import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserAndBusiness } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/meta/pages
 * Returns the list of Facebook Pages from pending connection (after OAuth callback).
 * Only id and name; tokens stay server-side.
 */
export async function GET(request: NextRequest) {
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

    const { data: row, error } = await db
      .from("meta_connection_pending")
      .select("pages")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !row) {
      return NextResponse.json({ pages: [] });
    }

    const pages = Array.isArray((row as { pages?: unknown }).pages) ? (row as { pages: { id: string; name: string }[] }).pages : [];
    const list = pages.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name || p.id }));
    return NextResponse.json({ pages: list });
  } catch (e) {
    console.error("[meta/pages] error:", e);
    return NextResponse.json({ error: "Failed to load pages" }, { status: 500 });
  }
}
