-- Booking confirmation architecture: charge only when a booking is actually confirmed.
-- Recoveries remain attribution-only; Stripe confirmed_bookings meter is sent only from this table.

-- 1) confirmed_bookings: one row per trusted confirmation (integration webhook or AutoRevenueOS booking page)
CREATE TABLE confirmed_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  recovery_id uuid REFERENCES recoveries(id) ON DELETE SET NULL,
  external_booking_id text,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  confirmation_source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- confirmation_source: 'autorevenueos_booking_page' | 'calendly' | 'cal.com' | etc.

CREATE INDEX idx_confirmed_bookings_business_id ON confirmed_bookings(business_id);
CREATE INDEX idx_confirmed_bookings_contact_id ON confirmed_bookings(contact_id);
CREATE INDEX idx_confirmed_bookings_recovery_id ON confirmed_bookings(recovery_id);
CREATE INDEX idx_confirmed_bookings_confirmed_at ON confirmed_bookings(confirmed_at);
CREATE INDEX idx_confirmed_bookings_confirmation_source ON confirmed_bookings(confirmation_source);
CREATE UNIQUE INDEX idx_confirmed_bookings_external_id_source ON confirmed_bookings(external_booking_id, confirmation_source)
  WHERE external_booking_id IS NOT NULL AND external_booking_id <> '';

COMMENT ON TABLE confirmed_bookings IS 'Trusted booking confirmations only. Stripe confirmed_bookings meter is sent only when rows are inserted here.';

-- Optional: contact email for matching integration webhooks (e.g. Calendly invitee email)
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS email text;
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);

-- 3) Optional: link business to Stripe customer for usage-based billing (meter events)
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS stripe_customer_id text;

CREATE INDEX IF NOT EXISTS idx_businesses_stripe_customer_id ON businesses(stripe_customer_id);
