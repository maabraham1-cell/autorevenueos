import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { recordConfirmedBooking } from "@/lib/confirm-booking";
import { parseInboundFeedPayload } from "@/lib/webhook-helpers";
import { FEED_ALLOWED_SOURCES } from "@/lib/booking-providers";

/**
 * Generic inbound feed for confirmed bookings.
 *
 * Use from Zapier, Make, Pipedream, Google Apps Script, or any automation that can POST JSON.
 *
 * POST /api/webhooks/feed
 * Authorization: Bearer <INBOUND_FEED_SECRET> — REQUIRED in production (NODE_ENV=production).
 *
 * Body (JSON):
 *   business_id   (required) UUID of the business
 *   confirmation_source (required) one of: google_sheets, zapier, make, pipedream, manual_feed,
 *     fresha, timely, treatwell, cliniko, setmore, jane, booksy, acuity, calendly, cal.com, square
 *   external_booking_id (optional) provider booking id for idempotency
 *   contact_id    (optional) UUID of contact
 *   recovery_id   (optional) UUID of recovery
 *   confirmed_at  (optional) ISO date string
 *
 * All confirmations flow through recordConfirmedBooking() → confirmed_bookings and Stripe meter.
 * In production, INBOUND_FEED_SECRET must be set or the endpoint returns 503 (feed disabled).
 */
export async function POST(request: NextRequest) {
  try {
    const secret = process.env.INBOUND_FEED_SECRET;
    const isProduction = process.env.NODE_ENV === "production";

    if (isProduction && !secret) {
      return NextResponse.json(
        {
          error: "Feed is disabled in production until INBOUND_FEED_SECRET is set.",
          code: "FEED_SECRET_REQUIRED",
        },
        { status: 503 }
      );
    }

    if (secret) {
      const auth = request.headers.get("authorization");
      const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
      if (token !== secret) {
        return NextResponse.json(
          { error: "Missing or invalid Authorization. Use Bearer <INBOUND_FEED_SECRET>." },
          { status: 401 }
        );
      }
    }

    const body = await request.json().catch(() => null);
    const parsed = parseInboundFeedPayload(body, {
      allowedSources: FEED_ALLOWED_SOURCES,
    });

    if (!parsed.ok) {
      return NextResponse.json(
        { error: parsed.error },
        { status: 400 }
      );
    }

    const db = getSupabaseAdmin();
    if (!db) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const { data: business } = await db
      .from("businesses")
      .select("id")
      .eq("id", parsed.input.business_id)
      .single();

    if (!business) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    const result = await recordConfirmedBooking(parsed.input);

    if (!result.ok) {
      if (result.error.includes("Duplicate")) {
        return NextResponse.json({ success: true });
      }
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      confirmed_booking_id: result.confirmed_booking_id,
    });
  } catch (e) {
    console.error("[webhooks/feed] unexpected error:", e);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
