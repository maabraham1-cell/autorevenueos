/**
 * Stripe usage-based billing: report confirmed_bookings meter events only.
 *
 * IMPORTANT: This function must ONLY be called from lib/confirm-booking.ts
 * (recordConfirmedBooking). No other code path may trigger Stripe usage.
 * Recoveries and link clicks are attribution only and must never call this.
 *
 * In Stripe Dashboard: create a meter with event name "confirmed_bookings",
 * customer mapping key "stripe_customer_id", and value key "value".
 */

const METER_EVENT_NAME = "confirmed_bookings";

export type ReportConfirmedBookingResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Report one confirmed booking to Stripe for usage-based billing.
 * Idempotency: use confirmedBookingId as identifier so the same booking is never counted twice.
 */
export async function reportConfirmedBookingMeter(args: {
  stripeCustomerId: string;
  confirmedBookingId: string;
  timestamp?: Date;
}): Promise<ReportConfirmedBookingResult> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !key.startsWith("sk_")) {
    return { ok: false, error: "STRIPE_SECRET_KEY not configured" };
  }

  const timestamp = Math.floor(
    (args.timestamp ?? new Date()).getTime() / 1000
  );
  const body = new URLSearchParams({
    event_name: METER_EVENT_NAME,
    "payload[value]": "1",
    "payload[stripe_customer_id]": args.stripeCustomerId,
    timestamp: String(timestamp),
    identifier: args.confirmedBookingId,
  });

  try {
    const res = await fetch("https://api.stripe.com/v1/billing/meter_events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[stripe-meter] Stripe API error:", res.status, err);
      return { ok: false, error: `${res.status}: ${err}` };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[stripe-meter] reportConfirmedBookingMeter error:", message);
    return { ok: false, error: message };
  }
}
