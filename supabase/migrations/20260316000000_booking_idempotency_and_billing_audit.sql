-- Idempotency and billing audit for confirmed_bookings.
-- Ensures the same booking can never be billed twice and gives admin visibility.

-- 1) Idempotency key: optional unique key (e.g. from booking page) to prevent double confirm.
ALTER TABLE confirmed_bookings
ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_confirmed_bookings_idempotency_key
ON confirmed_bookings(idempotency_key)
WHERE idempotency_key IS NOT NULL AND idempotency_key <> '';

-- 2) Billing status and error for quick visibility (pending | sent | skipped | failed).
ALTER TABLE confirmed_bookings
ADD COLUMN IF NOT EXISTS billing_status text NOT NULL DEFAULT 'pending';

ALTER TABLE confirmed_bookings
ADD COLUMN IF NOT EXISTS billing_error text;

COMMENT ON COLUMN confirmed_bookings.billing_status IS 'pending = not yet reported; sent = Stripe meter reported; skipped = no stripe_customer_id; failed = meter call failed.';

UPDATE confirmed_bookings
SET billing_status = CASE WHEN billed_at IS NOT NULL THEN 'sent' ELSE 'pending' END
WHERE billing_status IS NULL OR billing_status = '';

-- 3) Audit log for confirmation and billing events (admin visibility, debugging).
CREATE TABLE IF NOT EXISTS billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  confirmed_booking_id uuid REFERENCES confirmed_bookings(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  message text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_business_id ON billing_events(business_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_confirmed_booking_id ON billing_events(confirmed_booking_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_created_at ON billing_events(created_at);
CREATE INDEX IF NOT EXISTS idx_billing_events_event_type ON billing_events(event_type);

COMMENT ON TABLE billing_events IS 'Audit log for confirmed bookings and Stripe meter outcomes. event_type: confirmed | meter_sent | meter_failed | meter_skipped_no_customer | duplicate_ignored.';
