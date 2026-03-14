-- Internal role support for AutoRevenueOS.
-- Allowed values: platform_admin, owner, member.
-- New signups get role = owner by default. No UI or public way to set platform_admin.

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'owner';

ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('platform_admin', 'owner', 'member'));

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

COMMENT ON COLUMN profiles.role IS 'Internal only. platform_admin = system access; owner/member = workspace scoped. Not exposed in UI.';
