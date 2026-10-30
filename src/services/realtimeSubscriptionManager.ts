/**
 * Supabase Realtime Subscription Manager
 * 
 * Separates all Supabase Realtime channel subscription logic from UI and state management:
 * - Public Channel ('public:markets'): Public market data, price/probability shifts, volume,
 *   traders count, market lifecycle (created, updated, resolved, cancelled, deleted),
 *   public trade executions, and PostgreSQL CDC changes.
 * - Private User Channel ('user:${userId}'): Strictly authenticated user financial events
 *   (balance, positions, trade executions, private notifications). Never broadcasts to other users.
 * - Admin Channel ('admin:updates'): Admin telemetry (volume, trades, P&L, commissions, spread).
 * - Connection Lifecycle: Handles CONNECTED, DISCONNECTED, RECONNECTING, ERROR states and
 *   triggers authoritative backend database resync upon reconnection so no stale data remains.
 * - Authoritative Model: Realtime events notify clients; state is always reconciled with the backend.
 */

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { Market, Position, Trade, User } from '../types';
import { getBrowserSupabase, initBrowserSupabase } from './supabaseClient';

export type RealtimeStatus = 'connected' | 'disconnected' | 'reconnecting' | 'error' | 'connecting';

export interface PublicMarketDataEvent {
  action: 'created' | 'updated' | 'resolved' | 'cancelled' | 'trade' | 'status_changed';
  market: Market;
  recentTrade?: Trade;
  winningOutcomeId?: string;
  reason?: string;
}

export interface TradeExecutionNotificationEvent {
  trade: Trade;
  market?: Market;
  isPublic: boolean;
}

export interface AdminUpdateEvent {
  type: string;
  trade?: Trade;
  marketId?: string;
  metrics?: any;
  totalPayout?: number;
  totalRefund?: number;
}

export interface UserFinancialUpdateEvent {
  userId: string;
  virtualBalance?: number;
  updatedPosition?: Position;
  trade?: Trade;
  notification?: {
    title: string;
    message: string;
    type: 'trade' | 'resolution' | 'pnl' | 'system' | 'market';
    marketId?: string;
  };
}

export interface MarketDeletedEvent {
  marketId: string;
}

export interface TournamentEvent {
  action: 'created' | 'updated' | 'deleted' | 'participant_joined' | 'market_added' | 'market_removed';
  tournament?: any;
  tournamentId?: string;
  marketId?: string;
}

export interface RealtimeConsumerHandlers {
  onPublicMarketDataChange: (event: PublicMarketDataEvent) => void;
  onTradeExecutionNotification: (event: TradeExecutionNotificationEvent) => void;
  onAdminUpdate: (event: AdminUpdateEvent) => void;
  onUserFinancialUpdate: (event: UserFinancialUpdateEvent) => void;
  onMarketDeleted: (event: MarketDeletedEvent) => void;
  onTournamentEvent?: (event: TournamentEvent) => void;
  onConnectionStatusChange: (status: RealtimeStatus) => void;
  onAuthoritativeResyncRequired: () => void;
}

export class SupabaseRealtimeSubscriptionManager {
  private supabase: SupabaseClient | null = null;
  private status: RealtimeStatus = 'connecting';
  private wasConnectedOnce = false;

  // Supabase Channels
  private publicChannel: RealtimeChannel | null = null;
  private userChannel: RealtimeChannel | null = null;
  private adminChannel: RealtimeChannel | null = null;

  // Authentication & Scoping
  private currentToken: string | null = null;
  private currentUserId: string | null = null;
  private currentUserRole: 'user' | 'admin' | null = null;

  // Fallback SSE Stream
  private eventSource: EventSource | null = null;
  private reconnectTimer: any = null;
  private reconnectAttempts = 0;

  // Registered consumer handlers (from MarketProvider)
  private handlers: RealtimeConsumerHandlers | null = null;

  // Short-lived deduplication set
  private processedEventIds = new Set<string>();

  public getStatus(): RealtimeStatus {
    return this.status;
  }

  private setStatus(newStatus: RealtimeStatus) {
    if (this.status === newStatus) return;
    this.status = newStatus;
    this.handlers?.onConnectionStatusChange(newStatus);
  }

  /**
   * Initializes the subscription manager with event consumer handlers from MarketProvider.
   */
  public async initialize(
    handlers: RealtimeConsumerHandlers,
    initialToken?: string | null,
    initialUser?: User | null
  ): Promise<void> {
    this.handlers = handlers;
    if (initialToken !== undefined) this.currentToken = initialToken;
    if (initialUser !== undefined) {
      this.currentUserId = initialUser?.id ?? null;
      this.currentUserRole = initialUser?.role ?? null;
    }

    await this.connect();
  }

  /**
   * Updates authentication state when user logs in, switches roles, or logs out.
   */
  public updateAuth(
    token: string | null,
    userId: string | null,
    role?: 'user' | 'admin' | null
  ): void {
    const tokenChanged = this.currentToken !== token;
    const userChanged = this.currentUserId !== userId || this.currentUserRole !== (role ?? null);

    this.currentToken = token;
    this.currentUserId = userId;
    this.currentUserRole = role ?? null;

    if (userChanged) {
      this.syncUserChannel();
      this.syncAdminChannel();
    }

    if (tokenChanged) {
      // Re-establish fallback stream with updated token header/query
      this.setupSseStream();
    }
  }

  /**
   * Main connection logic: connects to Supabase Realtime and redundant SSE stream.
   */
  public async connect(): Promise<void> {
    this.setStatus(this.wasConnectedOnce ? 'reconnecting' : 'connecting');

    // 1. Obtain browser-safe Supabase client
    try {
      this.supabase = getBrowserSupabase();
      if (!this.supabase) {
        this.supabase = await initBrowserSupabase();
      }
    } catch (err) {
      console.warn('[RealtimeSubscriptionManager] Supabase init notice:', err);
    }

    // 2. Setup Supabase Realtime Channels
    if (this.supabase) {
      await this.setupSupabaseChannels();
    } else {
      setTimeout(async () => {
        this.supabase = getBrowserSupabase() || (await initBrowserSupabase());
        if (this.supabase) {
          await this.setupSupabaseChannels();
        }
      }, 1000);
    }

    // 3. Setup redundant SSE fallback stream
    this.setupSseStream();
  }

  /**
   * Subscribes to Supabase Realtime Channels:
   * 1. 'public:markets' (public broadcasts + Postgres CDC)
   * 2. 'user:${userId}' (private user financial updates)
   * 3. 'admin:updates' (admin dashboard metrics and alerts)
   */
  private async setupSupabaseChannels(): Promise<void> {
    if (!this.supabase) return;

    // --- 1. Public Channel ('public:markets') ---
    if (!this.publicChannel) {
      const ch = this.supabase.channel('public:markets');

      // A. Public Broadcasts (instant, low latency)
      ch.on('broadcast', { event: 'market:update' }, ({ payload }) => {
        this.handleMarketUpdatePayload(payload);
      });

      ch.on('broadcast', { event: 'market:created' }, ({ payload }) => {
        this.handleMarketUpdatePayload({ market: payload, action: 'created' });
      });

      ch.on('broadcast', { event: 'market:updated' }, ({ payload }) => {
        this.handleMarketUpdatePayload({ market: payload, action: 'updated' });
      });

      ch.on('broadcast', { event: 'market:resolved' }, ({ payload }) => {
        this.handleMarketUpdatePayload({
          market: payload.market,
          action: 'resolved',
          winningOutcomeId: payload.winningOutcomeId,
        });
        this.handlers?.onAuthoritativeResyncRequired();
      });

      ch.on('broadcast', { event: 'market:cancelled' }, ({ payload }) => {
        this.handleMarketUpdatePayload({
          market: payload.market,
          action: 'cancelled',
          reason: payload.reason,
        });
        this.handlers?.onAuthoritativeResyncRequired();
      });

      ch.on('broadcast', { event: 'trade:public' }, ({ payload }) => {
        this.handlePublicTradePayload(payload);
      });

      ch.on('broadcast', { event: 'trade:executed' }, ({ payload }) => {
        if (payload?.trade) {
          this.handlePublicTradePayload({ trade: payload.trade });
        }
        if (payload?.market) {
          this.handleMarketUpdatePayload({
            market: payload.market,
            recentTrade: payload.trade,
            action: 'trade',
          });
        }
      });

      ch.on('broadcast', { event: 'market:deleted' }, ({ payload }) => {
        const marketId = payload?.marketId || payload?.id;
        if (marketId) {
          this.handlers?.onMarketDeleted({ marketId });
        }
      });

      // C. Tournament Broadcasts
      ch.on('broadcast', { event: 'tournament:created' }, ({ payload }) => {
        this.handleTournamentPayload({ action: 'created', tournament: payload?.tournament || payload });
      });

      ch.on('broadcast', { event: 'tournament:updated' }, ({ payload }) => {
        this.handleTournamentPayload({ action: 'updated', tournament: payload?.tournament || payload });
      });

      ch.on('broadcast', { event: 'tournament:deleted' }, ({ payload }) => {
        this.handleTournamentPayload({ action: 'deleted', tournamentId: payload?.tournamentId || payload?.id });
      });

      ch.on('broadcast', { event: 'tournament:participant_joined' }, ({ payload }) => {
        this.handleTournamentPayload({ action: 'participant_joined', tournamentId: payload?.tournamentId });
      });

      ch.on('broadcast', { event: 'tournament:market_added' }, ({ payload }) => {
        this.handleTournamentPayload({ action: 'market_added', tournamentId: payload?.tournamentId, marketId: payload?.marketId });
      });

      ch.on('broadcast', { event: 'tournament:market_removed' }, ({ payload }) => {
        this.handleTournamentPayload({ action: 'market_removed', tournamentId: payload?.tournamentId, marketId: payload?.marketId });
      });

      // D. PostgreSQL Database Changes (Change Data Capture)
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'markets' }, () => {
        this.handlers?.onAuthoritativeResyncRequired();
      });

      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'market_outcomes' }, () => {
        this.handlers?.onAuthoritativeResyncRequired();
      });

      ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trades' }, () => {
        this.handlers?.onAuthoritativeResyncRequired();
      });

      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, () => {
        this.handlers?.onAuthoritativeResyncRequired();
      });

      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_participants' }, () => {
        this.handlers?.onAuthoritativeResyncRequired();
      });

      // Channel lifecycle status handling
      ch.subscribe((subStatus) => {
        if (subStatus === 'SUBSCRIBED') {
          const wasReconnecting = this.status === 'reconnecting' || this.status === 'error';
          this.wasConnectedOnce = true;
          this.setStatus('connected');
          this.reconnectAttempts = 0;

          // Reconcile client with latest database state after any interruption
          if (wasReconnecting) {
            this.handlers?.onAuthoritativeResyncRequired();
          }
        } else if (subStatus === 'TIMED_OUT' || subStatus === 'CHANNEL_ERROR') {
          this.setStatus(this.wasConnectedOnce ? 'reconnecting' : 'error');
          this.scheduleReconnect();
        } else if (subStatus === 'CLOSED') {
          if (this.status === 'connected') {
            this.setStatus('disconnected');
          }
        }
      });

      this.publicChannel = ch;
    }

    // --- 2. Private User Channel ('user:${userId}') ---
    this.syncUserChannel();

    // --- 3. Admin Updates Channel ('admin:updates') ---
    this.syncAdminChannel();
  }

  /**
   * Strictly manages private user channel:
   * Only subscribes to `user:${currentUserId}` when authenticated.
   * Never exposes or subscribes to another user's channel.
   */
  private syncUserChannel(): void {
    if (!this.supabase) return;

    if (!this.currentUserId) {
      if (this.userChannel) {
        this.supabase.removeChannel(this.userChannel);
        this.userChannel = null;
      }
      return;
    }

    const expectedTopic = `user:${this.currentUserId}`;
    if (this.userChannel && this.userChannel.topic === `realtime:${expectedTopic}`) {
      return;
    }

    if (this.userChannel) {
      this.supabase.removeChannel(this.userChannel);
      this.userChannel = null;
    }

    const uCh = this.supabase.channel(expectedTopic);

    uCh.on('broadcast', { event: 'user:update' }, ({ payload }) => {
      if (!payload || payload.userId !== this.currentUserId) return;
      this.handleUserUpdatePayload(payload);
    });

    uCh.on('broadcast', { event: 'user:updated' }, ({ payload }) => {
      if (!payload || payload.id !== this.currentUserId) return;
      this.handleUserUpdatePayload({
        userId: payload.id,
        virtualBalance: payload.virtualBalance,
      });
      this.handlers?.onAuthoritativeResyncRequired();
    });

    uCh.on('broadcast', { event: 'position:updated' }, ({ payload }) => {
      if (!payload || payload.userId !== this.currentUserId) return;
      this.handleUserUpdatePayload({
        userId: payload.userId,
        updatedPosition: payload,
      });
      this.handlers?.onAuthoritativeResyncRequired();
    });

    uCh.subscribe();
    this.userChannel = uCh;
  }

  /**
   * Manages admin channel:
   * Only active if the authenticated user has role 'admin'.
   */
  private syncAdminChannel(): void {
    if (!this.supabase) return;

    if (this.currentUserRole !== 'admin') {
      if (this.adminChannel) {
        this.supabase.removeChannel(this.adminChannel);
        this.adminChannel = null;
      }
      return;
    }

    if (this.adminChannel) return;

    const admCh = this.supabase.channel('admin:updates');

    admCh.on('broadcast', { event: 'admin:update' }, ({ payload }) => {
      this.handlers?.onAdminUpdate(payload);
    });

    admCh.subscribe();
    this.adminChannel = admCh;
  }

  /**
   * Complementary SSE fallback stream for multi-channel reliability
   */
  private setupSseStream(): void {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch {}
      this.eventSource = null;
    }

    const url = new URL('/api/events', window.location.origin);
    if (this.currentToken) {
      url.searchParams.set('token', this.currentToken);
    }

    try {
      const es = new EventSource(url.toString());
      this.eventSource = es;

      es.onopen = () => {
        this.wasConnectedOnce = true;
        this.setStatus('connected');
        this.reconnectAttempts = 0;
      };

      es.addEventListener('market:update', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          this.handleMarketUpdatePayload(data);
        } catch {}
      });

      es.addEventListener('trade:public', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          this.handlePublicTradePayload(data);
        } catch {}
      });

      es.addEventListener('user:update', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          this.handleUserUpdatePayload(data);
        } catch {}
      });

      es.addEventListener('admin:update', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          this.handlers?.onAdminUpdate(data);
        } catch {}
      });

      es.addEventListener('market:deleted', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          const marketId = data?.marketId || data?.id;
          if (marketId) {
            this.handlers?.onMarketDeleted({ marketId });
          }
        } catch {}
      });

      // Tournament events via SSE
      es.addEventListener('tournament:created', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          this.handleTournamentPayload({ action: 'created', tournament: data?.tournament || data });
        } catch {}
      });

      es.addEventListener('tournament:updated', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          this.handleTournamentPayload({ action: 'updated', tournament: data?.tournament || data });
        } catch {}
      });

      es.addEventListener('tournament:deleted', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          this.handleTournamentPayload({ action: 'deleted', tournamentId: data?.tournamentId || data?.id });
        } catch {}
      });

      es.addEventListener('tournament:participant_joined', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          this.handleTournamentPayload({ action: 'participant_joined', tournamentId: data?.tournamentId });
        } catch {}
      });

      es.addEventListener('tournament:market_added', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          this.handleTournamentPayload({ action: 'market_added', tournamentId: data?.tournamentId, marketId: data?.marketId });
        } catch {}
      });

      es.addEventListener('tournament:market_removed', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          this.handleTournamentPayload({ action: 'market_removed', tournamentId: data?.tournamentId, marketId: data?.marketId });
        } catch {}
      });

      es.onerror = () => {
        if (this.status !== 'connected') {
          this.setStatus(this.wasConnectedOnce ? 'reconnecting' : 'error');
        }
      };
    } catch {}
  }

  // --- Internal Deduplication & Event Handlers ---

  private handleMarketUpdatePayload(payload: any): void {
    if (!payload) return;
    const market = payload.market || payload;
    if (!market || !market.id) return;

    // Build comprehensive deduplication key that includes outcome prices, probabilities, and volume
    // This prevents dropping legitimate price/probability shifts that occur with matching volume
    const outcomePrices = (market.outcomes || [])
      .map((o: any) => `${o.id}:${o.currentPrice ?? o.buyPrice}:${o.q}`)
      .join('|');
    const dedupKey = `mkt:${market.id}:${market.volume || 0}:${market.totalTrades || 0}:${market.status}:${outcomePrices}:${market.updatedAt || ''}`;
    if (this.isDuplicate(dedupKey)) return;

    const event: PublicMarketDataEvent = {
      action: payload.action || 'updated',
      market,
      recentTrade: payload.recentTrade,
      winningOutcomeId: payload.winningOutcomeId,
      reason: payload.reason,
    };

    try {
      this.handlers?.onPublicMarketDataChange(event);
    } catch (err) {
      console.error('[RealtimeSubscriptionManager] onPublicMarketDataChange handler error:', err);
    }

    if (payload.recentTrade) {
      this.handlePublicTradePayload({ trade: payload.recentTrade, market });
    }
  }

  private handleTournamentPayload(event: TournamentEvent): void {
    if (!event) return;
    try {
      this.handlers?.onTournamentEvent?.(event);
    } catch (err) {
      console.error('[RealtimeSubscriptionManager] onTournamentEvent handler error:', err);
    }
  }

  private handlePublicTradePayload(payload: any): void {
    if (!payload || !payload.trade) return;
    const trade = payload.trade;
    const dedupKey = `trade:${trade.id}`;
    if (this.isDuplicate(dedupKey)) return;

    try {
      this.handlers?.onTradeExecutionNotification({
        trade,
        market: payload.market,
        isPublic: true,
      });
    } catch (err) {
      console.error('[RealtimeSubscriptionManager] onTradeExecutionNotification handler error:', err);
    }
  }

  private handleUserUpdatePayload(payload: UserFinancialUpdateEvent): void {
    if (!payload || !payload.userId) return;
    // Strictly isolate: verify target user matches authenticated session
    if (payload.userId !== this.currentUserId) return;

    const dedupKey = `usr:${payload.userId}:${payload.virtualBalance ?? ''}:${payload.trade?.id ?? ''}:${payload.updatedPosition?.quantity ?? ''}`;
    if (this.isDuplicate(dedupKey)) return;

    try {
      this.handlers?.onUserFinancialUpdate(payload);
    } catch (err) {
      console.error('[RealtimeSubscriptionManager] onUserFinancialUpdate handler error:', err);
    }
  }

  private isDuplicate(key: string): boolean {
    if (this.processedEventIds.has(key)) return true;
    this.processedEventIds.add(key);
    if (this.processedEventIds.size > 500) {
      const oldest = this.processedEventIds.values().next().value;
      if (oldest) this.processedEventIds.delete(oldest);
    }
    return false;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);

    this.setStatus('reconnecting');
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      await this.connect();
    }, delay);
  }

  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.publicChannel && this.supabase) {
      this.supabase.removeChannel(this.publicChannel);
      this.publicChannel = null;
    }

    if (this.userChannel && this.supabase) {
      this.supabase.removeChannel(this.userChannel);
      this.userChannel = null;
    }

    if (this.adminChannel && this.supabase) {
      this.supabase.removeChannel(this.adminChannel);
      this.adminChannel = null;
    }

    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch {}
      this.eventSource = null;
    }

    this.setStatus('disconnected');
  }

  public reconnect(): void {
    this.disconnect();
    this.connect();
    this.handlers?.onAuthoritativeResyncRequired();
  }
}

export const realtimeSubscriptionManager = new SupabaseRealtimeSubscriptionManager();
