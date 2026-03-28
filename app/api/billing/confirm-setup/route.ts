import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserAndBusiness } from "@/lib/auth";
import { confirmSetupIntentAndActivate } from "@/lib/stripe-billing";

/**
 * POST /api/billing/confirm-setup
 * Call after the client has confirmed the SetupIntent (card saved).
 * Body: { setup_intent_id: string }
 * Verifies SetupIntent, sets default payment method, provisions Twilio recovery number,
 * and sets activation_status = active only when billing + provisioning both succeed.
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

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
      (request.nextUrl ? `${request.nextUrl.protocol}//${request.nextUrl.host}` : "");

    const result = await confirmSetupIntentAndActivate(setupIntentId, business.id, baseUrl);

    if (!result.ok) {
      const status =
        result.phase === "billing_db" || result.phase === "finalize" || result.phase === "config"
          ? 500
          : 400;
      return NextResponse.json(
        { error: result.error, phase: result.phase },
        { status }
      );
    }

    if (result.fullyActivated) {
      return NextResponse.json({
        success: true,
        fullyActivated: true,
        activation_status: "active",
        billing_status: "ready",
        phone_recovery_status: "provisioned",
      });
    }

    return NextResponse.json({
      success: true,
      fullyActivated: false,
      activation_status: "billing_ready",
      billing_status: "ready",
      phone_recovery_status: "failed",
      twilio_provisioning_error: result.twilio_provisioning_error,
    });
  } catch (e) {
    console.error("[billing/confirm-setup] unexpected error:", e);
    return NextResponse.json(
      { error: "Failed to confirm setup" },
      { status: 500 }
    );
  }
}
