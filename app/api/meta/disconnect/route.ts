import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserAndBusiness } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/meta/disconnect
 * Clears Meta connection for the current business (meta_page_id, meta_page_name, meta_page_access_token).
 */
export async function POST(request: NextRequest) {
  try {
    const { user, business } = await getCurrentUserAndBusiness(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (!business) {
      return NextResponse.json({ error: "No business linked" }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    if (!db) {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    const { error } = await db
      .from("businesses")
      .update({
        meta_page_id: null,
        meta_page_name: null,
        meta_page_access_token: null,
      })
      .eq("id", business.id);

    if (error) {
      console.error("[meta/disconnect] error:", error);
      return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
    }

    await db.from("meta_connection_pending").delete().eq("business_id", business.id);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[meta/disconnect] error:", e);
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }
}
