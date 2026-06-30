-- Migration: add contract renewal tracking
-- Run AFTER backing up the database. All changes are additive (ADD COLUMN IF NOT EXISTS).

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS renewed_from_id UUID REFERENCES contracts(id) ON DELETE SET NULL;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS renewal_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_contracts_renewed_from ON contracts(renewed_from_id);
