-- Migration: Add customer_signature_data_url column to contracts table
-- This stores the customer's digital signature as a base64 data URL

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS customer_signature_data_url TEXT;

