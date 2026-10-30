-- Migration: 20261016_enable_rls.sql
-- Description: Enable Row Level Security (RLS) on all public tables and configure policies for centralized prediction market

-- 1. Dynamically enable RLS on all tables in public schema
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

-- 2. Explicitly ensure core tables have RLS enabled
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.market_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ledger_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tournament_participants ENABLE ROW LEVEL SECURITY;

-- 3. Public Read Policies for Market Discovery
-- Anyone can view market questions, categories, status, and prices via Supabase API / Realtime
DROP POLICY IF EXISTS "Allow public read access to markets" ON public.markets;
CREATE POLICY "Allow public read access to markets"
  ON public.markets
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Allow public read access to market outcomes" ON public.market_outcomes;
CREATE POLICY "Allow public read access to market outcomes"
  ON public.market_outcomes
  FOR SELECT
  TO public
  USING (true);

-- 4. Public Read Policy for completed trades (realtime orderbook feed)
DROP POLICY IF EXISTS "Allow public read access to completed trades" ON public.trades;
CREATE POLICY "Allow public read access to completed trades"
  ON public.trades
  FOR SELECT
  TO public
  USING (true);

-- 5. Public Read Policy for Tournaments & Leaderboards
DROP POLICY IF EXISTS "Allow public read access to tournaments" ON public.tournaments;
CREATE POLICY "Allow public read access to tournaments"
  ON public.tournaments
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Allow public read access to tournament participants" ON public.tournament_participants;
CREATE POLICY "Allow public read access to tournament participants"
  ON public.tournament_participants
  FOR SELECT
  TO public
  USING (true);

-- Note:
-- Sensitive tables (users, sessions, positions, ledger_transactions, fees, settlements)
-- have RLS enabled with NO direct public access policies. PostgREST direct calls are blocked.
-- The backend Express application connects via connection pooling with the 'postgres' role,
-- which bypasses RLS and manages all balances, trades, and sessions securely.
