/**
 * Meta (Facebook Messenger / Instagram) send reply helper.
 * Replies are subject to platform messaging rules (e.g. 24-hour window, messaging_type RESPONSE).
 * Production would also need signature verification (X-Hub-Signature-256) and stricter event filtering.
 */

const META_SEND_URL = "https://graph.facebook.com/v21.0/me/messages";

export async function sendMetaReply({
  recipientId,
  text,
}: {
  recipientId: string;
  text: string;
}): Promise<Record<string, unknown>> {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "META_PAGE_ACCESS_TOKEN is required to send Meta replies. Set it in .env.local (can be a placeholder for local testing)."
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
