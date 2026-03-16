const WHATSAPP_API_BASE = "https://graph.facebook.com/v21.0";

type SendWhatsAppTextParams = {
  /**
   * Destination WhatsApp number in international format, e.g. "447700900123".
   */
  to: string;
  /**
   * Text body to send.
   */
  text: string;
  /**
   * Optional Meta WhatsApp phone_number_id for this business.
   * If omitted, we fall back to a shared env-level PHONE_NUMBER_ID for testing.
   */
  phoneNumberId?: string | null;
  /**
   * Optional per-business access token; if omitted we fall back to META_PAGE_ACCESS_TOKEN.
   */
  accessToken?: string | null;
};

/**
 * Meta WhatsApp Cloud API expects "to" as digits only (no + or spaces).
 */
function toWhatsAppRecipient(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) throw new Error("WhatsApp recipient number is empty after normalizing.");
  return digits;
}

export async function sendWhatsAppTextMessage(params: SendWhatsAppTextParams): Promise<void> {
  const { text } = params;
  const toRaw = typeof params.to === "string" ? params.to.trim() : "";
  const to = toWhatsAppRecipient(toRaw);

  const phoneNumberId =
    (params.phoneNumberId && params.phoneNumberId.trim()) ||
    process.env.META_WHATSAPP_PHONE_NUMBER_ID;

  const accessToken =
    (params.accessToken && params.accessToken.trim()) || process.env.META_PAGE_ACCESS_TOKEN;

  if (!phoneNumberId) {
    throw new Error(
      "No WhatsApp phone_number_id configured. Set META_WHATSAPP_PHONE_NUMBER_ID or pass phoneNumberId."
    );
  }

  if (!accessToken) {
    throw new Error(
      "No Meta access token configured. Connect WhatsApp/Facebook in Settings or set META_PAGE_ACCESS_TOKEN."
    );
  }

  const url = `${WHATSAPP_API_BASE}/${encodeURIComponent(
    phoneNumberId
  )}/messages?access_token=${encodeURIComponent(accessToken)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: {
        preview_url: true,
        body: text,
      },
    }),
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = (await res.json()) as any;
      message =
        (data?.error && (data.error.message as string | undefined)) ||
        (data?.message as string | undefined) ||
        message;
    } catch {
      // ignore JSON parse issues; fall back to status text
    }
    throw new Error(`WhatsApp send API failed: ${message}`);
  }
}

type BuildBookingLinkParams = {
  bookingLink: string | null | undefined;
  source?: string;
  conversationId?: string | null;
  missedCallId?: string | null;
};

/**
 * Attach attribution params for WhatsApp-driven bookings.
 * - source=whatsapp
 * - conversationId=<conversation uuid> (when known)
 * - missedCallId=<event uuid> (when recovery was triggered by a missed call)
 */
export function buildWhatsAppBookingLink(params: BuildBookingLinkParams): string | null {
  const { bookingLink, source = "whatsapp", conversationId, missedCallId } = params;
  if (!bookingLink) return null;

  let url: URL;
  try {
    url = new URL(bookingLink);
  } catch {
    // If an invalid URL sneaks through, just return the raw value rather than throwing.
    return bookingLink;
  }

  url.searchParams.set("source", source);
  if (conversationId) {
    url.searchParams.set("conversationId", conversationId);
  }
  if (missedCallId) {
    url.searchParams.set("missedCallId", missedCallId);
  }

  return url.toString();
}

