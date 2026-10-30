-- ============================================================================
-- MIGRATION: Phase 1 - Optimistic Resolution Window & LMSR Subsidy Budget
-- ============================================================================

ALTER TABLE markets ADD COLUMN IF NOT EXISTS subsidy_budget NUMERIC(18, 4) DEFAULT NULL;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS proposed_outcome_id TEXT DEFAULT NULL;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS resolution_proof TEXT DEFAULT NULL;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS dispute_deadline TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS dispute_reason TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_markets_status_dispute ON markets(status, dispute_deadline) WHERE status = 'resolving';
