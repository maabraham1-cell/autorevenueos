-- Store Twilio IncomingPhoneNumber SID for each business so numbers can be managed (release, rotate, webhooks).
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS twilio_number_sid text;
CREATE INDEX IF NOT EXISTS idx_businesses_twilio_number_sid ON businesses(twilio_number_sid) WHERE twilio_number_sid IS NOT NULL;
COMMENT ON COLUMN businesses.twilio_number_sid IS 'Twilio IncomingPhoneNumber SID (PN...) for auto-provisioned recovery number; used for webhook config and future release/rotate.';
