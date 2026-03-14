/**
 * Single code path for recording a trusted booking confirmation.
 * This is the ONLY place that may trigger Stripe usage (confirmed_bookings meter).
 * Use from: integration webhooks (Calendly, Cal.com, Acuity, Square), or AutoRevenueOS booking page.
 * Do NOT use for recovery creation or link clicks — those are attribution only.
 */

import { supabase, getSupabaseAdmin } from "@/lib/supabase";
import { reportConfirmedBookingMeter } from "@/lib/stripe-meter";

export type ConfirmationSource =
  | "autorevenueos_booking_page"
  | "calendly"
  | "cal.com"
  | "acuity"
  | "square"
  | (string & {});

export type RecordConfirmedBookingInput = {
  business_id: string;
  contact_id: string | null;
  recovery_id: string | null;
  external_booking_id: string | null;
  confirmation_source: ConfirmationSource;
  confirmed_at?: Date;
  /** Optional idempotency key (e.g. from booking page). If provided and duplicate, returns error without inserting or billing. */
  idempotency_key?: string | null;
};

export type RecordConfirmedBookingResult =
  | { ok: true; confirmed_booking_id: string }
  | { ok: false; error: string };

type BillingEventType =
  | "confirmed"
  | "meter_sent"
  | "meter_failed"
  | "meter_skipped_no_customer"
  | "duplicate_ignored";

async function logBillingEvent(
  db: { from: (table: string) => { insert: (row: object) => Promise<{ error: unknown }> } },
  businessId: string,
  confirmedBookingId: string | null,
  eventType: BillingEventType,
  message: string | null,
  metadata?: Record<string, unknown>
) {
  await db.from("billing_events").insert({
    business_id: businessId,
    confirmed_booking_id: confirmedBookingId,
    event_type: eventType,
    message: message ?? null,
    metadata: metadata ?? null,
  });
}

async function findExistingConfirmedBooking(
  db: ReturnType<typeof getSupabaseAdmin> extends null ? typeof supabase : NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  input: RecordConfirmedBookingInput,
  idempotencyKey: string | null
): Promise<string | null> {
  if (idempotencyKey) {
    const { data: row } = await db
      .from("confirmed_bookings")
      .select("id")
      .eq("business_id", input.business_id)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (row?.id) return row.id;
  }
  const extId = input.external_booking_id?.trim();
  if (extId) {
    const { data: row } = await db
      .from("confirmed_bookings")
      .select("id")
      .eq("business_id", input.business_id)
      .eq("external_booking_id", extId)
      .eq("confirmation_source", input.confirmation_source)
      .maybeSingle();
    if (row?.id) return row.id;
  }
  return null;
}

/**
 * Insert a row into confirmed_bookings and, if the business has a Stripe customer,
 * report one unit to the confirmed_bookings meter (ONLY path that triggers Stripe).
 * billed_at is set only when the meter event is successfully reported; it does NOT mean the invoice is paid.
 * Idempotent by: (business_id, external_booking_id, confirmation_source) or idempotency_key when provided.
 */
export async function recordConfirmedBooking(
  input: RecordConfirmedBookingInput
): Promise<RecordConfirmedBookingResult> {
  const confirmed_at = input.confirmed_at ?? new Date();
  const db = getSupabaseAdmin() ?? supabase;

  const idempotencyKey =
    typeof input.idempotency_key === "string" && input.idempotency_key.trim()
      ? input.idempotency_key.trim()
      : null;

  const insertPayload = {
    business_id: input.business_id,
    contact_id: input.contact_id ?? null,
    recovery_id: input.recovery_id ?? null,
    external_booking_id: input.external_booking_id ?? null,
    confirmation_source: input.confirmation_source,
    confirmed_at: confirmed_at.toISOString(),
    billing_status: "pending",
    idempotency_key: idempotencyKey,
  };

  const { data: row, error: insertError } = await db
    .from("confirmed_bookings")
    .insert(insertPayload)
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const existing = await findExistingConfirmedBooking(db, input, idempotencyKey);
      await logBillingEvent(
        db,
        input.business_id,
        existing ?? null,
        "duplicate_ignored",
        "Duplicate booking (idempotency or external_booking_id conflict); returning existing id.",
        { source: input.confirmation_source, idempotency_key: idempotencyKey ?? undefined }
      );
      if (existing) {
        return { ok: true, confirmed_booking_id: existing };
      }
      return { ok: false, error: "Duplicate booking (already confirmed)" };
    }
    console.error("[confirm-booking] insert error:", insertError.message);
    return { ok: false, error: insertError.message };
  }

  if (!row?.id) {
    return { ok: false, error: "Insert did not return id" };
  }

  await logBillingEvent(db, input.business_id, row.id, "confirmed", "Booking confirmed.", {
    source: input.confirmation_source,
    external_booking_id: input.external_booking_id ?? undefined,
  });

  const { data: business } = await db
    .from("businesses")
    .select("stripe_customer_id")
    .eq("id", input.business_id)
    .single();

  const stripeCustomerId =
    (business as { stripe_customer_id?: string } | null)?.stripe_customer_id;

  if (!stripeCustomerId) {
    await db
      .from("confirmed_bookings")
      .update({ billing_status: "skipped" })
      .eq("id", row.id);
    await logBillingEvent(
      db,
      input.business_id,
      row.id,
      "meter_skipped_no_customer",
      "Business has no stripe_customer_id; meter not sent.",
      {}
    );
    return { ok: true, confirmed_booking_id: row.id };
  }

  const meterResult = await reportConfirmedBookingMeter({
    stripeCustomerId,
    confirmedBookingId: row.id,
    timestamp: confirmed_at,
  });

  if (meterResult.ok) {
    await db
      .from("confirmed_bookings")
      .update({ billed_at: new Date().toISOString(), billing_status: "sent" })
      .eq("id", row.id);
    await logBillingEvent(db, input.business_id, row.id, "meter_sent", "Stripe meter event reported.", {});
  } else {
    await db
      .from("confirmed_bookings")
      .update({ billing_status: "failed", billing_error: meterResult.error })
      .eq("id", row.id);
    console.error(
      "[confirm-booking] Stripe meter report failed (booking still recorded):",
      meterResult.error
    );
    await logBillingEvent(
      db,
      input.business_id,
      row.id,
      "meter_failed",
      meterResult.error,
      { error: meterResult.error }
    );
  }

  return { ok: true, confirmed_booking_id: row.id };
}

export type RetryFailedBillingResult =
  | { ok: true; billing_status: "sent" }
  | { ok: false; error: string };

/**
 * Retry sending the Stripe meter event for a confirmed_booking that has billing_status = 'failed'.
 * Call from admin or manual retry endpoint. Does nothing if status is not 'failed'.
 * billed_at is set only when the meter event is successfully reported (not when invoice is paid).
 */
export async function retryFailedBilling(confirmedBookingId: string): Promise<RetryFailedBillingResult> {
  const db = getSupabaseAdmin() ?? supabase;

  const { data: row, error: fetchError } = await db
    .from("confirmed_bookings")
    .select("id, business_id, confirmed_at, billing_status")
    .eq("id", confirmedBookingId)
    .single();

  if (fetchError || !row) {
    return { ok: false, error: "Booking not found" };
  }

  const status = (row as { billing_status?: string }).billing_status;
  if (status !== "failed") {
    return { ok: false, error: `Booking billing status is '${status ?? "unknown"}', not 'failed'. Nothing to retry.` };
  }

  const businessId = (row as { business_id: string }).business_id;
  const { data: business } = await db
    .from("businesses")
    .select("stripe_customer_id")
    .eq("id", businessId)
    .single();

  const stripeCustomerId = (business as { stripe_customer_id?: string } | null)?.stripe_customer_id;
  if (!stripeCustomerId) {
    return { ok: false, error: "Business has no stripe_customer_id" };
  }

  const confirmedAt = (row as { confirmed_at?: string }).confirmed_at
    ? new Date((row as { confirmed_at: string }).confirmed_at)
    : new Date();

  const meterResult = await reportConfirmedBookingMeter({
    stripeCustomerId,
    confirmedBookingId: row.id,
    timestamp: confirmedAt,
  });

  if (meterResult.ok) {
    await db
      .from("confirmed_bookings")
      .update({
        billed_at: new Date().toISOString(),
        billing_status: "sent",
        billing_error: null,
      })
      .eq("id", row.id);
    await logBillingEvent(db, businessId, row.id, "meter_sent", "Stripe meter event reported (retry).", {});
    return { ok: true, billing_status: "sent" };
  }

  await db
    .from("confirmed_bookings")
    .update({ billing_status: "failed", billing_error: meterResult.error })
    .eq("id", row.id);
  await logBillingEvent(
    db,
    businessId,
    row.id,
    "meter_failed",
    meterResult.error,
    { error: meterResult.error, retry: true }
  );
  return { ok: false, error: meterResult.error };
}
