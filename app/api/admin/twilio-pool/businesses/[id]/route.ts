import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * PATCH /api/admin/twilio-pool/businesses/:id
 * Body: { "phone_number_mode": "dedicated" | "pool" }
 * Controls provisioning strategy for the next phone recovery provision attempt.
 * Does not remove an existing number; switch to dedicated before re-provisioning if needed.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if ("response" in auth) {
    return auth.response;
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Server configuration error (admin client unavailable)." },
      { status: 503 },
    );
  }

  const { id: businessId } = await context.params;
  if (!businessId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const mode = (body as { phone_number_mode?: string }).phone_number_mode;
  if (mode !== "dedicated" && mode !== "pool") {
    return NextResponse.json(
      { error: "phone_number_mode must be 'dedicated' or 'pool'" },
      { status: 400 },
    );
  }

  const { error } = await admin
    .from("businesses")
    .update({ phone_number_mode: mode })
    .eq("id", businessId);

  if (error) {
    console.error("[admin/twilio-pool/businesses]", error.message);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    business_id: businessId,
    phone_number_mode: mode,
    note:
      mode === "pool"
        ? "Next provisioning will try the shared pool first (requires rows in twilio_number_pool)."
        : "Next provisioning will purchase a dedicated Twilio number (default production behavior).",
  });
}
