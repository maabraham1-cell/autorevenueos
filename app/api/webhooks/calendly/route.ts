import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { recordConfirmedBooking } from "@/lib/confirm-booking";
import { findContactAndRecoveryByEmail } from "@/lib/webhook-helpers";

/**
 * Calendly webhook: invitation created → confirmed booking.
 *
 * Setup: In Calendly create a webhook subscription for "invitee.created"
 * with URL: https://your-domain/api/webhooks/calendly?business_id=<BUSINESS_UUID>
 * Keep the URL private (it identifies the business). Optionally verify
 * Calendly-Signature with CALENDLY_WEBHOOK_SIGNING_KEY.
 *
 * Payload shape (relevant): { event, payload: { email?, uri?, ... } }
 * We use payload.uri as external_booking_id and match contact by email.
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

    // Calendly payload: { payload: { invitee?: { email?, uri? }, event?: { uri? } } }
    const pl = (raw as { payload?: { invitee?: { email?: string; uri?: string }; event?: { uri?: string } } }).payload;
    const invitee = pl?.invitee;
    const email =
      typeof invitee?.email === "string"
        ? invitee.email.trim().toLowerCase()
        : null;
    const externalUri =
      typeof invitee?.uri === "string"
        ? invitee.uri
        : typeof pl?.event?.uri === "string"
          ? pl.event.uri
          : null;

    if (!email) {
      return NextResponse.json(
        { error: "Payload missing invitee email" },
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

    const { contact_id: contactId, recovery_id: recoveryId } =
      await findContactAndRecoveryByEmail(db, businessId, email);

    const result = await recordConfirmedBooking({
      business_id: businessId,
      contact_id: contactId,
      recovery_id: recoveryId,
      external_booking_id: externalUri ?? null,
      confirmation_source: "calendly",
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
    console.error("[webhooks/calendly] unexpected error:", e);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
