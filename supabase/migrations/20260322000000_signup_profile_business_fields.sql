-- Signup/onboarding: profile name parts and business contact + type (industry).
-- Used to store data collected at signup and reduce repetition in /setup.

-- Profiles: title and name parts (signup form "About you")
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name text;
COMMENT ON COLUMN profiles.title IS 'Salutation from signup (Mr, Mrs, Ms, etc.)';
COMMENT ON COLUMN profiles.first_name IS 'First name from signup';
COMMENT ON COLUMN profiles.last_name IS 'Last name from signup';

-- Businesses: primary contact phone from signup ("Business mobile")
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS business_mobile text;
CREATE INDEX IF NOT EXISTS idx_businesses_business_mobile ON businesses(business_mobile) WHERE business_mobile IS NOT NULL;
COMMENT ON COLUMN businesses.business_mobile IS 'Primary business contact phone from signup; used for account/recovery contact.';
