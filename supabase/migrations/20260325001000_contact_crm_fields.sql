-- Lightweight mini-CRM fields on contacts

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS status text;

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[];

COMMENT ON COLUMN contacts.status IS 'Mini-CRM status for this contact (e.g. new_lead, in_conversation, waiting_for_customer, booking_requested, booked, lost).';
COMMENT ON COLUMN contacts.notes IS 'Freeform notes about the contact (preferences, context).';
COMMENT ON COLUMN contacts.tags IS 'Lightweight labels for the contact (e.g. Hot lead, Returning client).';

