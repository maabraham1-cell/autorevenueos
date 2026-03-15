import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserAndBusiness } from "@/lib/auth";
import { getOrCreateStripeCustomer, createSetupIntent } from "@/lib/stripe-billing";

/**
 * POST /api/billing/setup-intent
 * Creates or reuses Stripe customer for the business and returns a SetupIntent client_secret
 * for the client to collect a payment method (card) with Stripe Elements.
 * No charge. Used to activate the business (card on file).
 */
export async function POST(request: NextRequest) {
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

    const email = (user as { email?: string }).email ?? null;
    const customerResult = await getOrCreateStripeCustomer(business.id, email);
    if (!customerResult.ok) {
      return NextResponse.json(
        { error: customerResult.error },
        { status: 400 }
      );
    }

    const intentResult = await createSetupIntent(customerResult.customerId);
    if (!intentResult.ok) {
      return NextResponse.json(
        { error: intentResult.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      clientSecret: intentResult.clientSecret,
      stripeCustomerId: customerResult.customerId,
    });
  } catch (e) {
    console.error("[billing/setup-intent] unexpected error:", e);
    return NextResponse.json(
      { error: "Failed to create setup session" },
      { status: 500 }
    );
  }
}
