import { NextRequest, NextResponse } from "next/server";

/**
 * Fresha webhook: scaffold only.
 *
 * Fresha is widely used in beauty/salons. Integration typically requires partner/API access.
 *
 * When implementing:
 * - Use Fresha partner API or webhooks (if available after partnership).
 * - Map venue/account to business_id; extract booking id and customer; call recordConfirmedBooking(..., confirmation_source: "fresha").
 *
 * Required for full integration: Fresha partner/API access; business_id mapping.
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: "Fresha integration not yet implemented",
      hint: "Fresha typically requires partner access. See docs/BOOKING_INTEGRATIONS.md",
    },
    { status: 501 }
  );
}
