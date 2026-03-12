-- Add external_id to contacts so we can associate
-- website visitors and future WhatsApp / Meta IDs
-- with a single contact record.

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS external_id text;

CREATE INDEX IF NOT EXISTS idx_contacts_external_id
  ON contacts(external_id);

