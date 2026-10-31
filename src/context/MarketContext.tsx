import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Market, Position, Trade, User, PlatformMetrics, NotificationItem, Category, MarketStatus, Tournament, LeaderboardUser, TournamentParticipant, UserTournamentParticipation } from '../types';
import { apiClient } from '../services/apiClient';
import {
  realtimeSubscriptionManager,
  RealtimeStatus,
  PublicMarketDataEvent,
  TradeExecutionNotificationEvent,
  AdminUpdateEvent,
  UserFinancialUpdateEvent,
  MarketDeletedEvent,
  TournamentEvent,
} from '../services/realtimeSubscriptionManager';
import { useRealtimeSubscriptionManager } from './useRealtimeSubscriptionManager';
import { MarketEngine } from '../services/marketEngine';
import { LMSREngine } from '../services/lmsrEngine';
import { RiskEngine } from '../services/riskEngine';

export type NavigationTarget = 'home' | 'markets' | 'detail' | 'portfolio' | 'history' | 'leaderboard' | 'tournaments' | 'profile' | 'admin';
export type AdminSubView = 'overview' | 'revenue' | 'risk' | 'markets' | 'create' | 'tournaments' | 'users';
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface SystemAlert {
  type: 'database_unavailable' | 'server_error';
  title: string;
  message: string;
  timestamp: string;
}

interface MarketContextType {
  markets: Market[];
  positions: Position[];
  allPositions: Position[];
  trades: Trade[];
  allTrades: Trade[];
  user: User | null;
  authStatus: AuthStatus;
  realtimeStatus: RealtimeStatus;
  metrics: PlatformMetrics;
  platformBalance: number;
  notifications: NotificationItem[];
  currentView: NavigationTarget;
  selectedMarketId: string | null;
  adminSubView: AdminSubView;
  isSimulationActive: boolean;
  searchQuery: string;
  selectedCategory: Category | 'All';
  isAuthModalOpen: boolean;
  isWelcomeModalOpen: boolean;
  activeRole: 'user' | 'admin';
  loading: boolean;
  systemAlert: SystemAlert | null;

  // Tournaments Arena
  tournaments: Tournament[];
  selectedTournamentId: string | null;
  selectedTournament: Tournament | null;
  tournamentLeaderboard: LeaderboardUser[];
  tournamentMarkets: Market[];
  loadingTournaments: boolean;
  loadingTournamentMarkets: boolean;
  userTournamentParticipant: TournamentParticipant | null;
  userTournaments: UserTournamentParticipation[];
  setSelectedTournamentId: (id: string | null) => void;
  loadTournaments: (silent?: boolean) => Promise<void>;
  loadUserTournaments: () => Promise<UserTournamentParticipation[]>;
  loadTournamentLeaderboard: (tournamentId: string) => Promise<LeaderboardUser[]>;
  loadTournamentMarkets: (tournamentId: string, silent?: boolean) => Promise<Market[]>;
  loadUserTournamentParticipant: (tournamentId: string) => Promise<TournamentParticipant | null>;
  addMarketToTournament: (tournamentId: string, marketId: string) => Promise<void>;
  removeMarketFromTournament: (tournamentId: string, marketId: string) => Promise<void>;
  joinTournament: (tournamentId: string) => Promise<void>;
  createTournament: (data: Partial<Tournament>) => Promise<Tournament>;
  updateTournament: (id: string, updates: Partial<Tournament>) => Promise<Tournament>;
  deleteTournament: (id: string) => Promise<void>;
  
  // Actions
  navigateTo: (view: NavigationTarget, marketId?: string) => void;
  setAdminSubView: (subview: AdminSubView) => void;
  toggleSimulation: () => void;
  setSearchQuery: (q: string) => void;
  setSelectedCategory: (cat: Category | 'All') => void;
  setIsAuthModalOpen: (open: boolean) => void;
  setIsWelcomeModalOpen: (open: boolean) => void;
  switchUserRole: (role: 'user' | 'admin') => void;
  login: (usernameOrEmail: string, password?: string, adminPin?: string) => Promise<User>;
  register: (username: string, password: string, phoneNumber: string, name?: string, email?: string) => Promise<User>;
  logout: () => Promise<void>;
  retryConnection: () => Promise<void>;
  clearSystemAlert: () => void;
  executeTrade: (params: {
    marketId: string;
    outcomeId: string;
    type: 'BUY' | 'SELL';
    amountOrShares: number;
    isAnonymous?: boolean;
  }) => Promise<{ success: boolean; message: string }>;
  partialSellPosition: (position: Position, sharesToSell: number) => Promise<boolean>;
  createMarket: (marketData: Omit<Market, 'id' | 'createdAt' | 'volume' | 'totalTraders' | 'priceHistory'>) => Promise<Market>;
  editMarket: (
    marketId: string,
    updates: Partial<Omit<Market, 'id' | 'createdAt' | 'priceHistory'>> & {
      liquidityParameter?: number;
      outcomesUpdates?: { id: string; name?: string; initialProbability?: number; color?: string }[];
    }
  ) => Promise<Market>;
  updateMarketLiquidity: (marketId: string, liquidityParameter: number) => Promise<void>;
  updateMarketStatus: (marketId: string, status: MarketStatus) => Promise<void>;
  cancelMarket: (marketId: string) => Promise<{ success: boolean; refund: number }>;
  resolveMarket: (
    marketId: string,
    winningOutcomeId: string,
    options?: { resolutionProof?: string; disputeWindowSeconds?: number }
  ) => Promise<{ success: boolean; payout: number; disputeDeadline?: string; error?: string }>;
  proposeMarketResolution: (
    marketId: string,
    proposedOutcomeId: string,
    options?: { resolutionProof?: string; disputeWindowSeconds?: number }
  ) => Promise<{ success: boolean; disputeDeadline?: string; error?: string }>;
  disputeMarketResolution: (
    marketId: string,
    reason?: string
  ) => Promise<{ success: boolean; error?: string }>;
  finalizeMarketResolution: (
    marketId: string,
    force?: boolean
  ) => Promise<{ success: boolean; payout: number; error?: string }>;
  deleteMarket: (marketId: string) => Promise<void>;
  clearAllMarkets: () => Promise<void>;
  purgeGhostTrades: () => Promise<void>;
  resetDemoAccount: () => Promise<void>;
  markNotificationAsRead: (id: string) => void;
  clearNotifications: () => void;
  addNotification: (item: Omit<NotificationItem, 'id' | 'read' | 'timestamp'>) => void;
}

const MarketContext = createContext<MarketContextType | undefined>(undefined);

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Welcome Virtual Bonus',
    message: 'Your account has been funded with $1,000 in virtual credits to test prediction markets.',
    type: 'system',
    read: false,
    timestamp: new Date().toISOString(),
  },
  {
    id: 'notif-2',
    title: 'Position Open: Bitcoin > $150k',
    message: 'Holding 100 YES shares. Contract current probability is 71%.',
    type: 'market',
    read: false,
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    marketId: 'mkt-btc-150k',
  },
];

function getInitialView(): NavigationTarget {
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname.replace(/^\//, '').toLowerCase();
    if (['home', 'markets', 'detail', 'portfolio', 'history', 'leaderboard', 'tournaments', 'admin'].includes(pathname)) {
      return pathname as NavigationTarget;
    }
  }
  return 'home';
}

export const MarketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [allPositions, setAllPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [currentView, setCurrentView] = useState<NavigationTarget>(getInitialView);
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const [adminSubView, setAdminSubView] = useState<AdminSubView>('overview');
  const [isSimulationActive, setIsSimulationActive] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState<boolean>(false);
  const [activeRole, setActiveRole] = useState<'user' | 'admin'>('user');
  const [loading, setLoading] = useState<boolean>(true);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('connecting');
  const [systemAlert, setSystemAlert] = useState<SystemAlert | null>(null);
  const [serverMetrics, setServerMetrics] = useState<PlatformMetrics | null>(null);

  // Tournament Arena state
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [tournamentLeaderboard, setTournamentLeaderboard] = useState<LeaderboardUser[]>([]);
  const [tournamentMarkets, setTournamentMarkets] = useState<Market[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState<boolean>(false);
  const [loadingTournamentMarkets, setLoadingTournamentMarkets] = useState<boolean>(false);
  const [userTournamentParticipant, setUserTournamentParticipant] = useState<TournamentParticipant | null>(null);
  const [userTournaments, setUserTournaments] = useState<UserTournamentParticipation[]>([]);

  const userRef = useRef<User | null>(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const deduplicateMarkets = useCallback((marketList: Market[]): Market[] => {
    const seen = new Set<string>();
    const result: Market[] = [];
    for (const m of marketList) {
      if (!m || !m.id || seen.has(m.id)) continue;
      seen.add(m.id);
      result.push(m);
    }
    return result;
  }, []);

  const addNotification = useCallback((item: Omit<NotificationItem, 'id' | 'read' | 'timestamp'>) => {
    const newItem: NotificationItem = {
      ...item,
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      read: false,
      timestamp: new Date().toISOString(),
    };
    setNotifications((prev) => [newItem, ...prev.slice(0, 19)]);
  }, []);

  const markNotificationAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const resyncDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (resyncDebounceRef.current) {
        clearTimeout(resyncDebounceRef.current);
        resyncDebounceRef.current = null;
      }
    };
  }, []);

  // Initial load & Background synchronization
  const refreshData = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setAuthStatus('loading');
      }
      const u = await apiClient.getUser();
      const isAdmin = u?.role === 'admin';
      const [m, pUser, pAll, tUser, tAll, sMetrics, uTournaments] = await Promise.all([
        apiClient.getMarkets(),
        u ? apiClient.getPositions(u.id) : Promise.resolve([]),
        isAdmin ? apiClient.getPositions() : Promise.resolve([]),
        u ? apiClient.getTrades(u.id) : Promise.resolve([]),
        isAdmin ? apiClient.getTrades() : apiClient.getPublicTrades(),
        apiClient.getPlatformMetrics().catch(() => null),
        u ? apiClient.getUserTournaments().catch(() => []) : Promise.resolve([]),
      ]);
      setMarkets((prev) => {
        const seen = new Set<string>();
        const list: Market[] = [];
        for (const item of m) {
          if (!item || !item.id || seen.has(item.id)) continue;
          seen.add(item.id);
          list.push(item);
        }
        return list;
      });
      setPositions(pUser);
      setAllPositions(pAll);
      setTrades(tUser);
      setAllTrades(tAll);
      setUserTournaments(uTournaments);
      if (sMetrics) {
        setServerMetrics(sMetrics);
      }
      setUser((prev) => {
        if (!prev && !u) return null;
        if (
          prev &&
          u &&
          prev.id === u.id &&
          prev.virtualBalance === u.virtualBalance &&
          prev.role === u.role &&
          prev.username === u.username &&
          prev.name === u.name &&
          prev.email === u.email &&
          prev.avatar === u.avatar
        ) {
          return prev;
        }
        return u;
      });
      setSystemAlert(null);
      if (u) {
        setAuthStatus('authenticated');
        setActiveRole(u.role);
        realtimeSubscriptionManager.updateAuth(apiClient.getToken(), u.id, u.role);
      } else {
        setAuthStatus('unauthenticated');
        setActiveRole('user');
        realtimeSubscriptionManager.updateAuth(null, null, null);
      }
    } catch (err: any) {
      // 1. Explicitly ignore DOM AbortError or cancelled background requests
      if (
        err?.name === 'AbortError' ||
        err?.message?.includes('aborted') ||
        err?.message?.includes('canceled') ||
        err?.message?.includes('cancelled')
      ) {
        return;
      }

      console.warn('Background refreshData notice:', err);

      // 2. Prevent background silent resyncs from triggering modal UI alerts
      if (silent) {
        return;
      }

      try {
        const health = await apiClient.checkHealth();
        if (health.database !== 'connected') {
          setSystemAlert({
            type: 'database_unavailable',
            title: 'Database Persistence Unavailable',
            message: 'The persistence layer is temporarily unreachable. All historical records, balances, and positions are securely locked.',
            timestamp: new Date().toISOString(),
          });
        } else {
          setSystemAlert({
            type: 'server_error',
            title: 'Server Connection Disrupted',
            message: 'Unable to connect to the prediction market server. Real-time updates and trading may be temporarily halted.',
            timestamp: new Date().toISOString(),
          });
        }
      } catch {
        setSystemAlert({
          type: 'server_error',
          title: 'Server Unreachable',
          message: 'Unable to connect to the prediction market server. Please check your network connection.',
          timestamp: new Date().toISOString(),
        });
      }
      setAuthStatus('unauthenticated');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  const retryConnection = useCallback(async () => {
    await refreshData(false);
  }, [refreshData]);

  const clearSystemAlert = useCallback(() => {
    setSystemAlert(null);
  }, []);

  const loadTournaments = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoadingTournaments(true);
      }
      const list = await apiClient.getTournaments();
      setTournaments((prev) => {
        if (prev.length === list.length) {
          const isIdentical = prev.every((p, idx) => {
            const n = list[idx];
            return (
              p &&
              n &&
              p.id === n.id &&
              p.title === n.title &&
              p.status === n.status &&
              p.startDate === n.startDate &&
              p.endDate === n.endDate &&
              p.categoryFilter === n.categoryFilter &&
              p.initialBalance === n.initialBalance
            );
          });
          if (isIdentical) return prev;
        }
        return list;
      });
      if (list.length > 0) {
        setSelectedTournamentId((prev) => prev || list[0].id);
      }
    } catch (err) {
      console.error('Failed to load tournaments:', err);
    } finally {
      if (!silent) {
        setLoadingTournaments(false);
      }
    }
  }, []);

  const loadTournamentLeaderboard = useCallback(async (tournId: string): Promise<LeaderboardUser[]> => {
    try {
      const data = await apiClient.getTournamentLeaderboard(tournId);
      setTournamentLeaderboard((prev) => {
        if (prev.length === data.length) {
          const isIdentical = prev.every((p, idx) => {
            const n = data[idx];
            return (
              p &&
              n &&
              p.id === n.id &&
              p.totalEquity === n.totalEquity &&
              p.roiPercent === n.roiPercent &&
              p.tradesCount === n.tradesCount
            );
          });
          if (isIdentical) return prev;
        }
        return data;
      });
      return data;
    } catch (err) {
      console.error('Failed to load tournament leaderboard:', err);
      return [];
    }
  }, []);

  const loadTournamentMarkets = useCallback(async (tournId: string, silent = false): Promise<Market[]> => {
    try {
      if (!silent) {
        setLoadingTournamentMarkets(true);
      }
      const list = await apiClient.getTournamentMarkets(tournId);
      setTournamentMarkets((prev) => {
        if (prev.length === list.length) {
          const isIdentical = prev.every((p, idx) => {
            const n = list[idx];
            return (
              p &&
              n &&
              p.id === n.id &&
              p.volume === n.volume &&
              p.totalTraders === n.totalTraders &&
              p.totalTrades === n.totalTrades &&
              p.status === n.status &&
              p.outcomes.length === n.outcomes.length &&
              p.outcomes.every((po, oIdx) => po.currentPrice === n.outcomes[oIdx]?.currentPrice)
            );
          });
          if (isIdentical) return prev;
        }
        return list;
      });
      return list;
    } catch (err) {
      console.error('Failed to load tournament markets:', err);
      return [];
    } finally {
      if (!silent) {
        setLoadingTournamentMarkets(false);
      }
    }
  }, []);

  const loadUserTournamentParticipant = useCallback(async (tournId: string): Promise<TournamentParticipant | null> => {
    try {
      const part = await apiClient.getTournamentParticipant(tournId);
      setUserTournamentParticipant((prev) => {
        if (!prev && !part) return null;
        if (
          prev &&
          part &&
          prev.tournamentId === part.tournamentId &&
          prev.userId === part.userId &&
          prev.tournamentBalance === part.tournamentBalance
        ) {
          return prev;
        }
        return part;
      });
      return part;
    } catch (err) {
      console.error('Failed to load participant:', err);
      return null;
    }
  }, []);

  const loadUserTournaments = useCallback(async (): Promise<UserTournamentParticipation[]> => {
    if (!user) {
      setUserTournaments([]);
      return [];
    }
    try {
      const list = await apiClient.getUserTournaments();
      setUserTournaments(list);
      return list;
    } catch (err) {
      console.error('Failed to load user tournaments:', err);
      return [];
    }
  }, [user]);

  const addMarketToTournament = useCallback(async (tournId: string, mktId: string): Promise<void> => {
    await apiClient.addMarketToTournament(tournId, mktId);
    await loadTournamentMarkets(tournId, true);
    await refreshData(true);
  }, [loadTournamentMarkets, refreshData]);

  const removeMarketFromTournament = useCallback(async (tournId: string, mktId: string): Promise<void> => {
    await apiClient.removeMarketFromTournament(tournId, mktId);
    await loadTournamentMarkets(tournId, true);
    await refreshData(true);
  }, [loadTournamentMarkets, refreshData]);

  const joinTournament = useCallback(async (tournamentId: string): Promise<void> => {
    await apiClient.joinTournament(tournamentId);
    await loadTournaments(true);
    await loadTournamentLeaderboard(tournamentId);
    await loadTournamentMarkets(tournamentId, true);
    await loadUserTournamentParticipant(tournamentId);
    await loadUserTournaments();
    await refreshData(true);
  }, [loadTournaments, loadTournamentLeaderboard, loadTournamentMarkets, loadUserTournamentParticipant, loadUserTournaments, refreshData]);

  const createTournament = useCallback(async (data: Partial<Tournament>): Promise<Tournament> => {
    const created = await apiClient.createTournament(data);
    setTournaments((prev) => [created, ...prev]);
    setSelectedTournamentId(created.id);
    return created;
  }, []);

  const updateTournament = useCallback(async (id: string, updates: Partial<Tournament>): Promise<Tournament> => {
    const updated = await apiClient.updateTournament(id, updates);
    setTournaments((prev) => prev.map((t) => (t.id === id ? updated : t)));
    return updated;
  }, []);

  const deleteTournament = useCallback(async (id: string): Promise<void> => {
    await apiClient.deleteTournament(id);
    setTournaments((prev) => prev.filter((t) => t.id !== id));
    setSelectedTournamentId((prev) => (prev === id ? null : prev));
  }, []);

  const selectedTournament = useMemo(() => {
    if (!selectedTournamentId) return tournaments[0] || null;
    return tournaments.find((t) => t.id === selectedTournamentId) || tournaments[0] || null;
  }, [tournaments, selectedTournamentId]);

  useEffect(() => {
    if (selectedTournamentId) {
      loadTournamentMarkets(selectedTournamentId, true);
      loadUserTournamentParticipant(selectedTournamentId);
    }
  }, [selectedTournamentId, loadTournamentMarkets, loadUserTournamentParticipant]);

  // Continuous sync & tab focus reconciliation
  useEffect(() => {
    refreshData(false);
    loadTournaments();

    // Pulse sync every 4s when the tab is visible to guarantee zero stale data
    const syncInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refreshData(true);
        loadTournaments(true);
      }
    }, 4000);

    const handleFocusSync = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refreshData(true);
        loadTournaments(true);
      }
    };

    window.addEventListener('visibilitychange', handleFocusSync);
    window.addEventListener('focus', handleFocusSync);

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('visibilitychange', handleFocusSync);
      window.removeEventListener('focus', handleFocusSync);
    };
  }, [refreshData, loadTournaments]);

  // =========================================================================
  // SUPABASE REALTIME SUBSCRIPTION MANAGER EVENT CONSUMERS
  // Subscription lifecycle, channels, and CDC are cleanly separated in
  // useRealtimeSubscriptionManager; MarketProvider only consumes events.
  // =========================================================================

  // 1. Debounced authoritative resync: batches rapid-fire Realtime invalidation events (500ms window)
  const handleAuthoritativeResyncRequired = useCallback(() => {
    if (resyncDebounceRef.current) {
      clearTimeout(resyncDebounceRef.current);
    }
    resyncDebounceRef.current = setTimeout(() => {
      resyncDebounceRef.current = null;
      refreshData(true);
      loadTournaments();
    }, 500);
  }, [refreshData, loadTournaments]);

  // 2. Public Market Data Changes (Prices, probabilities, status, volume, traders)
  const handlePublicMarketDataChange = useCallback(
    (event: PublicMarketDataEvent) => {
      const { market, recentTrade, action } = event;

      setMarkets((prev) => {
        const withoutMarket = prev.filter((m) => m.id !== market.id);
        const idx = prev.findIndex((m) => m.id === market.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = market;
          return deduplicateMarkets(updated);
        }
        return deduplicateMarkets([market, ...withoutMarket]);
      });

      // If market resolved or cancelled, debounced authoritative refresh for user balances and positions
      if (
        market.status === 'resolved' ||
        market.status === 'cancelled' ||
        action === 'resolved' ||
        action === 'cancelled'
      ) {
        handleAuthoritativeResyncRequired();
      }

      if (recentTrade) {
        setAllTrades((prev) => {
          if (prev.some((t) => t.id === recentTrade.id)) return prev;
          return [recentTrade, ...prev];
        });
      }
    },
    [deduplicateMarkets, handleAuthoritativeResyncRequired]
  );

  // 2. Trade Execution Notifications (Public tape and market state updates)
  const handleTradeExecutionNotification = useCallback(
    (event: TradeExecutionNotificationEvent) => {
      const { trade, market } = event;
      setAllTrades((prev) => {
        if (prev.some((t) => t.id === trade.id)) return prev;
        return [trade, ...prev];
      });

      if (market) {
        setMarkets((prev) => {
          const idx = prev.findIndex((m) => m.id === market.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = market;
            return deduplicateMarkets(updated);
          }
          return deduplicateMarkets([market, ...prev]);
        });
      }
    },
    [deduplicateMarkets]
  );

  // 3. Private User Financial Updates (Strictly isolated to current user)
  const handleUserFinancialUpdate = useCallback((event: UserFinancialUpdateEvent) => {
    const current = userRef.current;
    if (!current || current.id !== event.userId) return;

    // Balance update
    if (typeof event.virtualBalance === 'number') {
      setUser((prev) => {
        if (!prev || prev.id !== event.userId) return prev;
        return {
          ...prev,
          virtualBalance: event.virtualBalance!,
        };
      });
    }

    // Position update
    if (event.updatedPosition) {
      const pos = event.updatedPosition;
      setPositions((prev) => {
        const idx = prev.findIndex(
          (p) => p.marketId === pos.marketId && p.outcomeId === pos.outcomeId
        );
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = pos;
          return copy;
        }
        return [pos, ...prev];
      });
    }

    // Trade tape update
    if (event.trade) {
      const tr = event.trade;
      setTrades((prev) => {
        if (prev.some((t) => t.id === tr.id)) return prev;
        return [tr, ...prev];
      });
    }

    // Notification update
    if (event.notification) {
      const newItem: NotificationItem = {
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: event.notification.title,
        message: event.notification.message,
        type: event.notification.type || 'system',
        read: false,
        timestamp: new Date().toISOString(),
        marketId: event.notification.marketId,
      };
      setNotifications((prev) => [newItem, ...prev.slice(0, 19)]);
    }
  }, []);

  // 4. Administrative Updates (New trades, volume, commissions, spread, MM exposure)
  const handleAdminUpdate = useCallback(
    (_event: AdminUpdateEvent) => {
      if (userRef.current?.role === 'admin') {
        apiClient.getPositions().then(setAllPositions).catch(() => {});
        apiClient.getTrades().then(setAllTrades).catch(() => {});
        apiClient.getMarkets().then((mList) => setMarkets(deduplicateMarkets(mList))).catch(() => {});
      }
    },
    [deduplicateMarkets]
  );

  // 5. Market Deleted
  const handleMarketDeleted = useCallback(({ marketId }: MarketDeletedEvent) => {
    setMarkets((prev) => prev.filter((m) => m.id !== marketId));
  }, []);

  // 6. Tournament Realtime Events
  const handleTournamentEvent = useCallback(
    (event: TournamentEvent) => {
      if (event.action === 'created' && event.tournament) {
        setTournaments((prev) => {
          if (prev.some((t) => t.id === event.tournament.id)) {
            return prev.map((t) => (t.id === event.tournament.id ? event.tournament : t));
          }
          return [event.tournament, ...prev];
        });
        addNotification({
          title: 'Nuevo Torneo Disponible',
          message: `El torneo "${event.tournament.title}" ya está disponible para participar.`,
          type: 'market',
        });
      } else if (event.action === 'updated' && event.tournament) {
        setTournaments((prev) =>
          prev.map((t) => (t.id === event.tournament.id ? event.tournament : t))
        );
      } else if (event.action === 'deleted' && event.tournamentId) {
        setTournaments((prev) => prev.filter((t) => t.id !== event.tournamentId));
      } else if (event.action === 'participant_joined') {
        loadTournaments(true);
        if (selectedTournamentId) {
          loadTournamentLeaderboard(selectedTournamentId);
        }
      } else if (event.action === 'market_added' || event.action === 'market_removed') {
        if (event.tournamentId) {
          loadTournamentMarkets(event.tournamentId, true);
        }
      }
    },
    [loadTournaments, selectedTournamentId, loadTournamentLeaderboard, loadTournamentMarkets, addNotification]
  );

  // 7. Connect subscription manager within MarketProvider
  useRealtimeSubscriptionManager(
    {
      onPublicMarketDataChange: handlePublicMarketDataChange,
      onTradeExecutionNotification: handleTradeExecutionNotification,
      onAdminUpdate: handleAdminUpdate,
      onUserFinancialUpdate: handleUserFinancialUpdate,
      onMarketDeleted: handleMarketDeleted,
      onTournamentEvent: handleTournamentEvent,
      onConnectionStatusChange: setRealtimeStatus,
      onAuthoritativeResyncRequired: handleAuthoritativeResyncRequired,
    },
    user,
    apiClient.getToken()
  );

  // Authoritative Platform Metrics across all markets, trades, and users
  const metrics = useMemo<PlatformMetrics>(() => {
    const distinctTradersFromTrades = new Set(allTrades.map((t) => t.userId).filter(Boolean)).size;
    const maxMarketTraders = markets.reduce((max, m) => Math.max(max, m.totalTraders || 0), 0);
    const computedActiveTraders = Math.max(distinctTradersFromTrades, maxMarketTraders);

    if (serverMetrics) {
      return {
        ...serverMetrics,
        activeUsers: Math.max(serverMetrics.activeUsers, computedActiveTraders),
        totalUsers: Math.max(serverMetrics.totalUsers, computedActiveTraders),
        activeMarkets: markets.filter((m) => m.status === 'open').length,
        resolvedMarkets: markets.filter((m) => m.status === 'resolved').length,
      };
    }

    return MarketEngine.computeMetrics(markets, allTrades, user ? [user] : []);
  }, [serverMetrics, markets, allTrades, user]);

  // Compute Platform Risk Aggregates and Net Platform Result across all markets
  const platformAggregates = useMemo(() => {
    return RiskEngine.calculatePlatformAggregates(markets, allTrades, allPositions);
  }, [markets, allTrades, allPositions]);

  // Base platform treasury seed is $25,000.00; total platform balance equals base seed + net platform result
  const platformBalance = useMemo(() => {
    const basePlatformTreasury = 25000.0;
    return Number((basePlatformTreasury + platformAggregates.netPlatformResult).toFixed(2));
  }, [platformAggregates.netPlatformResult]);

  // Link administrator user balance authoritatively to the platform balance
  const effectiveUser = useMemo(() => {
    if (!user) return null;
    if (user.role === 'admin') {
      return {
        ...user,
        virtualBalance: platformBalance,
      };
    }
    return user;
  }, [user, platformBalance]);

  // Navigation Helper with URL synchronization
  const navigateTo = useCallback((view: NavigationTarget, marketId?: string) => {
    if (marketId) {
      setSelectedMarketId(marketId);
    }
    setCurrentView(view);
    if (typeof window !== 'undefined') {
      const targetPath = view === 'home' ? '/' : `/${view}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ view, marketId }, '', targetPath);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname.replace(/^\//, '').toLowerCase();
      if (['home', 'markets', 'detail', 'portfolio', 'history', 'admin'].includes(p)) {
        setCurrentView(p as NavigationTarget);
      } else {
        setCurrentView('home');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const toggleSimulation = useCallback(() => {
    setIsSimulationActive((prev) => !prev);
  }, []);

  const login = useCallback(async (usernameOrEmail: string, password?: string, adminPin?: string) => {
    const loggedInUser = await apiClient.login(usernameOrEmail, password, adminPin);
    if (!loggedInUser) {
      throw new Error('Authentication failed: User account details could not be retrieved.');
    }
    const isAdmin = await apiClient.verifyAdminRole(loggedInUser.email || loggedInUser.id);
    const verifiedUser: User = {
      ...loggedInUser,
      role: isAdmin ? 'admin' : (loggedInUser.role || 'user'),
    };
    setUser(verifiedUser);
    setAuthStatus('authenticated');
    setActiveRole(verifiedUser.role);

    // Isolate user-specific positions and trades, and keep platform-wide sync
    const isVerifiedAdmin = verifiedUser.role === 'admin';
    const [userPositions, pAll, userTrades, tAll] = await Promise.all([
      apiClient.getPositions(verifiedUser.id),
      isVerifiedAdmin ? apiClient.getPositions() : Promise.resolve([]),
      apiClient.getTrades(verifiedUser.id),
      isVerifiedAdmin ? apiClient.getTrades() : apiClient.getPublicTrades(),
    ]);
    setPositions(userPositions);
    setAllPositions(pAll);
    setTrades(userTrades);
    setAllTrades(tAll);

    if (verifiedUser.role === 'admin') {
      navigateTo('admin');
      setAdminSubView('overview');
    } else if (currentView === 'admin') {
      navigateTo('home');
    }
    addNotification({
      title: 'Authentication Successful',
      message: `Active session: ${verifiedUser.name || verifiedUser.username} (${verifiedUser.role.toUpperCase()})`,
      type: 'system',
    });
    realtimeSubscriptionManager.updateAuth(apiClient.getToken(), verifiedUser.id, verifiedUser.role);
    return verifiedUser;
  }, [currentView, navigateTo, addNotification]);

  const register = useCallback(async (username: string, password: string, phoneNumber: string, name?: string, email?: string) => {
    const newUser = await apiClient.register(username, password, phoneNumber, name, email);
    if (!newUser) {
      throw new Error('Registration failed: User account details could not be created.');
    }
    setUser(newUser);
    setAuthStatus('authenticated');
    setActiveRole('user');
    setPositions([]);
    setTrades([]);
    if (currentView === 'admin') {
      navigateTo('home');
    }
    addNotification({
      title: 'Demo Fase Beta (Gratuito) - Instrucciones',
      message: 'Para poder participar en los mercados: 1) Ingresa al torneo (gratuito) 2) Se te asignan 100 tokens 3) ¡Opera e invierte! 4) El que quede en el podio tendrá un premio.',
      type: 'system',
    });
    setIsWelcomeModalOpen(true);
    realtimeSubscriptionManager.updateAuth(apiClient.getToken(), newUser.id, 'user');
    return newUser;
  }, [currentView, navigateTo, addNotification]);

  const logout = useCallback(async () => {
    await apiClient.logout();
    setUser(null);
    setAuthStatus('unauthenticated');
    setActiveRole('user');
    setPositions([]);
    setTrades([]);
    if (currentView === 'admin') {
      navigateTo('home');
    }
    addNotification({
      title: 'Signed Out',
      message: 'Logged out. Active session ended.',
      type: 'system',
    });
    realtimeSubscriptionManager.updateAuth(null, null, null);
  }, [currentView, navigateTo, addNotification]);

  const switchUserRole = useCallback((_role: 'user' | 'admin') => {
    addNotification({
      title: 'Action Not Permitted',
      message: 'Dynamic role escalation is permanently disabled for platform security.',
      type: 'system',
    });
  }, [addNotification]);

  // Trade Execution
  const executeTrade = useCallback(
    async (params: {
      marketId: string;
      outcomeId: string;
      type: 'BUY' | 'SELL';
      amountOrShares: number;
      isAnonymous?: boolean;
    }) => {
      if (!user) {
        setIsAuthModalOpen(true);
        return { success: false, message: 'Authentication required. Please sign in to place trades.' };
      }
      try {
        const result = await apiClient.executeTrade({
          userId: user.id,
          userName: user.name,
          ...params,
        });

        // Update local state reactively
        setUser(result.updatedUser);
        setMarkets((prev) =>
          prev.map((m) => (m.id === result.updatedMarket.id ? result.updatedMarket : m))
        );
        const isAdmin = user.role === 'admin';
        const [pUser, pAll, tUser, tAll] = await Promise.all([
          apiClient.getPositions(user.id),
          isAdmin ? apiClient.getPositions() : Promise.resolve([]),
          apiClient.getTrades(user.id),
          isAdmin ? apiClient.getTrades() : apiClient.getPublicTrades(),
        ]);
        setPositions(pUser);
        setAllPositions(pAll);
        setTrades(tUser);
        setAllTrades(tAll);

        const outcome = result.updatedMarket.outcomes.find((o) => o.id === params.outcomeId);
        addNotification({
          title: `${params.type} Order Filled`,
          message: `${params.type} ${result.trade.quantity.toFixed(2)} shares of ${outcome?.name || ''} at $${result.trade.price.toFixed(2)}`,
          type: 'trade',
          marketId: params.marketId,
        });

        return { success: true, message: 'Trade executed successfully' };
      } catch (err: any) {
        return { success: false, message: err?.message || 'Trade failed' };
      }
    },
    [user, addNotification]
  );

  // Partial Sell Position
  const partialSellPosition = useCallback(
    async (position: Position, sharesToSell: number) => {
      try {
        const res = await executeTrade({
          marketId: position.marketId,
          outcomeId: position.outcomeId,
          type: 'SELL',
          amountOrShares: sharesToSell,
        });
        return res.success;
      } catch (err) {
        console.error('Failed partial sell', err);
        return false;
      }
    },
    [executeTrade]
  );

  // Create Market
  const createMarket = useCallback(
    async (marketData: Omit<Market, 'id' | 'createdAt' | 'volume' | 'totalTraders' | 'priceHistory'>) => {
      const created = await apiClient.createMarket(marketData);
      setMarkets((prev) => [created, ...prev.filter((m) => m.id !== created.id)]);
      if (created.tournamentId) {
        loadTournamentMarkets(created.tournamentId);
      }
      addNotification({
        title: 'New Market Created',
        message: `Market "${created.question}" is now live for trading.`,
        type: 'market',
        marketId: created.id,
      });
      return created;
    },
    [addNotification, loadTournamentMarkets]
  );

  // Update Market Status
  const updateMarketStatus = useCallback(async (marketId: string, status: MarketStatus) => {
    const updated = await apiClient.updateMarketStatus(marketId, status);
    setMarkets((prev) => prev.map((m) => (m.id === marketId ? updated : m)));
    addNotification({
      title: 'Market Status Updated',
      message: `Market status transitioned to ${status.toUpperCase()}.`,
      type: 'system',
      marketId,
    });
  }, [addNotification]);

  // Edit Market
  const editMarket = useCallback(
    async (
      marketId: string,
      updates: Partial<Omit<Market, 'id' | 'createdAt' | 'priceHistory'>> & {
        liquidityParameter?: number;
        outcomesUpdates?: { id: string; name?: string; initialProbability?: number; color?: string }[];
      }
    ) => {
      const updated = await apiClient.editMarket(marketId, updates);
      setMarkets((prev) => prev.map((m) => (m.id === marketId ? updated : m)));
      addNotification({
        title: 'Market Updated',
        message: `Market parameters for "${updated.question}" have been saved.`,
        type: 'market',
        marketId,
      });
      return updated;
    },
    [addNotification]
  );

  // Update Market Liquidity
  const updateMarketLiquidity = useCallback(
    async (marketId: string, liquidityParameter: number) => {
      await editMarket(marketId, { liquidityParameter });
    },
    [editMarket]
  );

  // Cancel Market
  const cancelMarket = useCallback(
    async (marketId: string) => {
      try {
        const { market, refundAmount } = await apiClient.cancelMarket(marketId);
        setMarkets((prev) => prev.map((m) => (m.id === marketId ? market : m)));
        await refreshData(true);

        addNotification({
          title: 'Market Cancelled',
          message: `Market "${market.question}" was cancelled by operator. ${
            refundAmount > 0
              ? `$${refundAmount.toFixed(2)} refunded to your balance.`
              : 'All pending contracts voided.'
          }`,
          type: 'system',
          marketId,
        });

        return { success: true, refund: refundAmount };
      } catch (err) {
        console.error('Cancellation error', err);
        return { success: false, refund: 0 };
      }
    },
    [addNotification, refreshData]
  );

  // Resolve / Propose Market Resolution
  const resolveMarket = useCallback(
    async (
      marketId: string,
      winningOutcomeId: string,
      options?: { resolutionProof?: string; disputeWindowSeconds?: number }
    ) => {
      try {
        const apiRes = await apiClient.resolveMarket(marketId, winningOutcomeId, options);
        const market = apiRes.market;
        const userPayout = apiRes.userPayout || 0;

        setMarkets((prev) => prev.map((m) => (m.id === marketId ? market : m)));
        await refreshData(true);

        const winningOutcome = market.outcomes.find((o) => o.id === winningOutcomeId);

        if (market.status === 'resolving') {
          addNotification({
            title: 'Resolución Propuesta (Ventana de Disputa)',
            message: `"${market.question}" propuesto como ganador: ${winningOutcome?.name || winningOutcomeId}. Ventana de impugnación activa.`,
            type: 'system',
            marketId,
          });
        } else {
          addNotification({
            title: 'Market Resolved',
            message: `"${market.question}" resolved to ${winningOutcome?.name}. ${
              userPayout > 0 ? `You received $${userPayout.toFixed(2)} in winnings!` : 'Settlement complete.'
            }`,
            type: 'resolution',
            marketId,
          });
        }

        return { success: true, payout: userPayout, disputeDeadline: apiRes.disputeDeadline };
      } catch (err: any) {
        console.error('Resolution error', err);
        return { success: false, payout: 0, error: err.message || 'Unknown resolution error' };
      }
    },
    [addNotification, refreshData]
  );

  // Propose optimistic resolution
  const proposeMarketResolution = useCallback(
    async (
      marketId: string,
      proposedOutcomeId: string,
      options?: { resolutionProof?: string; disputeWindowSeconds?: number }
    ) => {
      return resolveMarket(marketId, proposedOutcomeId, options);
    },
    [resolveMarket]
  );

  // Dispute proposed resolution
  const disputeMarketResolution = useCallback(
    async (marketId: string, reason?: string) => {
      try {
        const apiRes = await apiClient.disputeMarket(marketId, reason);
        const market = apiRes.market;
        setMarkets((prev) => prev.map((m) => (m.id === marketId ? market : m)));
        await refreshData(true);

        addNotification({
          title: 'Resolución Impugnada',
          message: `La propuesta de resolución del mercado "${market.question}" fue revertida. ${reason ? `Motivo: ${reason}` : ''}`,
          type: 'system',
          marketId,
        });

        return { success: true };
      } catch (err: any) {
        console.error('Dispute error', err);
        return { success: false, error: err.message || 'Error disputing resolution' };
      }
    },
    [addNotification, refreshData]
  );

  // Finalize optimistic resolution
  const finalizeMarketResolution = useCallback(
    async (marketId: string, force?: boolean) => {
      try {
        const apiRes = await apiClient.finalizeMarket(marketId, force);
        const market = apiRes.market;
        setMarkets((prev) => prev.map((m) => (m.id === marketId ? market : m)));
        await refreshData(true);

        addNotification({
          title: 'Liquidación Finalizada',
          message: `El mercado "${market.question}" ha sido liquidado oficialmente. Pagos acreditados a los ganadores.`,
          type: 'resolution',
          marketId,
        });

        return { success: true, payout: Number(market.settlementPayout || 0) };
      } catch (err: any) {
        console.error('Finalize resolution error', err);
        return { success: false, payout: 0, error: err.message || 'Error finalizing resolution' };
      }
    },
    [addNotification, refreshData]
  );

  // Delete specific market
  const deleteMarket = useCallback(async (marketId: string) => {
    await apiClient.deleteMarket(marketId);
    await refreshData();
    addNotification({
      title: 'Market Removed',
      message: 'Contract and associated open positions were cleanly deleted.',
      type: 'system',
    });
  }, [refreshData, addNotification]);

  // Clear all markets
  const clearAllMarkets = useCallback(async () => {
    await apiClient.clearAllMarkets();
    await refreshData();
    addNotification({
      title: 'Markets Wiped',
      message: 'All previous contracts, positions, and trades have been purged. Clean slate initialized.',
      type: 'system',
    });
  }, [refreshData, addNotification]);

  // Purge all open trades and ghost traders
  const purgeGhostTrades = useCallback(async () => {
    try {
      await apiClient.purgeGhostTrades();
      await refreshData();
      addNotification({
        title: 'Trades & Ghost Traders Purged',
        message: 'Zero open trades, zero ghost traders. Clean exposure restored.',
        type: 'system',
      });
    } catch (err: any) {
      addNotification({
        title: 'Action Prohibited',
        message: err?.message || 'Purging trades is disabled in production environments.',
        type: 'system',
      });
    }
  }, [refreshData, addNotification]);

  // Reset Demo Account
  const resetDemoAccount = useCallback(async () => {
    try {
      await apiClient.resetDemoData();
      await refreshData();
      addNotification({
        title: 'Demo Balance Reset',
        message: 'Your virtual trading balance has been restored to $1,000.00. Markets, contracts, and trade history are preserved.',
        type: 'system',
      });
    } catch (err: any) {
      addNotification({
        title: 'Action Prohibited',
        message: err?.message || 'Resetting balances is disabled in production environments.',
        type: 'system',
      });
    }
  }, [refreshData, addNotification]);

  const value = {
    markets,
    positions,
    allPositions,
    trades,
    allTrades,
    user: effectiveUser,
    authStatus,
    realtimeStatus,
    metrics,
    platformBalance,
    notifications,
    currentView,
    selectedMarketId,
    adminSubView,
    isSimulationActive,
    searchQuery,
    selectedCategory,
    isAuthModalOpen,
    isWelcomeModalOpen,
    setIsWelcomeModalOpen,
    activeRole,
    loading,
    systemAlert,
    tournaments,
    selectedTournamentId,
    selectedTournament,
    tournamentLeaderboard,
    tournamentMarkets,
    loadingTournaments,
    loadingTournamentMarkets,
    userTournamentParticipant,
    userTournaments,
    setSelectedTournamentId,
    loadTournaments,
    loadUserTournaments,
    loadTournamentLeaderboard,
    loadTournamentMarkets,
    loadUserTournamentParticipant,
    addMarketToTournament,
    removeMarketFromTournament,
    joinTournament,
    createTournament,
    updateTournament,
    deleteTournament,
    navigateTo,
    setAdminSubView,
    toggleSimulation,
    setSearchQuery,
    setSelectedCategory,
    setIsAuthModalOpen,
    switchUserRole,
    login,
    register,
    logout,
    retryConnection,
    clearSystemAlert,
    executeTrade,
    partialSellPosition,
    createMarket,
    editMarket,
    updateMarketLiquidity,
    updateMarketStatus,
    cancelMarket,
    resolveMarket,
    proposeMarketResolution,
    disputeMarketResolution,
    finalizeMarketResolution,
    deleteMarket,
    clearAllMarkets,
    purgeGhostTrades,
    resetDemoAccount,
    markNotificationAsRead,
    clearNotifications,
    addNotification,
  };

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
};

export const useMarket = () => {
  const context = useContext(MarketContext);
  if (!context) {
    throw new Error('useMarket must be used within a MarketProvider');
  }
  return context;
};
