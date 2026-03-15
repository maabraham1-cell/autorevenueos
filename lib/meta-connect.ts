/**
 * Meta Connect: sign/verify state for OAuth redirect and exchange code for Page list.
 */

import crypto from "crypto";

const META_GRAPH = "https://graph.facebook.com/v21.0";

function getSecret(): string {
  const s = process.env.META_APP_SECRET;
  if (!s?.trim()) throw new Error("META_APP_SECRET is required for Connect Facebook");
  return s.trim();
}

export function signMetaState(payload: { businessId: string; nonce: string }): string {
  const secret = getSecret();
  const data = JSON.stringify(payload);
  const b64 = Buffer.from(data, "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(b64).digest("base64url");
  return `${b64}.${sig}`;
}

export function verifyMetaState(state: string): { businessId: string; nonce: string } | null {
  const secret = getSecret();
  const dot = state.indexOf(".");
  if (dot <= 0) return null;
  const b64 = state.slice(0, dot);
  const sigProvided = state.slice(dot + 1);
  const expected = crypto.createHmac("sha256", secret).update(b64).digest("base64url");
  if (sigProvided.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sigProvided), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(b64, "base64url").toString("utf8"));
    if (typeof data.businessId === "string" && typeof data.nonce === "string") return data;
  } catch {
    return null;
  }
  return null;
}

export async function exchangeCodeForPages(code: string, redirectUri: string): Promise<{ id: string; name: string; access_token: string }[]> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId?.trim() || !appSecret?.trim()) throw new Error("META_APP_ID and META_APP_SECRET are required");

  const tokenRes = await fetch(
    `${META_GRAPH}/oauth/access_token?client_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${encodeURIComponent(appSecret)}&code=${encodeURIComponent(code)}`
  );
  if (!tokenRes.ok) {
    const err = (await tokenRes.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `Token exchange failed: ${tokenRes.status}`);
  }
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  const userToken = tokenJson.access_token;
  if (!userToken) throw new Error("No access_token in response");

  const longLivedRes = await fetch(
    `${META_GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&fb_exchange_token=${encodeURIComponent(userToken)}`
  );
  let longLivedToken = userToken;
  if (longLivedRes.ok) {
    const ll = (await longLivedRes.json()) as { access_token?: string };
    if (ll.access_token) longLivedToken = ll.access_token;
  }

  const accountsRes = await fetch(
    `${META_GRAPH}/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(longLivedToken)}`
  );
  if (!accountsRes.ok) throw new Error("Failed to fetch Pages");
  const accountsJson = (await accountsRes.json()) as { data?: { id: string; name: string; access_token: string }[] };
  const pages = Array.isArray(accountsJson.data) ? accountsJson.data : [];
  return pages.map((p) => ({ id: p.id, name: p.name || p.id, access_token: p.access_token }));
}
