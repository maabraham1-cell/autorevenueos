import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserAndBusiness } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { retryFailedBilling } from "@/lib/confirm-booking";

/**
 * POST /api/billing/retry
 *
 * Manual retry for a confirmed_booking with billing_status = 'failed'.
 * Body: { confirmed_booking_id: string }. Booking must belong to the current user's business.
 */
export async function POST(request: NextRequest) {
  try {
    const { user, business } = await getCurrentUserAndBusiness(request);

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    if (!business) {
      return NextResponse.json(
        { error: "No business linked to this user" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => null);
    const confirmedBookingId =
      typeof body?.confirmed_booking_id === "string"
        ? body.confirmed_booking_id.trim()
        : null;

    if (!confirmedBookingId) {
      return NextResponse.json(
        { error: "Missing confirmed_booking_id" },
        { status: 400 }
      );
    }

    const { data: booking, error: fetchError } = await supabase
      .from("confirmed_bookings")
      .select("id, business_id")
      .eq("id", confirmedBookingId)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    if ((booking as { business_id: string }).business_id !== (business as { id: string }).id) {
      return NextResponse.json(
        { error: "Booking does not belong to your business" },
        { status: 403 }
      );
    }

    const result = await retryFailedBilling(confirmedBookingId);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      billing_status: result.billing_status,
    });
  } catch (e) {
    console.error("[billing/retry] unexpected error:", e);
    return NextResponse.json(
      { error: "Failed to retry billing" },
      { status: 500 }
    );
  }
}
