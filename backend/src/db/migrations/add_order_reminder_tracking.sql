-- Migration: Add order reminder tracking
-- This migration adds a field to track when reminder emails were last sent

-- Add last_reminder_sent column to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS last_reminder_sent TIMESTAMP;

-- Create index for efficient querying of orders needing reminders
CREATE INDEX IF NOT EXISTS idx_orders_reminder_sent 
ON orders(customer_status, order_date, last_reminder_sent) 
WHERE customer_status = 'pending';
