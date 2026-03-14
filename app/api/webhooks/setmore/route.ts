import { NextRequest, NextResponse } from "next/server";

/**
 * Setmore webhook: scaffold only.
 *
 * Setmore is used by salons and SMBs. Official public webhook documentation was not found;
 * some sources mention appointment.created-style events. If Setmore adds or exposes webhooks:
 *
 * When implementing:
 * - Verify request (signature or shared secret if provided).
 * - URL: .../api/webhooks/setmore?business_id=<UUID> or map Setmore account to business.
 * - Parse payload for appointment id and customer email/phone.
 * - Call findContactAndRecoveryByEmail (or by phone) then recordConfirmedBooking(..., confirmation_source: "setmore").
 *
 * Required for full integration: Official Setmore webhook docs or API; business_id mapping.
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: "Setmore integration not yet implemented",
      hint: "Awaiting official webhook/API for appointment created. See docs/BOOKING_INTEGRATIONS.md",
    },
    { status: 501 }
  );
}
