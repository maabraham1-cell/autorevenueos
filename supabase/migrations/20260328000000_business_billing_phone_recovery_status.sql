-- Granular activation: billing vs phone recovery vs full activation.
-- billing_status: pending = no default payment method saved; ready = card on file.
-- phone_recovery_status: none | provisioned | failed
-- activation_status: active only when billing is ready AND phone recovery number is provisioned (Option B).

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS billing_status text NOT NULL DEFAULT 'pending';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS phone_recovery_status text NOT NULL DEFAULT 'none';

COMMENT ON COLUMN businesses.billing_status IS 'pending | ready. ready = Stripe default payment method on file.';
COMMENT ON COLUMN businesses.phone_recovery_status IS 'none | provisioned | failed. provisioned = Twilio recovery number assigned.';
COMMENT ON COLUMN businesses.activation_status IS 'onboarding | payment_required | billing_ready | active | suspended. active = billing ready AND phone recovery provisioned.';

-- Backfill from existing rows
UPDATE businesses
SET billing_status = 'ready'
WHERE COALESCE(NULLIF(TRIM(stripe_default_payment_method_id), ''), NULL) IS NOT NULL
   OR activation_status = 'active';

UPDATE businesses
SET phone_recovery_status = 'provisioned'
WHERE COALESCE(NULLIF(TRIM(twilio_phone_number), ''), NULL) IS NOT NULL;

UPDATE businesses
SET phone_recovery_status = 'failed'
WHERE phone_recovery_status = 'none'
  AND COALESCE(NULLIF(TRIM(twilio_provisioning_error), ''), NULL) IS NOT NULL;

-- Legacy: was "active" with card but no Twilio number — not fully active
UPDATE businesses
SET activation_status = 'billing_ready'
WHERE activation_status = 'active'
  AND COALESCE(NULLIF(TRIM(twilio_phone_number), ''), NULL) IS NULL;

-- Fully active only when both billing and number exist (do not lift suspended)
UPDATE businesses
SET activation_status = 'active'
WHERE billing_status = 'ready'
  AND phone_recovery_status = 'provisioned'
  AND COALESCE(activation_status, '') <> 'suspended';

CREATE INDEX IF NOT EXISTS idx_businesses_billing_status ON businesses(billing_status);
CREATE INDEX IF NOT EXISTS idx_businesses_phone_recovery_status ON businesses(phone_recovery_status);
