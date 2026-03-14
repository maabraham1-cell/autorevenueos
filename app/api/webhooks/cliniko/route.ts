import { NextRequest, NextResponse } from "next/server";

/**
 * Cliniko webhook: scaffold only.
 *
 * Cliniko (clinics, practitioners) does not expose native webhooks in their public API.
 * Integration options:
 * - Use their REST API to poll for new/updated appointments (rate limit 200/min).
 * - Use a third-party (Integrately, Zapier, Appy Pie) to forward "appointment created" to this URL.
 *
 * When implementing:
 * - Accept POST with a shared secret or signed payload.
 * - Map organization/practice to business_id (e.g. query param or payload tenant id).
 * - Extract external_booking_id and optionally patient email for contact/recovery link.
 * - Call recordConfirmedBooking(..., confirmation_source: "cliniko").
 *
 * Required for full integration: Cliniko webhook or partner API; business_id mapping.
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: "Cliniko integration not yet implemented",
      hint: "Use Cliniko REST API or a third-party webhook bridge. See docs/BOOKING_INTEGRATIONS.md",
    },
    { status: 501 }
  );
}
