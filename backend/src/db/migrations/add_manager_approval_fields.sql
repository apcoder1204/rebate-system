-- Migration: Add manager approval fields to contracts table
-- This migration adds fields for manager signature and approval workflow

-- Add new columns to contracts table
ALTER TABLE contracts 
ADD COLUMN IF NOT EXISTS manager_signature_data_url TEXT,
ADD COLUMN IF NOT EXISTS manager_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS manager_position VARCHAR(255),
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_date TIMESTAMP;

-- Update status constraint to include new statuses
ALTER TABLE contracts 
DROP CONSTRAINT IF EXISTS contracts_status_check;

ALTER TABLE contracts 
ADD CONSTRAINT contracts_status_check 
CHECK (status IN ('pending', 'pending_approval', 'approved', 'active', 'expired', 'cancelled', 'rejected'));

-- Update existing contracts with signed_contract_url to pending_approval status
UPDATE contracts 
SET status = 'pending_approval' 
WHERE signed_contract_url IS NOT NULL AND status = 'pending';

-- Create index for approval status filtering
CREATE INDEX IF NOT EXISTS idx_contracts_approval_status ON contracts(status) WHERE status IN ('pending_approval', 'approved');
