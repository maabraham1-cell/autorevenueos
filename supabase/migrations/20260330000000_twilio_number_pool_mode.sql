-- Optional shared Twilio pool: reuse pre-provisioned numbers instead of purchasing per business.
-- Default remains dedicated (one purchased number per business). Routing unchanged: one business row per number.

CREATE TABLE IF NOT EXISTS public.twilio_number_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  twilio_number_sid text NOT NULL UNIQUE,
  phone_e164 text NOT NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'assigned')),
  assigned_business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_twilio_number_pool_available ON public.twilio_number_pool (created_at)
  WHERE status = 'available';

ALTER TABLE public.twilio_number_pool ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.twilio_number_pool IS 'Pre-provisioned Twilio incoming numbers for optional pool mode; assign exclusively to one business at a time.';
COMMENT ON COLUMN public.twilio_number_pool.status IS 'available = in pool; assigned = linked to assigned_business_id.';

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS phone_number_mode text NOT NULL DEFAULT 'dedicated'
    CHECK (phone_number_mode IN ('dedicated', 'pool'));

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS twilio_pool_entry_id uuid REFERENCES public.twilio_number_pool(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.businesses.phone_number_mode IS 'dedicated = purchase/own number (default). pool = assign from twilio_number_pool when provisioning.';
COMMENT ON COLUMN public.businesses.twilio_pool_entry_id IS 'Set when phone_number_mode=pool and a pool row was assigned; null for dedicated purchases.';

-- Atomically assign next available pool number to a business (exclusive — routing stays 1:1).
CREATE OR REPLACE FUNCTION public.claim_twilio_pool_entry(p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.twilio_number_pool%ROWTYPE;
BEGIN
  SELECT p.* INTO r
  FROM public.twilio_number_pool p
  WHERE p.status = 'available'
  ORDER BY p.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'empty');
  END IF;

  UPDATE public.twilio_number_pool
  SET
    status = 'assigned',
    assigned_business_id = p_business_id,
    assigned_at = now()
  WHERE id = r.id;

  RETURN jsonb_build_object(
    'outcome', 'claimed',
    'pool_entry_id', r.id,
    'twilio_number_sid', r.twilio_number_sid,
    'phone_e164', r.phone_e164
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.revert_twilio_pool_entry(p_pool_entry_id uuid, p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
BEGIN
  UPDATE public.twilio_number_pool
  SET
    status = 'available',
    assigned_business_id = null,
    assigned_at = null
  WHERE id = p_pool_entry_id
    AND assigned_business_id IS NOT DISTINCT FROM p_business_id;

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RETURN jsonb_build_object('outcome', 'noop');
  END IF;
  RETURN jsonb_build_object('outcome', 'reverted');
END;
$$;

REVOKE ALL ON FUNCTION public.claim_twilio_pool_entry(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revert_twilio_pool_entry(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_twilio_pool_entry(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.revert_twilio_pool_entry(uuid, uuid) TO service_role;

-- Admin RPCs: return type changed — must drop first (PostgreSQL disallows CREATE OR REPLACE with different OUT shape).
DROP FUNCTION IF EXISTS public.admin_list_platform_businesses();
DROP FUNCTION IF EXISTS public.admin_get_platform_business(uuid);

-- Admin RPCs: include phone_number_mode for operator visibility
CREATE OR REPLACE FUNCTION public.admin_list_platform_businesses()
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  created_at timestamptz,
  phone text,
  phone_number_mode text,
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
    b.phone_number_mode,
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
  phone_number_mode text,
  twilio_pool_entry_id uuid,
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
    b.phone_number_mode,
    b.twilio_pool_entry_id,
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

-- Seed example (run manually after purchasing numbers in Twilio): insert available rows with matching SID and E.164.
-- INSERT INTO public.twilio_number_pool (twilio_number_sid, phone_e164, status, notes)
-- VALUES ('PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', '+44xxxxxxxxxx', 'available', 'Pool candidate');
