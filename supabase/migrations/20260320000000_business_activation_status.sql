-- Activation/billing state: business cannot use billable features until payment method is on file.
-- onboarding = just created, not yet configured
-- payment_required = no valid payment method; must add card to activate
-- active = has payment method; can use phone recovery and confirmed booking billing
-- suspended = admin or billing issue (e.g. payment failed)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS activation_status text NOT NULL DEFAULT 'payment_required';
CREATE INDEX IF NOT EXISTS idx_businesses_activation_status ON businesses(activation_status);
COMMENT ON COLUMN businesses.activation_status IS 'onboarding | payment_required | active | suspended. Only active businesses can use billable features (phone recovery, confirmed booking meter).';

-- Optional: store default payment method id for display (e.g. "Card ending 4242").
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS stripe_default_payment_method_id text;
