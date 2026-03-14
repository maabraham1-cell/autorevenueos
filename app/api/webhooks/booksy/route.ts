import { NextRequest, NextResponse } from "next/server";

/**
 * Booksy webhook: scaffold only.
 *
 * Booksy is used by barbers and salons. Integration may require partner/API access.
 *
 * When implementing:
 * - Use Booksy webhook or API (if available); verify requests; map business to business_id;
 *   extract booking id and customer; call recordConfirmedBooking(..., confirmation_source: "booksy").
 *
 * Required for full integration: Booksy developer/partner access; webhook or API docs; business_id mapping.
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: "Booksy integration not yet implemented",
      hint: "Booksy may require partner access. See docs/BOOKING_INTEGRATIONS.md",
    },
    { status: 501 }
  );
}
