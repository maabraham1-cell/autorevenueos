import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserAndBusiness } from "@/lib/auth";
import { BOOKING_PROVIDERS } from "@/lib/booking-providers";

/**
 * GET /api/booking-integrations
 * Returns webhook URLs, booking page URL, and provider metadata (trust level, setup hints) for the current business.
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
    const isProduction = process.env.NODE_ENV === "production";

    const booking_page_url = `${base}/book/${businessId}`;

    const providers = BOOKING_PROVIDERS.map((p) => {
      let webhookUrl: string | null = null;
      if (p.id === "autorevenueos_booking_page") {
        webhookUrl = booking_page_url;
      } else if (p.routePath.startsWith("/api/")) {
        const path = p.routePath as string;
        const needsBusinessId = !["square", "feed"].includes(p.id);
        webhookUrl = needsBusinessId
          ? `${base}${path}?business_id=${businessId}`
          : `${base}${path}`;
      }
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        trustLevel: p.trustLevel,
        trustLabel: p.trustLabel ?? p.trustLevel,
        confirmationMethod: p.confirmationMethod,
        webhookUrl,
        setupHint: p.blocksProduction ?? p.notes ?? null,
        credentialsNeeded: p.credentialsNeeded,
        canTriggerConfirmedBookingsToday: p.canTriggerConfirmedBookingsToday,
      };
    });

    return NextResponse.json({
      business_id: businessId,
      booking_page_url,
      providers,
      feed_secret_required_in_production: isProduction,
      hint: {
        square: "Set Square merchant ID in Booking credentials below so we can map webhooks to this business.",
        acuity: "Set Acuity API key in Booking credentials below for webhook signature verification.",
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
