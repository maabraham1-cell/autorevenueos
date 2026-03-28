-- Read-only aggregates for platform admin (service_role only).
-- Used by /api/admin/customers — not exposed to anon/authenticated JWT clients.

CREATE OR REPLACE FUNCTION public.admin_list_platform_businesses()
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  created_at timestamptz,
  phone text,
  contact_count bigint,
  conversation_count bigint,
  recovery_count bigint,
  confirmed_booking_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id,
    b.name,
    u.email::text,
    b.created_at,
    COALESCE(b.business_mobile, b.twilio_phone_number)::text AS phone,
    (SELECT COUNT(*)::bigint FROM contacts c WHERE c.business_id = b.id),
    (SELECT COUNT(*)::bigint FROM conversations cv WHERE cv.business_id = b.id),
    (SELECT COUNT(*)::bigint FROM recoveries r WHERE r.business_id = b.id),
    (SELECT COUNT(*)::bigint FROM confirmed_bookings cb WHERE cb.business_id = b.id)
  FROM businesses b
  LEFT JOIN LATERAL (
    SELECT pr.id
    FROM profiles pr
    WHERE pr.business_id = b.id
    ORDER BY pr.created_at ASC NULLS LAST
    LIMIT 1
  ) fp ON true
  LEFT JOIN auth.users u ON u.id = fp.id
  ORDER BY b.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_list_platform_businesses() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_platform_businesses() TO service_role;

CREATE OR REPLACE FUNCTION public.admin_get_platform_business(p_business_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  created_at timestamptz,
  business_mobile text,
  twilio_phone_number text,
  industry text,
  activation_status text,
  booking_link text,
  contact_count bigint,
  conversation_count bigint,
  recovery_count bigint,
  confirmed_booking_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id,
    b.name,
    u.email::text,
    b.created_at,
    b.business_mobile,
    b.twilio_phone_number,
    b.industry,
    b.activation_status,
    b.booking_link,
    (SELECT COUNT(*)::bigint FROM contacts c WHERE c.business_id = b.id),
    (SELECT COUNT(*)::bigint FROM conversations cv WHERE cv.business_id = b.id),
    (SELECT COUNT(*)::bigint FROM recoveries r WHERE r.business_id = b.id),
    (SELECT COUNT(*)::bigint FROM confirmed_bookings cb WHERE cb.business_id = b.id)
  FROM businesses b
  LEFT JOIN LATERAL (
    SELECT pr.id
    FROM profiles pr
    WHERE pr.business_id = b.id
    ORDER BY pr.created_at ASC NULLS LAST
    LIMIT 1
  ) fp ON true
  LEFT JOIN auth.users u ON u.id = fp.id
  WHERE b.id = p_business_id;
$$;

REVOKE ALL ON FUNCTION public.admin_get_platform_business(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_platform_business(uuid) TO service_role;
