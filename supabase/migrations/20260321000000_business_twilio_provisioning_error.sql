-- Persist last Phone Recovery provisioning error so UI can show failed state after reload.
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS twilio_provisioning_error text;
COMMENT ON COLUMN businesses.twilio_provisioning_error IS 'Last error from Twilio number provisioning; cleared on success. Shown in Settings when Phone Recovery provisioning failed.';
