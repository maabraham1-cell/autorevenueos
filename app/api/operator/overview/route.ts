import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { loadAdminCustomersList } from "@/lib/admin/load-customers";
import type { OperatorOverviewResponse } from "@/lib/operator-types";
import { getSupabaseAdmin } from "@/lib/supabase";

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
    const [{ count: totalBusinesses }, { count: activeBusinesses }, customers] =
      await Promise.all([
        admin.from("businesses").select("*", { count: "exact", head: true }),
        admin
          .from("businesses")
          .select("*", { count: "exact", head: true })
          .eq("activation_status", "active"),
        loadAdminCustomersList(admin),
      ]);

    const sorted = [...customers].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    const recentSignups = sorted.slice(0, 25);

    const businessIds = customers.map((c) => c.id);
    let businessesWithConversations = 0;
    if (businessIds.length > 0) {
      const { data: convRows } = await admin
        .from("conversations")
        .select("business_id")
        .in("business_id", businessIds);
      const seen = new Set(
        (convRows ?? []).map((r) => r.business_id as string),
      );
      businessesWithConversations = seen.size;
    }

    const payload: OperatorOverviewResponse = {
      stats: {
        totalBusinesses: totalBusinesses ?? customers.length,
        activeBusinesses: activeBusinesses ?? 0,
        businessesWithConversations,
      },
      recentSignups,
    };

    return NextResponse.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[operator/overview]", msg);
    return NextResponse.json(
      { error: "Failed to load overview." },
      { status: 503 },
    );
  }
}
