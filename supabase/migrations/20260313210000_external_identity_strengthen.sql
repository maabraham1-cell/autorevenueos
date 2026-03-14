-- Strengthen external identity model for scale.
-- Contacts: channel + external_id scoping; messages/events: provider IDs and dedupe.

-- 1) Contacts: add channel for stable (business_id, channel, external_id) identity.
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS channel text;

COMMENT ON COLUMN contacts.channel IS 'Channel for this contact identity: sms, meta, website_chat. Used with external_id for lookup/dedupe.';

-- Composite index for contact lookup by business + channel + external_id.
CREATE INDEX IF NOT EXISTS idx_contacts_business_channel_external_id
ON contacts(business_id, channel, external_id)
WHERE channel IS NOT NULL AND external_id IS NOT NULL;

-- Prevent duplicate contacts per (business, channel, external_id).
CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_business_channel_external_id
ON contacts(business_id, channel, external_id)
WHERE channel IS NOT NULL AND external_id IS NOT NULL;

-- 2) Messages: composite index for idempotency lookups (business + provider message id).
CREATE INDEX IF NOT EXISTS idx_messages_business_external_id
ON messages(business_id, external_id)
WHERE external_id IS NOT NULL;

-- Enforce at most one message per (business_id, external_id) for provider-level dedupe.
CREATE UNIQUE INDEX IF NOT EXISTS uq_messages_business_external_id
ON messages(business_id, external_id)
WHERE external_id IS NOT NULL;

-- 3) Events: composite index for idempotency (e.g. CallSid).
CREATE INDEX IF NOT EXISTS idx_events_business_external_id
ON events(business_id, external_id)
WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_events_business_external_id
ON events(business_id, external_id)
WHERE external_id IS NOT NULL;
