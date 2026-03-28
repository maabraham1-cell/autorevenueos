-- Idempotent Twilio provisioning: transient "provisioning" state + claim timestamp for stale recovery.
-- phone_recovery_status: none | provisioning | provisioned | failed

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS twilio_provisioning_started_at timestamptz;
COMMENT ON COLUMN businesses.twilio_provisioning_started_at IS 'Set when phone_recovery_status = provisioning; used to detect stale locks.';

COMMENT ON COLUMN businesses.phone_recovery_status IS
  'none | provisioning | provisioned | failed. provisioning = purchase in progress (prevents duplicate buys).';

-- Atomically attempt to claim the provisioning slot for this business.
-- Locking: single UPDATE with conditions; concurrent callers get 0 rows and must re-check (busy vs done).
CREATE OR REPLACE FUNCTION public.try_claim_twilio_provisioning(p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b record;
  n int;
  stale_after interval := interval '15 minutes';
BEGIN
  SELECT * INTO b FROM businesses WHERE id = p_business_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'not_found');
  END IF;

  IF b.twilio_phone_number IS NOT NULL AND trim(b.twilio_phone_number) <> '' THEN
    RETURN jsonb_build_object(
      'outcome', 'already_provisioned',
      'twilio_phone_number', trim(b.twilio_phone_number),
      'twilio_number_sid', b.twilio_number_sid,
      'phone_recovery_status', b.phone_recovery_status
    );
  END IF;

  IF coalesce(b.phone_recovery_status, '') = 'provisioned'
     AND b.twilio_number_sid IS NOT NULL
     AND trim(b.twilio_number_sid) <> '' THEN
    RETURN jsonb_build_object(
      'outcome', 'already_provisioned',
      'twilio_phone_number', b.twilio_phone_number,
      'twilio_number_sid', trim(b.twilio_number_sid),
      'phone_recovery_status', b.phone_recovery_status
    );
  END IF;

  UPDATE businesses
  SET
    phone_recovery_status = 'provisioning',
    twilio_provisioning_started_at = now(),
    twilio_provisioning_error = null
  WHERE id = p_business_id
    AND (twilio_phone_number IS NULL OR trim(twilio_phone_number) = '')
    AND (
      phone_recovery_status IN ('none', 'failed')
      OR (
        phone_recovery_status = 'provisioning'
        AND twilio_provisioning_started_at IS NOT NULL
        AND twilio_provisioning_started_at < now() - stale_after
      )
    );

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN
    RETURN jsonb_build_object('outcome', 'claimed');
  END IF;

  SELECT * INTO b FROM businesses WHERE id = p_business_id;
  IF b.twilio_phone_number IS NOT NULL AND trim(b.twilio_phone_number) <> '' THEN
    RETURN jsonb_build_object(
      'outcome', 'already_provisioned',
      'twilio_phone_number', trim(b.twilio_phone_number),
      'twilio_number_sid', b.twilio_number_sid
    );
  END IF;

  IF b.phone_recovery_status = 'provisioning'
     AND (
       b.twilio_provisioning_started_at IS NULL
       OR b.twilio_provisioning_started_at >= now() - stale_after
     ) THEN
    RETURN jsonb_build_object('outcome', 'busy');
  END IF;

  RETURN jsonb_build_object('outcome', 'busy');
END;
$$;

REVOKE ALL ON FUNCTION public.try_claim_twilio_provisioning(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_claim_twilio_provisioning(uuid) TO service_role;
