import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserAndBusiness } from "@/lib/auth";
import { confirmSetupIntentAndActivate } from "@/lib/stripe-billing";

/**
 * POST /api/billing/confirm-setup
 * Call after the client has confirmed the SetupIntent (card saved).
 * Body: { setup_intent_id: string }
 * Sets default payment method on the Stripe customer and business activation_status = active.
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

    const body = await request.json().catch(() => ({}));
    const setupIntentId =
      typeof (body as { setup_intent_id?: string }).setup_intent_id === "string"
        ? (body as { setup_intent_id: string }).setup_intent_id.trim()
        : null;
    if (!setupIntentId) {
      return NextResponse.json(
        { error: "Missing setup_intent_id" },
        { status: 400 }
      );
    }

    const result = await confirmSetupIntentAndActivate(setupIntentId, business.id);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, activated: true });
  } catch (e) {
    console.error("[billing/confirm-setup] unexpected error:", e);
    return NextResponse.json(
      { error: "Failed to confirm setup" },
      { status: 500 }
    );
  }
}
