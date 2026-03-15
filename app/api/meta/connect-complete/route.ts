import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserAndBusiness } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/meta/connect-complete
 * Body: { page_id: string }
 * Saves the selected Page's id, name, and access_token to the business and clears pending.
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

    const body = await request.json().catch(() => ({}));
    const pageId = typeof (body as { page_id?: string }).page_id === "string" ? (body as { page_id: string }).page_id.trim() : null;
    if (!pageId) {
      return NextResponse.json({ error: "Missing page_id" }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    if (!db) {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    const { data: row, error: fetchErr } = await db
      .from("meta_connection_pending")
      .select("pages")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchErr || !row) {
      return NextResponse.json({ error: "No pending connection. Please start Connect Facebook again." }, { status: 400 });
    }

    const pages = Array.isArray((row as { pages?: { id: string; name: string; access_token: string }[] }).pages)
      ? (row as { pages: { id: string; name: string; access_token: string }[] }).pages
      : [];
    const page = pages.find((p: { id: string }) => p.id === pageId);
    if (!page) {
      return NextResponse.json({ error: "Page not found in pending list" }, { status: 400 });
    }

    const { error: updateErr } = await db
      .from("businesses")
      .update({
        meta_page_id: page.id,
        meta_page_name: page.name || null,
        meta_page_access_token: page.access_token || null,
      })
      .eq("id", business.id);

    if (updateErr) {
      console.error("[meta/connect-complete] update error:", updateErr);
      return NextResponse.json({ error: "Failed to save connection" }, { status: 500 });
    }

    await db.from("meta_connection_pending").delete().eq("business_id", business.id);

    return NextResponse.json({ success: true, meta_page_id: page.id, meta_page_name: page.name });
  } catch (e) {
    console.error("[meta/connect-complete] error:", e);
    return NextResponse.json({ error: "Failed to complete connection" }, { status: 500 });
  }
}
