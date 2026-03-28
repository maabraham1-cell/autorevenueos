import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { loadAdminCustomerDetail } from "@/lib/admin/load-customers";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requirePlatformAdmin(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Server configuration error (admin client unavailable)." },
      { status: 503 },
    );
  }

  try {
    const customer = await loadAdminCustomerDetail(admin, id);
    if (!customer) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ customer });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[admin/customers/id]", msg);
    return NextResponse.json(
      { error: "Failed to load customer." },
      { status: 503 },
    );
  }
}
