-- billed_at: set only when the meter event is successfully reported to Stripe (not when invoice is paid).
ALTER TABLE confirmed_bookings
ADD COLUMN IF NOT EXISTS billed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_confirmed_bookings_billed_at ON confirmed_bookings(billed_at)
  WHERE billed_at IS NOT NULL;

-- Optional per-business integration keys (for webhook verification or mapping).
-- acuity_api_key: used to verify Acuity webhook signature (x-acuity-signature).
-- square_merchant_id: map Square webhook merchant_id to business.
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS acuity_api_key text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS square_merchant_id text;
