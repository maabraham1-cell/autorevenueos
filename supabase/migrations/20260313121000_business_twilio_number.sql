-- Optional Twilio routing fields for businesses.
-- Allows mapping incoming Twilio webhooks to the correct business by "To" number.

ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS twilio_phone_number text;

CREATE INDEX IF NOT EXISTS idx_businesses_twilio_phone_number
ON businesses(twilio_phone_number);

