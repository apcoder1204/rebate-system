-- Migration: rebate redemption request workflow
-- Customer submits a redeem request → staff approves → orders paid → contract expires

CREATE TABLE IF NOT EXISTS rebate_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  total_rebate_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  requested_at TIMESTAMP DEFAULT NOW(),
  processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  processed_at TIMESTAMP,
  customer_notes TEXT,
  staff_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rebate_requests_customer ON rebate_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_rebate_requests_status ON rebate_requests(status);
CREATE INDEX IF NOT EXISTS idx_rebate_requests_contract ON rebate_requests(contract_id);
