/**
 * API Client Service Layer
 * 
 * Communicates authoritatively with the backend HTTP REST API.
 * All financial math, trade execution, market resolution, balance deductions,
 * and ledger updates occur strictly on the server.
 */

import { Market, Position, Trade, User, LeaderboardUser, Category, MarketStatus, Tournament, TournamentParticipant, PlatformMetrics } from '../types';

const TOKEN_KEY = 'centra_auth_token_v3';
const USER_KEY = 'centra_user_v3';
const EXPLICIT_LOGOUT_KEY = 'centra_explicit_logout';

class ApiClient {
  private inMemoryToken: string | null = null;
  private inMemoryUser: User | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      let token: string | null = null;
      let rawUser: string | null = null;

      // 1. Check tab-scoped sessionStorage first to support independent multi-tab testing
      try {
        token = window.sessionStorage?.getItem(TOKEN_KEY) || null;
        rawUser = window.sessionStorage?.getItem(USER_KEY) || null;
      } catch {
        // Handle restricted storage access
      }

      const wasExplicitlyLoggedOut = (() => {
        try {
          return window.sessionStorage?.getItem(EXPLICIT_LOGOUT_KEY) === 'true';
        } catch {
          return false;
        }
      })();

      // 2. If no tab-specific session and not explicitly logged out in this tab, seed from localStorage
      if (!token && !wasExplicitlyLoggedOut && typeof window.localStorage !== 'undefined') {
        try {
          token = window.localStorage.getItem(TOKEN_KEY);
          rawUser = window.localStorage.getItem(USER_KEY);
          if (token && window.sessionStorage) {
            window.sessionStorage.setItem(TOKEN_KEY, token);
            if (rawUser) window.sessionStorage.setItem(USER_KEY, rawUser);
          }
        } catch {
          // ignore
        }
      }

      this.inMemoryToken = token;
      if (rawUser) {
        try {
          this.inMemoryUser = JSON.parse(rawUser);
        } catch {
          // ignore
        }
      }
    }
  }

  public getToken(): string | null {
    if (this.inMemoryToken) return this.inMemoryToken;
    if (typeof window !== 'undefined') {
      let token: string | null = null;
      try {
        token = window.sessionStorage?.getItem(TOKEN_KEY) || null;
      } catch {
        // ignore
      }

      const wasExplicitlyLoggedOut = (() => {
        try {
          return window.sessionStorage?.getItem(EXPLICIT_LOGOUT_KEY) === 'true';
        } catch {
          return false;
        }
      })();

      if (!token && !wasExplicitlyLoggedOut && typeof window.localStorage !== 'undefined') {
        try {
          token = window.localStorage.getItem(TOKEN_KEY);
          if (token && window.sessionStorage) {
            window.sessionStorage.setItem(TOKEN_KEY, token);
          }
        } catch {
          // ignore
        }
      }
      this.inMemoryToken = token;
    }
    return this.inMemoryToken;
  }

  public setToken(token: string | null): void {
    this.inMemoryToken = token;
    if (typeof window !== 'undefined') {
      if (token) {
        try {
          window.sessionStorage?.setItem(TOKEN_KEY, token);
          window.sessionStorage?.removeItem(EXPLICIT_LOGOUT_KEY);
        } catch {
          // ignore
        }
        try {
          window.localStorage?.setItem(TOKEN_KEY, token);
        } catch {
          // ignore
        }
      } else {
        try {
          window.sessionStorage?.removeItem(TOKEN_KEY);
          window.sessionStorage?.setItem(EXPLICIT_LOGOUT_KEY, 'true');
        } catch {
          // ignore
        }
        // Retain localStorage on single tab logout to prevent unexpected logout of other testing tabs
      }
    }
  }

  public setCachedUser(user: User | null): void {
    this.inMemoryUser = user;
    if (typeof window !== 'undefined') {
      if (user) {
        const serialized = JSON.stringify(user);
        try {
          window.sessionStorage?.setItem(USER_KEY, serialized);
        } catch {
          // ignore
        }
        try {
          window.localStorage?.setItem(USER_KEY, serialized);
        } catch {
          // ignore
        }
      } else {
        try {
          window.sessionStorage?.removeItem(USER_KEY);
        } catch {
          // ignore
        }
      }
    }
  }

  /**
   * Universal fetch wrapper with authorization header injection
   */
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && options.method && options.method !== 'GET') {
      headers.set('Content-Type', 'application/json');
    }

    const token = this.getToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const baseUrl = typeof window !== 'undefined' ? '' : 'http://localhost:3000';
    const response = await fetch(`${baseUrl}${path}`, {
      cache: 'no-store',
      ...options,
      headers,
    });

    const contentType = response.headers.get('content-type') || '';
    let data: any = null;
    if (contentType.includes('application/json')) {
      data = await response.json().catch(() => null);
    } else {
      const text = await response.text().catch(() => '');
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      if (response.status === 401) {
        // Automatically clear stale or revoked credentials unless it is an admin PIN challenge
        const isPinChallenge = data?.requiresAdminPin || /Administrator master PIN is required/i.test(data?.error || '');
        if (!isPinChallenge) {
          this.setToken(null);
          this.setCachedUser(null);
        }
      }
      const err: any = new Error(data?.error || `Request failed with status ${response.status}`);
      if (data?.requiresAdminPin) {
        err.requiresAdminPin = true;
      }
      throw err;
    }

    if (!data || typeof data !== 'object') {
      throw new Error(`API endpoint ${path} returned an unexpected response format.`);
    }

    return data as T;
  }

  // --- Auth Operations ---

  public async login(identifier: string, password?: string, adminPin?: string): Promise<User> {
    const res = await this.request<{ success: boolean; user: User; token: string }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({
          identifier,
          username: identifier,
          email: identifier,
          password,
          adminPin,
        }),
      }
    );

    if (!res || !res.user) {
      throw new Error('Authentication succeeded but invalid user profile was returned.');
    }

    this.setToken(res.token);
    this.setCachedUser(res.user);
    return res.user;
  }

  public async register(username: string, password: string, phoneNumber?: string, name?: string, email?: string): Promise<User> {
    const res = await this.request<{ success: boolean; user: User; token: string }>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({
          username,
          password,
          phoneNumber,
          name: name || username,
          email,
        }),
      }
    );

    if (!res || !res.user) {
      throw new Error('Registration succeeded but invalid user profile was returned.');
    }

    this.setToken(res.token);
    this.setCachedUser(res.user);
    return res.user;
  }

  public async logout(): Promise<null> {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    this.setToken(null);
    this.setCachedUser(null);
    return null;
  }

  public async getUser(userId?: string): Promise<User | null> {
    const token = this.getToken();
    if (!token) {
      this.setCachedUser(null);
      return null;
    }

    try {
      const res = await this.request<{ success: boolean; user: User }>('/api/auth/me');
      if (res.user) {
        this.setCachedUser(res.user);
        return res.user;
      }
    } catch {
      this.setToken(null);
      this.setCachedUser(null);
      return null;
    }
    return null;
  }

  public async verifyAdminRole(emailOrId?: string): Promise<boolean> {
    const token = this.getToken();
    if (!token) return false;
    try {
      const res = await this.request<{ success: boolean; isAdmin: boolean }>('/api/admin/verify');
      return Boolean(res?.isAdmin);
    } catch {
      return false;
    }
  }

  // --- Market Data ---

  public async getMarkets(): Promise<Market[]> {
    const res = await this.request<{ success: boolean; markets: Market[] }>('/api/markets');
    return res.markets || [];
  }

  public async getLeaderboard(): Promise<LeaderboardUser[]> {
    try {
      const res = await this.request<{ success: boolean; leaderboard: LeaderboardUser[] }>('/api/leaderboard');
      return res.leaderboard || [];
    } catch {
      return [];
    }
  }

  public async getPlatformMetrics(): Promise<PlatformMetrics> {
    try {
      const res = await this.request<{ success: boolean; metrics: PlatformMetrics }>('/api/metrics');
      return res.metrics;
    } catch {
      return {
        totalUsers: 0,
        activeUsers: 0,
        activeMarkets: 0,
        totalVolume: 0,
        totalRevenue: 0,
        netRevenue: 0,
        commissionRevenue: 0,
        spreadRevenue: 0,
        totalVirtualCapital: 0,
        openExposure: 0,
        resolvedMarkets: 0,
      };
    }
  }

  public async getAdminUsers(): Promise<User[]> {
    try {
      const res = await this.request<{ success: boolean; users: User[] }>('/api/admin/users');
      return res.users || [];
    } catch {
      return [];
    }
  }

  public async getMarketById(id: string): Promise<Market | null> {
    try {
      const res = await this.request<{ success: boolean; market: Market }>(`/api/markets/${id}`);
      return res.market || null;
    } catch {
      return null;
    }
  }

  // --- Positions & Trades ---

  public async getPositions(userId?: string): Promise<Position[]> {
    const token = this.getToken();
    if (!token) {
      return [];
    }
    const cached = this.inMemoryUser;
    // If admin viewing all positions
    if (!userId && cached?.role === 'admin') {
      try {
        const res = await this.request<{ success: boolean; positions: Position[] }>('/api/admin/positions');
        return res.positions || [];
      } catch {
        return [];
      }
    }

    try {
      const res = await this.request<{ success: boolean; positions: Position[] }>('/api/positions');
      return res.positions || [];
    } catch {
      return [];
    }
  }

  public async getTrades(userId?: string): Promise<Trade[]> {
    const token = this.getToken();
    if (!token) {
      return [];
    }
    const cached = this.inMemoryUser;
    if (!userId && cached?.role === 'admin') {
      try {
        const res = await this.request<{ success: boolean; trades: Trade[] }>('/api/admin/trades');
        return res.trades || [];
      } catch {
        return [];
      }
    }

    try {
      const res = await this.request<{ success: boolean; trades: Trade[] }>('/api/trades');
      return res.trades || [];
    } catch {
      return [];
    }
  }

  public async getPublicTrades(marketId?: string): Promise<Trade[]> {
    const query = marketId ? `?marketId=${encodeURIComponent(marketId)}` : '';
    const res = await this.request<{ success: boolean; trades: Trade[] }>(`/api/trades/public${query}`);
    return res.trades || [];
  }

  // --- Trade Execution (Authoritative Server-Side) ---

  public async executeTrade(params: {
    userId: string;
    userName: string;
    marketId: string;
    outcomeId: string;
    type: 'BUY' | 'SELL';
    amountOrShares: number;
  }): Promise<{ trade: Trade; updatedUser: User; updatedMarket: Market; updatedPosition: Position }> {
    const idempotencyKey = `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const res = await this.request<{
      success: boolean;
      trade: Trade;
      updatedUser: User;
      updatedMarket: Market;
      updatedPosition: Position;
    }>('/api/trades/execute', {
      method: 'POST',
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        marketId: params.marketId,
        outcomeId: params.outcomeId,
        type: params.type,
        amountOrShares: params.amountOrShares,
        idempotencyKey,
      }),
    });

    this.setCachedUser(res.updatedUser);
    return res;
  }

  // --- Admin Operations ---

  public async createMarket(
    marketData: Omit<Market, 'id' | 'createdAt' | 'volume' | 'totalTraders' | 'priceHistory'>
  ): Promise<Market> {
    const res = await this.request<{ success: boolean; market: Market }>('/api/admin/markets', {
      method: 'POST',
      body: JSON.stringify(marketData),
    });
    return res.market;
  }

  public async editMarket(
    marketId: string,
    updates: Partial<Omit<Market, 'id' | 'createdAt' | 'priceHistory'>> & {
      liquidityParameter?: number;
      outcomesUpdates?: { id: string; name?: string; initialProbability?: number; color?: string }[];
    }
  ): Promise<Market> {
    const res = await this.request<{ success: boolean; market: Market }>(
      `/api/admin/markets/${marketId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }
    );
    return res.market;
  }

  public async updateMarketStatus(marketId: string, status: MarketStatus): Promise<Market> {
    const res = await this.request<{ success: boolean; market: Market }>(
      `/api/admin/markets/${marketId}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }
    );
    return res.market;
  }

  public async resolveMarket(
    marketId: string,
    winningOutcomeId: string,
    options?: { resolutionProof?: string; disputeWindowSeconds?: number }
  ): Promise<{ market: Market; userPayout: number; disputeDeadline?: string }> {
    const res = await this.request<{ success: boolean; market: Market; userPayout: number; disputeDeadline?: string }>(
      `/api/admin/markets/${marketId}/resolve`,
      {
        method: 'POST',
        body: JSON.stringify({
          winningOutcomeId,
          resolutionProof: options?.resolutionProof,
          disputeWindowSeconds: options?.disputeWindowSeconds,
        }),
      }
    );
    return res;
  }

  public async disputeMarket(
    marketId: string,
    reason?: string
  ): Promise<{ market: Market }> {
    const res = await this.request<{ success: boolean; market: Market }>(
      `/api/admin/markets/${marketId}/dispute`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    );
    return res;
  }

  public async finalizeMarket(
    marketId: string,
    force?: boolean
  ): Promise<{ market: Market; settlement: any }> {
    const res = await this.request<{ success: boolean; market: Market; settlement: any }>(
      `/api/admin/markets/${marketId}/finalize`,
      {
        method: 'POST',
        body: JSON.stringify({ force }),
      }
    );
    return res;
  }

  public async cancelMarket(marketId: string): Promise<{ market: Market; refundAmount: number }> {
    const res = await this.request<{ success: boolean; market: Market; refundAmount: number }>(
      `/api/admin/markets/${marketId}/cancel`,
      {
        method: 'POST',
      }
    );
    return res;
  }

  public async deleteMarket(marketId: string): Promise<void> {
    await this.request(`/api/admin/markets/${marketId}`, {
      method: 'DELETE',
    });
  }

  public async getLedger(): Promise<any[]> {
    const token = this.getToken();
    if (!token) return [];
    try {
      const res = await this.request<{ success: boolean; ledger: any[] }>('/api/ledger');
      return res.ledger || [];
    } catch {
      return [];
    }
  }

  public async getAdminLedger(): Promise<any[]> {
    const token = this.getToken();
    if (!token) return [];
    try {
      const res = await this.request<{ success: boolean; ledger: any[] }>('/api/admin/ledger');
      return res.ledger || [];
    } catch {
      return [];
    }
  }

  public async checkHealth(): Promise<{ status: string; database: string }> {
    return await this.request<{ status: string; database: string }>('/api/health');
  }

  public async resetDemoData(): Promise<void> {
    const res = await this.request<{ success: boolean; user: User }>('/api/user/reset-demo', {
      method: 'POST',
    });
    if (res.user) {
      this.setCachedUser(res.user);
    }
  }

  public async purgeGhostTrades(): Promise<{ purgedTrades: number; purgedPositions: number; marketsCleaned: number }> {
    return await this.request('/api/admin/purge-ghost-trades', {
      method: 'POST',
    });
  }

  public async clearAllMarkets(): Promise<void> {
    const markets = await this.getMarkets();
    for (const m of markets) {
      try {
        await this.deleteMarket(m.id);
      } catch {
        // ignore
      }
    }
  }

  // =========================================================================
  // TOURNAMENTS & TESTING ARENA
  // =========================================================================

  public async getTournaments(): Promise<Tournament[]> {
    try {
      const res = await this.request<{ success: boolean; tournaments: Tournament[] }>('/api/tournaments');
      return res.tournaments || [];
    } catch {
      return [];
    }
  }

  public async getTournament(id: string): Promise<Tournament> {
    const res = await this.request<{ success: boolean; tournament: Tournament }>(`/api/tournaments/${id}`);
    return res.tournament;
  }

  public async getTournamentLeaderboard(tournamentId: string): Promise<LeaderboardUser[]> {
    try {
      const res = await this.request<{ success: boolean; leaderboard: LeaderboardUser[] }>(
        `/api/tournaments/${tournamentId}/leaderboard`
      );
      return res.leaderboard || [];
    } catch {
      return [];
    }
  }

  public async joinTournament(tournamentId: string): Promise<void> {
    await this.request<{ success: boolean; message: string }>(`/api/tournaments/${tournamentId}/join`, {
      method: 'POST',
    });
  }

  public async createTournament(tournamentData: Partial<Tournament>): Promise<Tournament> {
    const res = await this.request<{ success: boolean; tournament: Tournament }>('/api/admin/tournaments', {
      method: 'POST',
      body: JSON.stringify(tournamentData),
    });
    return res.tournament;
  }

  public async updateTournament(id: string, updates: Partial<Tournament>): Promise<Tournament> {
    const res = await this.request<{ success: boolean; tournament: Tournament }>(`/api/admin/tournaments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    return res.tournament;
  }

  public async getTournamentMarkets(tournamentId: string): Promise<Market[]> {
    try {
      const res = await this.request<{ success: boolean; markets: Market[] }>(
        `/api/tournaments/${tournamentId}/markets`
      );
      return res.markets || [];
    } catch {
      return [];
    }
  }

  public async getTournamentParticipant(tournamentId: string): Promise<TournamentParticipant | null> {
    try {
      const res = await this.request<{ success: boolean; participant: TournamentParticipant | null }>(
        `/api/tournaments/${tournamentId}/participant`
      );
      return res.participant || null;
    } catch {
      return null;
    }
  }

  public async addMarketToTournament(tournamentId: string, marketId: string): Promise<void> {
    await this.request<{ success: boolean; message: string }>(`/api/admin/tournaments/${tournamentId}/markets`, {
      method: 'POST',
      body: JSON.stringify({ marketId }),
    });
  }

  public async removeMarketFromTournament(tournamentId: string, marketId: string): Promise<void> {
    await this.request<{ success: boolean; message: string }>(
      `/api/admin/tournaments/${tournamentId}/markets/${marketId}`,
      {
        method: 'DELETE',
      }
    );
  }

  public async deleteTournament(id: string): Promise<void> {
    await this.request<{ success: boolean }>(`/api/admin/tournaments/${id}`, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient();
