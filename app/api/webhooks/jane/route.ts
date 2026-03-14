import { NextRequest, NextResponse } from "next/server";

/**
 * Jane App webhook: scaffold only.
 *
 * Jane App (clinics, wellness) has a Developer Platform API (OAuth, List Appointments, etc.)
 * but no public webhook docs for booking-created in the search results.
 *
 * When implementing:
 * - If Jane provides webhooks: verify signature, map practice/clinic to business_id,
 *   extract booking id and patient identifier, call recordConfirmedBooking(..., confirmation_source: "jane").
 * - Alternatively: poll List Appointments API with OAuth per business (requires Jane extension approval).
 *
 * Required for full integration: Jane webhook docs or polling strategy; OAuth per business; business_id mapping.
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: "Jane App integration not yet implemented",
      hint: "Jane Developer Platform may support webhooks or polling. See docs/BOOKING_INTEGRATIONS.md",
    },
    { status: 501 }
  );
}
