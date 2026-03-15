import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserAndBusiness } from "@/lib/auth";
import { getBusinessActivationStatus } from "@/lib/stripe-billing";

/**
 * GET /api/billing/status
 * Returns activation status and whether the business has a payment method on file.
 */
export async function GET(request: NextRequest) {
  try {
    const { user, business } = await getCurrentUserAndBusiness(request);

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (!business) {
      return NextResponse.json(
        { error: "No business linked to this user" },
        { status: 400 }
      );
    }

    const status = await getBusinessActivationStatus(business.id);
    if (!status) {
      return NextResponse.json(
        { error: "Could not load billing status" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      activation_status: status.activation_status,
      has_payment_method: status.has_payment_method,
      stripe_customer_id: status.stripe_customer_id ?? undefined,
    });
  } catch (e) {
    console.error("[billing/status] unexpected error:", e);
    return NextResponse.json(
      { error: "Failed to load billing status" },
      { status: 500 }
    );
  }
}
