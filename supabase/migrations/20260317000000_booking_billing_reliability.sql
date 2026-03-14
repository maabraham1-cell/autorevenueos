-- Final reliability: scope provider uniqueness by business_id; clarify billed_at meaning.

-- 1) Provider booking uniqueness scoped by business_id (same external booking cannot be confirmed twice for the same business).
DROP INDEX IF EXISTS idx_confirmed_bookings_external_id_source;

CREATE UNIQUE INDEX idx_confirmed_bookings_business_external_source
ON confirmed_bookings(business_id, external_booking_id, confirmation_source)
WHERE external_booking_id IS NOT NULL AND external_booking_id <> '';

-- 2) billed_at means strictly "meter event successfully reported to Stripe", not invoice paid.
COMMENT ON COLUMN confirmed_bookings.billed_at IS 'Set when the confirmed_bookings meter event was successfully reported to Stripe. Does NOT mean the invoice has been paid.';
