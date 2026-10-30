-- Migration: 20260921000001_initial_schema.sql
-- Description: Core schema for Prediction Market platform

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
  password_hash TEXT NOT NULL,
  virtual_balance NUMERIC(18, 4) NOT NULL DEFAULT 1000.0000,
  avatar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

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
  commission_rate NUMERIC(8, 6) NOT NULL DEFAULT 0.010000,
  spread NUMERIC(8, 6) NOT NULL DEFAULT 0.015000,
  volume NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
  total_traders INT NOT NULL DEFAULT 0,
  total_trades INT NOT NULL DEFAULT 0,
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
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE INDEX IF NOT EXISTS idx_positions_user ON positions(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_market ON positions(market_id);
CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_market ON trades(market_id);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
