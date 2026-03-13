-- Launch-readiness hardening migration for AutoRevenueOS
-- Safe to run multiple times; uses IF NOT EXISTS where possible.
-- Apply via Supabase CLI, for example:
--   supabase db push
-- or
--   supabase db migrate up

-- 1) Extend businesses with fields used in code (dashboard, settings, meta webhook, etc.)

ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS average_booking_value integer;

ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS cost_per_lead integer;

ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS currency_code text;

ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS locale text;

ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS location text;

ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS auto_reply_template text;

-- meta_page_id is added in a separate migration (20250309102000_business_meta_page_id.sql).


-- 2) Contact / message / event external identifiers
-- Used for website chat visitors, Twilio message/call IDs, and other channel-specific IDs.

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS external_id text;

CREATE INDEX IF NOT EXISTS idx_contacts_external_id
ON contacts(external_id);

ALTER TABLE messages
ADD COLUMN IF NOT EXISTS external_id text;

CREATE INDEX IF NOT EXISTS idx_messages_external_id
ON messages(external_id);

ALTER TABLE events
ADD COLUMN IF NOT EXISTS external_id text;

CREATE INDEX IF NOT EXISTS idx_events_external_id
ON events(external_id);


-- 3) Recoveries status column (manual pipeline status overrides)

ALTER TABLE recoveries
ADD COLUMN IF NOT EXISTS status text;

CREATE INDEX IF NOT EXISTS idx_recoveries_status
ON recoveries(status);


-- 4) Profiles table to link Supabase auth users to a business.
-- This is used by lib/auth.getCurrentUserAndBusiness.

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY,
  business_id uuid REFERENCES businesses(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_business_id
ON profiles(business_id);


-- 5) Helper function used when the service role key is NOT available.
-- lib/auth.ts calls link_profile_to_business(p_user_id, p_business_id).

CREATE OR REPLACE FUNCTION link_profile_to_business(
  p_user_id uuid,
  p_business_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO profiles (id, business_id)
  VALUES (p_user_id, p_business_id)
  ON CONFLICT (id) DO UPDATE
    SET business_id = EXCLUDED.business_id;
END;
$$;

