-- ============================================================================
-- PREDICTION MARKET POSTGRESQL / SUPABASE SCHEMA
-- Authoritative, ACID-compliant financial and state architecture
-- ============================================================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone_number VARCHAR(30) UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
  password_hash TEXT NOT NULL,
  virtual_balance NUMERIC(18, 4) NOT NULL DEFAULT 1000.0000,
  avatar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number);

-- 2. SESSIONS TABLE
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- 3. MARKETS TABLE
CREATE TABLE IF NOT EXISTS markets (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('binary', 'multi', 'range')),
  status TEXT NOT NULL CHECK (status IN ('open', 'closed', 'resolving', 'resolved', 'paused', 'cancelled')),
  close_time TIMESTAMPTZ NOT NULL,
  resolution_time TIMESTAMPTZ NOT NULL,
  resolution_source TEXT NOT NULL DEFAULT '',
  resolution_rules TEXT NOT NULL DEFAULT '',
  liquidity_parameter NUMERIC(18, 6) NOT NULL DEFAULT 100.000000,
  subsidy_budget NUMERIC(18, 4) DEFAULT NULL,
  commission_rate NUMERIC(8, 6) NOT NULL DEFAULT 0.010000,
  spread NUMERIC(8, 6) NOT NULL DEFAULT 0.015000,
  volume NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
  total_traders INT NOT NULL DEFAULT 0,
  total_trades INT NOT NULL DEFAULT 0,
  proposed_outcome_id TEXT,
  resolution_proof TEXT,
  dispute_deadline TIMESTAMPTZ,
  disputed_at TIMESTAMPTZ,
  dispute_reason TEXT,
  winning_outcome_id TEXT,
  resolved_outcome_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  price_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags TEXT[] NOT NULL DEFAULT '{}',
  initial_probabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  initial_quantities JSONB NOT NULL DEFAULT '{}'::jsonb,
  cumulative_lmsr_cash_flow NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
  total_commission_revenue NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
  total_spread_revenue NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
  settlement_payout NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
  realized_mm_pnl NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
  realized_platform_result NUMERIC(18, 4) NOT NULL DEFAULT 0.0000
);

-- 4. MARKET OUTCOMES TABLE (LMSR state per outcome)
CREATE TABLE IF NOT EXISTS market_outcomes (
  market_id TEXT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  label TEXT,
  q NUMERIC(18, 6) NOT NULL DEFAULT 0.000000,
  initial_q NUMERIC(18, 6) NOT NULL DEFAULT 0.000000,
  current_price NUMERIC(10, 6) NOT NULL DEFAULT 0.500000,
  buy_price NUMERIC(10, 6) NOT NULL DEFAULT 0.500000,
  sell_price NUMERIC(10, 6) NOT NULL DEFAULT 0.500000,
  initial_price NUMERIC(10, 6),
  initial_probability NUMERIC(10, 6),
  color TEXT,
  is_winner BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (market_id, id)
);

-- 5. POSITIONS TABLE (Outcome holdings by user)
CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  market_id TEXT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  outcome_id TEXT NOT NULL,
  market_question TEXT NOT NULL,
  market_category TEXT NOT NULL,
  outcome_name TEXT NOT NULL,
  quantity NUMERIC(18, 6) NOT NULL DEFAULT 0.000000,
  average_price NUMERIC(10, 6) NOT NULL DEFAULT 0.000000,
  current_price NUMERIC(10, 6) NOT NULL DEFAULT 0.000000,
  current_cost_basis NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
  current_value NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
  realized_pnl NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
  unrealized_pnl NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
  unrealized_pnl_percent NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'CLOSED', 'SETTLED_WIN', 'SETTLED_LOSE', 'CANCELLED', 'REFUNDED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_market_outcome UNIQUE (user_id, market_id, outcome_id)
);

-- 6. TRADES TABLE (Executed orders and settlements)
CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT,
  market_id TEXT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  market_question TEXT NOT NULL,
  outcome_id TEXT NOT NULL,
  outcome_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('BUY', 'SELL', 'SETTLEMENT', 'REFUND', 'RESOLUTION')),
  price NUMERIC(10, 6) NOT NULL,
  quantity NUMERIC(18, 6) NOT NULL,
  amount NUMERIC(18, 4) NOT NULL,
  fee NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
  spread_fee NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
  lmsr_cash_flow NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
  pnl NUMERIC(18, 4),
  status TEXT NOT NULL CHECK (status IN ('EXECUTED', 'SETTLED', 'REFUNDED')),
  tournament_id TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. LEDGER TRANSACTIONS (Double-entry audit log of balance adjustments)
CREATE TABLE IF NOT EXISTS ledger_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('INITIAL_DEMO_CREDIT', 'BUY', 'SELL', 'COMMISSION', 'SETTLEMENT', 'REFUND', 'RESET_DEMO_CREDIT')),
  amount NUMERIC(18, 4) NOT NULL,
  balance_after NUMERIC(18, 4) NOT NULL,
  market_id TEXT REFERENCES markets(id) ON DELETE SET NULL,
  market_question TEXT,
  trade_id TEXT REFERENCES trades(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. FEES TABLE (Explicit breakdown of commission and spread revenues)
CREATE TABLE IF NOT EXISTS fees (
  id TEXT PRIMARY KEY,
  trade_id TEXT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  market_id TEXT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fee_type TEXT NOT NULL CHECK (fee_type IN ('COMMISSION', 'SPREAD')),
  amount NUMERIC(18, 4) NOT NULL,
  rate NUMERIC(8, 6) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. SETTLEMENTS TABLE (Market resolution and cancellation records)
CREATE TABLE IF NOT EXISTS settlements (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  resolution_type TEXT NOT NULL CHECK (resolution_type IN ('WINNER', 'CANCELLED')),
  winning_outcome_id TEXT,
  total_payout NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
  total_refund NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
  positions_settled INT NOT NULL DEFAULT 0,
  executed_by TEXT NOT NULL REFERENCES users(id),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('trade', 'resolution', 'pnl', 'system', 'market')),
  read BOOLEAN NOT NULL DEFAULT FALSE,
  market_id TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. TOURNAMENTS TABLE (Testing & Competition Arena)
CREATE TABLE IF NOT EXISTS tournaments (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  prize_pool TEXT NOT NULL DEFAULT '',
  initial_balance NUMERIC(18, 4) NOT NULL DEFAULT 1000.0000,
  status TEXT NOT NULL CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  category_filter TEXT NOT NULL DEFAULT 'ALL',
  rules TEXT NOT NULL DEFAULT '',
  created_by_id TEXT,
  winner_user_id TEXT,
  winner_name TEXT,
  winner_equity NUMERIC(18, 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10.1 TOURNAMENT PARTICIPANTS
CREATE TABLE IF NOT EXISTS tournament_participants (
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tournament_id, user_id)
);

-- INDEXES FOR FAST QUERYING AND CONCURRENCY
CREATE INDEX IF NOT EXISTS idx_positions_user ON positions(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_market ON positions(market_id);
CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_market ON trades(market_id);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- 11. SUPABASE REALTIME REPLICATION CONFIGURATION
-- Enable full row replication for real-time delta synchronization
ALTER TABLE markets REPLICA IDENTITY FULL;
ALTER TABLE market_outcomes REPLICA IDENTITY FULL;
ALTER TABLE trades REPLICA IDENTITY FULL;

-- Ensure public tables are added to supabase_realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'markets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE markets;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'market_outcomes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE market_outcomes;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'trades'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE trades;
  END IF;
END $$;

-- =============================================================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

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
ALTER TABLE IF EXISTS public.tournament_markets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'markets' AND policyname = 'Allow public read access to markets'
  ) THEN
    CREATE POLICY "Allow public read access to markets" ON public.markets FOR SELECT TO public USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'market_outcomes' AND policyname = 'Allow public read access to market outcomes'
  ) THEN
    CREATE POLICY "Allow public read access to market outcomes" ON public.market_outcomes FOR SELECT TO public USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'trades' AND policyname = 'Allow public read access to completed trades'
  ) THEN
    CREATE POLICY "Allow public read access to completed trades" ON public.trades FOR SELECT TO public USING (true);
  END IF;
END $$;

