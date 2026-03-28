import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/admin/twilio-pool
 * Internal: pool inventory + which businesses use dedicated vs pool numbers.
 */
export async function GET(request: NextRequest) {
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

  try {
    const [
      { data: poolEntries, error: poolErr },
      { count: nDedicated },
      { count: nPoolMode },
    ] = await Promise.all([
      admin.from("twilio_number_pool").select("*").order("created_at", { ascending: true }),
      admin
        .from("businesses")
        .select("*", { count: "exact", head: true })
        .eq("phone_number_mode", "dedicated"),
      admin
        .from("businesses")
        .select("*", { count: "exact", head: true })
        .eq("phone_number_mode", "pool"),
    ]);

    if (poolErr) {
      console.error("[admin/twilio-pool]", poolErr.message);
      return NextResponse.json({ error: "Failed to load pool" }, { status: 500 });
    }

    const { data: poolAssignments } = await admin
      .from("businesses")
      .select("id, name, phone_number_mode, twilio_pool_entry_id, twilio_phone_number, activation_status")
      .not("twilio_pool_entry_id", "is", null);

    const available = (poolEntries ?? []).filter((r) => (r as { status?: string }).status === "available").length;
    const assigned = (poolEntries ?? []).filter((r) => (r as { status?: string }).status === "assigned").length;

    return NextResponse.json({
      counts: {
        businesses_phone_mode_dedicated: nDedicated ?? 0,
        businesses_phone_mode_pool: nPoolMode ?? 0,
        pool_entries_total: poolEntries?.length ?? 0,
        pool_available: available,
        pool_assigned: assigned,
      },
      pool_entries: poolEntries ?? [],
      businesses_with_pool_assignment: poolAssignments ?? [],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[admin/twilio-pool]", msg);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}
