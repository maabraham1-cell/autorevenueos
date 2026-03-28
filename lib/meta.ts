/**
 * Meta (Facebook Messenger / Instagram) send reply helper.
 * Replies are subject to platform messaging rules (e.g. 24-hour window, messaging_type RESPONSE).
 * Use pageAccessToken when sending for a specific business (from Connect Facebook); otherwise falls back to env.
 */

const META_SEND_URL = "https://graph.facebook.com/v21.0/me/messages";

export async function sendMetaReply({
  recipientId,
  text,
  pageAccessToken,
}: {
  recipientId: string;
  text: string;
  pageAccessToken?: string | null;
}): Promise<Record<string, unknown>> {
  const token = (pageAccessToken && pageAccessToken.trim()) || process.env.META_PAGE_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "No Meta page token: connect a Facebook Page in Settings, or set META_PAGE_ACCESS_TOKEN for testing."
    );
  }

  const res = await fetch(`${META_SEND_URL}?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      messaging_type: "RESPONSE",
      message: { text },
    }),
  });

  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const errMsg = (data.error as { message?: string })?.message ?? res.statusText;
    throw new Error(`Meta send API failed: ${errMsg}`);
  }
  return data;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function toGraphRecipientId(value: string): string {
  return value.trim();
}

/**
 * Messenger send helper.
 * Uses the business-scoped page access token set during Meta connect flow.
 */
export async function sendMessengerMessage(params: {
  recipientId: string;
  text: string;
  pageAccessToken?: string | null;
}): Promise<Record<string, unknown>> {
  const recipientId = toGraphRecipientId(params.recipientId);
  if (!isNonEmptyString(recipientId)) {
    throw new Error("Messenger recipient id is required.");
  }

  return sendMetaReply({
    recipientId,
    text: params.text,
    pageAccessToken: params.pageAccessToken,
  });
}

/**
 * Instagram DM send helper.
 * Meta supports IG DM sending through the same /me/messages endpoint when
 * the token/account has Instagram messaging permissions.
 */
export async function sendInstagramMessage(params: {
  recipientId: string;
  text: string;
  pageAccessToken?: string | null;
}): Promise<Record<string, unknown>> {
  const recipientId = toGraphRecipientId(params.recipientId);
  if (!isNonEmptyString(recipientId)) {
    throw new Error("Instagram recipient id is required.");
  }

  return sendMetaReply({
    recipientId,
    text: params.text,
    pageAccessToken: params.pageAccessToken,
  });
}
