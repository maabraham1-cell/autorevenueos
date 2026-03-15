import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { recordConfirmedBooking } from "@/lib/confirm-booking";
import { findContactAndRecoveryByEmail } from "@/lib/webhook-helpers";

/**
 * Cliniko webhook / bridge for confirmed bookings.
 *
 * Cliniko does not expose native webhooks. Use this endpoint:
 * - From Zapier/Integrately/Make: when "Appointment created" or "Appointment confirmed" fires, POST here.
 * - From polling: your job polls Cliniko API (200/min), then POSTs each new appointment to this URL.
 *
 * POST /api/webhooks/cliniko?business_id=<BUSINESS_UUID>
 * Body (JSON): business_id?, external_booking_id, email?, confirmed_at?
 * external_booking_id can be cliniko:<appointment_id> for idempotency.
 */
export async function POST(request: NextRequest) {
  try {
    const businessIdQuery = request.nextUrl.searchParams.get("business_id");
    const raw = await request.json().catch(() => null);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const b = raw as Record<string, unknown>;
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

    const externalBookingId =
      typeof b.external_booking_id === "string" && b.external_booking_id.trim()
        ? b.external_booking_id.trim()
        : typeof b.appointment_id === "string" && b.appointment_id.trim()
          ? `cliniko:${b.appointment_id.trim()}`
          : null;

    const email =
      typeof b.email === "string" ? b.email.trim().toLowerCase() : null;
    let confirmedAt: Date | undefined;
    if (typeof b.confirmed_at === "string" && b.confirmed_at.trim()) {
      const d = new Date(b.confirmed_at.trim());
      if (!isNaN(d.getTime())) confirmedAt = d;
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

    const { contact_id: contactId, recovery_id: recoveryId } = email
      ? await findContactAndRecoveryByEmail(db, businessId, email)
      : { contact_id: null as string | null, recovery_id: null as string | null };

    const result = await recordConfirmedBooking({
      business_id: businessId,
      contact_id: contactId,
      recovery_id: recoveryId,
      external_booking_id: externalBookingId,
      confirmation_source: "cliniko",
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
    console.error("[webhooks/cliniko] unexpected error:", e);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
