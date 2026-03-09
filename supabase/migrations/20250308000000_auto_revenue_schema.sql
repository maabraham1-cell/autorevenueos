-- AutoRevenueOS schema for Supabase
-- Run in Supabase SQL Editor or via: supabase db push

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. businesses
CREATE TABLE businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  industry text,
  booking_link text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_businesses_created_at ON businesses(created_at);

-- 2. contacts
CREATE TABLE contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  phone text,
  name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contacts_business_id ON contacts(business_id);
CREATE INDEX idx_contacts_created_at ON contacts(created_at);

-- 3. events
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  source_channel text NOT NULL,
  event_type text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_business_id ON events(business_id);
CREATE INDEX idx_events_contact_id ON events(contact_id);
CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_source_channel ON events(source_channel);
CREATE INDEX idx_events_created_at ON events(created_at);

-- 4. messages
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  channel text NOT NULL,
  direction text NOT NULL,
  body text,
  status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_business_id ON messages(business_id);
CREATE INDEX idx_messages_contact_id ON messages(contact_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- 5. recoveries
CREATE TABLE recoveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  recovery_type text NOT NULL,
  recovery_value integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_recoveries_business_id ON recoveries(business_id);
CREATE INDEX idx_recoveries_contact_id ON recoveries(contact_id);
CREATE INDEX idx_recoveries_created_at ON recoveries(created_at);
