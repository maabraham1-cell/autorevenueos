import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserAndBusiness } from "@/lib/auth";
import { signMetaState } from "@/lib/meta-connect";

/**
 * GET /api/meta/connect
 * Redirects to Facebook OAuth so the user can connect a Page.
 * Requires auth; state contains signed businessId for callback.
 */
export async function GET(request: NextRequest) {
  try {
    const { user, business } = await getCurrentUserAndBusiness(request);
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (!business) {
      return NextResponse.json({ error: "No business linked" }, { status: 400 });
    }

    const appId = process.env.META_APP_ID;
    if (!appId?.trim()) {
      return NextResponse.json({ error: "Meta Connect is not configured (META_APP_ID)" }, { status: 503 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (request.nextUrl ? `${request.nextUrl.protocol}//${request.nextUrl.host}` : "");
    if (!baseUrl) {
      return NextResponse.json({ error: "App URL not configured" }, { status: 500 });
    }
    const redirectUri = `${baseUrl}/api/meta/callback`;
    const state = signMetaState({ businessId: business.id, nonce: crypto.randomUUID() });
    const scope = "pages_show_list,pages_messaging";
    const url =
      `https://www.facebook.com/v21.0/dialog/oauth?client_id=${encodeURIComponent(appId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(scope)}` +
      `&state=${encodeURIComponent(state)}` +
      `&response_type=code`;
    return NextResponse.redirect(url);
  } catch (e) {
    console.error("[meta/connect] error:", e);
    return NextResponse.json({ error: "Failed to start Connect" }, { status: 500 });
  }
}
