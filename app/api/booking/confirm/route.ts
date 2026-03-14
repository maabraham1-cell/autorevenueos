import { NextRequest, NextResponse } from "next/server";
import { verifyBookingConfirmToken } from "@/lib/booking-confirm-token";
import { recordConfirmedBooking } from "@/lib/confirm-booking";

/**
 * POST /api/booking/confirm
 *
 * Used by the AutoRevenueOS booking page when the customer confirms.
 * Body: { confirm_token: string } (token issued when the booking page was loaded).
 * Do NOT use for integration webhooks — they call recordConfirmedBooking directly
 * from their own verified handlers.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const token =
      typeof body?.confirm_token === "string" ? body.confirm_token.trim() : null;
    const idempotencyKey =
      typeof body?.idempotency_key === "string" ? body.idempotency_key.trim() || null : null;

    if (!token) {
      return NextResponse.json(
        { error: "Missing confirm_token" },
        { status: 400 }
      );
    }

    const payload = verifyBookingConfirmToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: "Invalid or expired confirm_token" },
        { status: 400 }
      );
    }

    const result = await recordConfirmedBooking({
      business_id: payload.business_id,
      contact_id: payload.contact_id,
      recovery_id: payload.recovery_id,
      external_booking_id: null,
      confirmation_source: "autorevenueos_booking_page",
      idempotency_key: idempotencyKey,
    });

    if (!result.ok) {
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
    console.error("[booking/confirm] unexpected error:", e);
    return NextResponse.json(
      { error: "Failed to confirm booking" },
      { status: 500 }
    );
  }
}
