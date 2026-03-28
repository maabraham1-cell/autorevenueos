-- Enable/disable AI auto-send for safe, high-confidence booking-related replies.
-- This should default to false.

ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS ai_auto_send_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN businesses.ai_auto_send_enabled IS
  'If true, the system may auto-send AI-generated booking-related replies when confidence is high and safety checks pass. Disabled by default.';

