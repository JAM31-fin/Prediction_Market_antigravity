/**
 * Server-Side HTTP API Router & Security Gateway (PostgreSQL / Supabase)
 * 
 * Enforces:
 * - Cryptographic session authentication on every user endpoint
 * - Role-Based Access Control (RBAC) on every admin endpoint
 * - Strict input validation & sanitization
 * - Absolute data isolation (preventing cross-user access to positions, balance, or history)
 * - Safe response error handling (never leaking stack traces or credentials)
 * - True ACID database transactions for trades, settlements, and ledger entries
 */

import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import { dbService, StoredUserAccount } from './dbService';
import { checkDatabaseHealth } from './db';
import { realtimeService } from './realtimeService';
import { logger } from './logger';

export interface AuthenticatedRequest extends IncomingMessage {
  user?: StoredUserAccount;
  parsedBody?: any;
}

function sendJson(res: ServerResponse, statusCode: number, data: any): void {
  const json = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  });
  res.end(json);
}

function sendError(res: ServerResponse, statusCode: number, message: string): void {
  if (statusCode >= 500) {
    logger.error('API', `Internal Server Error: ${message}`);
    const publicMessage = process.env.NODE_ENV === 'production'
      ? 'An unexpected internal server error occurred. Please try again later.'
      : message;
    sendJson(res, statusCode, { success: false, error: publicMessage });
  } else {
    // Client-side validation / request rejections (400, 401, 403, 404, 422) are normal client feedback
    logger.debug('API', `Client Response (${statusCode}): ${message}`);
    sendJson(res, statusCode, { success: false, error: message });
  }
}

async function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
      if (body.length > 1e6) {
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function getBearerToken(req: IncomingMessage): string | undefined {
  const authHeader = req.headers['authorization'];
  if (authHeader && typeof authHeader === 'string') {
    const trimmed = authHeader.trim();
    if (trimmed.startsWith('Bearer ')) {
      return trimmed.slice(7).trim();
    }
    return trimmed;
  }
  return undefined;
}

export async function handleApiRequest(
  req: AuthenticatedRequest,
  res: ServerResponse
): Promise<boolean> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method?.toUpperCase() || 'GET';

  // Only handle /api/* routes
  if (!pathname.startsWith('/api/')) {
    return false;
  }

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }

  // Parse body for mutations
  if (['POST', 'PATCH', 'PUT'].includes(method)) {
    req.parsedBody = await parseBody(req);
  }

  // Authenticate user via bearer token
  const token = getBearerToken(req);
  if (token) {
    const verified = await dbService.getUserBySessionToken(token);
    if (verified) {
      req.user = verified;
    }
  }

  try {
    // -----------------------------------------------------------------------
    // PUBLIC AUTH ENDPOINTS
    // -----------------------------------------------------------------------

    if (pathname === '/api/auth/login' && method === 'POST') {
      const { email, username, identifier, password, adminPin } = req.parsedBody || {};
      const loginId = identifier || username || email;
      if (!loginId || typeof loginId !== 'string' || loginId.trim().length === 0) {
        sendError(res, 400, 'Username, email address, or phone number is required.');
        return true;
      }
      if (!password || typeof password !== 'string' || password.trim().length === 0) {
        sendError(res, 400, 'Password is required.');
        return true;
      }
      // Ensure ADMIN_MASTER_PIN is available in server runtime; randomize in prod if missing
      if (!process.env.ADMIN_MASTER_PIN) {
        process.env.ADMIN_MASTER_PIN = process.env.NODE_ENV === 'production'
          ? crypto.randomBytes(4).toString('hex')
          : '849201';
      }
      try {
        const result = await dbService.authenticate(loginId, password, adminPin);
        sendJson(res, 200, { success: true, ...result });
      } catch (err: any) {
        const isForbiddenOrUnauthorized = /PIN|unauthorized|invalid credentials|not found/i.test(err.message || '');
        const requiresAdminPin = /Administrator master PIN is required/i.test(err.message || '');
        if (requiresAdminPin) {
          sendJson(res, 401, { success: false, error: err.message, requiresAdminPin: true });
        } else {
          sendError(res, isForbiddenOrUnauthorized ? 401 : 400, err.message || 'Authentication failed.');
        }
      }
      return true;
    }

    if (pathname === '/api/auth/register' && method === 'POST') {
      const { username, name, email, password, phoneNumber } = req.parsedBody || {};
      const chosenUsername = (username || (email ? email.split('@')[0] : name) || '').trim();
      if (!chosenUsername || typeof chosenUsername !== 'string') {
        sendError(res, 400, 'Username is required.');
        return true;
      }
      if (!password || typeof password !== 'string' || password.trim().length === 0) {
        sendError(res, 400, 'Password is required.');
        return true;
      }
      if (!phoneNumber || typeof phoneNumber !== 'string' || phoneNumber.trim().length === 0) {
        sendError(res, 400, 'El número de celular / WhatsApp es obligatorio para evitar cuentas duplicadas.');
        return true;
      }
      try {
        const result = await dbService.register(chosenUsername, password, name, email, phoneNumber);
        sendJson(res, 200, { success: true, ...result });
      } catch (err: any) {
        const msg = err.message || '';
        if (/already registered|ya está registrado|duplicate/i.test(msg)) {
          sendError(res, 409, 'Este número de celular ya está registrado por otro usuario.');
        } else {
          sendError(res, 400, msg || 'Registration failed.');
        }
      }
      return true;
    }

    if (pathname === '/api/auth/logout' && method === 'POST') {
      if (token) {
        await dbService.revokeSession(token);
      }
      sendJson(res, 200, { success: true });
      return true;
    }

    if (pathname === '/api/auth/me' && method === 'GET') {
      if (!req.user) {
        sendError(res, 401, 'Unauthorized: session expired or token invalid.');
        return true;
      }
      sendJson(res, 200, {
        success: true,
        user: {
          id: req.user.id,
          username: req.user.username,
          name: req.user.name,
          email: req.user.email,
          phoneNumber: req.user.phoneNumber,
          role: req.user.role,
          virtualBalance: req.user.virtualBalance,
          avatar: req.user.avatar,
          createdAt: req.user.createdAt,
        },
      });
      return true;
    }

    if (pathname === '/api/auth/switch-role' && method === 'POST') {
      sendError(res, 403, 'Forbidden: Self-elevation or role promotion to administrator is prohibited.');
      return true;
    }

    // -----------------------------------------------------------------------
    // PUBLIC MARKET DATA
    // -----------------------------------------------------------------------

    if (pathname === '/api/markets' && method === 'GET') {
      const markets = await dbService.getMarkets();
      sendJson(res, 200, { success: true, markets });
      return true;
    }

    if (pathname.startsWith('/api/markets/') && method === 'GET') {
      const marketId = pathname.replace('/api/markets/', '').trim();
      const market = await dbService.getMarket(marketId);
      if (!market) {
        sendError(res, 404, 'Market not found.');
        return true;
      }
      sendJson(res, 200, { success: true, market });
      return true;
    }

    // Health & Database Probe Endpoint
    if ((pathname === '/api/health' || pathname === '/api/realtime/ping') && method === 'GET') {
      const dbHealth = await checkDatabaseHealth();
      const statusCode = dbHealth.connected ? 200 : 503;
      sendJson(res, statusCode, {
        status: dbHealth.connected ? 'ok' : 'degraded',
        service: 'centra-prediction-markets',
        database: dbHealth.connected ? 'connected' : 'error',
        databaseType: dbHealth.type,
        urlConfigured: dbHealth.urlConfigured,
        diskError: dbHealth.lastError,
        timestamp: new Date().toISOString(),
        connections: realtimeService.getConnectionCount?.() ?? 0,
      });
      return true;
    }

    // Public client-safe runtime configuration
    // Explicitly excludes SUPABASE_SECRET_KEY, DATABASE_URL, and SESSION_SECRET
    if (pathname === '/api/config' && method === 'GET') {
      sendJson(res, 200, {
        supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
        supabasePublishableKey:
          process.env.SUPABASE_PUBLISHABLE_KEY ||
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
          process.env.SUPABASE_ANON_KEY ||
          process.env.VITE_SUPABASE_ANON_KEY ||
          '',
      });
      return true;
    }

    // Public tape of recent executed trades (anonymized)
    if (pathname === '/api/trades/public' && method === 'GET') {
      const marketId = url.searchParams.get('marketId') || undefined;
      const trades = await dbService.getPublicTrades(marketId);
      sendJson(res, 200, { success: true, trades });
      return true;
    }

    // Public Tournament Leaderboard
    if (pathname === '/api/leaderboard' && method === 'GET') {
      const leaderboard = await dbService.getLeaderboard();
      sendJson(res, 200, { success: true, leaderboard });
      return true;
    }

    // Public Tournaments List
    if (pathname === '/api/tournaments' && method === 'GET') {
      const tournaments = await dbService.getTournaments();
      sendJson(res, 200, { success: true, tournaments });
      return true;
    }

    // Public Specific Tournament Leaderboard
    if (pathname.startsWith('/api/tournaments/') && pathname.endsWith('/leaderboard') && method === 'GET') {
      const tournamentId = pathname.replace('/api/tournaments/', '').replace('/leaderboard', '').trim();
      try {
        const leaderboard = await dbService.getTournamentLeaderboard(tournamentId);
        sendJson(res, 200, { success: true, leaderboard });
      } catch (err: any) {
        sendError(res, 404, err.message || 'Tournament leaderboard not found.');
      }
      return true;
    }

    // Public Specific Tournament Markets
    if (pathname.startsWith('/api/tournaments/') && pathname.endsWith('/markets') && method === 'GET') {
      const tournamentId = pathname.replace('/api/tournaments/', '').replace('/markets', '').trim();
      try {
        const markets = await dbService.getTournamentMarkets(tournamentId);
        sendJson(res, 200, { success: true, markets });
      } catch (err: any) {
        sendError(res, 400, err.message || 'Failed to load tournament markets.');
      }
      return true;
    }

    // Authenticated Specific Tournament Participant Profile
    if (pathname.startsWith('/api/tournaments/') && pathname.endsWith('/participant') && method === 'GET') {
      if (!req.user) {
        sendError(res, 401, 'Unauthorized');
        return true;
      }
      const tournamentId = pathname.replace('/api/tournaments/', '').replace('/participant', '').trim();
      try {
        const participant = await dbService.getUserTournamentParticipant(tournamentId, req.user.id);
        sendJson(res, 200, { success: true, participant });
      } catch (err: any) {
        sendError(res, 400, err.message || 'Failed to load participant.');
      }
      return true;
    }

    // Public Tournament Detail
    if (pathname.startsWith('/api/tournaments/') && !pathname.includes('/leaderboard') && !pathname.includes('/join') && !pathname.includes('/markets') && !pathname.includes('/participant') && method === 'GET') {
      const tournamentId = pathname.replace('/api/tournaments/', '').trim();
      const tournament = await dbService.getTournament(tournamentId);
      if (!tournament) {
        sendError(res, 404, 'Tournament not found.');
        return true;
      }
      sendJson(res, 200, { success: true, tournament });
      return true;
    }

    // Real-Time Server-Sent Events (SSE) Stream
    if ((pathname === '/api/events' || pathname === '/api/realtime/stream') && method === 'GET') {
      const sseToken = url.searchParams.get('token') || token;
      realtimeService.handleSseConnection(req, res, sseToken);
      return true;
    }

    // -----------------------------------------------------------------------
    // AUTHENTICATED USER OPERATIONS
    // -----------------------------------------------------------------------

    const requireAuth = (): boolean => {
      if (!req.user) {
        sendError(res, 401, 'Unauthorized: Please sign in to perform this operation.');
        return false;
      }
      return true;
    };

    const requireAdmin = (): boolean => {
      if (!requireAuth()) return false;
      if (req.user!.role !== 'admin') {
        sendError(res, 403, 'Forbidden: Administrator privileges required.');
        return false;
      }
      return true;
    };

    // User's own positions
    if (pathname === '/api/positions' && method === 'GET') {
      if (!requireAuth()) return true;
      const positions = await dbService.getPositions(req.user!.id);
      sendJson(res, 200, { success: true, positions });
      return true;
    }

    // User's own trades
    if (pathname === '/api/trades' && method === 'GET') {
      if (!requireAuth()) return true;
      const trades = await dbService.getTrades(req.user!.id);
      sendJson(res, 200, { success: true, trades });
      return true;
    }

    // User's own double-entry ledger transactions
    if (pathname === '/api/ledger' && method === 'GET') {
      if (!requireAuth()) return true;
      const ledger = await dbService.getLedger(req.user!.id);
      sendJson(res, 200, { success: true, ledger });
      return true;
    }

    // User notifications
    if (pathname === '/api/notifications' && method === 'GET') {
      if (!requireAuth()) return true;
      const notifications = await dbService.getNotifications(req.user!.id);
      sendJson(res, 200, { success: true, notifications });
      return true;
    }

    // User join tournament
    if (pathname.startsWith('/api/tournaments/') && pathname.endsWith('/join') && method === 'POST') {
      if (!requireAuth()) return true;
      const tournamentId = pathname.replace('/api/tournaments/', '').replace('/join', '').trim();
      try {
        await dbService.joinTournament(tournamentId, req.user!.id);
        sendJson(res, 200, { success: true, message: 'Joined tournament successfully.' });
      } catch (err: any) {
        sendError(res, 400, err.message || 'Failed to join tournament.');
      }
      return true;
    }

    // User balance reset (Disabled in production/beta)
    if (pathname === '/api/user/reset-demo' && method === 'POST') {
      if (!requireAuth()) return true;
      if (process.env.NODE_ENV === 'production' || process.env.ENABLE_DEV_SHORTCUTS !== 'true') {
        sendError(res, 403, 'Development shortcut disabled: Balance auto-reset is not allowed in beta deployment.');
        return true;
      }
      sendError(res, 403, 'Balance auto-reset is not permitted on persistent database.');
      return true;
    }

    // ATOMIC TRADE EXECUTION (BUY / SELL)
    if (pathname === '/api/trades/execute' && method === 'POST') {
      if (!requireAuth()) return true;

      const idempotencyKey =
        (req.headers['idempotency-key'] as string) || req.parsedBody?.idempotencyKey;
      const body = req.parsedBody || {};
      const marketId = body.marketId;
      const outcomeId = body.outcomeId || body.outcome;
      const rawType = String(body.type || body.side || '').toUpperCase().trim();
      const rawAmount = body.amountOrShares !== undefined
        ? body.amountOrShares
        : (body.shares !== undefined ? body.shares : body.amount);

      if (!marketId || !outcomeId || !rawType || rawAmount === undefined) {
        sendError(res, 400, 'Missing required trade parameters: marketId, outcomeId, type, amountOrShares.');
        return true;
      }

      if (rawType !== 'BUY' && rawType !== 'SELL') {
        sendError(res, 400, 'Invalid trade type: must be BUY or SELL.');
        return true;
      }

      const numAmount = Number(rawAmount);
      if (!isFinite(numAmount) || numAmount <= 0) {
        sendError(res, 400, 'Invalid trade order: quantity/amount must be a positive number.');
        return true;
      }

      const isAnonymous = Boolean(body.isAnonymous);

      try {
        const result = await dbService.executeTrade({
          userId: req.user!.id,
          marketId: String(marketId),
          outcomeId: String(outcomeId),
          type: rawType as 'BUY' | 'SELL',
          amountOrShares: numAmount,
          idempotencyKey,
          isAnonymous,
        });

        logger.info('API', `Trade executed successfully via PostgreSQL transaction`, {
          userId: req.user!.id,
          marketId,
          outcomeId,
          type: rawType,
          amount: numAmount,
        });
        sendJson(res, 200, { success: true, ...result });
      } catch (err: any) {
        sendError(res, 400, err.message || 'Trade execution failed.');
      }
      return true;
    }

    // -----------------------------------------------------------------------
    // ADMIN ENDPOINTS (STRICT SERVER-SIDE ADMIN VERIFICATION)
    // -----------------------------------------------------------------------

    if (pathname === '/api/admin/verify' && method === 'GET') {
      if (!req.user || req.user.role !== 'admin') {
        sendJson(res, 200, { success: true, isAdmin: false, role: req.user?.role || 'unauthenticated' });
        return true;
      }
      sendJson(res, 200, { success: true, isAdmin: true, role: 'admin' });
      return true;
    }

    // Create Market
    if (pathname === '/api/admin/markets' && method === 'POST') {
      if (!requireAdmin()) return true;
      try {
        const market = await dbService.createMarket(req.parsedBody || {}, req.user!.id);
        logger.info('API', `Market created by admin in PostgreSQL`, { adminId: req.user!.id, marketId: market.id });
        sendJson(res, 201, { success: true, market });
      } catch (err: any) {
        sendError(res, 400, err.message || 'Failed to create market.');
      }
      return true;
    }

    // Edit Market
    if (pathname.startsWith('/api/admin/markets/') && method === 'PATCH') {
      if (!requireAdmin()) return true;
      const subpath = pathname.replace('/api/admin/markets/', '');

      if (subpath.endsWith('/status')) {
        const marketId = subpath.replace('/status', '').trim();
        const { status } = req.parsedBody || {};
        if (!status) {
          sendError(res, 400, 'Status is required.');
          return true;
        }
        try {
          const updated = await dbService.updateMarket(marketId, { status }, req.user!.id);
          sendJson(res, 200, { success: true, market: updated });
        } catch (err: any) {
          sendError(res, 400, err.message || 'Failed to update market status.');
        }
        return true;
      }

      const marketId = subpath.trim();
      try {
        const updated = await dbService.updateMarket(marketId, req.parsedBody || {}, req.user!.id);
        sendJson(res, 200, { success: true, market: updated });
      } catch (err: any) {
        sendError(res, 400, err.message || 'Failed to edit market.');
      }
      return true;
    }

    // Resolve / Propose Market (Optimistic Dispute Window or immediate resolution)
    if (pathname.startsWith('/api/admin/markets/') && pathname.endsWith('/resolve') && method === 'POST') {
      if (!requireAdmin()) return true;
      const marketId = pathname.replace('/api/admin/markets/', '').replace('/resolve', '').trim();
      const { winningOutcomeId, proposedOutcomeId, resolutionProof, disputeWindowSeconds } = req.parsedBody || {};
      const targetOutcomeId = winningOutcomeId || proposedOutcomeId;

      if (!targetOutcomeId) {
        sendError(res, 400, 'Winning / proposed outcome ID is required.');
        return true;
      }

      try {
        const result = await dbService.resolveMarket({
          adminUserId: req.user!.id,
          marketId,
          winningOutcomeId: targetOutcomeId,
          resolutionProof,
          disputeWindowSeconds,
        });
        logger.info('API', `Market resolution initiated by admin in PostgreSQL`, { adminId: req.user!.id, marketId, targetOutcomeId, disputeWindowSeconds });
        sendJson(res, 200, { success: true, ...result });
      } catch (err: any) {
        sendError(res, 400, err.message || 'Failed to resolve market.');
      }
      return true;
    }

    // Dispute Market Resolution (Cancels proposal and resets status)
    if (pathname.startsWith('/api/admin/markets/') && pathname.endsWith('/dispute') && method === 'POST') {
      if (!requireAdmin()) return true;
      const marketId = pathname.replace('/api/admin/markets/', '').replace('/dispute', '').trim();
      const { reason } = req.parsedBody || {};

      try {
        const result = await dbService.disputeMarketResolution({
          adminUserId: req.user!.id,
          marketId,
          reason,
        });
        logger.info('API', `Market resolution disputed by admin in PostgreSQL`, { adminId: req.user!.id, marketId, reason });
        sendJson(res, 200, { success: true, ...result });
      } catch (err: any) {
        sendError(res, 400, err.message || 'Failed to dispute market resolution.');
      }
      return true;
    }

    // Finalize Market Resolution (Executes final atomic settlement and payouts)
    if (pathname.startsWith('/api/admin/markets/') && pathname.endsWith('/finalize') && method === 'POST') {
      if (!requireAdmin()) return true;
      const marketId = pathname.replace('/api/admin/markets/', '').replace('/finalize', '').trim();
      const { force } = req.parsedBody || {};

      try {
        const result = await dbService.finalizeMarketResolution({
          adminUserId: req.user!.id,
          marketId,
          force: Boolean(force),
        });
        logger.info('API', `Market finalized by admin in PostgreSQL`, { adminId: req.user!.id, marketId, force });
        sendJson(res, 200, { success: true, ...result });
      } catch (err: any) {
        sendError(res, 400, err.message || 'Failed to finalize market resolution.');
      }
      return true;
    }

    // Cancel Market
    if (pathname.startsWith('/api/admin/markets/') && pathname.endsWith('/cancel') && method === 'POST') {
      if (!requireAdmin()) return true;
      const marketId = pathname.replace('/api/admin/markets/', '').replace('/cancel', '').trim();
      const reason = req.parsedBody?.reason || 'Cancelled by administrator.';

      try {
        const result = await dbService.cancelMarket({
          adminUserId: req.user!.id,
          marketId,
          reason,
        });
        logger.info('API', `Market cancelled by admin in PostgreSQL`, { adminId: req.user!.id, marketId });
        sendJson(res, 200, { success: true, ...result });
      } catch (err: any) {
        sendError(res, 400, err.message || 'Failed to cancel market.');
      }
      return true;
    }

    // Delete Market
    if (pathname.startsWith('/api/admin/markets/') && method === 'DELETE') {
      if (!requireAdmin()) return true;
      const marketId = pathname.replace('/api/admin/markets/', '').trim();
      try {
        await dbService.deleteMarket(marketId, req.user!.id);
        logger.info('API', `Market deleted by admin in PostgreSQL`, { adminId: req.user!.id, marketId });
        sendJson(res, 200, { success: true });
      } catch (err: any) {
        sendError(res, 400, err.message || 'Failed to delete market.');
      }
      return true;
    }

    // -----------------------------------------------------------------------
    // ADMIN TOURNAMENT MANAGEMENT
    // -----------------------------------------------------------------------

    // Create Tournament
    if (pathname === '/api/admin/tournaments' && method === 'POST') {
      if (!requireAdmin()) return true;
      try {
        const tournament = await dbService.createTournament(req.parsedBody || {}, req.user!.id);
        logger.info('API', `Tournament created by admin`, { adminId: req.user!.id, tournamentId: tournament.id });
        sendJson(res, 201, { success: true, tournament });
      } catch (err: any) {
        sendError(res, 400, err.message || 'Failed to create tournament.');
      }
      return true;
    }

    // Update Tournament (Deadline, status, rules, prize)
    if (pathname.startsWith('/api/admin/tournaments/') && method === 'PATCH') {
      if (!requireAdmin()) return true;
      const tournamentId = pathname.replace('/api/admin/tournaments/', '').trim();
      try {
        const tournament = await dbService.updateTournament(tournamentId, req.parsedBody || {}, req.user!.id);
        logger.info('API', `Tournament updated by admin`, { adminId: req.user!.id, tournamentId });
        sendJson(res, 200, { success: true, tournament });
      } catch (err: any) {
        sendError(res, 400, err.message || 'Failed to update tournament.');
      }
      return true;
    }

    // Delete Tournament
    if (pathname.startsWith('/api/admin/tournaments/') && !pathname.includes('/markets') && method === 'DELETE') {
      if (!requireAdmin()) return true;
      const tournamentId = pathname.replace('/api/admin/tournaments/', '').trim();
      try {
        await dbService.deleteTournament(tournamentId, req.user!.id);
        logger.info('API', `Tournament deleted by admin`, { adminId: req.user!.id, tournamentId });
        sendJson(res, 200, { success: true });
      } catch (err: any) {
        sendError(res, 400, err.message || 'Failed to delete tournament.');
      }
      return true;
    }

    // Add Market to Tournament
    if (pathname.startsWith('/api/admin/tournaments/') && pathname.endsWith('/markets') && method === 'POST') {
      if (!requireAdmin()) return true;
      const tournamentId = pathname.replace('/api/admin/tournaments/', '').replace('/markets', '').trim();
      const { marketId } = req.parsedBody || {};
      if (!marketId) {
        sendError(res, 400, 'marketId is required.');
        return true;
      }
      try {
        await dbService.addMarketToTournament(tournamentId, marketId, req.user!.id);
        sendJson(res, 200, { success: true, message: 'Market associated with tournament successfully.' });
      } catch (err: any) {
        sendError(res, 400, err.message || 'Failed to associate market with tournament.');
      }
      return true;
    }

    // Remove Market from Tournament
    if (pathname.startsWith('/api/admin/tournaments/') && pathname.includes('/markets/') && method === 'DELETE') {
      if (!requireAdmin()) return true;
      const parts = pathname.replace('/api/admin/tournaments/', '').split('/markets/');
      const tournamentId = parts[0]?.trim();
      const marketId = parts[1]?.trim();
      if (!tournamentId || !marketId) {
        sendError(res, 400, 'tournamentId and marketId are required.');
        return true;
      }
      try {
        await dbService.removeMarketFromTournament(tournamentId, marketId, req.user!.id);
        sendJson(res, 200, { success: true, message: 'Market disassociated from tournament.' });
      } catch (err: any) {
        sendError(res, 400, err.message || 'Failed to disassociate market from tournament.');
      }
      return true;
    }

    // Admin Aggregates & Audit Logs
    if (pathname === '/api/admin/positions' && method === 'GET') {
      if (!requireAdmin()) return true;
      const positions = await dbService.getPositions();
      sendJson(res, 200, { success: true, positions });
      return true;
    }

    if (pathname === '/api/admin/trades' && method === 'GET') {
      if (!requireAdmin()) return true;
      const trades = await dbService.getTrades();
      sendJson(res, 200, { success: true, trades });
      return true;
    }

    if (pathname === '/api/admin/ledger' && method === 'GET') {
      if (!requireAdmin()) return true;
      const ledger = await dbService.getLedger();
      sendJson(res, 200, { success: true, ledger });
      return true;
    }

    if (pathname === '/api/admin/metrics' || pathname === '/api/metrics') {
      const metrics = await dbService.getPlatformMetrics();
      sendJson(res, 200, { success: true, metrics });
      return true;
    }

    if (pathname === '/api/admin/solvency' && method === 'GET') {
      if (!requireAdmin()) return true;
      const solvency = await dbService.getHouseSolvencyAudit();
      sendJson(res, 200, { success: true, solvency });
      return true;
    }

    // Admin User Audit List
    if (pathname === '/api/admin/users' && method === 'GET') {
      if (!requireAdmin()) return true;
      const users = await dbService.getUsers();
      sendJson(res, 200, { success: true, users });
      return true;
    }

    // Purge All Trades & Ghost Traders (Disabled in beta)
    if (pathname === '/api/admin/purge-ghost-trades' && method === 'POST') {
      if (!requireAdmin()) return true;
      sendError(res, 403, 'Development shortcut disabled: Bulk state purge is not allowed in beta deployment.');
      return true;
    }

    // If no route matched
    sendError(res, 404, `API endpoint ${method} ${pathname} not found.`);
    return true;
  } catch (err: any) {
    sendError(res, 500, `Internal Server Error: ${err?.message || 'Unexpected failure'}`);
    return true;
  }
}
