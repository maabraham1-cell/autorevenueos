import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase";
import { recordConfirmedBooking } from "@/lib/confirm-booking";

/**
 * Square Appointments webhook: booking.created → confirmed booking.
 *
 * Setup:
 * 1. In Square Developer Dashboard create a webhook subscription for "booking.created".
 * 2. Set notification URL to: https://your-domain/api/webhooks/square
 * 3. Set SQUARE_WEBHOOK_SIGNATURE_KEY (from Square) in env.
 * 4. For each business using Square, set businesses.square_merchant_id to their Square merchant ID
 *    (so we map webhook merchant_id to business).
 *
 * Payload: { merchant_id, type, event_id, created_at, data: { type, id, object } }
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-square-signature");

    const signingKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
    if (signingKey && signature) {
      const expected = createHmac("sha256", signingKey)
        .update(rawBody)
        .digest("base64");
      if (signature !== expected) {
        return NextResponse.json(
          { error: "Invalid Square signature" },
          { status: 401 }
        );
      }
    } else if (signingKey && !signature) {
      return NextResponse.json(
        { error: "Missing x-square-signature" },
        { status: 401 }
      );
    }

    let raw: {
      merchant_id?: string;
      type?: string;
      created_at?: string;
      data?: { type?: string; id?: string };
    };
    try {
      raw = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    if (raw.type !== "booking.created") {
      return NextResponse.json(
        { error: "Unsupported event type" },
        { status: 400 }
      );
    }

    const merchantId = typeof raw.merchant_id === "string" ? raw.merchant_id.trim() : null;
    const bookingId = raw.data?.id;

    if (!merchantId || !bookingId) {
      return NextResponse.json(
        { error: "Payload missing merchant_id or booking id" },
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
      .select("id")
      .eq("square_merchant_id", merchantId)
      .single();

    if (bizError || !business) {
      console.warn("[webhooks/square] no business for merchant_id:", merchantId);
      return NextResponse.json(
        { error: "Business not found for this merchant" },
        { status: 404 }
      );
    }

    const confirmedAt =
      typeof raw.created_at === "string"
        ? (() => {
            const d = new Date(raw.created_at);
            return isNaN(d.getTime()) ? undefined : d;
          })()
        : undefined;

    const result = await recordConfirmedBooking({
      business_id: (business as { id: string }).id,
      contact_id: null,
      recovery_id: null,
      external_booking_id: `square:${bookingId}`,
      confirmation_source: "square",
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
    console.error("[webhooks/square] unexpected error:", e);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
