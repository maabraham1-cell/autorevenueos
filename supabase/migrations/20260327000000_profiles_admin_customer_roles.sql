-- Extend profiles.role with explicit admin / customer values (source of truth for access control).
-- Legacy values remain valid during transition.

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('admin', 'customer', 'platform_admin', 'owner', 'member'));

COMMENT ON COLUMN profiles.role IS
  'Access: admin|platform_admin = internal operator; customer|owner|member = business users.';

-- Internal operator account(s)
UPDATE profiles p
SET role = 'admin',
    business_id = NULL
FROM auth.users u
WHERE p.id = u.id
  AND lower(u.email) = 'hello@autorevenueos.com';

-- Existing platform_admin rows map to admin for a single canonical internal role
UPDATE profiles
SET role = 'admin'
WHERE role = 'platform_admin';
