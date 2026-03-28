import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { loadAdminCustomersList } from "@/lib/admin/load-customers";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
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
    const customers = await loadAdminCustomersList(admin);
    return NextResponse.json({ customers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[admin/customers]", msg);
    return NextResponse.json(
      { error: "Failed to load customers." },
      { status: 503 },
    );
  }
}
