import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { recordConfirmedBooking } from "@/lib/confirm-booking";
import { findContactAndRecoveryByEmail } from "@/lib/webhook-helpers";

/**
 * Cal.com webhook: BOOKING_CREATED → confirmed booking.
 *
 * Setup: In Cal.com go to /settings/developer/webhooks, add Subscriber URL:
 * https://your-domain/api/webhooks/calcom?business_id=<BUSINESS_UUID>
 * Trigger: "Booking Created". Optionally set Secret and verify with CAL_WEBHOOK_SECRET.
 *
 * Payload: { triggerEvent, createdAt, payload: { uid, attendees: [{ email }], ... } }
 */
export async function POST(request: NextRequest) {
  try {
    const businessId = request.nextUrl.searchParams.get("business_id");
    if (!businessId) {
      return NextResponse.json(
        { error: "Missing business_id in webhook URL" },
        { status: 400 }
      );
    }

    const raw = await request.json().catch(() => null);
    if (!raw || typeof raw !== "object") {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const triggerEvent = (raw as { triggerEvent?: string }).triggerEvent;
    if (triggerEvent !== "BOOKING_CREATED" && triggerEvent !== "BOOKING_CONFIRMED") {
      return NextResponse.json(
        { error: "Unsupported trigger event" },
        { status: 400 }
      );
    }

    const payload = (raw as { payload?: { uid?: string; attendees?: Array<{ email?: string }> }; createdAt?: string }).payload;
    const uid = typeof payload?.uid === "string" ? payload.uid.trim() : null;
    const attendees = Array.isArray(payload?.attendees) ? payload.attendees : [];
    const email =
      typeof attendees[0]?.email === "string"
        ? attendees[0].email.trim().toLowerCase()
        : null;

    if (!uid) {
      return NextResponse.json(
        { error: "Payload missing booking uid" },
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

    const { contact_id: contactId, recovery_id: recoveryId } = email
      ? await findContactAndRecoveryByEmail(db, businessId, email)
      : { contact_id: null as string | null, recovery_id: null as string | null };

    const createdAt = (raw as { createdAt?: string }).createdAt;
    const confirmedAt =
      typeof createdAt === "string"
        ? (() => {
            const d = new Date(createdAt);
            return isNaN(d.getTime()) ? undefined : d;
          })()
        : undefined;

    const result = await recordConfirmedBooking({
      business_id: businessId,
      contact_id: contactId,
      recovery_id: recoveryId,
      external_booking_id: uid,
      confirmation_source: "cal.com",
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
    console.error("[webhooks/calcom] unexpected error:", e);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
