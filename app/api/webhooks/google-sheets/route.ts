import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { recordConfirmedBooking } from "@/lib/confirm-booking";
import { parseInboundFeedPayload } from "@/lib/webhook-helpers";
import { findContactAndRecoveryByEmail } from "@/lib/webhook-helpers";

/**
 * Google Sheets (and Apps Script / Make / Zapier) webhook for confirmed bookings.
 *
 * Use when Google Sheets is the source of truth: each row = one confirmed booking.
 * Post from Apps Script (onEdit/submit), Make, or Zapier with the standard payload.
 *
 * POST /api/webhooks/google-sheets?business_id=<BUSINESS_UUID>
 * Or include business_id in body.
 *
 * Body (JSON) – standard mapping:
 *   business_id        (required if not in query)
 *   external_booking_id (optional) e.g. row id or "sheet:A1"
 *   contact_id         (optional)
 *   recovery_id        (optional)
 *   email              (optional) if set, we resolve contact_id/recovery_id for this business
 *   confirmed_at       (optional) ISO date
 *
 * Row → payload mapping (for Apps Script / Make):
 *   business_id, contact_id, recovery_id, external_booking_id, confirmed_at, confirmation_source
 *   confirmation_source is fixed to "google_sheets".
 */
export async function POST(request: NextRequest) {
  try {
    const businessIdQuery = request.nextUrl.searchParams.get("business_id");
    const secret = process.env.INBOUND_FEED_SECRET;
    const isProduction = process.env.NODE_ENV === "production";

    if (isProduction && !secret) {
      return NextResponse.json(
        {
          error: "Google Sheets feed is disabled in production until INBOUND_FEED_SECRET is set.",
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
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const b = body as Record<string, unknown>;
    let businessId =
      typeof b.business_id === "string"
        ? b.business_id.trim()
        : (businessIdQuery ?? "").trim();
    if (!businessId) {
      return NextResponse.json(
        { error: "Missing business_id (query or body)" },
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
      .eq("id", businessId)
      .single();

    if (!business) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    let contactId: string | null =
      typeof b.contact_id === "string" && b.contact_id.trim()
        ? b.contact_id.trim()
        : null;
    let recoveryId: string | null =
      typeof b.recovery_id === "string" && b.recovery_id.trim()
        ? b.recovery_id.trim()
        : null;

    const email =
      typeof b.email === "string" ? b.email.trim().toLowerCase() : null;
    if (email && (!contactId || !recoveryId)) {
      const found = await findContactAndRecoveryByEmail(db, businessId, email);
      contactId = contactId ?? found.contact_id;
      recoveryId = recoveryId ?? found.recovery_id;
    }

    const externalBookingId =
      typeof b.external_booking_id === "string" && b.external_booking_id.trim()
        ? b.external_booking_id.trim()
        : null;
    let confirmedAt: Date | undefined;
    if (typeof b.confirmed_at === "string" && b.confirmed_at.trim()) {
      const d = new Date(b.confirmed_at.trim());
      if (!isNaN(d.getTime())) confirmedAt = d;
    }

    const result = await recordConfirmedBooking({
      business_id: businessId,
      contact_id: contactId,
      recovery_id: recoveryId,
      external_booking_id: externalBookingId,
      confirmation_source: "google_sheets",
      confirmed_at: confirmedAt,
    });

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
    console.error("[webhooks/google-sheets] unexpected error:", e);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
