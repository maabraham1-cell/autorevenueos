-- WhatsApp Cloud API uses a separate "Phone Number ID" for the webhook value.metadata.phone_number_id.
-- Store it so the webhook can resolve the business without relying on meta_page_id (Page ID) or display number.

ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id text;

CREATE INDEX IF NOT EXISTS idx_businesses_whatsapp_phone_number_id
ON businesses(whatsapp_phone_number_id)
WHERE whatsapp_phone_number_id IS NOT NULL;

COMMENT ON COLUMN businesses.whatsapp_phone_number_id IS 'Meta WhatsApp Cloud API phone_number_id from webhook metadata; used to route inbound WhatsApp messages to this business.';
