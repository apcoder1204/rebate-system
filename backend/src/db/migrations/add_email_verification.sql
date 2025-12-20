-- Add email column to verification_codes table
ALTER TABLE verification_codes ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Make phone column nullable (to support email-only verification)
ALTER TABLE verification_codes ALTER COLUMN phone DROP NOT NULL;

-- Add email_verified column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

-- Update verification_codes purpose check to include email verification
-- First, drop the existing constraint
ALTER TABLE verification_codes DROP CONSTRAINT IF EXISTS verification_codes_purpose_check;

-- Add the new constraint with email_verification option
ALTER TABLE verification_codes ADD CONSTRAINT verification_codes_purpose_check 
  CHECK (purpose IN ('registration', 'password_reset', 'email_verification'));

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_verification_codes_email ON verification_codes(email);

