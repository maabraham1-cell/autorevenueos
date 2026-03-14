import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase";
import { recordConfirmedBooking } from "@/lib/confirm-booking";

/**
 * Acuity Scheduling webhook: appointment scheduled → confirmed booking.
 *
 * Setup: In Acuity under Integrations set Webhook URL to:
 * https://your-domain/api/webhooks/acuity?business_id=<BUSINESS_UUID>
 * Store the same account's API key in businesses.acuity_api_key (for signature verification).
 * Acuity sends application/x-www-form-urlencoded with action=scheduled, id=appointmentId.
 * Verify using x-acuity-signature: base64(HMAC-SHA256(body, api_key)).
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

    const rawBody = await request.text();
    const params = new URLSearchParams(rawBody);
    const action = params.get("action");
    const appointmentId = params.get("id");

    if (action !== "scheduled") {
      return NextResponse.json(
        { error: "Ignored: only appointment.scheduled creates a confirmed booking" },
        { status: 200 }
      );
    }

    if (!appointmentId?.trim()) {
      return NextResponse.json(
        { error: "Payload missing appointment id" },
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

    const { data: business, error: bizError } = await db
      .from("businesses")
      .select("id, acuity_api_key")
      .eq("id", businessId)
      .single();

    if (bizError || !business) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    const apiKey = (business as { acuity_api_key?: string }).acuity_api_key;
    if (apiKey) {
      const signature = request.headers.get("x-acuity-signature");
      if (!signature) {
        return NextResponse.json(
          { error: "Missing x-acuity-signature" },
          { status: 401 }
        );
      }
      const expected = createHmac("sha256", apiKey)
        .update(rawBody)
        .digest("base64");
      if (signature !== expected) {
        return NextResponse.json(
          { error: "Invalid Acuity signature" },
          { status: 401 }
        );
      }
    }

    // Acuity payload does not include email in the webhook; we record without contact/recovery link.
    const result = await recordConfirmedBooking({
      business_id: businessId,
      contact_id: null,
      recovery_id: null,
      external_booking_id: `acuity:${appointmentId.trim()}`,
      confirmation_source: "acuity",
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
    console.error("[webhooks/acuity] unexpected error:", e);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
