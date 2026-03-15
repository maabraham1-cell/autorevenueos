-- Business-scoped uniqueness for confirmed_bookings (same external id can exist per business).
DROP INDEX IF EXISTS idx_confirmed_bookings_external_id_source;
CREATE UNIQUE INDEX IF NOT EXISTS idx_confirmed_bookings_business_external_source
  ON confirmed_bookings(business_id, external_booking_id, confirmation_source)
  WHERE external_booking_id IS NOT NULL AND external_booking_id <> '';

-- Optional per-business provider identifiers for booking integrations.
-- Used when mapping provider webhooks (e.g. Fresha venue, Timely company) to business_id.
-- Bridge integrations can use business_id in URL/body without these.

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS fresha_venue_id text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS timely_company_id text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS treatwell_venue_id text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS cliniko_practice_id text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS setmore_business_id text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS jane_account_id text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS booksy_business_id text;

-- Optional webhook verification (when provider sends a signing secret).
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS fresha_webhook_secret text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS timely_webhook_secret text;

COMMENT ON COLUMN businesses.fresha_venue_id IS 'Fresha venue/account id for webhook mapping when partner webhook is available';
COMMENT ON COLUMN businesses.timely_company_id IS 'Timely company id for webhook or API polling mapping';
COMMENT ON COLUMN businesses.fresha_webhook_secret IS 'Fresha webhook signing secret when provided by partner';
COMMENT ON COLUMN businesses.timely_webhook_secret IS 'Timely webhook signing secret when provided';
