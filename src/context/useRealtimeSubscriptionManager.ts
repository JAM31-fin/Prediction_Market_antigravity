import { useEffect, useRef, useMemo } from 'react';
import { User } from '../types';
import {
  realtimeSubscriptionManager,
  RealtimeConsumerHandlers,
  RealtimeStatus,
} from '../services/realtimeSubscriptionManager';

/**
 * Custom React hook for MarketProvider to consume Supabase Realtime events.
 * 
 * Separates subscription lifecycle, Supabase Realtime channels, CDC listeners,
 * and connection management from state logic.
 * MarketProvider provides pure state-updating callbacks; this hook handles the rest.
 */
export function useRealtimeSubscriptionManager(
  handlers: RealtimeConsumerHandlers,
  user: User | null,
  token: string | null
): {
  reconnect: () => void;
  getStatus: () => RealtimeStatus;
} {
  const handlersRef = useRef<RealtimeConsumerHandlers>(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  // Create stable handler proxies so subscription listeners never churn or re-bind
  const stableHandlers = useMemo<RealtimeConsumerHandlers>(() => {
    return {
      onPublicMarketDataChange: (event) => handlersRef.current.onPublicMarketDataChange(event),
      onTradeExecutionNotification: (event) => handlersRef.current.onTradeExecutionNotification(event),
      onAdminUpdate: (event) => handlersRef.current.onAdminUpdate(event),
      onUserFinancialUpdate: (event) => handlersRef.current.onUserFinancialUpdate(event),
      onMarketDeleted: (event) => handlersRef.current.onMarketDeleted(event),
      onTournamentEvent: (event) => handlersRef.current.onTournamentEvent?.(event),
      onConnectionStatusChange: (status) => handlersRef.current.onConnectionStatusChange(status),
      onAuthoritativeResyncRequired: () => handlersRef.current.onAuthoritativeResyncRequired(),
    };
  }, []);

  // Initialize once on mount
  useEffect(() => {
    realtimeSubscriptionManager.initialize(
      stableHandlers,
      token,
      user
    );

    return () => {
      realtimeSubscriptionManager.disconnect();
    };
  }, [stableHandlers]);

  // Keep subscription auth & scoped channels synchronized whenever user or session token changes
  useEffect(() => {
    realtimeSubscriptionManager.updateAuth(token, user?.id ?? null, user?.role ?? null);
  }, [token, user?.id, user?.role]);

  return {
    reconnect: () => realtimeSubscriptionManager.reconnect(),
    getStatus: () => realtimeSubscriptionManager.getStatus(),
  };
}
