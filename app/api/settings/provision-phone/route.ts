import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserAndBusiness } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { provisionNumberForBusiness } from "@/lib/twilio-number";

/**
 * POST /api/settings/provision-phone
 * Provision a Twilio recovery number for the current user's business.
 * Idempotent: if business already has a number, returns it without purchasing again.
 * Used when an existing business enables "Phone Recovery" in settings.
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

    const activationStatus = (business as { activation_status?: string }).activation_status;
    if (activationStatus !== "active") {
      return NextResponse.json(
        {
          error: "Add your card to activate AutoRevenueOS before enabling Phone Recovery.",
          code: "PAYMENT_REQUIRED",
        },
        { status: 402 }
      );
    }

    const businessId = (business as { id: string }).id;
    const location = (business as { location?: string }).location ?? null;
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (request.nextUrl ? `${request.nextUrl.protocol}//${request.nextUrl.host}` : "");

    if (!baseUrl) {
      return NextResponse.json(
        { error: "App URL not configured" },
        { status: 500 }
      );
    }

    const result = await provisionNumberForBusiness({
      businessId,
      baseUrl,
      location,
    });

    if (!result.ok) {
      const db = getSupabaseAdmin();
      if (db) {
        await db
          .from("businesses")
          .update({ twilio_provisioning_error: result.error.slice(0, 1000) })
          .eq("id", businessId);
      }
      return NextResponse.json(
        { error: result.error, code: "PROVISION_FAILED" },
        { status: 400 }
      );
    }

    const db = getSupabaseAdmin();
    if (db) {
      await db
        .from("businesses")
        .update({ twilio_provisioning_error: null })
        .eq("id", businessId);
    }

    return NextResponse.json({
      success: true,
      phoneNumber: result.phoneNumber,
      twilioNumberSid: result.twilioNumberSid || undefined,
    });
  } catch (e) {
    console.error("[provision-phone] unexpected error:", e);
    return NextResponse.json(
      { error: "Failed to provision phone number" },
      { status: 500 }
    );
  }
}
