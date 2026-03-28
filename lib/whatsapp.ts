import { assertBillingReadyForOutbound } from "@/lib/billing-outbound-gate";

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
  /**
   * If false, environment fallback credentials are blocked.
   * Use false in production send paths to avoid cross-business leakage.
   */
  allowEnvFallback?: boolean;
  businessId?: string | null;
  contactId?: string | null;
  recipientSource?: string | null;
  isTestMode?: boolean;
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
  const allowEnvFallback = params.allowEnvFallback === true;
  const toRaw = typeof params.to === "string" ? params.to.trim() : "";
  const to = toWhatsAppRecipient(toRaw);

  const phoneNumberIdFromParams = params.phoneNumberId && params.phoneNumberId.trim();
  const phoneNumberIdFromEnv = allowEnvFallback ? process.env.META_WHATSAPP_PHONE_NUMBER_ID : null;
  const phoneNumberId = phoneNumberIdFromParams || phoneNumberIdFromEnv;

  const accessTokenFromParams = params.accessToken && params.accessToken.trim();
  const accessTokenFromEnv = allowEnvFallback ? process.env.META_PAGE_ACCESS_TOKEN : null;
  const accessToken = accessTokenFromParams || accessTokenFromEnv;

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

  if (params.businessId) {
    await assertBillingReadyForOutbound(params.businessId, {
      channel: "whatsapp",
      source: "sendWhatsAppTextMessage",
      recipient_source: params.recipientSource ?? null,
    });
  }

  // Explicit logging so we can distinguish test-number vs per-business flows.
  // NOTE: this does not log any secrets.
  const toDigitsPrefix = to.slice(0, 6) + "…";
  const isEnvPhoneIdFallback = !phoneNumberIdFromParams && !!phoneNumberIdFromEnv;
  const isEnvAccessTokenFallback = !accessTokenFromParams && !!accessTokenFromEnv;
  const inferredTestMode =
    process.env.MESSAGE_TEST_MODE === "true" || process.env.NODE_ENV !== "production";

  console.log("[whatsapp/send] sending text message", {
    channel: "whatsapp",
    business_id: params.businessId ?? null,
    contact_id: params.contactId ?? null,
    to_digits_prefix: toDigitsPrefix,
    recipient_source: params.recipientSource ?? "unknown",
    phone_number_id_used: phoneNumberId,
    phone_number_id_source: phoneNumberIdFromParams ? "business.phone_number_id" : "env.META_WHATSAPP_PHONE_NUMBER_ID",
    access_token_source: accessTokenFromParams ? "business.meta_page_access_token" : "env.META_PAGE_ACCESS_TOKEN",
    is_env_phone_id_fallback: isEnvPhoneIdFallback,
    is_env_access_token_fallback: isEnvAccessTokenFallback,
    allow_env_fallback: allowEnvFallback,
    is_test_mode: params.isTestMode ?? inferredTestMode,
    // Heuristic: when we rely entirely on env-level credentials, we are most likely
    // in shared/test-number mode rather than a fully connected production WhatsApp number.
    is_likely_test_number_flow: isEnvPhoneIdFallback || isEnvAccessTokenFallback,
  });

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
  /**
   * Canonical identifier for attribution. This is currently the contact_id
   * from the inbox, but may later point at a real conversation/thread id.
   */
  contactId?: string | null;
  /**
   * Optional conversation/thread identifier when known.
   * Legacy behaviour used this as an alias for contactId; we now treat it as
   * a real conversation id but still accept old values where it equals a contact id.
   */
  conversationId?: string | null;
  missedCallId?: string | null;
};

/**
 * Attach attribution params for WhatsApp-driven bookings.
 * - source=whatsapp
 * - contactId=<contact uuid> (canonical identifier for the person)
 * - conversationId=<conversation uuid> when known (thread id)
 *   - for backwards compatibility, if only conversationId is provided and it
 *     equals an old contact id, we still treat it as the contact identifier.
 * - missedCallId=<event uuid> (when recovery was triggered by a missed call)
 */
export function buildWhatsAppBookingLink(params: BuildBookingLinkParams): string | null {
  const {
    bookingLink,
    source = "whatsapp",
    contactId,
    conversationId,
    missedCallId,
  } = params;
  if (!bookingLink) return null;

  let url: URL;
  try {
    url = new URL(bookingLink);
  } catch {
    // If an invalid URL sneaks through, just return the raw value rather than throwing.
    return bookingLink;
  }

  url.searchParams.set("source", source);

  const effectiveContactId = contactId || conversationId || null;
  if (effectiveContactId) {
    url.searchParams.set("contactId", effectiveContactId);
  }
  if (conversationId) {
    url.searchParams.set("conversationId", conversationId);
  }
  if (missedCallId) {
    url.searchParams.set("missedCallId", missedCallId);
  }

  return url.toString();
}

