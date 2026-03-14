import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  createServerClient,
  type CookieOptions,
} from "@supabase/auth-helpers-nextjs";
import { getCurrentUserAndBusiness } from "@/lib/auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * POST /api/setup — create a business and link it to the current user if they have none.
 * Body: { name?: string } (optional business name).
 */
export async function POST(request: NextRequest) {
  try {
    const { user, business } = await getCurrentUserAndBusiness(request);

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    if (business) {
      return NextResponse.json({
        success: true,
        businessId: business.id,
        phone_recovery_available: Boolean((business as { twilio_phone_number?: string }).twilio_phone_number),
      });
    }

    const body = (await request.json().catch(() => ({}))) as { name?: string; location?: string };
    const name =
      typeof body.name === "string" && body.name.trim().length > 0
        ? body.name.trim().slice(0, 200)
        : "New Business";

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    });

    const adminClient = supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey)
      : supabase;

    const { data: newBusiness, error: insertBizError } = await adminClient
      .from("businesses")
      .insert({ name, activation_status: "payment_required" })
      .select("id")
      .single();

    if (insertBizError || !newBusiness) {
      console.error(
        "[setup] business create error:",
        insertBizError?.message,
        insertBizError,
      );
      return NextResponse.json(
        {
          error: "Failed to create business",
          details: insertBizError?.message ?? null,
        },
        { status: 500 },
      );
    }

    // Use session client + RPC so JWT is sent; function runs as definer and bypasses RLS
    const { error: profileLinkError } = await supabase.rpc("link_profile_to_business", {
      p_user_id: user.id,
      p_business_id: newBusiness.id,
    });

    if (profileLinkError) {
      console.error("[setup] link_profile_to_business error:", profileLinkError.message, profileLinkError);
      return NextResponse.json(
        {
          error: "Failed to link business to your account",
          details: process.env.NODE_ENV === "development" ? profileLinkError.message : undefined,
        },
        { status: 500 },
      );
    }

    // Twilio number is provisioned only after the business is active (card on file); see Settings → Phone Recovery.

    return NextResponse.json({
      success: true,
      businessId: newBusiness.id,
      phone_recovery_available: false,
    });
  } catch (e) {
    console.error("[setup] unexpected error:", e);
    return NextResponse.json(
      { error: "Setup failed" },
      { status: 500 },
    );
  }
}
