/**
 * Send transactional email via Resend API (https://resend.com).
 * Set RESEND_API_KEY in env. Optional: RESEND_FROM (defaults to onboarding@resend.dev for testing).
 */

const RESEND_API = "https://api.resend.com/emails";
const DEFAULT_FROM = "AutoRevenueOS <onboarding@resend.dev>";

export type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
  from?: string;
};

export async function sendEmail(options: SendEmailOptions): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set, skipping send");
    return { ok: false, error: "RESEND_API_KEY not set" };
  }

  const from = options.from ?? process.env.RESEND_FROM ?? DEFAULT_FROM;

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [options.to],
      subject: options.subject,
      html: options.html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[email] Resend error:", res.status, err);
    return { ok: false, error: err };
  }

  return { ok: true };
}
