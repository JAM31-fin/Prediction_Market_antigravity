/**
 * PostgreSQL / Supabase Schema Migration & Seed Engine
 * 
 * Performs:
 * 1. Automatic idempotent DDL schema creation.
 * 2. Safe one-way migration of legacy JSON state (.server_state.json / data/app_state.json)
 *    into PostgreSQL without data loss.
 * 3. Seed initialization for fresh deployments.
 * 4. Safe archival of the legacy JSON file so it is never used as authoritative storage.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { dbQuery, dbTransaction, checkDatabaseHealth } from './db';
import { logger } from './logger';
import { CANONICAL_SEED_MARKETS } from '../data/mockMarkets';
import { Money } from './money';

export function hashPassword(password: string): string {
  const salt = process.env.SESSION_SECRET || 'centra_default_salt_sec_2026';
  return crypto.createHash('sha256').update(`${salt}:${password}`).digest('hex');
}

export function verifyPassword(inputPassword: string, storedHashOrPassword: string): boolean {
  if (storedHashOrPassword === inputPassword) return true;
  const hashedInput = hashPassword(inputPassword);
  return hashedInput === storedHashOrPassword;
}

export function normalizePhoneNumber(raw: string): string {
  if (!raw) return '';
  const clean = raw.trim().replace(/[^\d+]/g, '');
  return clean.startsWith('00') ? '+' + clean.slice(2) : clean;
}

export function isValidPhoneNumber(phone: string): boolean {
  if (!phone) return false;
  // If input contains letters or invalid characters, reject
  if (/[a-zA-Z]/.test(phone)) return false;
  const clean = normalizePhoneNumber(phone);
  return /^\+?[0-9]{8,16}$/.test(clean);
}

export const CANONICAL_SEED_ACCOUNTS = [
  {
    id: 'usr-admin31',
    username: 'admin31',
    email: 'admin31@centra.internal',
    phoneNumber: '+15550000001',
    name: 'Admin 31',
    role: 'admin',
    passwordHash: '12345',
    virtualBalance: 25000.0,
    avatar: undefined,
  },
];

export async function runMigrations(): Promise<{ migratedFromLegacyJson: boolean; usersCount: number; marketsCount: number }> {
  logger.info('Migration', 'Starting PostgreSQL / Supabase schema verification...');

  // 1. Read and execute Schema DDL
  const schemaPath = path.join(process.cwd(), 'supabase', 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    // Remove Supabase-only realtime replication configuration statements that are unsupported in embedded engine
    const cleanSql = schemaSql.replace(/-- 11\. SUPABASE REALTIME REPLICATION CONFIGURATION[\s\S]*$/, '');
    const withoutComments = cleanSql.replace(/--.*$/gm, '');
    const statements = withoutComments
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      try {
        await dbQuery(stmt + ';');
      } catch (ddlErr: any) {
        logger.debug('Migration', `Skipped non-critical DDL statement (${ddlErr.message})`);
      }
    }
  }

  // Ensure username column and index exist
  try {
    await dbQuery('ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;');
    await dbQuery('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);');
    await dbQuery('ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30);');
    await dbQuery('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number);');
    // Clean up old demo accounts as requested by user
    await dbQuery("DELETE FROM users WHERE email IN ('admin@demo.com', 'user@demo.com', 'usera@demo.com', 'userb@demo.com');");
  } catch (err: any) {
    logger.debug('Migration', `Schema update note: ${err.message}`);
  }

  // Ensure tournaments and tournament_participants tables exist
  try {
    await dbQuery(`
      CREATE TABLE IF NOT EXISTS tournaments (
        id text,
        title text,
        description text,
        prize_pool text,
        initial_balance numeric,
        status text,
        start_date timestamptz,
        end_date timestamptz,
        category_filter text,
        rules text,
        created_by_id text,
        winner_user_id text,
        winner_name text,
        winner_equity numeric,
        created_at timestamptz
      );
    `);
    await dbQuery(`
      CREATE TABLE IF NOT EXISTS tournament_participants (
        tournament_id text,
        user_id text,
        tournament_balance numeric,
        initial_granted_balance numeric,
        joined_at timestamptz
      );
    `);
    await dbQuery(`
      CREATE TABLE IF NOT EXISTS tournament_markets (
        tournament_id text,
        market_id text,
        created_at timestamptz
      );
    `);
    // Ensure columns exist if table was already created
    try {
      await dbQuery('ALTER TABLE markets ADD COLUMN IF NOT EXISTS tournament_id text;');
      await dbQuery('ALTER TABLE positions ADD COLUMN IF NOT EXISTS tournament_id text;');
      await dbQuery('ALTER TABLE trades ADD COLUMN IF NOT EXISTS tournament_id text;');
      await dbQuery('ALTER TABLE trades ADD COLUMN IF NOT EXISTS is_anonymous boolean DEFAULT false;');
      await dbQuery('ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS tournament_balance numeric;');
      await dbQuery('ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS initial_granted_balance numeric;');
      if (process.env.DATABASE_URL) {
        try {
          await dbQuery('ALTER TABLE IF EXISTS tournament_markets ENABLE ROW LEVEL SECURITY;');
        } catch {
          // Non-critical if cloud cluster already configured
        }
      }
      // Remove any pre-seeded ghost tournaments requested by user
      await dbQuery("DELETE FROM tournaments WHERE id IN ('tourn-alpha-friends', 'tourn-weekend-challenges');");

      // Phase 1: Subsidy budget and optimistic dispute resolution columns
      await dbQuery('ALTER TABLE markets ADD COLUMN IF NOT EXISTS subsidy_budget numeric;');
      await dbQuery('ALTER TABLE markets ADD COLUMN IF NOT EXISTS proposed_outcome_id text;');
      await dbQuery('ALTER TABLE markets ADD COLUMN IF NOT EXISTS resolution_proof text;');
      await dbQuery('ALTER TABLE markets ADD COLUMN IF NOT EXISTS dispute_deadline timestamptz;');
      await dbQuery('ALTER TABLE markets ADD COLUMN IF NOT EXISTS disputed_at timestamptz;');
      await dbQuery('ALTER TABLE markets ADD COLUMN IF NOT EXISTS dispute_reason text;');
    } catch {}

    await dbQuery('CREATE INDEX IF NOT EXISTS idx_tournaments_id ON tournaments(id);');
    await dbQuery('CREATE INDEX IF NOT EXISTS idx_tournament_participants_tourn ON tournament_participants(tournament_id);');
    await dbQuery('CREATE INDEX IF NOT EXISTS idx_tournament_participants_user ON tournament_participants(user_id);');
    await dbQuery('CREATE INDEX IF NOT EXISTS idx_tournament_markets_tourn ON tournament_markets(tournament_id);');
    await dbQuery('CREATE INDEX IF NOT EXISTS idx_tournament_markets_market ON tournament_markets(market_id);');
    await dbQuery('CREATE INDEX IF NOT EXISTS idx_positions_tourn ON positions(tournament_id);');
    await dbQuery('CREATE INDEX IF NOT EXISTS idx_trades_tourn ON trades(tournament_id);');
  } catch (err: any) {
    logger.debug('Migration', `Tournament schema update note: ${err.message}`);
  }

  // 1.5. Apply Row Level Security (RLS) if connected to real Supabase / PostgreSQL cluster
  try {
    const health = await checkDatabaseHealth();
    if (health.type === 'supabase_postgres') {
      const rlsPath = path.join(process.cwd(), 'supabase', 'migrations', '20261016_enable_rls.sql');
      if (fs.existsSync(rlsPath)) {
        logger.info('Migration', 'Ensuring Supabase Row Level Security (RLS) is active on all tables...');
        const rlsSql = fs.readFileSync(rlsPath, 'utf8');
        const rlsStatements = rlsSql
          .replace(/--.*$/gm, '')
          .split(';')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        for (const s of rlsStatements) {
          try {
            await dbQuery(s + ';');
          } catch (rlsErr: any) {
            logger.debug('Migration', `RLS statement note: ${rlsErr.message}`);
          }
        }
        logger.info('Migration', 'Supabase Row Level Security (RLS) policies verified.');
      }

      // 1.6. Configure Supabase Realtime publication & full replica identity
      try {
        logger.info('Migration', 'Configuring Supabase Realtime replication & publication...');
        await dbQuery('ALTER TABLE markets REPLICA IDENTITY FULL;');
        await dbQuery('ALTER TABLE market_outcomes REPLICA IDENTITY FULL;');
        await dbQuery('ALTER TABLE trades REPLICA IDENTITY FULL;');
        await dbQuery('ALTER TABLE tournaments REPLICA IDENTITY FULL;');
        await dbQuery('ALTER TABLE tournament_participants REPLICA IDENTITY FULL;');

        const realtimeTables = ['markets', 'market_outcomes', 'trades', 'tournaments', 'tournament_participants'];
        for (const t of realtimeTables) {
          const check = await dbQuery(
            `SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = $1;`,
            [t]
          );
          if (check.rowCount === 0) {
            await dbQuery(`ALTER PUBLICATION supabase_realtime ADD TABLE ${t};`);
            logger.info('Migration', `Added table "${t}" to supabase_realtime publication.`);
          }
        }
        logger.info('Migration', 'Supabase Realtime publication configured successfully.');
      } catch (realtimeErr: any) {
        logger.debug('Migration', `Realtime publication setup note: ${realtimeErr.message}`);
      }
    }
  } catch (err: any) {
    logger.debug('Migration', `RLS/Realtime check skipped: ${err.message}`);
  }

  // 2. Check existing record counts
  const usersRes = await dbQuery<{ count: string | number }>('SELECT COUNT(*) AS count FROM users;');
  const existingUsersCount = Number(usersRes.rows[0]?.count || 0);

  let migratedFromLegacyJson = false;

  // 3. Optional one-time bootstrap from archived legacy JSON state if database is brand new.
  // Note: DATA_FILE_PATH is NOT a production dependency; PostgreSQL/Supabase is the sole authoritative storage.
  const legacyFiles = [
    path.join(process.cwd(), '.server_state.json'),
    path.join(process.cwd(), 'data', 'app_state.json'),
    process.env.DATA_FILE_PATH,
  ].filter(Boolean) as string[];

  let legacyFilePath: string | null = null;
  for (const f of legacyFiles) {
    if (fs.existsSync(f)) {
      legacyFilePath = f;
      break;
    }
  }

  if (existingUsersCount === 0 && legacyFilePath) {
    logger.info('Migration', `Found legacy JSON state at "${legacyFilePath}". Initiating migration into PostgreSQL...`);
    try {
      const raw = fs.readFileSync(legacyFilePath, 'utf8');
      const data = JSON.parse(raw);

      await dbTransaction(async (client) => {
        // A. Migrate Users
        if (Array.isArray(data.users)) {
          for (const u of data.users) {
            await client.query(
              `INSERT INTO users (id, name, email, role, password_hash, virtual_balance, avatar, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               ON CONFLICT (id) DO NOTHING;`,
              [
                u.id,
                u.name,
                u.email.toLowerCase(),
                u.role,
                u.passwordHash || hashPassword('User123!'),
                Number(u.virtualBalance || 1000),
                u.avatar || null,
                u.createdAt || new Date().toISOString(),
                u.updatedAt || new Date().toISOString(),
              ]
            );
          }
        }

        // B. Migrate Markets & Outcomes
        if (Array.isArray(data.markets)) {
          for (const m of data.markets) {
            await client.query(
              `INSERT INTO markets (
                 id, question, description, category, type, status,
                 close_time, resolution_time, resolution_source, resolution_rules,
                 liquidity_parameter, commission_rate, spread, volume, total_traders,
                 total_trades, winning_outcome_id, resolved_outcome_id, created_at,
                 price_history, tags, initial_probabilities, initial_quantities,
                 cumulative_lmsr_cash_flow, total_commission_revenue, total_spread_revenue,
                 settlement_payout, realized_mm_pnl, realized_platform_result
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
               ON CONFLICT (id) DO NOTHING;`,
              [
                m.id,
                m.question,
                m.description || '',
                m.category,
                m.type,
                m.status,
                m.closeTime || new Date(Date.now() + 86400000).toISOString(),
                m.resolutionTime || new Date(Date.now() + 86400000 * 2).toISOString(),
                m.resolutionSource || '',
                m.resolutionRules || '',
                m.liquidityParameter || 100,
                m.commissionRate || 0.01,
                m.spread || 0.015,
                m.volume || 0,
                m.totalTraders || 0,
                m.totalTrades || 0,
                m.winningOutcomeId || null,
                m.resolvedOutcomeId || null,
                m.createdAt || new Date().toISOString(),
                JSON.stringify(m.priceHistory || []),
                m.tags || [],
                JSON.stringify(m.initialProbabilities || {}),
                JSON.stringify(m.initialQuantities || {}),
                m.cumulativeLmsrCashFlow || 0,
                m.totalCommissionRevenue || 0,
                m.totalSpreadRevenue || 0,
                m.settlementPayout || 0,
                m.realizedMMPnL || 0,
                m.realizedPlatformResult || 0,
              ]
            );

            if (Array.isArray(m.outcomes)) {
              for (let i = 0; i < m.outcomes.length; i++) {
                const o = m.outcomes[i];
                const safeQ = typeof o.q === 'number' && isFinite(o.q) ? o.q : 0;
                const safeInitialQ = typeof o.initialQ === 'number' && isFinite(o.initialQ) ? o.initialQ : safeQ;
                const safePrice = typeof o.currentPrice === 'number' && isFinite(o.currentPrice) ? o.currentPrice : 0.5;
                const safeBuy = typeof o.buyPrice === 'number' && isFinite(o.buyPrice) ? o.buyPrice : safePrice;
                const safeSell = typeof o.sellPrice === 'number' && isFinite(o.sellPrice) ? o.sellPrice : safePrice;
                const safeInitPrice = typeof o.initialPrice === 'number' && isFinite(o.initialPrice) ? o.initialPrice : null;
                const safeInitProb = typeof o.initialProbability === 'number' && isFinite(o.initialProbability) ? o.initialProbability : null;

                await client.query(
                  `INSERT INTO market_outcomes (
                     market_id, id, name, label, q, initial_q, current_price,
                     buy_price, sell_price, initial_price, initial_probability,
                     color, is_winner, display_order
                   ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                   ON CONFLICT (market_id, id) DO NOTHING;`,
                  [
                    m.id,
                    o.id,
                    o.name,
                    o.label || null,
                    safeQ,
                    safeInitialQ,
                    safePrice,
                    safeBuy,
                    safeSell,
                    safeInitPrice,
                    safeInitProb,
                    o.color || null,
                    !!o.isWinner,
                    i,
                  ]
                );
              }
            }
          }
        }

        // C. Migrate Positions
        if (Array.isArray(data.positions)) {
          for (const p of data.positions) {
            await client.query(
              `INSERT INTO positions (
                 id, user_id, market_id, outcome_id, market_question,
                 market_category, outcome_name, quantity, average_price,
                 current_price, current_cost_basis, current_value, realized_pnl,
                 unrealized_pnl, unrealized_pnl_percent, status
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
               ON CONFLICT (user_id, market_id, outcome_id) DO NOTHING;`,
              [
                p.id,
                p.userId,
                p.marketId,
                p.outcomeId,
                p.marketQuestion,
                p.marketCategory,
                p.outcomeName,
                p.quantity,
                p.averagePrice,
                p.currentPrice,
                p.currentCostBasis,
                p.currentValue,
                p.realizedPnL || 0,
                p.unrealizedPnL || 0,
                p.unrealizedPnLPercent || 0,
                p.status || 'OPEN',
              ]
            );
          }
        }

        // D. Migrate Trades
        if (Array.isArray(data.trades)) {
          for (const t of data.trades) {
            await client.query(
              `INSERT INTO trades (
                 id, user_id, user_name, market_id, market_question,
                 outcome_id, outcome_name, type, price, quantity,
                 amount, fee, spread_fee, lmsr_cash_flow, pnl, status, timestamp
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
               ON CONFLICT (id) DO NOTHING;`,
              [
                t.id,
                t.userId,
                t.userName || null,
                t.marketId,
                t.marketQuestion,
                t.outcomeId,
                t.outcomeName,
                t.type,
                t.price,
                t.quantity,
                t.amount,
                t.fee || 0,
                t.spreadFee || 0,
                t.lmsrCashFlow || 0,
                t.pnl || null,
                t.status || 'EXECUTED',
                t.timestamp || new Date().toISOString(),
              ]
            );
          }
        }

        // E. Migrate Ledger Transactions
        if (Array.isArray(data.ledger)) {
          for (const l of data.ledger) {
            await client.query(
              `INSERT INTO ledger_transactions (
                 id, user_id, user_email, type, amount, balance_after,
                 market_id, market_question, trade_id, description, timestamp
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
               ON CONFLICT (id) DO NOTHING;`,
              [
                l.id,
                l.userId,
                l.userEmail,
                l.type,
                l.amount,
                l.balanceAfter,
                l.marketId || null,
                l.marketQuestion || null,
                l.tradeId || null,
                l.description,
                l.timestamp || new Date().toISOString(),
              ]
            );
          }
        }
      });

      // Archive legacy JSON file safely with backup extension
      const backupPath = `${legacyFilePath}.migrated_backup`;
      try {
        fs.renameSync(legacyFilePath, backupPath);
        logger.info('Migration', `Legacy JSON state safely archived to "${backupPath}".`);
      } catch {
        // If rename fails, write an archival header
        fs.writeFileSync(
          legacyFilePath + '.status',
          JSON.stringify({ migratedAt: new Date().toISOString(), status: 'MIGRATED_TO_POSTGRESQL' })
        );
      }

      migratedFromLegacyJson = true;
      logger.info('Migration', 'Successfully imported all legacy data into PostgreSQL.');
    } catch (err: any) {
      logger.error('Migration', `Error migrating legacy JSON data: ${err.message}`);
    }
  }

  // 4. Ensure Canonical Admin Account Exists (ONLY if not already present)
  for (const seed of CANONICAL_SEED_ACCOUNTS) {
    const existing = await dbQuery(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2);',
      [seed.username || '', seed.email.toLowerCase()]
    );
    if (existing.rowCount === 0) {
      logger.info('Migration', `Seeding canonical account "${seed.username}" (${seed.role})...`);
      const now = new Date().toISOString();
      await dbTransaction(async (client) => {
        await client.query(
          `INSERT INTO users (id, username, name, email, phone_number, role, password_hash, virtual_balance, avatar, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO UPDATE SET
             username = EXCLUDED.username,
             phone_number = COALESCE(users.phone_number, EXCLUDED.phone_number),
             role = EXCLUDED.role,
             password_hash = EXCLUDED.password_hash;`,
          [
            seed.id,
            seed.username,
            seed.name,
            seed.email.toLowerCase(),
            (seed as any).phoneNumber || '+15550000001',
            seed.role,
            hashPassword(seed.passwordHash),
            seed.virtualBalance,
            seed.avatar,
            now,
            now,
          ]
        );

        // Record initial ledger entry
        await client.query(
          `INSERT INTO ledger_transactions (id, user_id, user_email, type, amount, balance_after, description, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
          [
            `ledg-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
            seed.id,
            seed.email.toLowerCase(),
            'INITIAL_DEMO_CREDIT',
            seed.virtualBalance,
            seed.virtualBalance,
            `Initial canonical allocation (${seed.role.toUpperCase()})`,
            now,
          ]
        );
      });
    }
  }

  // 5. Ensure Canonical Markets Exist (ONLY if database has 0 markets)
  const marketsRes = await dbQuery<{ count: string | number }>('SELECT COUNT(*) AS count FROM markets;');
  const existingMarketsCount = Number(marketsRes.rows[0]?.count || 0);

  if (existingMarketsCount === 0) {
    logger.info('Migration', 'Seeding canonical prediction markets...');
    for (const m of CANONICAL_SEED_MARKETS) {
      await dbTransaction(async (client) => {
        await client.query(
          `INSERT INTO markets (
             id, question, description, category, type, status,
             close_time, resolution_time, resolution_source, resolution_rules,
             liquidity_parameter, commission_rate, spread, volume, total_traders,
             total_trades, winning_outcome_id, resolved_outcome_id, created_at,
             price_history, tags, initial_probabilities, initial_quantities,
             cumulative_lmsr_cash_flow, total_commission_revenue, total_spread_revenue,
             settlement_payout, realized_mm_pnl, realized_platform_result
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
           ON CONFLICT (id) DO NOTHING;`,
          [
            m.id,
            m.question,
            m.description || '',
            m.category,
            m.type,
            m.status,
            m.closeTime,
            m.resolutionTime,
            m.resolutionSource || '',
            m.resolutionRules || '',
            m.liquidityParameter,
            m.commissionRate,
            m.spread,
            m.volume || 0,
            m.totalTraders || 0,
            m.totalTrades || 0,
            m.winningOutcomeId || null,
            m.resolvedOutcomeId || null,
            m.createdAt,
            JSON.stringify(m.priceHistory || []),
            m.tags || [],
            JSON.stringify(m.initialProbabilities || {}),
            JSON.stringify(m.initialQuantities || {}),
            m.cumulativeLmsrCashFlow || 0,
            m.totalCommissionRevenue || 0,
            m.totalSpreadRevenue || 0,
            m.settlementPayout || 0,
            m.realizedMMPnL || 0,
            m.realizedPlatformResult || 0,
          ]
        );

        for (let i = 0; i < m.outcomes.length; i++) {
          const o = m.outcomes[i];
          const safeQ = typeof o.q === 'number' && isFinite(o.q) ? o.q : 0;
          const safeInitialQ = typeof o.initialQ === 'number' && isFinite(o.initialQ) ? o.initialQ : safeQ;
          const safePrice = typeof o.currentPrice === 'number' && isFinite(o.currentPrice) ? o.currentPrice : 0.5;
          const safeBuy = typeof o.buyPrice === 'number' && isFinite(o.buyPrice) ? o.buyPrice : safePrice;
          const safeSell = typeof o.sellPrice === 'number' && isFinite(o.sellPrice) ? o.sellPrice : safePrice;
          const safeInitPrice = typeof o.initialPrice === 'number' && isFinite(o.initialPrice) ? o.initialPrice : null;
          const safeInitProb = typeof o.initialProbability === 'number' && isFinite(o.initialProbability) ? o.initialProbability : null;

          await client.query(
            `INSERT INTO market_outcomes (
               market_id, id, name, label, q, initial_q, current_price,
               buy_price, sell_price, initial_price, initial_probability,
               color, is_winner, display_order
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             ON CONFLICT (market_id, id) DO NOTHING;`,
            [
              m.id,
              o.id,
              o.name,
              o.label || null,
              safeQ,
              safeInitialQ,
              safePrice,
              safeBuy,
              safeSell,
              safeInitPrice,
              safeInitProb,
              o.color || null,
              !!o.isWinner,
              i,
            ]
          );
        }
      });
    }
  }

  const finalUsers = await dbQuery<{ count: string | number }>('SELECT COUNT(*) AS count FROM users;');
  const finalMarkets = await dbQuery<{ count: string | number }>('SELECT COUNT(*) AS count FROM markets;');

  logger.info('Migration', 'PostgreSQL database ready.', {
    totalUsers: Number(finalUsers.rows[0]?.count || 0),
    totalMarkets: Number(finalMarkets.rows[0]?.count || 0),
    migratedFromLegacyJson,
  });

  return {
    migratedFromLegacyJson,
    usersCount: Number(finalUsers.rows[0]?.count || 0),
    marketsCount: Number(finalMarkets.rows[0]?.count || 0),
  };
}
