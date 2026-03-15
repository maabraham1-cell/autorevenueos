import { NextRequest, NextResponse } from "next/server";
import { verifyMetaState, exchangeCodeForPages } from "@/lib/meta-connect";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/meta/callback
 * Facebook OAuth callback. Exchanges code for token, fetches Pages, stores in meta_connection_pending, redirects to Settings.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (request.nextUrl ? `${request.nextUrl.protocol}//${request.nextUrl.host}` : "");
  const settingsUrl = baseUrl ? `${baseUrl}/settings` : "/settings";

  if (error) {
    const errDesc = searchParams.get("error_description") || error;
    console.warn("[meta/callback] OAuth error:", error, errDesc);
    return NextResponse.redirect(`${settingsUrl}?meta=error&message=${encodeURIComponent(errDesc)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${settingsUrl}?meta=error&message=${encodeURIComponent("Missing code or state")}`);
  }

  const payload = verifyMetaState(state);
  if (!payload) {
    return NextResponse.redirect(`${settingsUrl}?meta=error&message=${encodeURIComponent("Invalid state")}`);
  }

  try {
    const redirectUri = `${baseUrl}/api/meta/callback`;
    const pages = await exchangeCodeForPages(code, redirectUri);
    if (pages.length === 0) {
      return NextResponse.redirect(`${settingsUrl}?meta=error&message=${encodeURIComponent("No Facebook Pages found")}`);
    }

    const db = getSupabaseAdmin();
    if (!db) {
      return NextResponse.redirect(`${settingsUrl}?meta=error&message=${encodeURIComponent("Server error")}`);
    }

    await db.from("meta_connection_pending").delete().eq("business_id", payload.businessId);
    const { error: insertErr } = await db.from("meta_connection_pending").insert({
      business_id: payload.businessId,
      pages,
    });
    if (insertErr) {
      console.error("[meta/callback] insert error:", insertErr);
      return NextResponse.redirect(`${settingsUrl}?meta=error&message=${encodeURIComponent("Failed to save")}`);
    }

    return NextResponse.redirect(`${settingsUrl}?meta=select`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to connect";
    console.error("[meta/callback] error:", e);
    return NextResponse.redirect(`${settingsUrl}?meta=error&message=${encodeURIComponent(msg)}`);
  }
}
