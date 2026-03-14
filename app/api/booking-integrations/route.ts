import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserAndBusiness } from "@/lib/auth";

/**
 * GET /api/booking-integrations
 * Returns webhook URLs and booking page URL for the current business (for Settings UI).
 */
export async function GET(request: NextRequest) {
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

    const base =
      process.env.NEXT_PUBLIC_APP_URL ||
      (request.nextUrl ? `${request.nextUrl.protocol}//${request.nextUrl.host}` : "");
    const businessId = (business as { id: string }).id;

    const webhooks = {
      calendly: `${base}/api/webhooks/calendly?business_id=${businessId}`,
      calcom: `${base}/api/webhooks/calcom?business_id=${businessId}`,
      acuity: `${base}/api/webhooks/acuity?business_id=${businessId}`,
      square: `${base}/api/webhooks/square`,
    };

    const booking_page_url = `${base}/book/${businessId}`;

    return NextResponse.json({
      business_id: businessId,
      booking_page_url,
      webhooks,
      hint: {
        square: "Set businesses.square_merchant_id to your Square merchant ID so we can map webhooks to this business.",
        acuity: "Store your Acuity API key in Settings (Acuity) for webhook signature verification.",
      },
    });
  } catch (e) {
    console.error("[booking-integrations] unexpected error:", e);
    return NextResponse.json(
      { error: "Failed to load booking integrations" },
      { status: 500 }
    );
  }
}
