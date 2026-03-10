-- Add business configuration fields used by AutoRevenueOS.
-- This migration is safe to run multiple times in dev environments.
-- It does NOT change routing, ingestion, or recovery logic.

-- Average booking value used across Dashboard, Recoveries, Inbox.
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS average_booking_value integer DEFAULT 60;

COMMENT ON COLUMN businesses.average_booking_value IS 'Average booking value in GBP for revenue estimation';

-- Optional business location for display/ops context.
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS location text;

-- Optional auto-reply template used by the Meta webhook.
-- Placeholders:
-- - {business_name}
-- - {booking_link}
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS auto_reply_template text;

