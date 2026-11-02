/**
 * Database Service & Repository Layer (PostgreSQL / Supabase)
 * 
 * Provides:
 * 1. Fully ACID-compliant transaction processing for BUY, SELL, settlements, and refunds.
 * 2. Row-level concurrency locking (SELECT ... FOR UPDATE) to prevent race conditions and double-spending.
 * 3. Exact monetary precision (integer-cents rounding) matching double-entry accounting.
 * 4. Strict server-side role enforcement (Admins prohibited from trading, Users prohibited from resolving/creating).
 * 5. Full lifecycle and LMSR state synchronization.
 */

import crypto from 'crypto';
import { dbQuery, dbTransaction } from './db';
import { LMSREngine } from '../services/lmsrEngine';
import { MarketEngine } from '../services/marketEngine';
import { Money } from './money';
import { idempotencyManager } from './idempotency';
import { logger } from './logger';
import { realtimeService } from './realtimeService';
import {
  Market,
  Position,
  Trade,
  User,
  LeaderboardUser,
  Outcome,
  PlatformMetrics,
  NotificationItem,
  Category,
  MarketType,
  MarketStatus,
  Tournament,
  TournamentParticipant,
  UserTournamentParticipation,
  PricePoint,
} from '../types';
import { hashPassword, verifyPassword, normalizePhoneNumber, isValidPhoneNumber } from './migrate';

export interface StoredUserAccount extends User {
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerEntry {
  id: string;
  userId: string;
  userEmail: string;
  type: 'INITIAL_DEMO_CREDIT' | 'BUY' | 'SELL' | 'COMMISSION' | 'SETTLEMENT' | 'REFUND' | 'RESET_DEMO_CREDIT';
  amount: number;
  balanceAfter: number;
  marketId?: string;
  marketQuestion?: string;
  tradeId?: string;
  description: string;
  timestamp: string;
}

/**
 * Multi-resolution temporal bucketing and tiered compaction for market price curves.
 * 
 * Enforces:
 * - Same-second deduplication: Trades in the same second update the latest snapshot.
 * - < 1 hour: Full 1-second resolution.
 * - 1 hour to 24 hours: 5-minute candles/snapshots (closing price of each interval).
 * - 24 hours to 7 days: 30-minute snapshots.
 * - > 7 days: 2-hour snapshots.
 * - Genesis point (first inception point) and latest real-time point are ALWAYS strictly preserved.
 * - Hard safety cap of 250 points max to keep JSON payloads lightweight (< 20 KB) and SVG rendering at 60 FPS.
 */
export function compactPriceHistory(
  rawHistory: PricePoint[],
  newPoint: PricePoint,
  createdTimestamp?: number
): PricePoint[] {
  const now = newPoint.timestamp;
  const ONE_SEC = 1000;
  const ONE_HOUR = 3600 * 1000;
  const ONE_DAY = 24 * ONE_HOUR;
  const SEVEN_DAYS = 7 * ONE_DAY;

  const allPoints = [...rawHistory];

  // Ensure we anchor the opening genesis point if createdTimestamp is older than first point
  if (createdTimestamp && createdTimestamp < now - 1000) {
    if (allPoints.length === 0 || allPoints[0].timestamp > createdTimestamp + 1000) {
      allPoints.unshift({
        timestamp: createdTimestamp,
        timeLabel: new Date(createdTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        prices: { ...newPoint.prices },
        volume: 0,
      });
    }
  }

  // Deduplicate if previous trade occurred in the exact same second
  const last = allPoints[allPoints.length - 1];
  if (last && Math.abs(now - last.timestamp) < ONE_SEC) {
    allPoints[allPoints.length - 1] = newPoint;
  } else {
    allPoints.push(newPoint);
  }

  allPoints.sort((a, b) => a.timestamp - b.timestamp);

  // If under minimum compaction threshold, keep intact
  if (allPoints.length <= 40) {
    return allPoints;
  }

  const genesis = allPoints[0];
  const latest = allPoints[allPoints.length - 1];
  const middle = allPoints.slice(1, allPoints.length - 1);

  const compactedMiddle: PricePoint[] = [];
  const bucketMap = new Map<string, PricePoint>();

  for (const pt of middle) {
    const age = now - pt.timestamp;
    if (age <= ONE_HOUR) {
      // Full resolution for recent trades (< 1h)
      compactedMiddle.push(pt);
    } else if (age <= ONE_DAY) {
      // 5-minute bucket for 1h - 24h (closing snapshot)
      const bucketKey = `5m_${Math.floor(pt.timestamp / (5 * 60 * 1000))}`;
      bucketMap.set(bucketKey, pt);
    } else if (age <= SEVEN_DAYS) {
      // 30-minute bucket for 24h - 7d
      const bucketKey = `30m_${Math.floor(pt.timestamp / (30 * 60 * 1000))}`;
      bucketMap.set(bucketKey, pt);
    } else {
      // 2-hour bucket for older than 7d
      const bucketKey = `2h_${Math.floor(pt.timestamp / (2 * 3600 * 1000))}`;
      bucketMap.set(bucketKey, pt);
    }
  }

  const combined = [genesis, ...bucketMap.values(), ...compactedMiddle, latest];
  combined.sort((a, b) => a.timestamp - b.timestamp);

  const deduplicated: PricePoint[] = [];
  const seenTimestamps = new Set<number>();
  for (const pt of combined) {
    if (!seenTimestamps.has(pt.timestamp)) {
      seenTimestamps.add(pt.timestamp);
      deduplicated.push(pt);
    }
  }

  if (deduplicated.length > 250) {
    const step = Math.ceil(deduplicated.length / 200);
    const capped: PricePoint[] = [deduplicated[0]];
    for (let i = 1; i < deduplicated.length - 1; i += step) {
      capped.push(deduplicated[i]);
    }
    capped.push(deduplicated[deduplicated.length - 1]);
    return capped;
  }

  return deduplicated;
}

export class DatabaseService {
  private static instance: DatabaseService;

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  // =========================================================================
  // MAPPERS
  // =========================================================================

  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      username: row.username || undefined,
      name: row.name,
      email: row.email,
      phoneNumber: row.phone_number || undefined,
      role: row.role,
      virtualBalance: Money.round(Number(row.virtual_balance)),
      avatar: row.avatar || undefined,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    };
  }

  private mapRowToStoredUserAccount(row: any): StoredUserAccount {
    return {
      ...this.mapRowToUser(row),
      passwordHash: row.password_hash,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  private mapRowToMarket(mRow: any, outcomesRows: any[]): Market {
    const outcomes: Outcome[] = outcomesRows.map((o) => ({
      id: o.id,
      name: o.name,
      label: o.label || undefined,
      q: Number(o.q),
      currentPrice: Number(o.current_price),
      buyPrice: Number(o.buy_price),
      sellPrice: Number(o.sell_price),
      initialPrice: o.initial_price !== null && o.initial_price !== undefined ? Number(o.initial_price) : undefined,
      initialProbability: o.initial_probability !== null && o.initial_probability !== undefined ? Number(o.initial_probability) : undefined,
      initialQ: o.initial_q !== null && o.initial_q !== undefined ? Number(o.initial_q) : undefined,
      color: o.color || undefined,
      isWinner: !!o.is_winner,
    }));

    const priceHistory = typeof mRow.price_history === 'string'
      ? JSON.parse(mRow.price_history)
      : (mRow.price_history || []);

    const initialProbabilities = typeof mRow.initial_probabilities === 'string'
      ? JSON.parse(mRow.initial_probabilities)
      : (mRow.initial_probabilities || {});

    const initialQuantities = typeof mRow.initial_quantities === 'string'
      ? JSON.parse(mRow.initial_quantities)
      : (mRow.initial_quantities || {});

    const market: Market = {
      id: mRow.id,
      question: mRow.question,
      description: mRow.description || '',
      category: mRow.category,
      type: mRow.type,
      status: mRow.status,
      outcomes,
      closeTime: new Date(mRow.close_time).toISOString(),
      resolutionTime: new Date(mRow.resolution_time).toISOString(),
      resolutionSource: mRow.resolution_source || '',
      resolutionRules: mRow.resolution_rules || '',
      liquidityParameter: Number(mRow.liquidity_parameter),
      subsidyBudget: mRow.subsidy_budget !== null && mRow.subsidy_budget !== undefined ? Money.round(Number(mRow.subsidy_budget)) : undefined,
      commissionRate: Number(mRow.commission_rate),
      spread: Number(mRow.spread),
      volume: Money.round(Number(mRow.volume)),
      totalTraders: Number(mRow.total_traders || 0),
      totalTrades: Number(mRow.total_trades || 0),
      proposedOutcomeId: mRow.proposed_outcome_id || undefined,
      resolutionProof: mRow.resolution_proof || undefined,
      disputeDeadline: mRow.dispute_deadline ? new Date(mRow.dispute_deadline).toISOString() : undefined,
      disputedAt: mRow.disputed_at ? new Date(mRow.disputed_at).toISOString() : undefined,
      disputeReason: mRow.dispute_reason || undefined,
      winningOutcomeId: mRow.winning_outcome_id || undefined,
      resolvedOutcomeId: mRow.resolved_outcome_id || undefined,
      createdAt: new Date(mRow.created_at).toISOString(),
      priceHistory,
      tags: Array.isArray(mRow.tags) ? mRow.tags : [],
      initialProbabilities,
      initialQuantities,
      cumulativeLmsrCashFlow: Money.round(Number(mRow.cumulative_lmsr_cash_flow || 0)),
      totalCommissionRevenue: Money.round(Number(mRow.total_commission_revenue || 0)),
      totalSpreadRevenue: Money.round(Number(mRow.total_spread_revenue || 0)),
      settlementPayout: Money.round(Number(mRow.settlement_payout || 0)),
      realizedMMPnL: Money.round(Number(mRow.realized_mm_pnl || 0)),
      realizedPlatformResult: Money.round(Number(mRow.realized_platform_result || 0)),
      tournamentId: mRow.tournament_id || undefined,
    };

    return MarketEngine.syncMarketPrices(market);
  }

  private mapRowToPosition(row: any): Position {
    return {
      id: row.id,
      userId: row.user_id,
      marketId: row.market_id,
      marketQuestion: row.market_question,
      marketCategory: row.market_category,
      outcomeId: row.outcome_id,
      outcomeName: row.outcome_name,
      quantity: Number(row.quantity),
      averagePrice: Number(row.average_price),
      currentPrice: Number(row.current_price),
      currentCostBasis: Money.round(Number(row.current_cost_basis)),
      currentValue: Money.round(Number(row.current_value)),
      realizedPnL: Money.round(Number(row.realized_pnl)),
      unrealizedPnL: Money.round(Number(row.unrealized_pnl)),
      unrealizedPnLPercent: Number(row.unrealized_pnl_percent),
      status: row.status,
      tournamentId: row.tournament_id || undefined,
    };
  }

  private mapRowToTrade(row: any): Trade {
    return {
      id: row.id,
      userId: row.user_id,
      userName: row.user_name || undefined,
      marketId: row.market_id,
      marketQuestion: row.market_question,
      outcomeId: row.outcome_id,
      outcomeName: row.outcome_name,
      type: row.type,
      price: Number(row.price),
      quantity: Number(row.quantity),
      amount: Money.round(Number(row.amount)),
      fee: Money.round(Number(row.fee || 0)),
      spreadFee: Money.round(Number(row.spread_fee || 0)),
      lmsrCashFlow: Money.round(Number(row.lmsr_cash_flow || 0)),
      pnl: row.pnl !== null && row.pnl !== undefined ? Money.round(Number(row.pnl)) : undefined,
      status: row.status,
      timestamp: new Date(row.timestamp).toISOString(),
      tournamentId: row.tournament_id || undefined,
      isAnonymous: Boolean(row.is_anonymous),
    };
  }

  private mapRowToTournament(row: any, participantsCount: number = 0, marketsCount: number = 0): Tournament {
    return {
      id: row.id,
      title: row.title,
      description: row.description || '',
      prizePool: row.prize_pool || '',
      initialBalance: Money.round(Number(row.initial_balance || 1000)),
      status: row.status,
      startDate: new Date(row.start_date).toISOString(),
      endDate: new Date(row.end_date).toISOString(),
      categoryFilter: (row.category_filter as Category | 'ALL') || 'ALL',
      rules: row.rules || '',
      createdById: row.created_by_id || undefined,
      createdAt: new Date(row.created_at).toISOString(),
      participantsCount,
      marketsCount,
      winnerUserId: row.winner_user_id || undefined,
      winnerName: row.winner_name || undefined,
      winnerEquity: row.winner_equity ? Money.round(Number(row.winner_equity)) : undefined,
    };
  }

  private mapRowToLedger(row: any): LedgerEntry {
    return {
      id: row.id,
      userId: row.user_id,
      userEmail: row.user_email,
      type: row.type,
      amount: Money.round(Number(row.amount)),
      balanceAfter: Money.round(Number(row.balance_after)),
      marketId: row.market_id || undefined,
      marketQuestion: row.market_question || undefined,
      tradeId: row.trade_id || undefined,
      description: row.description,
      timestamp: new Date(row.timestamp).toISOString(),
    };
  }

  // =========================================================================
  // USER & AUTHENTICATION REPOSITORY
  // =========================================================================

  public async getUserAccountById(id: string): Promise<StoredUserAccount | null> {
    const res = await dbQuery('SELECT * FROM users WHERE id = $1;', [id]);
    if (res.rowCount === 0) return null;
    return this.mapRowToStoredUserAccount(res.rows[0]);
  }

  public async getUserById(id: string): Promise<User | null> {
    const account = await this.getUserAccountById(id);
    if (!account) return null;
    const { passwordHash, createdAt, updatedAt, ...safeUser } = account;
    return safeUser;
  }

  public async getUserByEmail(email: string): Promise<StoredUserAccount | null> {
    const res = await dbQuery('SELECT * FROM users WHERE LOWER(email) = LOWER($1);', [email.trim()]);
    if (res.rowCount === 0) return null;
    return this.mapRowToStoredUserAccount(res.rows[0]);
  }

  public async getUserByPhoneNumber(phone: string): Promise<StoredUserAccount | null> {
    if (!phone) return null;
    const clean = normalizePhoneNumber(phone);
    if (!clean) return null;
    const with51 = clean.startsWith('+51') ? clean : `+51${clean.replace(/^\+/, '')}`;
    const without51 = clean.replace(/^\+?51/, '');
    const res = await dbQuery(
      'SELECT * FROM users WHERE phone_number = $1 OR phone_number = $2 OR phone_number = $3;',
      [clean, with51, without51]
    );
    if (res.rowCount === 0) return null;
    return this.mapRowToStoredUserAccount(res.rows[0]);
  }

  public async getUserByUsernameOrEmail(identifier: string): Promise<StoredUserAccount | null> {
    if (!identifier) return null;
    const clean = identifier.trim().toLowerCase();
    const cleanPhone = normalizePhoneNumber(identifier);
    const with51 = cleanPhone ? (cleanPhone.startsWith('+51') ? cleanPhone : `+51${cleanPhone.replace(/^\+/, '')}`) : '';
    const without51 = cleanPhone ? cleanPhone.replace(/^\+?51/, '') : '';
    const res = await dbQuery(
      `SELECT * FROM users 
       WHERE LOWER(username) = $1 
          OR LOWER(email) = $1 
          OR (phone_number IS NOT NULL AND $2 != '' AND (phone_number = $2 OR phone_number = $3 OR phone_number = $4));`,
      [clean, cleanPhone, with51, without51]
    );
    if (res.rowCount === 0) return null;
    return this.mapRowToStoredUserAccount(res.rows[0]);
  }

  public async getUsers(): Promise<User[]> {
    const res = await dbQuery('SELECT * FROM users ORDER BY created_at DESC;');
    return res.rows.map((row) => this.mapRowToUser(row));
  }

  public async createSession(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000); // 7 days

    await dbQuery(
      `INSERT INTO sessions (token, user_id, created_at, expires_at)
       VALUES ($1, $2, NOW(), $3);`,
      [token, userId, expiresAt.toISOString()]
    );

    return token;
  }

  public async getUserBySessionToken(token: string): Promise<StoredUserAccount | null> {
    if (!token) return null;
    const res = await dbQuery(
      `SELECT u.* FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = $1 AND s.expires_at > NOW();`,
      [token]
    );
    if (res.rowCount === 0) return null;
    return this.mapRowToStoredUserAccount(res.rows[0]);
  }

  public async revokeSession(token: string): Promise<void> {
    await dbQuery('DELETE FROM sessions WHERE token = $1;', [token]);
  }

  public async authenticate(identifier: string, password?: string, adminPin?: string): Promise<{ user: User; token: string }> {
    if (!identifier || typeof identifier !== 'string' || identifier.trim().length === 0) {
      throw new Error('Username or email address is required.');
    }
    if (!password || typeof password !== 'string' || password.trim().length === 0) {
      throw new Error('Password is required.');
    }

    const account = await this.getUserByUsernameOrEmail(identifier);
    if (!account) {
      throw new Error('User account not found. Please verify your credentials.');
    }

    if (!verifyPassword(password, account.passwordHash)) {
      throw new Error('Invalid credentials. Please verify your password.');
    }

    if (account.role === 'admin') {
      const masterPin = process.env.ADMIN_MASTER_PIN;
      if (masterPin) {
        if (!adminPin || typeof adminPin !== 'string' || adminPin.trim().length === 0) {
          throw new Error('Administrator master PIN is required.');
        }
        const bufA = Buffer.from(adminPin.trim());
        const bufB = Buffer.from(masterPin.trim());
        if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
          throw new Error('Invalid administrator master PIN.');
        }
      }
    }

    const token = await this.createSession(account.id);
    const { passwordHash, createdAt, updatedAt, ...safeUser } = account;
    return { user: safeUser, token };
  }

  public async register(
    username: string,
    password: string,
    name?: string,
    email?: string,
    phoneNumber?: string
  ): Promise<{ user: User; token: string }> {
    const cleanUsername = (username || '').trim();
    const cleanPassword = (password || '').trim();
    const cleanName = (name || '').trim() || cleanUsername;
    const cleanEmail = (email || '').trim().toLowerCase() || `${cleanUsername.toLowerCase()}@centra.internal`;

    if (!cleanUsername || cleanUsername.length < 3) {
      throw new Error('Username must be at least 3 characters long.');
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
      throw new Error('Username can only contain letters, numbers, underscores, dashes, and periods.');
    }

    if (!cleanPassword || cleanPassword.length === 0) {
      throw new Error('Password is required.');
    }

    let finalPhone: string;
    if (!phoneNumber || typeof phoneNumber !== 'string' || phoneNumber.trim().length === 0) {
      if (arguments.length <= 3 && !process.env.ADMIN_MASTER_PIN) {
        finalPhone = `+1555${Math.floor(10000000 + Math.random() * 90000000)}`;
      } else {
        throw new Error('A valid phone number is required for registration.');
      }
    } else {
      if (!isValidPhoneNumber(phoneNumber)) {
        throw new Error('Invalid phone number: must be a valid international phone number with at least 8 digits.');
      }
      finalPhone = normalizePhoneNumber(phoneNumber);
    }

    const existing = await this.getUserByUsernameOrEmail(cleanUsername);
    if (existing) {
      throw new Error(`An account with username "${cleanUsername}" already exists.`);
    }

    const existingEmail = await this.getUserByEmail(cleanEmail);
    if (existingEmail) {
      throw new Error(`An account with this email/alias already exists.`);
    }

    const existingPhone = await this.getUserByPhoneNumber(finalPhone);
    if (existingPhone) {
      throw new Error(`Este número de celular ya está registrado por otro usuario. (Phone number is already registered by another account.)`);
    }

    const userId = `usr-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const initialBalance = 0.0; // Base user starts with $0.00 until joining a tournament
    const pHash = hashPassword(cleanPassword);
    const avatar = null; // No external fake profile photos
    const now = new Date().toISOString();

    await dbTransaction(async (client) => {
      await client.query(
        `INSERT INTO users (id, username, name, email, phone_number, role, password_hash, virtual_balance, avatar, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'user', $6, $7, $8, $9, $9);`,
        [userId, cleanUsername.toLowerCase(), cleanName, cleanEmail.toLowerCase(), finalPhone, pHash, initialBalance, avatar, now]
      );

      await client.query(
        `INSERT INTO ledger_transactions (id, user_id, user_email, type, amount, balance_after, description, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
        [
          `ledg-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          userId,
          cleanEmail.toLowerCase(),
          'INITIAL_DEMO_CREDIT',
          0,
          0,
          'Account initialized with base $0.00 balance',
          now,
        ]
      );
    });

    return this.authenticate(cleanUsername, cleanPassword);
  }

  public async authenticateOrRegisterByPhone(
    phoneNumber: string,
    username?: string,
    alias?: string
  ): Promise<{ user: User; token: string; isNew: boolean }> {
    const cleanPhone = normalizePhoneNumber(phoneNumber);
    if (!cleanPhone || !isValidPhoneNumber(cleanPhone)) {
      throw new Error('Número de teléfono celular inválido. Debe contener 9 dígitos.');
    }

    const cleanUsernameInput = (username || '').trim();
    const cleanAliasInput = (alias || '').trim();

    // Check if user already exists with this phone number
    const existing = await this.getUserByPhoneNumber(cleanPhone);
    if (existing) {
      if (cleanAliasInput && (!existing.name || existing.name.startsWith('Trader '))) {
        await dbQuery(`UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2;`, [cleanAliasInput, existing.id]);
        existing.name = cleanAliasInput;
      }
      const token = await this.createSession(existing.id);
      const { passwordHash, createdAt, updatedAt, ...safeUser } = existing;
      return { user: safeUser, token, isNew: false };
    }

    // Check if user already exists with this username (if provided)
    if (cleanUsernameInput) {
      const existingByUsername = await this.getUserByUsernameOrEmail(cleanUsernameInput);
      if (existingByUsername) {
        const token = await this.createSession(existingByUsername.id);
        const { passwordHash, createdAt, updatedAt, ...safeUser } = existingByUsername;
        return { user: safeUser, token, isNew: false };
      }
    }

    // Auto-generate profile details for new beta participant
    const digitsOnly = cleanPhone.replace(/\D/g, '');
    const suffix = digitsOnly.slice(-4) || Math.floor(1000 + Math.random() * 9000).toString();
    
    let chosenUsername = cleanUsernameInput 
      ? cleanUsernameInput.toLowerCase().replace(/[^a-z0-9_.-]/g, '_')
      : `trader_${suffix}`;
    
    if (chosenUsername.length < 3) {
      chosenUsername = `trader_${suffix}`;
    }
    
    // Check collision for username
    const existingWithUser = await this.getUserByUsernameOrEmail(chosenUsername);
    if (existingWithUser) {
      chosenUsername = `${chosenUsername}_${crypto.randomBytes(2).toString('hex')}`;
    }

    const defaultName = cleanAliasInput || cleanUsernameInput || `Trader ${suffix}`;
    const userId = `usr-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const initialBalance = 0.0;
    const dummyPassword = crypto.randomBytes(16).toString('hex');
    const pHash = hashPassword(dummyPassword);
    const cleanEmail = `${chosenUsername}@centra.internal`;
    const now = new Date().toISOString();

    await dbTransaction(async (client) => {
      await client.query(
        `INSERT INTO users (id, username, name, email, phone_number, role, password_hash, virtual_balance, avatar, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'user', $6, $7, null, $8, $8);`,
        [userId, chosenUsername.toLowerCase(), defaultName, cleanEmail.toLowerCase(), cleanPhone, pHash, initialBalance, now]
      );

      await client.query(
        `INSERT INTO ledger_transactions (id, user_id, user_email, type, amount, balance_after, description, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
        [
          `ledg-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          userId,
          cleanEmail.toLowerCase(),
          'INITIAL_DEMO_CREDIT',
          0,
          0,
          'Account initialized with base $0.00 balance (Phone Registration)',
          now,
        ]
      );
    });

    const token = await this.createSession(userId);
    const safeUser: User = {
      id: userId,
      username: chosenUsername,
      name: defaultName,
      email: cleanEmail,
      phoneNumber: cleanPhone,
      role: 'user',
      virtualBalance: initialBalance,
      createdAt: now,
    };

    return { user: safeUser, token, isNew: true };
  }

  public async switchUserRole(userId: string, newRole: 'user' | 'admin'): Promise<User> {
    if (newRole === 'admin') {
      throw new Error('Forbidden: Self-elevation or role promotion to administrator is prohibited.');
    }
    const res = await dbQuery(
      `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING *;`,
      [newRole, userId]
    );
    if (res.rowCount === 0) {
      throw new Error('User not found.');
    }
    const safeUser = this.mapRowToUser(res.rows[0]);
    realtimeService.emitToUser(userId, 'user:updated', safeUser);
    return safeUser;
  }

  // =========================================================================
  // MARKETS REPOSITORY
  // =========================================================================

  public async getMarkets(): Promise<Market[]> {
    const marketsRes = await dbQuery('SELECT * FROM markets ORDER BY created_at DESC;');
    const outcomesRes = await dbQuery('SELECT * FROM market_outcomes ORDER BY display_order ASC;');

    const outcomesByMarket = new Map<string, any[]>();
    for (const o of outcomesRes.rows) {
      if (!outcomesByMarket.has(o.market_id)) {
        outcomesByMarket.set(o.market_id, []);
      }
      outcomesByMarket.get(o.market_id)!.push(o);
    }

    return marketsRes.rows.map((mRow) => {
      const oRows = outcomesByMarket.get(mRow.id) || [];
      return this.mapRowToMarket(mRow, oRows);
    });
  }

  public async getMarket(id: string): Promise<Market | null> {
    const mRes = await dbQuery('SELECT * FROM markets WHERE id = $1;', [id]);
    if (mRes.rowCount === 0) return null;
    const oRes = await dbQuery('SELECT * FROM market_outcomes WHERE market_id = $1 ORDER BY display_order ASC;', [id]);
    return this.mapRowToMarket(mRes.rows[0], oRes.rows);
  }

  public async createMarket(
    marketData: Partial<Omit<Market, 'outcomes'>> & { outcomes?: Partial<Outcome>[] },
    creatorId: string
  ): Promise<Market> {
    const creator = await this.getUserAccountById(creatorId);
    if (!creator || creator.role !== 'admin') {
      throw new Error('Unauthorized: Only platform administrators can create markets.');
    }

    const marketId = marketData.id || `mkt-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const question = (marketData.question || '').trim();
    if (!question) throw new Error('Market question is required.');

    const category = marketData.category || 'Other';
    const type = marketData.type || 'binary';
    let subsidyBudget = marketData.subsidyBudget !== undefined && marketData.subsidyBudget !== null
      ? Number(marketData.subsidyBudget)
      : undefined;
    let liquidityParameter = Number(marketData.liquidityParameter || 100);
    const commissionRate = Number(marketData.commissionRate || 0.01);
    const spread = Number(marketData.spread || 0.015);
    const closeTime = marketData.closeTime || new Date(Date.now() + 86400000 * 30).toISOString();
    const resolutionTime = marketData.resolutionTime || new Date(Date.now() + 86400000 * 31).toISOString();

    // Pre-calculate LMSR states for outcomes using normalized probabilities
    const rawOutcomes = (marketData.outcomes && marketData.outcomes.length >= 2
      ? marketData.outcomes
      : [
          { id: 'yes', name: 'YES', initialProbability: 0.5 },
          { id: 'no', name: 'NO', initialProbability: 0.5 },
        ]
    );

    const targetProbs: Record<string, number> = {};
    for (let i = 0; i < rawOutcomes.length; i++) {
      const o = rawOutcomes[i];
      const outcomeId = o.id || o.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || `outcome-${i + 1}`;
      targetProbs[outcomeId] = Number(o.initialProbability ?? 1 / rawOutcomes.length);
    }

    if (subsidyBudget && subsidyBudget > 0 && !marketData.liquidityParameter) {
      liquidityParameter = LMSREngine.calculateBFromSubsidy(subsidyBudget, targetProbs);
    } else if (subsidyBudget === undefined || subsidyBudget === null) {
      subsidyBudget = LMSREngine.calculateMaxLoss(liquidityParameter, targetProbs);
    }

    const initialQuantities = LMSREngine.calculateInitialQuantities(targetProbs, liquidityParameter);
    const initialPrices = LMSREngine.calculatePrices(initialQuantities, liquidityParameter);

    const processedOutcomes = rawOutcomes.map((o: any, i: number) => {
      const outcomeId = o.id || o.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || `outcome-${i + 1}`;
      const q = initialQuantities[outcomeId] ?? 0;
      const p = initialPrices[outcomeId] ?? (1 / rawOutcomes.length);
      const spreadInfo = LMSREngine.getSpreadPrices(p, spread);

      return {
        ...o,
        id: outcomeId,
        initialProbability: p,
        q: q,
        currentPrice: p,
        buyPrice: spreadInfo.buy,
        sellPrice: spreadInfo.sell,
      };
    });

    const nowTs = Date.now();
    const genesisPrices: Record<string, number> = {};
    for (const o of processedOutcomes) {
      genesisPrices[o.id] = o.currentPrice;
    }
    const genesisHistory: PricePoint[] = [
      {
        timestamp: nowTs,
        timeLabel: new Date(nowTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        prices: genesisPrices,
        volume: 0,
      },
    ];

    await dbTransaction(async (client) => {
      await client.query(
        `INSERT INTO markets (
           id, question, description, category, type, status,
           close_time, resolution_time, resolution_source, resolution_rules,
           liquidity_parameter, subsidy_budget, commission_rate, spread, volume, total_traders,
           total_trades, created_at, price_history, tags, tournament_id
         ) VALUES ($1, $2, $3, $4, $5, 'open', $6, $7, $8, $9, $10, $11, $12, $13, 0, 0, 0, NOW(), $14, $15, $16);`,
        [
          marketId,
          question,
          marketData.description || '',
          category,
          type,
          closeTime,
          resolutionTime,
          marketData.resolutionSource || '',
          marketData.resolutionRules || '',
          liquidityParameter,
          subsidyBudget !== undefined ? subsidyBudget : null,
          commissionRate,
          spread,
          JSON.stringify(genesisHistory),
          marketData.tags || [],
          marketData.tournamentId || null,
        ]
      );

      if (marketData.tournamentId) {
        await client.query(
          `INSERT INTO tournament_markets (tournament_id, market_id, created_at)
           VALUES ($1, $2, NOW());`,
          [marketData.tournamentId, marketId]
        );
      }

      for (let i = 0; i < processedOutcomes.length; i++) {
        const o = processedOutcomes[i];
        const outcomeId = o.id || o.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || `outcome-${i + 1}`;
        await client.query(
          `INSERT INTO market_outcomes (
             market_id, id, name, label, q, initial_q, current_price,
             buy_price, sell_price, initial_price, initial_probability, color, display_order
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);`,
          [
            marketId,
            outcomeId,
            o.name || `Outcome ${i + 1}`,
            o.label || null,
            o.q,
            o.q,
            o.currentPrice,
            o.buyPrice,
            o.sellPrice,
            o.currentPrice,
            o.initialProbability,
            o.color || null,
            i,
          ]
        );
      }
    });

    const market = (await this.getMarket(marketId))!;
    try {
      realtimeService.broadcast('market:update', { market, action: 'created' });
      realtimeService.broadcast('market:created', market);
      realtimeService.broadcastToAdmins('admin:update', { type: 'market_created', marketId });
    } catch (broadcastErr) {
      console.warn('Realtime broadcast skipped on market creation:', broadcastErr);
    }
    return market;
  }

  public async updateMarket(id: string, updates: Partial<Market>, adminUserId: string): Promise<Market> {
    const admin = await this.getUserAccountById(adminUserId);
    if (!admin || admin.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators can modify market parameters.');
    }

    const current = await this.getMarket(id);
    if (!current) throw new Error(`Market "${id}" not found.`);

    const closeTime = updates.closeTime || (updates as any).close_time || (updates as any).closeDate;
    const resolutionTime = updates.resolutionTime || (updates as any).resolution_time || (updates as any).resolutionDate;

    await dbTransaction(async (client) => {
      await client.query(
        `UPDATE markets SET
           question = COALESCE($1, question),
           description = COALESCE($2, description),
           category = COALESCE($3, category),
           status = COALESCE($4, status),
           close_time = COALESCE($5, close_time),
           resolution_time = COALESCE($6, resolution_time),
           resolution_source = COALESCE($7, resolution_source),
           resolution_rules = COALESCE($8, resolution_rules),
           liquidity_parameter = COALESCE($9, liquidity_parameter),
           commission_rate = COALESCE($10, commission_rate),
           spread = COALESCE($11, spread)
         WHERE id = $12;`,
        [
          updates.question || null,
          updates.description !== undefined ? updates.description : null,
          updates.category || null,
          updates.status || null,
          closeTime || null,
          resolutionTime || null,
          updates.resolutionSource || null,
          updates.resolutionRules !== undefined ? updates.resolutionRules : null,
          updates.liquidityParameter || null,
          updates.commissionRate || null,
          updates.spread || null,
          id,
        ]
      );

      // If pre-trading and outcomesUpdates provided, update outcomes
      if (Array.isArray((updates as any).outcomesUpdates) && (updates as any).outcomesUpdates.length > 0) {
        for (const ou of (updates as any).outcomesUpdates) {
          if (ou.id) {
            await client.query(
              `UPDATE market_outcomes SET
                 name = COALESCE($1, name),
                 color = COALESCE($2, color),
                 initial_probability = COALESCE($3, initial_probability)
               WHERE market_id = $4 AND id = $5;`,
              [
                ou.name || null,
                ou.color || null,
                ou.initialProbability !== undefined && ou.initialProbability !== null ? ou.initialProbability : null,
                id,
                ou.id,
              ]
            );
          }
        }
      }
    });

    const updated = (await this.getMarket(id))!;
    realtimeService.broadcast('market:update', { market: updated, action: 'updated' });
    realtimeService.broadcast('market:updated', updated);
    realtimeService.broadcastToAdmins('admin:update', { type: 'market_updated', marketId: id });
    return updated;
  }

  public async deleteMarket(id: string, adminUserId: string): Promise<void> {
    const admin = await this.getUserAccountById(adminUserId);
    if (!admin || admin.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators can delete markets.');
    }

    await dbTransaction(async (client) => {
      // 1. Guard against deleting active markets with user funds/open positions
      const openPosRes = await client.query(
        "SELECT COUNT(*) AS count FROM positions WHERE market_id = $1 AND status = 'OPEN' AND quantity > 0;",
        [id]
      );
      const openCount = Number(openPosRes.rows[0]?.count || 0);
      if (openCount > 0) {
        throw new Error(
          `Cannot delete market with ${openCount} open position(s). Please cancel or resolve the market first so all user funds are properly settled or refunded.`
        );
      }

      // 2. Disassociate financial ledger transactions instead of deleting them to preserve auditability
      await client.query('UPDATE ledger_transactions SET market_id = NULL WHERE market_id = $1;', [id]);
      
      // 3. Delete settlement records tied to this market
      await client.query('DELETE FROM settlements WHERE market_id = $1;', [id]);
      
      // 4. Delete trades
      await client.query('DELETE FROM trades WHERE market_id = $1;', [id]);
      
      // 5. Delete closed/settled positions
      await client.query('DELETE FROM positions WHERE market_id = $1;', [id]);
      
      // 6. Delete outcomes
      await client.query('DELETE FROM market_outcomes WHERE market_id = $1;', [id]);
      
      // 7. Finally, delete the market itself
      await client.query('DELETE FROM markets WHERE id = $1;', [id]);
    });

    try {
      realtimeService.broadcast('market:deleted', { marketId: id, id });
      realtimeService.broadcastToAdmins('admin:update', { type: 'market_deleted', marketId: id });
    } catch (err) {
      console.warn('Legacy broadcast skipped during deletion');
    }
  }

  // =========================================================================
  // POSITIONS, TRADES & LEDGER REPOSITORY
  // =========================================================================

  public async getPositions(userId?: string): Promise<Position[]> {
    let sql = 'SELECT * FROM positions';
    const params: any[] = [];
    if (userId) {
      sql += ' WHERE user_id = $1';
      params.push(userId);
    }
    sql += ' ORDER BY created_at DESC;';

    const res = await dbQuery(sql, params);
    const positions = res.rows.map((r) => this.mapRowToPosition(r));

    // Update open positions valuation against live market price
    const markets = await this.getMarkets();
    const marketsMap = new Map(markets.map((m) => [m.id, m]));

    return positions.map((pos) => {
      if (pos.status === 'OPEN') {
        const m = marketsMap.get(pos.marketId);
        if (m) {
          const outcome = m.outcomes.find((o) => o.id === pos.outcomeId);
          if (outcome) {
            return MarketEngine.updatePositionValuation(pos, outcome.currentPrice);
          }
        }
      }
      return pos;
    });
  }

  public async getTrades(userId?: string): Promise<Trade[]> {
    let sql = 'SELECT * FROM trades';
    const params: any[] = [];
    if (userId) {
      sql += ' WHERE user_id = $1';
      params.push(userId);
    }
    sql += ' ORDER BY timestamp DESC LIMIT 200;';

    const res = await dbQuery(sql, params);
    return res.rows.map((r) => this.mapRowToTrade(r));
  }

  public async getPublicTrades(marketId?: string): Promise<Partial<Trade>[]> {
    let sql = 'SELECT * FROM trades';
    const params: any[] = [];
    if (marketId) {
      sql += ' WHERE market_id = $1';
      params.push(marketId);
    }
    sql += ' ORDER BY timestamp DESC LIMIT 50;';

    const res = await dbQuery(sql, params);
    return res.rows.map((r) => {
      const t = this.mapRowToTrade(r);
      const isAnon = Boolean(t.isAnonymous);
      return {
        id: t.id,
        userId: isAnon ? 'anon' : t.userId,
        userName: isAnon ? 'Trader Anónimo' : t.userName,
        isAnonymous: isAnon,
        marketId: t.marketId,
        marketQuestion: t.marketQuestion,
        outcomeId: t.outcomeId,
        outcomeName: t.outcomeName,
        type: t.type,
        price: t.price,
        quantity: t.quantity,
        amount: t.amount,
        status: t.status,
        timestamp: t.timestamp,
      };
    });
  }

  public async getLedger(userId?: string): Promise<LedgerEntry[]> {
    let sql = 'SELECT * FROM ledger_transactions';
    const params: any[] = [];
    if (userId) {
      sql += ' WHERE user_id = $1';
      params.push(userId);
    }
    sql += ' ORDER BY timestamp DESC LIMIT 300;';

    const res = await dbQuery(sql, params);
    return res.rows.map((r) => this.mapRowToLedger(r));
  }

  public async getLeaderboard(): Promise<LeaderboardUser[]> {
    const usersRes = await dbQuery('SELECT id, username, name, email, role, virtual_balance, avatar FROM users;');
    const allPositions = await this.getPositions();
    const allTrades = await this.getTrades();

    const userEquityMap = new Map<string, { openValue: number; wins: number }>();
    for (const pos of allPositions) {
      const current = userEquityMap.get(pos.userId) || { openValue: 0, wins: 0 };
      if (pos.status === 'OPEN') {
        current.openValue = Money.add(current.openValue, pos.currentValue);
      } else if (pos.status === 'SETTLED_WIN') {
        current.wins += 1;
      }
      userEquityMap.set(pos.userId, current);
    }

    const userTradesCount = new Map<string, number>();
    for (const tr of allTrades) {
      const cnt = userTradesCount.get(tr.userId) || 0;
      userTradesCount.set(tr.userId, cnt + 1);
    }

    const leaderboard: LeaderboardUser[] = usersRes.rows.map((r: any) => {
      const user = this.mapRowToUser(r);
      const metrics = userEquityMap.get(user.id) || { openValue: 0, wins: 0 };
      const tradesCount = userTradesCount.get(user.id) || 0;
      const virtualBalance = user.virtualBalance;
      const openPositionsValue = Money.round(metrics.openValue);
      const totalEquity = Money.round(Money.add(virtualBalance, openPositionsValue));
      const initialDeposit = 1000.0;
      const totalPnl = Money.round(Money.subtract(totalEquity, initialDeposit));
      const roiPercent = Number((((totalEquity - initialDeposit) / initialDeposit) * 100).toFixed(2));
      const winsCount = metrics.wins;
      const winRate = tradesCount > 0 ? Number(((winsCount / tradesCount) * 100).toFixed(1)) : 0;

      return {
        id: user.id,
        username: user.username || user.name || user.email.split('@')[0],
        name: user.name,
        avatar: user.avatar,
        virtualBalance,
        openPositionsValue,
        totalEquity,
        totalPnl,
        roiPercent,
        tradesCount,
        winsCount,
        winRate,
      };
    });

    leaderboard.sort((a, b) => b.totalEquity - a.totalEquity);

    leaderboard.forEach((u, idx) => {
      u.rank = idx + 1;
    });

    return leaderboard;
  }

  public async getPlatformMetrics(): Promise<PlatformMetrics> {
    const [usersRes, activeUsersRes, marketsRes, resolvedRes, volRes, capRes, expRes] = await Promise.all([
      dbQuery('SELECT COUNT(*) AS count FROM users;'),
      dbQuery(`SELECT COUNT(DISTINCT user_id) AS count FROM (
        SELECT user_id FROM positions WHERE quantity > 0
        UNION
        SELECT user_id FROM trades
      ) t;`),
      dbQuery('SELECT COUNT(*) AS count FROM markets WHERE status = \'open\';'),
      dbQuery('SELECT COUNT(*) AS count FROM markets WHERE status = \'resolved\';'),
      dbQuery('SELECT SUM(volume) AS total_vol, SUM(total_commission_revenue) AS comm, SUM(total_spread_revenue) AS sprd FROM markets;'),
      dbQuery('SELECT SUM(virtual_balance) AS balance FROM users;'),
      dbQuery('SELECT SUM(current_cost_basis) AS exposure FROM positions WHERE status = \'OPEN\';'),
    ]);

    const totalVolume = Money.round(Number(volRes.rows[0]?.total_vol || 0));
    const commissionRevenue = Money.round(Number(volRes.rows[0]?.comm || 0));
    const spreadRevenue = Money.round(Number(volRes.rows[0]?.sprd || 0));
    const totalRevenue = Money.add(commissionRevenue, spreadRevenue);

    return {
      totalUsers: Number(usersRes.rows[0]?.count || 0),
      activeUsers: Number(activeUsersRes.rows[0]?.count || 0),
      activeMarkets: Number(marketsRes.rows[0]?.count || 0),
      totalVolume,
      totalRevenue,
      netRevenue: totalRevenue,
      commissionRevenue,
      spreadRevenue,
      totalVirtualCapital: Money.round(Number(capRes.rows[0]?.balance || 0)),
      openExposure: Money.round(Number(expRes.rows[0]?.exposure || 0)),
      resolvedMarkets: Number(resolvedRes.rows[0]?.count || 0),
    };
  }

  /**
   * Centralized Market Maker (House) Solvency and Liability Audit
   * Computes exact house risk, user custody balances, escrow, and double-entry ledger balance.
   */
  public async getHouseSolvencyAudit(): Promise<{
    timestamp: string;
    totalUserBalances: number;
    totalOpenLMSRCashFlow: number;
    totalCommissionRevenue: number;
    totalSpreadRevenue: number;
    totalPlatformRevenue: number;
    maxTheoreticalLMSRSubsidy: number;
    maxPotentialSettlementPayout: number;
    houseExposure: number;
    ledgerIntegrity: {
      totalCreditsAndDebits: number;
      userBalanceSum: number;
      difference: number;
      isBalanced: boolean;
    };
    solvencyStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  }> {
    const [
      usersBalRes,
      ledgerSumRes,
      openMarketsRes,
      marketOutcomesCountRes,
      openPositionsRes,
    ] = await Promise.all([
      dbQuery('SELECT COALESCE(SUM(virtual_balance), 0) AS total FROM users;'),
      dbQuery('SELECT COALESCE(SUM(amount), 0) AS total FROM ledger_transactions;'),
      dbQuery(
        `SELECT
           COALESCE(SUM(cumulative_lmsr_cash_flow), 0) AS cash_flow,
           COALESCE(SUM(total_commission_revenue), 0) AS comm,
           COALESCE(SUM(total_spread_revenue), 0) AS sprd
         FROM markets;`
      ),
      dbQuery(
        `SELECT m.id, m.liquidity_parameter, COUNT(o.id) AS num_outcomes
         FROM markets m
         JOIN market_outcomes o ON m.id = o.market_id
         WHERE m.status = 'open'
         GROUP BY m.id, m.liquidity_parameter;`
      ),
      dbQuery(
        `SELECT market_id, outcome_id, COALESCE(SUM(quantity), 0) AS outcome_shares
         FROM positions
         WHERE status = 'OPEN'
         GROUP BY market_id, outcome_id;`
      ),
    ]);

    const totalUserBalances = Money.round(Number(usersBalRes.rows[0]?.total || 0));
    const totalCreditsAndDebits = Money.round(Number(ledgerSumRes.rows[0]?.total || 0));
    const diff = Money.subtract(totalUserBalances, totalCreditsAndDebits);
    const isBalanced = Math.abs(diff) < 0.05;

    const totalOpenLMSRCashFlow = Money.round(Number(openMarketsRes.rows[0]?.cash_flow || 0));
    const totalCommissionRevenue = Money.round(Number(openMarketsRes.rows[0]?.comm || 0));
    const totalSpreadRevenue = Money.round(Number(openMarketsRes.rows[0]?.sprd || 0));
    const totalPlatformRevenue = Money.add(totalCommissionRevenue, totalSpreadRevenue);

    // Theoretical maximum subsidy for open markets: sum(b * ln(N))
    let maxTheoreticalLMSRSubsidy = 0;
    for (const r of marketOutcomesCountRes.rows) {
      const b = Number(r.liquidity_parameter || 100);
      const n = Math.max(2, Number(r.num_outcomes || 2));
      const marketMaxLoss = b * Math.log(n);
      maxTheoreticalLMSRSubsidy = Money.add(maxTheoreticalLMSRSubsidy, Money.round(marketMaxLoss));
    }

    // Maximum potential settlement payout across open markets: sum_m(max_k(shares_k) * $1.00)
    const marketSharesMap: Record<string, number> = {};
    for (const p of openPositionsRes.rows) {
      const mId = p.market_id;
      const sh = Number(p.outcome_shares || 0);
      marketSharesMap[mId] = Math.max(marketSharesMap[mId] || 0, sh);
    }

    let maxPotentialSettlementPayout = 0;
    for (const mId of Object.keys(marketSharesMap)) {
      maxPotentialSettlementPayout = Money.add(
        maxPotentialSettlementPayout,
        Money.round(marketSharesMap[mId] * 1.0)
      );
    }

    const houseExposure = Math.max(
      0,
      Money.subtract(maxPotentialSettlementPayout, totalOpenLMSRCashFlow)
    );

    let solvencyStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
    if (!isBalanced) {
      solvencyStatus = 'CRITICAL';
    } else if (houseExposure > totalPlatformRevenue + 100000) {
      solvencyStatus = 'WARNING';
    }

    return {
      timestamp: new Date().toISOString(),
      totalUserBalances,
      totalOpenLMSRCashFlow,
      totalCommissionRevenue,
      totalSpreadRevenue,
      totalPlatformRevenue,
      maxTheoreticalLMSRSubsidy,
      maxPotentialSettlementPayout,
      houseExposure,
      ledgerIntegrity: {
        totalCreditsAndDebits,
        userBalanceSum: totalUserBalances,
        difference: diff,
        isBalanced,
      },
      solvencyStatus,
    };
  }

  // =========================================================================
  // ATOMIC TRANSACTIONS (BUY, SELL, SETTLEMENT, REFUND)
  // =========================================================================

  /**
   * ATOMIC TRADE EXECUTION (BUY / SELL)
   * Protected by PostgreSQL Transaction and Row-Level Locks (SELECT ... FOR UPDATE)
   */
  public async executeTrade(params: {
    userId: string;
    marketId: string;
    outcomeId: string;
    type: 'BUY' | 'SELL';
    amountOrShares: number;
    idempotencyKey?: string;
    isAnonymous?: boolean;
  }): Promise<{ trade: Trade; updatedUser: User; updatedMarket: Market; updatedPosition: Position }> {
    // 1. Idempotency validation
    if (params.idempotencyKey) {
      const idemp = idempotencyManager.check(params.idempotencyKey, params.userId);
      if (idemp.isDuplicate) {
        if (idemp.cached) return idemp.cached as any;
        if (idemp.pending) {
          throw new Error('A trade with this request key is already processing. Please wait.');
        }
      }
      idempotencyManager.recordPending(params.idempotencyKey, params.userId);
    }

    try {
      const transactionResult = await dbTransaction(async (client) => {
        // A. Lock Market Row first (Enforces global lock hierarchy: markets -> outcomes -> positions -> users)
        const marketRes = await client.query('SELECT * FROM markets WHERE id = $1 FOR UPDATE;', [params.marketId]);
        if (marketRes.rowCount === 0) {
          throw new Error(`Market "${params.marketId}" not found.`);
        }
        const marketRow = marketRes.rows[0];
        if (marketRow.status !== 'open') {
          throw new Error(`Trading is disabled. Market status is ${marketRow.status.toUpperCase()}.`);
        }

        if (marketRow.close_time && new Date(marketRow.close_time).getTime() <= Date.now()) {
          await client.query('UPDATE markets SET status = \'closed\' WHERE id = $1;', [params.marketId]);
          throw new Error('Trading has closed for this market (close deadline passed).');
        }

        // B. Lock User Row
        const userRes = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE;', [params.userId]);
        if (userRes.rowCount === 0) {
          throw new Error('Unauthorized: User account not found.');
        }
        const userRow = userRes.rows[0];
        if (userRow.role === 'admin') {
          throw new Error('Platform Integrity: Administrator accounts are strictly prohibited from placing trades.');
        }

        // C. Lock Market Outcomes Rows
        const outcomesRes = await client.query(
          'SELECT * FROM market_outcomes WHERE market_id = $1 ORDER BY display_order ASC FOR UPDATE;',
          [params.marketId]
        );
        const targetOutcome = (params.outcomeId || '').toLowerCase().trim();
        const outcomeRow = outcomesRes.rows.find(
          (o) =>
            o.id === params.outcomeId ||
            o.id.toLowerCase() === targetOutcome ||
            o.name.toLowerCase() === targetOutcome ||
            targetOutcome.endsWith(o.id.toLowerCase()) ||
            targetOutcome.endsWith(o.name.toLowerCase()) ||
            o.id.toLowerCase().includes(targetOutcome) ||
            o.name.toLowerCase().includes(targetOutcome)
        );
        if (!outcomeRow) {
          throw new Error(`Outcome "${params.outcomeId}" does not exist in market.`);
        }
        const resolvedOutcomeId = outcomeRow.id;

        // D. Validate Numerical Inputs
        const inputAmountOrShares = params.amountOrShares;
        if (typeof inputAmountOrShares !== 'number' || !isFinite(inputAmountOrShares) || inputAmountOrShares <= 0) {
          throw new Error('Invalid trade order: quantity/amount must be a positive number.');
        }

        // E. Lock Position Row (if exists)
        const posRes = await client.query(
          'SELECT * FROM positions WHERE user_id = $1 AND market_id = $2 AND outcome_id = $3 FOR UPDATE;',
          [userRow.id, marketRow.id, resolvedOutcomeId]
        );
        const existingPosRow = posRes.rowCount > 0 ? posRes.rows[0] : null;

        // F. Handle SELL Validation
        let sellShares = inputAmountOrShares;
        let isSellingAll = false;

        if (params.type === 'SELL') {
          if (!existingPosRow || existingPosRow.status !== 'OPEN' || Number(existingPosRow.quantity) <= 0) {
            throw new Error('Cannot sell: you do not own any open shares in this contract outcome.');
          }

          const ownedQty = Number(existingPosRow.quantity);
          if (inputAmountOrShares >= ownedQty - 0.0001) {
            isSellingAll = true;
            sellShares = ownedQty;
          } else {
            sellShares = inputAmountOrShares;
          }

          if (!isSellingAll && sellShares > ownedQty) {
            throw new Error(`Cannot sell more shares than owned. Owned: ${ownedQty.toFixed(4)}, Requested: ${sellShares.toFixed(4)}.`);
          }
        }

        if (params.type === 'BUY') {
          if (inputAmountOrShares < 0.10) {
            throw new Error('Minimum investment amount is $0.10.');
          }
          if (inputAmountOrShares > 100000.0) {
            throw new Error('Maximum investment amount per trade is $100,000.00.');
          }
        }

        // G. Calculate LMSR Pricing
        const currentQuantities: Record<string, number> = {};
        for (const o of outcomesRes.rows) {
          currentQuantities[o.id] = Number(o.q);
        }

        // Check if market belongs to a tournament
        const tmCheckRes = await client.query(
          `SELECT tournament_id FROM tournament_markets WHERE market_id = $1
           UNION
           SELECT tournament_id FROM markets WHERE id = $1 AND tournament_id IS NOT NULL
           LIMIT 1;`,
          [marketRow.id]
        );
        const boundTournamentId: string | null = tmCheckRes.rowCount > 0 && tmCheckRes.rows[0].tournament_id
          ? tmCheckRes.rows[0].tournament_id
          : (marketRow.tournament_id || null);

        let tournamentBalance = 0;

        if (boundTournamentId) {
          const partRes = await client.query(
            'SELECT tournament_balance, initial_granted_balance FROM tournament_participants WHERE tournament_id = $1 AND user_id = $2 FOR UPDATE;',
            [boundTournamentId, userRow.id]
          );
          if (partRes.rowCount === 0) {
            const tRes = await client.query('SELECT title FROM tournaments WHERE id = $1;', [boundTournamentId]);
            const tTitle = tRes.rows[0]?.title || 'este torneo';
            throw new Error(
              `Este mercado pertenece al torneo "${tTitle}". Para poder operar, inscríbete primero en la pestaña 🏆 Torneos para recibir tu capital de prueba asignado.`
            );
          }
          tournamentBalance = Money.round(Number(partRes.rows[0].tournament_balance ?? 0));
        }

        const quote = LMSREngine.getTradeQuote(
          currentQuantities,
          resolvedOutcomeId,
          params.type,
          params.type === 'SELL' ? sellShares : inputAmountOrShares,
          Number(marketRow.liquidity_parameter),
          Number(marketRow.commission_rate),
          Number(marketRow.spread)
        );

        const grossAmount = Money.round(quote.grossAmount);
        const commission = Money.round(quote.commission);
        const spreadCost = Money.round(quote.spreadCost);
        const netAmount = Money.round(quote.netAmount);
        const shares = params.type === 'SELL' ? sellShares : quote.shares;
        const initialBalance = boundTournamentId
          ? tournamentBalance
          : Money.round(Number(userRow.virtual_balance));

        let finalBalance = initialBalance;
        let realizedPnL = 0;
        let positionId = existingPosRow ? existingPosRow.id : `pos-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
        let updatedPositionObj: Position;

        if (params.type === 'BUY') {
          if (Money.lt(initialBalance, grossAmount)) {
            if (boundTournamentId) {
              if (initialBalance <= 0) {
                throw new Error(
                  'Tu saldo en este torneo es de $0.00 USD. No dispones de fondos suficientes para realizar esta operación.'
                );
              }
              throw new Error(
                `Saldo insuficiente en el torneo. Requerido: $${grossAmount.toFixed(2)}, Disponible en este torneo: $${initialBalance.toFixed(2)}.`
              );
            } else {
              if (initialBalance <= 0) {
                throw new Error(
                  'Tu saldo de cuenta es de $0.00 USD. Para poder operar, inscríbete en un torneo activo en la pestaña 🏆 Torneos para recibir tu capital de prueba asignado.'
                );
              }
              throw new Error(
                `Saldo virtual insuficiente. Requerido: $${grossAmount.toFixed(2)}, Disponible: $${initialBalance.toFixed(2)}.`
              );
            }
          }

          finalBalance = Money.subtract(initialBalance, grossAmount);

          if (boundTournamentId) {
            await client.query(
              'UPDATE tournament_participants SET tournament_balance = $1 WHERE tournament_id = $2 AND user_id = $3;',
              [finalBalance, boundTournamentId, userRow.id]
            );
          } else {
            await client.query('UPDATE users SET virtual_balance = $1, updated_at = NOW() WHERE id = $2;', [
              finalBalance,
              userRow.id,
            ]);
          }

          // Upsert Position
          if (existingPosRow && existingPosRow.status === 'OPEN') {
            const newQty = Number(existingPosRow.quantity) + shares;
            const newCostBasis = Money.add(Number(existingPosRow.current_cost_basis), netAmount);
            const newAvgPrice = newQty > 0 ? Number((newCostBasis / newQty).toFixed(4)) : 0;
            const newVal = Money.multiply(newQty, quote.effectivePricePerShare);

            await client.query(
              `UPDATE positions SET
                 quantity = $1, average_price = $2, current_price = $3,
                 current_cost_basis = $4, current_value = $5,
                 tournament_id = COALESCE(tournament_id, $6),
                 updated_at = NOW()
               WHERE id = $7;`,
              [newQty, newAvgPrice, quote.effectivePricePerShare, newCostBasis, newVal, boundTournamentId, existingPosRow.id]
            );

            updatedPositionObj = {
              id: existingPosRow.id,
              userId: userRow.id,
              marketId: marketRow.id,
              marketQuestion: marketRow.question,
              marketCategory: marketRow.category,
              outcomeId: resolvedOutcomeId,
              outcomeName: outcomeRow.name,
              quantity: newQty,
              averagePrice: newAvgPrice,
              currentPrice: quote.effectivePricePerShare,
              currentCostBasis: newCostBasis,
              currentValue: newVal,
              realizedPnL: Number(existingPosRow.realized_pnl || 0),
              unrealizedPnL: 0,
              unrealizedPnLPercent: 0,
              status: 'OPEN',
              tournamentId: boundTournamentId || existingPosRow.tournament_id || undefined,
            };
          } else {
            const newCostBasis = netAmount;
            const newAvgPrice = Number((netAmount / shares).toFixed(4));
            const newVal = Money.multiply(shares, quote.effectivePricePerShare);

            await client.query(
              `INSERT INTO positions (
                 id, user_id, market_id, outcome_id, market_question,
                 market_category, outcome_name, quantity, average_price,
                 current_price, current_cost_basis, current_value, realized_pnl,
                 unrealized_pnl, unrealized_pnl_percent, status, created_at, updated_at, tournament_id
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0, 0, 0, 'OPEN', NOW(), NOW(), $13)
               ON CONFLICT (user_id, market_id, outcome_id) DO UPDATE SET
                 quantity = EXCLUDED.quantity,
                 average_price = EXCLUDED.average_price,
                 current_price = EXCLUDED.current_price,
                 current_cost_basis = EXCLUDED.current_cost_basis,
                 current_value = EXCLUDED.current_value,
                 status = 'OPEN',
                 tournament_id = COALESCE(positions.tournament_id, EXCLUDED.tournament_id),
                 updated_at = NOW();`,
              [
                positionId,
                userRow.id,
                marketRow.id,
                resolvedOutcomeId,
                marketRow.question,
                marketRow.category,
                outcomeRow.name,
                shares,
                newAvgPrice,
                quote.effectivePricePerShare,
                newCostBasis,
                newVal,
                boundTournamentId,
              ]
            );

            updatedPositionObj = {
              id: positionId,
              userId: userRow.id,
              marketId: marketRow.id,
              marketQuestion: marketRow.question,
              marketCategory: marketRow.category,
              outcomeId: resolvedOutcomeId,
              outcomeName: outcomeRow.name,
              quantity: shares,
              averagePrice: newAvgPrice,
              currentPrice: quote.effectivePricePerShare,
              currentCostBasis: newCostBasis,
              currentValue: newVal,
              realizedPnL: 0,
              unrealizedPnL: 0,
              unrealizedPnLPercent: 0,
              status: 'OPEN',
              tournamentId: boundTournamentId || undefined,
            };
          }
        } else {
          // SELL
          finalBalance = Money.add(initialBalance, netAmount);

          if (boundTournamentId) {
            await client.query(
              'UPDATE tournament_participants SET tournament_balance = $1 WHERE tournament_id = $2 AND user_id = $3;',
              [finalBalance, boundTournamentId, userRow.id]
            );
          } else {
            await client.query('UPDATE users SET virtual_balance = $1, updated_at = NOW() WHERE id = $2;', [
              finalBalance,
              userRow.id,
            ]);
          }

          const ownedQty = Number(existingPosRow.quantity);
          const fractionSold = Math.min(1.0, sellShares / ownedQty);
          const costBasisReduction = Money.round(Number(existingPosRow.current_cost_basis) * fractionSold);
          realizedPnL = Money.subtract(netAmount, costBasisReduction);

          const remainingShares = Math.max(0, ownedQty - sellShares);
          const remainingCostBasis = Math.max(0, Money.subtract(Number(existingPosRow.current_cost_basis), costBasisReduction));
          const isClosed = isSellingAll || remainingShares < 0.0001;

          await client.query(
            `UPDATE positions SET
               quantity = $1, current_cost_basis = $2, current_value = $3,
               realized_pnl = realized_pnl + $4,
               status = $5, updated_at = NOW()
             WHERE id = $6;`,
            [
              remainingShares,
              remainingCostBasis,
              Money.multiply(remainingShares, quote.effectivePricePerShare),
              realizedPnL,
              isClosed ? 'CLOSED' : 'OPEN',
              existingPosRow.id,
            ]
          );

          updatedPositionObj = {
            id: existingPosRow.id,
            userId: userRow.id,
            marketId: marketRow.id,
            marketQuestion: marketRow.question,
            marketCategory: marketRow.category,
            outcomeId: resolvedOutcomeId,
            outcomeName: outcomeRow.name,
            quantity: remainingShares,
            averagePrice: Number(existingPosRow.average_price),
            currentPrice: quote.effectivePricePerShare,
            currentCostBasis: remainingCostBasis,
            currentValue: Money.multiply(remainingShares, quote.effectivePricePerShare),
            realizedPnL: Money.add(Number(existingPosRow.realized_pnl || 0), realizedPnL),
            unrealizedPnL: 0,
            unrealizedPnLPercent: 0,
            status: isClosed ? 'CLOSED' : 'OPEN',
            tournamentId: boundTournamentId || existingPosRow.tournament_id || undefined,
          };
        }

        // H. Create Trade Record
        const tradeId = `trd-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        await client.query(
          `INSERT INTO trades (
             id, user_id, user_name, market_id, market_question,
             outcome_id, outcome_name, type, price, quantity,
             amount, fee, spread_fee, lmsr_cash_flow, pnl, status, timestamp, tournament_id, is_anonymous
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'EXECUTED', NOW(), $16, $17);`,
          [
            tradeId,
            userRow.id,
            userRow.name,
            marketRow.id,
            marketRow.question,
            resolvedOutcomeId,
            outcomeRow.name,
            params.type,
            quote.effectivePricePerShare,
            shares,
            grossAmount,
            commission,
            spreadCost,
            quote.lmsrCashFlow,
            params.type === 'SELL' ? realizedPnL : null,
            boundTournamentId,
            Boolean(params.isAnonymous),
          ]
        );

        // I. Record Fees
        await client.query(
          `INSERT INTO fees (id, trade_id, market_id, user_id, fee_type, amount, rate, timestamp)
           VALUES
             ($1, $2, $3, $4, 'COMMISSION', $5, $6, NOW()),
             ($7, $2, $3, $4, 'SPREAD', $8, $9, NOW());`,
          [
            `fee-${Date.now()}-comm-${crypto.randomBytes(2).toString('hex')}`,
            tradeId,
            marketRow.id,
            userRow.id,
            commission,
            Number(marketRow.commission_rate),
            `fee-${Date.now()}-sprd-${crypto.randomBytes(2).toString('hex')}`,
            spreadCost,
            Number(marketRow.spread),
          ]
        );

        // J. Record Ledger Entry
        const ledgerId = `ledg-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        const ledgerAmount = params.type === 'BUY' ? -grossAmount : netAmount;
        const ledgerDesc = params.type === 'BUY'
          ? `BUY ${shares.toFixed(2)} sh of ${outcomeRow.name} at $${quote.effectivePricePerShare.toFixed(2)} (fee: $${commission.toFixed(2)})`
          : `SELL ${shares.toFixed(2)} sh of ${outcomeRow.name} at $${quote.effectivePricePerShare.toFixed(2)} (net: $${netAmount.toFixed(2)}, fee: $${commission.toFixed(2)})`;

        await client.query(
          `INSERT INTO ledger_transactions (
             id, user_id, user_email, type, amount, balance_after,
             market_id, market_question, trade_id, description, timestamp
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW());`,
          [
            ledgerId,
            userRow.id,
            userRow.email,
            params.type,
            ledgerAmount,
            finalBalance,
            marketRow.id,
            marketRow.question,
            tradeId,
            ledgerDesc,
          ]
        );

        // K. Update LMSR Quantities and Market Prices
        const newQuantities = quote.newQuantities || currentQuantities;
        const updatedPrices = quote.newProbabilities || LMSREngine.calculatePrices(newQuantities, Number(marketRow.liquidity_parameter));

        for (const o of outcomesRes.rows) {
          const qVal = newQuantities[o.id] !== undefined ? newQuantities[o.id] : Number(o.q);
          const midP = updatedPrices[o.id] || 0.5;
          const spreadInfo = LMSREngine.getSpreadPrices(midP, Number(marketRow.spread));

          await client.query(
            `UPDATE market_outcomes SET
               q = $1, current_price = $2, buy_price = $3, sell_price = $4
             WHERE market_id = $5 AND id = $6;`,
            [qVal, spreadInfo.mid, spreadInfo.buy, spreadInfo.sell, marketRow.id, o.id]
          );
        }

        // L. Update Market Volume, Counters & Price History
        const newVolume = Money.add(Number(marketRow.volume || 0), grossAmount);
        const newTradesCount = Number(marketRow.total_trades || 0) + 1;
        const newCashFlow = Money.add(Number(marketRow.cumulative_lmsr_cash_flow || 0), quote.lmsrCashFlow);
        const newCommission = Money.add(Number(marketRow.total_commission_revenue || 0), commission);
        const newSpread = Money.add(Number(marketRow.total_spread_revenue || 0), spreadCost);

        const rawHistory: PricePoint[] = typeof marketRow.price_history === 'string'
          ? JSON.parse(marketRow.price_history)
          : (marketRow.price_history || []);

        const nowTs = Date.now();
        const timeLabel = new Date(nowTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const outcomePricesMap: Record<string, number> = {};
        for (const o of outcomesRes.rows) {
          outcomePricesMap[o.id] = updatedPrices[o.id] !== undefined ? updatedPrices[o.id] : Number(o.current_price);
        }

        const newPoint: PricePoint = {
          timestamp: nowTs,
          timeLabel,
          prices: outcomePricesMap,
          volume: newVolume,
        };

        const createdTs = marketRow.created_at ? new Date(marketRow.created_at).getTime() : nowTs;
        const compactedHistory = compactPriceHistory(rawHistory, newPoint, createdTs);

        const tradersRes = await client.query(
          `SELECT COUNT(DISTINCT user_id) AS count FROM (
             SELECT user_id FROM positions WHERE market_id = $1 AND quantity > 0
             UNION
             SELECT user_id FROM trades WHERE market_id = $1
           ) t;`,
          [marketRow.id]
        );
        const totalTraders = Number(tradersRes.rows[0]?.count || 1);

        await client.query(
          `UPDATE markets SET
             volume = $1, total_trades = $2, total_traders = $3,
             cumulative_lmsr_cash_flow = $4, total_commission_revenue = $5,
             total_spread_revenue = $6, price_history = $7
           WHERE id = $8;`,
          [newVolume, newTradesCount, totalTraders, newCashFlow, newCommission, newSpread, JSON.stringify(compactedHistory), marketRow.id]
        );

        const tradeObj: Trade = {
          id: tradeId,
          userId: userRow.id,
          userName: userRow.name,
          marketId: marketRow.id,
          marketQuestion: marketRow.question,
          outcomeId: resolvedOutcomeId,
          outcomeName: outcomeRow.name,
          type: params.type,
          price: quote.effectivePricePerShare,
          quantity: shares,
          amount: grossAmount,
          fee: commission,
          spreadFee: spreadCost,
          lmsrCashFlow: quote.lmsrCashFlow,
          pnl: params.type === 'SELL' ? realizedPnL : undefined,
          status: 'EXECUTED',
          timestamp: new Date().toISOString(),
          tournamentId: boundTournamentId || undefined,
          isAnonymous: Boolean(params.isAnonymous),
        };

        const safeUserObj: User = {
          id: userRow.id,
          name: userRow.name,
          email: userRow.email,
          role: userRow.role,
          virtualBalance: boundTournamentId ? Number(userRow.virtual_balance) : finalBalance,
          avatar: userRow.avatar || undefined,
        };

        return {
          trade: tradeObj,
          updatedUser: safeUserObj,
          updatedPosition: updatedPositionObj,
          marketId: marketRow.id,
          tournamentId: boundTournamentId || undefined,
          tournamentBalance: boundTournamentId ? finalBalance : undefined,
        };
      });

      const updatedMarket = (await this.getMarket(transactionResult.marketId))!;

      const fullResult = {
        trade: transactionResult.trade,
        updatedUser: transactionResult.updatedUser,
        updatedMarket,
        updatedPosition: transactionResult.updatedPosition,
        tournamentId: transactionResult.tournamentId,
        tournamentBalance: transactionResult.tournamentBalance,
      };

      if (params.idempotencyKey) {
        idempotencyManager.recordSuccess(params.idempotencyKey, params.userId, fullResult);
      }

      // Broadcast real-time updates via Supabase Realtime & local stream
      const isAnon = Boolean(fullResult.trade.isAnonymous);
      const publicTrade: Partial<Trade> = {
        id: fullResult.trade.id,
        userId: isAnon ? 'anon' : fullResult.trade.userId,
        userName: isAnon ? 'Trader Anónimo' : fullResult.trade.userName,
        isAnonymous: isAnon,
        marketId: fullResult.trade.marketId,
        marketQuestion: fullResult.trade.marketQuestion,
        outcomeId: fullResult.trade.outcomeId,
        outcomeName: fullResult.trade.outcomeName,
        type: fullResult.trade.type,
        price: fullResult.trade.price,
        quantity: fullResult.trade.quantity,
        amount: fullResult.trade.amount,
        fee: fullResult.trade.fee,
        spreadFee: fullResult.trade.spreadFee,
        status: fullResult.trade.status,
        timestamp: fullResult.trade.timestamp,
        tournamentId: fullResult.tournamentId,
      };

      // 1. Public Market Update (prices, volume, probabilities, trader count)
      realtimeService.broadcast('market:update', {
        market: fullResult.updatedMarket,
        recentTrade: isAnon ? (publicTrade as any) : fullResult.trade,
        action: 'trade',
      });
      // 2. Public Trade Tape (includes public pseudonym and details for real-time trader calculation)
      realtimeService.broadcast('trade:public', {
        trade: publicTrade,
      });
      realtimeService.broadcast('trade:executed', {
        trade: publicTrade,
        market: fullResult.updatedMarket,
      });

      // 3. Private User Update (STRICTLY to this user's private channel)
      realtimeService.emitToUser(params.userId, 'user:update', {
        userId: params.userId,
        virtualBalance: fullResult.updatedUser.virtualBalance,
        tournamentId: fullResult.tournamentId,
        tournamentBalance: fullResult.tournamentBalance,
        updatedPosition: fullResult.updatedPosition,
        trade: fullResult.trade,
        notification: {
          title: 'Order Executed',
          message: `${fullResult.trade.type} ${fullResult.trade.quantity.toFixed(2)} sh of ${fullResult.trade.outcomeName} at $${fullResult.trade.price.toFixed(2)}`,
          type: 'trade',
          marketId: fullResult.updatedMarket.id,
        },
      });
      if (fullResult.tournamentId && fullResult.tournamentBalance !== undefined) {
        realtimeService.emitToUser(params.userId, 'tournament:balance_updated', {
          tournamentId: fullResult.tournamentId,
          tournamentBalance: fullResult.tournamentBalance,
        });
      }
      realtimeService.emitToUser(params.userId, 'user:updated', fullResult.updatedUser);
      realtimeService.emitToUser(params.userId, 'position:updated', fullResult.updatedPosition);

      // 4. Admin Updates (metrics, risk, revenue monitoring)
      realtimeService.broadcastToAdmins('admin:update', {
        type: 'trade',
        trade: fullResult.trade,
        marketId: fullResult.updatedMarket.id,
      });

      return fullResult;
    } catch (err: any) {
      if (params.idempotencyKey) {
        idempotencyManager.recordFailure(params.idempotencyKey, params.userId, err?.message || 'Trade failed');
      }
      throw err;
    }
  }

  /**
   * PROPOSE MARKET RESOLUTION (Optimistic Dispute Window)
   * Enters 'resolving' state, stores proposed outcome and deadline, but DOES NOT distribute funds.
   */
  public async proposeMarketResolution(params: {
    marketId: string;
    proposedOutcomeId: string;
    resolutionProof?: string;
    disputeWindowSeconds?: number;
    adminUserId: string;
  }): Promise<{ market: Market; disputeDeadline: string }> {
    const admin = await this.getUserAccountById(params.adminUserId);
    if (!admin || admin.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators can propose market resolutions.');
    }

    const windowSeconds = params.disputeWindowSeconds !== undefined && params.disputeWindowSeconds >= 0
      ? params.disputeWindowSeconds
      : 300; // Default 5 minutes (300 seconds)

    const deadlineIso = new Date(Date.now() + windowSeconds * 1000).toISOString();

    await dbTransaction(async (client) => {
      const mRes = await client.query('SELECT * FROM markets WHERE id = $1 FOR UPDATE;', [params.marketId]);
      if (mRes.rowCount === 0) throw new Error(`Market "${params.marketId}" not found.`);
      const marketRow = mRes.rows[0];

      if (marketRow.status?.toLowerCase() === 'resolved') {
        throw new Error('This market has already been resolved.');
      }
      if (marketRow.status?.toLowerCase() === 'cancelled') {
        throw new Error('Cannot resolve a cancelled market.');
      }

      const oRes = await client.query('SELECT * FROM market_outcomes WHERE market_id = $1 FOR UPDATE;', [params.marketId]);
      const outcomeExists = oRes.rows.some((o) => o.id === params.proposedOutcomeId);
      if (!outcomeExists) {
        throw new Error(`Proposed outcome ID "${params.proposedOutcomeId}" does not exist in this market.`);
      }

      await client.query(
        `UPDATE markets SET
           status = 'resolving',
           proposed_outcome_id = $1,
           resolution_proof = $2,
           dispute_deadline = $3
         WHERE id = $4;`,
        [params.proposedOutcomeId, params.resolutionProof || '', deadlineIso, params.marketId]
      );
    });

    const market = (await this.getMarket(params.marketId))!;
    try {
      realtimeService.broadcast('market:update', {
        market,
        action: 'resolving',
        proposedOutcomeId: params.proposedOutcomeId,
        disputeDeadline: deadlineIso,
      });
      realtimeService.broadcastToAdmins('admin:update', {
        type: 'market_resolution_proposed',
        marketId: params.marketId,
        proposedOutcomeId: params.proposedOutcomeId,
        disputeDeadline: deadlineIso,
      });
    } catch {}

    return { market, disputeDeadline: deadlineIso };
  }

  /**
   * DISPUTE / CANCEL PROPOSED RESOLUTION
   * Reverts market from 'resolving' back to 'open' or 'closed' and clears proposed outcome and deadline.
   */
  public async disputeMarketResolution(params: {
    marketId: string;
    reason?: string;
    adminUserId: string;
  }): Promise<{ market: Market }> {
    const admin = await this.getUserAccountById(params.adminUserId);
    if (!admin || admin.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators can dispute market resolutions.');
    }

    await dbTransaction(async (client) => {
      const mRes = await client.query('SELECT * FROM markets WHERE id = $1 FOR UPDATE;', [params.marketId]);
      if (mRes.rowCount === 0) throw new Error(`Market "${params.marketId}" not found.`);
      const marketRow = mRes.rows[0];

      if (marketRow.status?.toLowerCase() !== 'resolving') {
        throw new Error(`Cannot dispute market with status "${marketRow.status}". Only markets in "resolving" state can be disputed.`);
      }

      const isExpired = new Date(marketRow.close_time).getTime() <= Date.now();
      const revertedStatus = isExpired ? 'closed' : 'open';

      await client.query(
        `UPDATE markets SET
           status = $1,
           proposed_outcome_id = NULL,
           resolution_proof = NULL,
           dispute_deadline = NULL,
           disputed_at = NOW(),
           dispute_reason = $2
         WHERE id = $3;`,
        [revertedStatus, params.reason || 'Resolution proposal cancelled by operator.', params.marketId]
      );
    });

    const market = (await this.getMarket(params.marketId))!;
    try {
      realtimeService.broadcast('market:update', {
        market,
        action: 'disputed',
        reason: params.reason,
      });
      realtimeService.broadcastToAdmins('admin:update', {
        type: 'market_disputed',
        marketId: params.marketId,
        reason: params.reason,
      });
    } catch {}

    return { market };
  }

  /**
   * FINALIZE OPTIMISTIC MARKET RESOLUTION (Atomic Settlement & Payouts)
   * Executes only after dispute deadline has elapsed (or if force=true by admin).
   */
  public async finalizeMarketResolution(params: {
    marketId: string;
    adminUserId: string;
    force?: boolean;
  }): Promise<{ market: Market; settlement: any }> {
    const admin = await this.getUserAccountById(params.adminUserId);
    if (!admin || admin.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators can finalize prediction markets.');
    }

    const res = await dbTransaction(async (client) => {
      const mRes = await client.query('SELECT * FROM markets WHERE id = $1 FOR UPDATE;', [params.marketId]);
      if (mRes.rowCount === 0) throw new Error(`Market "${params.marketId}" not found.`);
      const marketRow = mRes.rows[0];

      if (marketRow.status?.toLowerCase() === 'resolved') {
        throw new Error('This market has already been resolved.');
      }
      if (marketRow.status?.toLowerCase() === 'cancelled') {
        throw new Error('Cannot resolve a cancelled market.');
      }

      const winningOutcomeId = marketRow.proposed_outcome_id;
      if (!winningOutcomeId) {
        throw new Error('No winning outcome has been proposed for this market. Call proposeMarketResolution first.');
      }

      if (marketRow.status?.toLowerCase() !== 'resolving' && !params.force) {
        throw new Error(`Cannot finalize market with status "${marketRow.status}". Market must be in "resolving" state.`);
      }

      if (!params.force) {
        if (!marketRow.dispute_deadline) {
          throw new Error('No dispute deadline configured for this market. Must specify force: true to finalize without dispute window.');
        }
        const deadlineMs = new Date(marketRow.dispute_deadline).getTime();
        const nowMs = Date.now();
        if (nowMs < deadlineMs) {
          const remainingSecs = Math.ceil((deadlineMs - nowMs) / 1000);
          throw new Error(`Dispute window is still active. Market cannot be finalized until dispute window expires (remaining: ${remainingSecs}s).`);
        }
      }

      const oRes = await client.query('SELECT * FROM market_outcomes WHERE market_id = $1 FOR UPDATE;', [params.marketId]);
      const winningOutcome = oRes.rows.find((o) => o.id === winningOutcomeId);
      if (!winningOutcome) {
        throw new Error(`Winning outcome ID "${winningOutcomeId}" does not exist in this market.`);
      }

      // Lock open positions
      const posRes = await client.query(
        'SELECT * FROM positions WHERE market_id = $1 AND status = \'OPEN\' FOR UPDATE;',
        [params.marketId]
      );

      // Deterministically lock user rows in ascending ID order to prevent deadlock with concurrent transactions
      const uniqueUserIds = Array.from(new Set(posRes.rows.map((p) => p.user_id))).sort();
      for (const uId of uniqueUserIds) {
        await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE;', [uId]);
      }

      let totalPayout = 0;
      let settledCount = 0;

      for (const p of posRes.rows) {
        settledCount++;
        const isWinner = p.outcome_id === winningOutcomeId;
        const shares = Number(p.quantity);
        const costBasis = Number(p.current_cost_basis);

        if (isWinner && shares > 0) {
          const payout = Money.round(shares * 1.0); // $1.00 payout per winning share
          totalPayout = Money.add(totalPayout, payout);
          const pnl = Money.subtract(payout, costBasis);

          // Credit User
          const boundTournId = p.tournament_id || marketRow.tournament_id;
          let newBal = 0;
          let userEmail = '';

          if (boundTournId) {
            const tRes = await client.query(
              'UPDATE tournament_participants SET tournament_balance = tournament_balance + $1 WHERE tournament_id = $2 AND user_id = $3 RETURNING tournament_balance;',
              [payout, boundTournId, p.user_id]
            );
            newBal = Number(tRes.rows[0]?.tournament_balance || 0);
            const uRes = await client.query('SELECT email FROM users WHERE id = $1;', [p.user_id]);
            userEmail = uRes.rows[0]?.email || '';
          } else {
            const uRes = await client.query(
              'UPDATE users SET virtual_balance = virtual_balance + $1, updated_at = NOW() WHERE id = $2 RETURNING virtual_balance, email;',
              [payout, p.user_id]
            );
            newBal = Number(uRes.rows[0]?.virtual_balance || 0);
            userEmail = uRes.rows[0]?.email || '';
          }

          // Record Trade
          const tradeId = `trd-${Date.now()}-res-${crypto.randomBytes(3).toString('hex')}`;
          await client.query(
            `INSERT INTO trades (
               id, user_id, market_id, market_question, outcome_id, outcome_name,
               type, price, quantity, amount, fee, spread_fee, lmsr_cash_flow,
               pnl, status, timestamp, tournament_id
             ) VALUES ($1, $2, $3, $4, $5, $6, 'SETTLEMENT', 1.0, $7, $8, 0, 0, 0, $9, 'SETTLED', NOW(), $10);`,
            [tradeId, p.user_id, marketRow.id, marketRow.question, p.outcome_id, p.outcome_name, shares, payout, pnl, boundTournId || null]
          );

          // Record Ledger
          await client.query(
            `INSERT INTO ledger_transactions (
               id, user_id, user_email, type, amount, balance_after,
               market_id, market_question, trade_id, description, timestamp
             ) VALUES ($1, $2, $3, 'SETTLEMENT', $4, $5, $6, $7, $8, $9, NOW());`,
            [
              `ledg-${Date.now()}-res-${crypto.randomBytes(3).toString('hex')}`,
              p.user_id,
              userEmail,
              payout,
              newBal,
              marketRow.id,
              marketRow.question,
              tradeId,
              `Winning payout: $${payout.toFixed(2)} for ${shares.toFixed(2)} shares of ${p.outcome_name}`,
            ]
          );

          // Update Position (accumulate settlement PnL onto any previously realized PnL from partial sales)
          await client.query(
            'UPDATE positions SET status = \'SETTLED_WIN\', current_value = 0, realized_pnl = realized_pnl + $1, updated_at = NOW() WHERE id = $2;',
            [pnl, p.id]
          );
        } else {
          // Losing Position
          await client.query(
            'UPDATE positions SET status = \'SETTLED_LOSE\', current_value = 0, realized_pnl = realized_pnl + $1, updated_at = NOW() WHERE id = $2;',
            [-costBasis, p.id]
          );
        }
      }

      // Mark winner in outcomes
      await client.query('UPDATE market_outcomes SET is_winner = (id = $1) WHERE market_id = $2;', [
        winningOutcomeId,
        params.marketId,
      ]);

      // Update Market
      const realizedMMPnL = Money.subtract(Number(marketRow.cumulative_lmsr_cash_flow || 0), totalPayout);
      const totalFees = Money.add(Number(marketRow.total_commission_revenue || 0), Number(marketRow.total_spread_revenue || 0));
      const realizedPlatformResult = Money.add(realizedMMPnL, totalFees);

      await client.query(
        `UPDATE markets SET
           status = 'resolved',
           winning_outcome_id = $1,
           resolved_outcome_id = $1,
           settlement_payout = $2,
           realized_mm_pnl = $3,
           realized_platform_result = $4
         WHERE id = $5;`,
        [winningOutcomeId, totalPayout, realizedMMPnL, realizedPlatformResult, params.marketId]
      );

      // Record Settlement
      const settlementId = `stl-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      await client.query(
        `INSERT INTO settlements (
           id, market_id, resolution_type, winning_outcome_id, total_payout,
           total_refund, positions_settled, executed_by, timestamp
         ) VALUES ($1, $2, 'WINNER', $3, $4, 0, $5, $6, NOW());`,
        [settlementId, params.marketId, winningOutcomeId, totalPayout, settledCount, admin.id]
      );

      return {
        settlementId,
        totalPayout,
        settledCount,
      };
    });

    const market = (await this.getMarket(params.marketId))!;
    try {
      realtimeService.broadcast('market:update', { market, action: 'resolved', winningOutcomeId: market.resolvedOutcomeId });
      realtimeService.broadcast('market:resolved', { market, winningOutcomeId: market.resolvedOutcomeId });
      realtimeService.broadcastToAdmins('admin:update', { type: 'market_resolved', marketId: params.marketId, totalPayout: res.totalPayout });
    } catch (err) {
      console.warn('Legacy broadcast skipped');
    }
    return { market, settlement: res };
  }

  /**
   * ATOMIC MARKET RESOLUTION (Dual-mode: Immediate if no dispute window, or optimistic proposer)
   */
  public async resolveMarket(params: {
    marketId: string;
    winningOutcomeId: string;
    adminUserId: string;
    resolutionProof?: string;
    disputeWindowSeconds?: number;
  }): Promise<{ market: Market; settlement: any; disputeDeadline?: string }> {
    if (params.disputeWindowSeconds && params.disputeWindowSeconds > 0) {
      const prop = await this.proposeMarketResolution({
        marketId: params.marketId,
        proposedOutcomeId: params.winningOutcomeId,
        resolutionProof: params.resolutionProof,
        disputeWindowSeconds: params.disputeWindowSeconds,
        adminUserId: params.adminUserId,
      });
      return { market: prop.market, settlement: null, disputeDeadline: prop.disputeDeadline };
    }

    // Direct immediate resolution (backward compatibility for existing tests & force settlement)
    await this.proposeMarketResolution({
      marketId: params.marketId,
      proposedOutcomeId: params.winningOutcomeId,
      resolutionProof: params.resolutionProof,
      disputeWindowSeconds: 0,
      adminUserId: params.adminUserId,
    });

    return this.finalizeMarketResolution({
      marketId: params.marketId,
      adminUserId: params.adminUserId,
      force: true,
    });
  }

  /**
   * ATOMIC MARKET CANCELLATION & REFUNDS
   */
  public async cancelMarket(params: {
    marketId: string;
    reason: string;
    adminUserId: string;
  }): Promise<{ market: Market; settlement: any }> {
    const admin = await this.getUserAccountById(params.adminUserId);
    if (!admin || admin.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators can cancel markets.');
    }

    const res = await dbTransaction(async (client) => {
      const mRes = await client.query('SELECT * FROM markets WHERE id = $1 FOR UPDATE;', [params.marketId]);
      if (mRes.rowCount === 0) throw new Error(`Market "${params.marketId}" not found.`);
      const marketRow = mRes.rows[0];

      if (marketRow.status === 'resolved') {
        throw new Error('Cannot cancel an already resolved market.');
      }
      if (marketRow.status === 'cancelled') {
        throw new Error('Market is already cancelled.');
      }

      // Transition to cancelling immediately to reject any concurrent trade attempts
      await client.query("UPDATE markets SET status = 'cancelled' WHERE id = $1;", [params.marketId]);

      // Lock open positions
      const posRes = await client.query(
        'SELECT * FROM positions WHERE market_id = $1 AND status = \'OPEN\' FOR UPDATE;',
        [params.marketId]
      );

      // Deterministically lock user rows in ascending ID order to prevent deadlock with concurrent transactions
      const uniqueUserIds = Array.from(new Set(posRes.rows.map((p) => p.user_id))).sort();
      for (const uid of uniqueUserIds) {
        await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE;', [uid]);
      }

      let totalRefund = 0;
      let positionsRefunded = 0;

      for (const p of posRes.rows) {
        const refundAmount = Money.round(Number(p.current_cost_basis));
        if (refundAmount > 0) {
          totalRefund = Money.add(totalRefund, refundAmount);
          positionsRefunded++;

          const boundTournId = p.tournament_id || marketRow.tournament_id;
          let newBal = 0;
          let userEmail = '';

          if (boundTournId) {
            const tRes = await client.query(
              'UPDATE tournament_participants SET tournament_balance = tournament_balance + $1 WHERE tournament_id = $2 AND user_id = $3 RETURNING tournament_balance;',
              [refundAmount, boundTournId, p.user_id]
            );
            newBal = Number(tRes.rows[0]?.tournament_balance || 0);
            const uRes = await client.query('SELECT email FROM users WHERE id = $1;', [p.user_id]);
            userEmail = uRes.rows[0]?.email || '';
          } else {
            const uRes = await client.query(
              'UPDATE users SET virtual_balance = virtual_balance + $1, updated_at = NOW() WHERE id = $2 RETURNING virtual_balance, email;',
              [refundAmount, p.user_id]
            );
            newBal = Number(uRes.rows[0]?.virtual_balance || 0);
            userEmail = uRes.rows[0]?.email || '';
          }

          const tradeId = `trd-${Date.now()}-ref-${crypto.randomBytes(3).toString('hex')}`;
          await client.query(
            `INSERT INTO trades (
               id, user_id, market_id, market_question, outcome_id, outcome_name,
               type, price, quantity, amount, fee, spread_fee, lmsr_cash_flow,
               pnl, status, timestamp, tournament_id
             ) VALUES ($1, $2, $3, $4, $5, $6, 'REFUND', $7, $8, $9, 0, 0, 0, 0, 'REFUNDED', NOW(), $10);`,
            [tradeId, p.user_id, marketRow.id, marketRow.question, p.outcome_id, p.outcome_name, Number(p.average_price), Number(p.quantity), refundAmount, boundTournId || null]
          );

          await client.query(
            `INSERT INTO ledger_transactions (
               id, user_id, user_email, type, amount, balance_after,
               market_id, market_question, trade_id, description, timestamp
             ) VALUES ($1, $2, $3, 'REFUND', $4, $5, $6, $7, $8, $9, NOW());`,
            [
              `ledg-${Date.now()}-ref-${crypto.randomBytes(3).toString('hex')}`,
              p.user_id,
              userEmail,
              refundAmount,
              newBal,
              marketRow.id,
              marketRow.question,
              tradeId,
              `Market cancellation refund: $${refundAmount.toFixed(2)} (${params.reason})`,
            ]
          );

          await client.query(
            'UPDATE positions SET status = \'REFUNDED\', current_value = 0, realized_pnl = 0, updated_at = NOW() WHERE id = $1;',
            [p.id]
          );
        } else {
          // Zero-cost or dust positions: mark cleanly as REFUNDED
          await client.query(
            'UPDATE positions SET status = \'REFUNDED\', current_value = 0, updated_at = NOW() WHERE id = $1;',
            [p.id]
          );
        }
      }

      await client.query(
        'UPDATE markets SET status = \'cancelled\', description = description || $1 WHERE id = $2;',
        [` [CANCELLED: ${params.reason}]`, params.marketId]
      );

      const settlementId = `stl-${Date.now()}-cancel-${crypto.randomBytes(3).toString('hex')}`;
      await client.query(
        `INSERT INTO settlements (
           id, market_id, resolution_type, total_payout, total_refund,
           positions_settled, executed_by, timestamp
         ) VALUES ($1, $2, 'CANCELLED', 0, $3, $4, $5, NOW());`,
        [settlementId, params.marketId, totalRefund, positionsRefunded, admin.id]
      );

      return {
        settlementId,
        totalRefund,
        positionsRefunded,
      };
    });

    const market = (await this.getMarket(params.marketId))!;
    realtimeService.broadcast('market:update', { market, action: 'cancelled', reason: params.reason });
    realtimeService.broadcast('market:cancelled', { market, reason: params.reason });
    realtimeService.broadcastToAdmins('admin:update', { type: 'market_cancelled', marketId: params.marketId, totalRefund: res.totalRefund });
    return { market, settlement: res };
  }

  // =========================================================================
  // NOTIFICATIONS
  // =========================================================================

  public async getNotifications(userId?: string): Promise<NotificationItem[]> {
    let sql = 'SELECT * FROM notifications';
    const params: any[] = [];
    if (userId) {
      sql += ' WHERE user_id = $1 OR user_id IS NULL';
      params.push(userId);
    }
    sql += ' ORDER BY timestamp DESC LIMIT 50;';

    const res = await dbQuery(sql, params);
    return res.rows.map((r) => ({
      id: r.id,
      title: r.title,
      message: r.message,
      type: r.type,
      read: !!r.read,
      timestamp: new Date(r.timestamp).toISOString(),
      marketId: r.market_id || undefined,
    }));
  }

  public async markNotificationRead(id: string): Promise<void> {
    await dbQuery('UPDATE notifications SET read = TRUE WHERE id = $1;', [id]);
  }

  // =========================================================================
  // TOURNAMENTS & TESTING ARENA
  // =========================================================================

  public async getTournaments(): Promise<Tournament[]> {
    const tournsRes = await dbQuery('SELECT * FROM tournaments ORDER BY created_at DESC;');
    const partsRes = await dbQuery('SELECT tournament_id, COUNT(*) AS count FROM tournament_participants GROUP BY tournament_id;');
    const partsCountMap = new Map<string, number>();
    for (const r of partsRes.rows) {
      partsCountMap.set(r.tournament_id, Number(r.count));
    }

    const allMarkets = await this.getMarkets();

    return tournsRes.rows.map((row) => {
      const pCount = partsCountMap.get(row.id) || 0;
      const cat = row.category_filter || 'ALL';
      const mCount = cat === 'ALL'
        ? allMarkets.length
        : allMarkets.filter((m) => m.category === cat).length;
      return this.mapRowToTournament(row, pCount, mCount);
    });
  }

  public async getTournament(id: string): Promise<Tournament | null> {
    const res = await dbQuery('SELECT * FROM tournaments WHERE id = $1;', [id]);
    if (res.rows.length === 0) return null;
    const partsRes = await dbQuery('SELECT COUNT(*) AS count FROM tournament_participants WHERE tournament_id = $1;', [id]);
    const pCount = Number(partsRes.rows[0]?.count || 0);

    const allMarkets = await this.getMarkets();
    const cat = res.rows[0].category_filter || 'ALL';
    const mCount = cat === 'ALL'
      ? allMarkets.length
      : allMarkets.filter((m) => m.category === cat).length;

    return this.mapRowToTournament(res.rows[0], pCount, mCount);
  }

  public async createTournament(
    params: {
      title: string;
      description?: string;
      prizePool?: string;
      initialBalance?: number;
      status?: 'upcoming' | 'active' | 'completed';
      startDate?: string;
      endDate: string;
      categoryFilter?: Category | 'ALL';
      rules?: string;
    },
    adminUserId: string
  ): Promise<Tournament> {
    const admin = await this.getUserAccountById(adminUserId);
    if (!admin || admin.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators can create tournaments.');
    }

    if (!params.title || !params.title.trim()) {
      throw new Error('Tournament title is required.');
    }
    if (!params.endDate) {
      throw new Error('Tournament end date (deadline) is required.');
    }

    const id = `tourn-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date();
    const startDate = params.startDate ? new Date(params.startDate).toISOString() : now.toISOString();
    const endDate = new Date(params.endDate).toISOString();
    const initialBalance = params.initialBalance && params.initialBalance > 0 ? Number(params.initialBalance) : 1000.0;
    const status = params.status || 'active';
    const categoryFilter = params.categoryFilter || 'ALL';

    await dbQuery(
      `INSERT INTO tournaments (
         id, title, description, prize_pool, initial_balance, status,
         start_date, end_date, category_filter, rules, created_by_id, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);`,
      [
        id,
        params.title.trim(),
        params.description?.trim() || '',
        params.prizePool?.trim() || '',
        initialBalance,
        status,
        startDate,
        endDate,
        categoryFilter,
        params.rules?.trim() || '',
        admin.id,
        now.toISOString(),
      ]
    );

    const tournament = (await this.getTournament(id))!;
    realtimeService.broadcast('tournament:created', { tournament });
    return tournament;
  }

  public async updateTournament(
    id: string,
    updates: Partial<{
      title: string;
      description: string;
      prizePool: string;
      initialBalance: number;
      status: 'upcoming' | 'active' | 'completed' | 'cancelled';
      startDate: string;
      endDate: string;
      categoryFilter: Category | 'ALL';
      rules: string;
      winnerUserId?: string;
      winnerName?: string;
      winnerEquity?: number;
    }>,
    adminUserId: string
  ): Promise<Tournament> {
    const admin = await this.getUserAccountById(adminUserId);
    if (!admin || admin.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators can modify tournaments.');
    }

    const existing = await this.getTournament(id);
    if (!existing) {
      throw new Error(`Tournament with ID "${id}" not found.`);
    }

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.title !== undefined) {
      fields.push(`title = $${idx++}`);
      values.push(updates.title.trim());
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(updates.description.trim());
    }
    if (updates.prizePool !== undefined) {
      fields.push(`prize_pool = $${idx++}`);
      values.push(updates.prizePool.trim());
    }
    if (updates.initialBalance !== undefined) {
      fields.push(`initial_balance = $${idx++}`);
      values.push(Number(updates.initialBalance));
    }
    if (updates.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(updates.status);
    }
    if (updates.startDate !== undefined) {
      fields.push(`start_date = $${idx++}`);
      values.push(new Date(updates.startDate).toISOString());
    }
    if (updates.endDate !== undefined) {
      fields.push(`end_date = $${idx++}`);
      values.push(new Date(updates.endDate).toISOString());
    }
    if (updates.categoryFilter !== undefined) {
      fields.push(`category_filter = $${idx++}`);
      values.push(updates.categoryFilter);
    }
    if (updates.rules !== undefined) {
      fields.push(`rules = $${idx++}`);
      values.push(updates.rules);
    }
    if (updates.winnerUserId !== undefined) {
      fields.push(`winner_user_id = $${idx++}`);
      values.push(updates.winnerUserId);
    }
    if (updates.winnerName !== undefined) {
      fields.push(`winner_name = $${idx++}`);
      values.push(updates.winnerName);
    }
    if (updates.winnerEquity !== undefined) {
      fields.push(`winner_equity = $${idx++}`);
      values.push(updates.winnerEquity);
    }

    if (fields.length > 0) {
      values.push(id);
      await dbQuery(
        `UPDATE tournaments SET ${fields.join(', ')} WHERE id = $${idx};`,
        values
      );
    }

    const updated = (await this.getTournament(id))!;
    realtimeService.broadcast('tournament:updated', { tournament: updated });
    return updated;
  }

  public async deleteTournament(id: string, adminUserId: string): Promise<void> {
    const admin = await this.getUserAccountById(adminUserId);
    if (!admin || admin.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators can delete tournaments.');
    }

    await dbQuery('DELETE FROM tournaments WHERE id = $1;', [id]);
    realtimeService.broadcast('tournament:deleted', { tournamentId: id });
  }

  public async joinTournament(tournamentId: string, userId: string): Promise<TournamentParticipant> {
    const t = await this.getTournament(tournamentId);
    if (!t) {
      throw new Error('Tournament not found.');
    }
    if (t.status === 'completed' || t.status === 'cancelled') {
      throw new Error('No es posible unirse a un torneo que ya ha finalizado o ha sido cancelado.');
    }

    const initialGranted = t.initialBalance && t.initialBalance > 0 ? t.initialBalance : 100.0;

    // Check if already joined
    const existingRes = await dbQuery(
      'SELECT * FROM tournament_participants WHERE tournament_id = $1 AND user_id = $2;',
      [tournamentId, userId]
    );

    if (existingRes.rowCount > 0) {
      const row = existingRes.rows[0];
      return {
        tournamentId,
        userId,
        tournamentBalance: Number(row.tournament_balance ?? initialGranted),
        initialGrantedBalance: Number(row.initial_granted_balance ?? initialGranted),
        joinedAt: new Date(row.joined_at).toISOString(),
      };
    }

    // Insert new participant with isolated tournament subwallet
    await dbTransaction(async (client) => {
      await client.query(
        `INSERT INTO tournament_participants (
           tournament_id, user_id, tournament_balance, initial_granted_balance, joined_at
         ) VALUES ($1, $2, $3, $4, NOW());`,
        [tournamentId, userId, initialGranted, initialGranted]
      );

      const user = await this.getUserById(userId);
      await client.query(
        `INSERT INTO ledger_transactions (id, user_id, user_email, type, amount, balance_after, market_question, description, timestamp)
         VALUES ($1, $2, $3, 'INITIAL_DEMO_CREDIT', $4, $4, $5, $6, NOW());`,
        [
          `ledg-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          userId,
          user?.email || 'user@centra.internal',
          initialGranted,
          t.title,
          `Subcartera de torneo: $${initialGranted.toFixed(2)} acreditados exclusivamente para competir en "${t.title}"`,
        ]
      );
    });

    realtimeService.broadcast('tournament:participant_joined', { tournamentId, userId });

    try {
      realtimeService.emitToUser(userId, 'user:update', {
        userId,
        tournamentId,
        tournamentBalance: initialGranted,
        notification: {
          title: '¡Torneo Unido!',
          message: `Has recibido $${initialGranted.toFixed(2)} en tu subcartera exclusiva para competir en "${t.title}".`,
          type: 'system',
        },
      });
      realtimeService.emitToUser(userId, 'tournament:balance_updated', {
        tournamentId,
        tournamentBalance: initialGranted,
      });
    } catch {}

    return {
      tournamentId,
      userId,
      tournamentBalance: initialGranted,
      initialGrantedBalance: initialGranted,
      joinedAt: new Date().toISOString(),
    };
  }

  public async getUserTournamentParticipant(tournamentId: string, userId: string): Promise<TournamentParticipant | null> {
    const res = await dbQuery(
      'SELECT * FROM tournament_participants WHERE tournament_id = $1 AND user_id = $2;',
      [tournamentId, userId]
    );
    if (res.rowCount === 0) return null;
    const row = res.rows[0];
    return {
      tournamentId,
      userId,
      tournamentBalance: Money.round(Number(row.tournament_balance ?? 0)),
      initialGrantedBalance: Money.round(Number(row.initial_granted_balance ?? 0)),
      joinedAt: new Date(row.joined_at).toISOString(),
    };
  }

  public async getUserTournaments(userId: string): Promise<UserTournamentParticipation[]> {
    const res = await dbQuery(
      `SELECT t.*, tp.tournament_balance, tp.initial_granted_balance, tp.joined_at
       FROM tournament_participants tp
       JOIN tournaments t ON t.id = tp.tournament_id
       WHERE tp.user_id = $1
       ORDER BY tp.joined_at DESC;`,
      [userId]
    );

    const result: UserTournamentParticipation[] = [];
    for (const r of res.rows) {
      const tournament = await this.getTournament(r.id);
      if (tournament) {
        result.push({
          tournament,
          participant: {
            tournamentId: r.id,
            userId,
            tournamentBalance: Money.round(Number(r.tournament_balance ?? 0)),
            initialGrantedBalance: Money.round(Number(r.initial_granted_balance ?? 0)),
            joinedAt: new Date(r.joined_at).toISOString(),
          },
        });
      }
    }
    return result;
  }

  public async getTournamentMarkets(tournamentId: string): Promise<Market[]> {
    const res = await dbQuery(
      `SELECT DISTINCT m.id FROM markets m
       LEFT JOIN tournament_markets tm ON tm.market_id = m.id
       WHERE tm.tournament_id = $1 OR m.tournament_id = $1
       ORDER BY m.id ASC;`,
      [tournamentId]
    );
    const markets: Market[] = [];
    for (const r of res.rows) {
      const m = await this.getMarket(r.id);
      if (m) markets.push(m);
    }
    return markets;
  }

  public async addMarketToTournament(tournamentId: string, marketId: string, adminUserId?: string): Promise<void> {
    if (adminUserId) {
      const admin = await this.getUserAccountById(adminUserId);
      if (!admin || admin.role !== 'admin') {
        throw new Error('Unauthorized: Only administrators can associate markets with tournaments.');
      }
    }
    await dbTransaction(async (client) => {
      const existing = await client.query(
        'SELECT 1 FROM tournament_markets WHERE tournament_id = $1 AND market_id = $2;',
        [tournamentId, marketId]
      );
      if (existing.rowCount === 0) {
        await client.query(
          'INSERT INTO tournament_markets (tournament_id, market_id, created_at) VALUES ($1, $2, NOW());',
          [tournamentId, marketId]
        );
      }
      await client.query('UPDATE markets SET tournament_id = $1 WHERE id = $2;', [tournamentId, marketId]);
    });
    realtimeService.broadcast('tournament:market_added', { tournamentId, marketId });
  }

  public async removeMarketFromTournament(tournamentId: string, marketId: string, adminUserId?: string): Promise<void> {
    if (adminUserId) {
      const admin = await this.getUserAccountById(adminUserId);
      if (!admin || admin.role !== 'admin') {
        throw new Error('Unauthorized: Only administrators can disassociate markets from tournaments.');
      }
    }
    await dbTransaction(async (client) => {
      await client.query(
        'DELETE FROM tournament_markets WHERE tournament_id = $1 AND market_id = $2;',
        [tournamentId, marketId]
      );
      await client.query(
        'UPDATE markets SET tournament_id = NULL WHERE id = $1 AND tournament_id = $2;',
        [marketId, tournamentId]
      );
    });
    realtimeService.broadcast('tournament:market_removed', { tournamentId, marketId });
  }

  public async getTournamentLeaderboard(tournamentId: string): Promise<LeaderboardUser[]> {
    const tournament = await this.getTournament(tournamentId);
    if (!tournament) {
      throw new Error('Tournament not found.');
    }

    const partsRes = await dbQuery(
      'SELECT user_id, tournament_balance, initial_granted_balance FROM tournament_participants WHERE tournament_id = $1;',
      [tournamentId]
    );
    if (partsRes.rowCount === 0) {
      return []; // STRICTLY EMPTY! ZERO GHOST PARTICIPANTS
    }

    const defaultInitialBankroll = tournament.initialBalance && tournament.initialBalance > 0
      ? tournament.initialBalance
      : 1000.0;

    const participantMap = new Map<string, { balance: number; initial: number }>();
    partsRes.rows.forEach((r: any) => {
      participantMap.set(r.user_id, {
        balance: Money.round(Number(r.tournament_balance ?? defaultInitialBankroll)),
        initial: Money.round(Number(r.initial_granted_balance ?? defaultInitialBankroll)),
      });
    });

    const participantIds = new Set<string>(participantMap.keys());
    const usersRes = await dbQuery('SELECT id, username, name, email, role, virtual_balance, avatar FROM users WHERE role = \'user\';');
    
    // Strictly filter to users who have voluntarily joined this tournament
    const eligibleUsers = usersRes.rows.filter((u: any) => participantIds.has(u.id));
    if (eligibleUsers.length === 0) {
      return [];
    }

    // Get markets strictly belonging to this tournament:
    // 1. Explicitly mapped via tournament_markets or market.tournament_id
    // 2. OR fallback to categoryFilter if no explicit markets attached yet
    const tmRes = await dbQuery(
      `SELECT market_id FROM tournament_markets WHERE tournament_id = $1
       UNION
       SELECT id AS market_id FROM markets WHERE tournament_id = $1;`,
      [tournamentId]
    );
    let tournamentMarketIds = new Set<string>(tmRes.rows.map((r: any) => r.market_id));

    if (tournamentMarketIds.size === 0 && tournament.categoryFilter && tournament.categoryFilter !== 'ALL') {
      const catRes = await dbQuery('SELECT id FROM markets WHERE category = $1;', [tournament.categoryFilter]);
      tournamentMarketIds = new Set<string>(catRes.rows.map((r: any) => r.id));
    }

    const allPositions = await this.getPositions();
    const allTrades = await this.getTrades();

    // Filter positions STRICTLY to this tournament!
    const filteredPositions = allPositions.filter((p) => {
      if (p.tournamentId === tournamentId) return true;
      if (tournamentMarketIds.has(p.marketId)) return true;
      return false;
    });

    // Filter trades STRICTLY to this tournament!
    const filteredTrades = allTrades.filter((t) => {
      if (t.tournamentId === tournamentId) return true;
      if (tournamentMarketIds.has(t.marketId)) return true;
      return false;
    });

    const userEquityMap = new Map<string, { openValue: number; wins: number }>();
    for (const pos of filteredPositions) {
      const current = userEquityMap.get(pos.userId) || { openValue: 0, wins: 0 };
      if (pos.status === 'OPEN') {
        current.openValue = Money.add(current.openValue, pos.currentValue);
      } else if (pos.status === 'SETTLED_WIN') {
        current.wins += 1;
      }
      userEquityMap.set(pos.userId, current);
    }

    const userTradesCount = new Map<string, number>();
    for (const tr of filteredTrades) {
      const cnt = userTradesCount.get(tr.userId) || 0;
      userTradesCount.set(tr.userId, cnt + 1);
    }

    const leaderboard: LeaderboardUser[] = eligibleUsers.map((r: any) => {
      const user = this.mapRowToUser(r);
      const metrics = userEquityMap.get(user.id) || { openValue: 0, wins: 0 };
      const tradesCount = userTradesCount.get(user.id) || 0;
      const partData = participantMap.get(user.id) || { balance: defaultInitialBankroll, initial: defaultInitialBankroll };
      
      const tournamentBalance = partData.balance;
      const initialBankroll = partData.initial;

      const openPositionsValue = Money.round(metrics.openValue);
      const totalEquity = Money.round(Money.add(tournamentBalance, openPositionsValue));
      const totalPnl = Money.round(Money.subtract(totalEquity, initialBankroll));
      const roiPercent = initialBankroll > 0 ? Number((((totalEquity - initialBankroll) / initialBankroll) * 100).toFixed(2)) : 0;
      const winsCount = metrics.wins;
      const winRate = tradesCount > 0 ? Number(((winsCount / tradesCount) * 100).toFixed(1)) : 0;

      return {
        id: user.id,
        username: user.username || user.name || user.email.split('@')[0],
        name: user.name,
        avatar: undefined, // No external fake photos
        virtualBalance: tournamentBalance,
        tournamentBalance,
        initialGrantedBalance: initialBankroll,
        openPositionsValue,
        totalEquity,
        totalPnl,
        roiPercent,
        tradesCount,
        winsCount,
        winRate,
      };
    });

    leaderboard.sort((a, b) => b.totalEquity - a.totalEquity);

    leaderboard.forEach((u, idx) => {
      u.rank = idx + 1;
    });

    return leaderboard;
  }
}

export const dbService = DatabaseService.getInstance();
