import { sendWhatsAppTextMessage } from "@/lib/whatsapp";
import { sendInstagramMessage, sendMessengerMessage } from "@/lib/meta";
import { assertBillingReadyForOutbound } from "@/lib/billing-outbound-gate";
import twilio from "twilio";

type OutboundChannel = "whatsapp" | "sms" | "messenger" | "instagram" | "webchat";

function digitsOnly(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/\D/g, "");
}

function maskRecipient(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "(empty)";
  return `${trimmed.slice(0, 8)}…`;
}

function isLikelyTestMode(): boolean {
  return process.env.MESSAGE_TEST_MODE === "true" || process.env.NODE_ENV !== "production";
}

function assertNotBusinessRecipient(params: {
  channel: OutboundChannel;
  to: string;
  business: Record<string, unknown>;
}) {
  const { channel, to, business } = params;
  const toDigits = digitsOnly(to);
  const businessMobileDigits = digitsOnly((business as any).business_mobile as string | undefined);
  if (toDigits && businessMobileDigits && toDigits === businessMobileDigits) {
    throw new Error(
      `Blocked ${channel} send: recipient matches business_mobile.`,
    );
  }
}

function logOutboundAttempt(params: {
  channel: OutboundChannel;
  businessId: string;
  contactId: string | null;
  recipient: string;
  recipientSource: string;
  phoneNumberIdUsed: string | null;
  isTestMode: boolean;
}) {
  console.log("[messaging/send] outbound attempt", {
    channel: params.channel,
    business_id: params.businessId,
    contact_id: params.contactId,
    recipient_masked: maskRecipient(params.recipient),
    recipient_source: params.recipientSource,
    phone_number_id_used: params.phoneNumberIdUsed,
    is_test_mode: params.isTestMode,
  });
}

const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

export async function sendSmsMessage(params: {
  to: string;
  text: string;
  business: Record<string, unknown>;
  businessId: string;
  contactId?: string | null;
  recipientSource: string;
  explicitTestSend?: boolean;
}): Promise<{ sid: string; status: string | null }> {
  const {
    to,
    text,
    business,
    businessId,
    contactId = null,
    recipientSource,
    explicitTestSend = false,
  } = params;
  if (!twilioClient) {
    throw new Error("Twilio SMS client is not configured.");
  }

  assertNotBusinessRecipient({ channel: "sms", to, business });

  const fromNumber = ((business as any).twilio_phone_number as string | null) ?? null;
  if (!fromNumber) {
    throw new Error("Business does not have sms_recovery_number (twilio_phone_number).");
  }

  const isTestMode = isLikelyTestMode();
  if (isTestMode && !explicitTestSend) {
    throw new Error("TEST MODE: SMS send blocked unless explicitly triggered.");
  }

  logOutboundAttempt({
    channel: "sms",
    businessId,
    contactId,
    recipient: to,
    recipientSource,
    phoneNumberIdUsed: null,
    isTestMode,
  });

  const msg = await twilioClient.messages.create({
    to: to.trim(),
    from: fromNumber.trim(),
    body: text,
  });

  return { sid: msg.sid, status: msg.status ?? null };
}

export async function sendWhatsAppMessage(params: {
  to: string;
  text: string;
  business: Record<string, unknown>;
  businessId: string;
  contactId?: string | null;
  recipientSource: string;
}): Promise<void> {
  const { to, text, business, businessId, contactId = null, recipientSource } = params;
  assertNotBusinessRecipient({ channel: "whatsapp", to, business });

  const phoneNumberId =
    ((business as any).whatsapp_phone_number_id as string | undefined) ??
    ((business as any).meta_page_id as string | undefined) ??
    null;
  const accessToken = ((business as any).meta_page_access_token as string | undefined) ?? null;
  const isTestMode = isLikelyTestMode();

  logOutboundAttempt({
    channel: "whatsapp",
    businessId,
    contactId,
    recipient: to,
    recipientSource,
    phoneNumberIdUsed: phoneNumberId,
    isTestMode,
  });

  // No SMS fallback allowed.
  await sendWhatsAppTextMessage({
    to,
    text,
    phoneNumberId,
    accessToken,
    allowEnvFallback: false,
    businessId,
    contactId,
    recipientSource,
  });
}

export async function sendMessage(params: {
  channel: OutboundChannel;
  to: string;
  text: string;
  business: Record<string, unknown>;
  businessId?: string;
  contactId?: string | null;
  recipientSource?: "external_id" | "phone" | "unknown";
  explicitTestSend?: boolean;
}): Promise<{
  sent: boolean;
  mode: "live" | "stub";
  providerResponse?: Record<string, unknown> | null;
}> {
  const {
    channel,
    to,
    text,
    business,
    businessId = String((business as any).id ?? ""),
    contactId = null,
    recipientSource = "unknown",
    explicitTestSend = false,
  } = params;

  if (channel === "sms" || channel === "messenger" || channel === "instagram") {
    await assertBillingReadyForOutbound(businessId, {
      channel,
      source: "sendMessage",
    });
  }

  if (channel === "whatsapp") {
    await sendWhatsAppMessage({
      to,
      text,
      business,
      businessId,
      contactId,
      recipientSource,
    });
    return { sent: true, mode: "live", providerResponse: null };
  }

  if (channel === "sms") {
    const result = await sendSmsMessage({
      to,
      text,
      business,
      businessId,
      contactId,
      recipientSource,
      explicitTestSend,
    });
    return {
      sent: true,
      mode: "live",
      providerResponse: { sid: result.sid, status: result.status },
    };
  }

  if (channel === "messenger") {
    const recipientId = to.trim();
    if (!recipientId) {
      throw new Error("Missing Messenger recipient id.");
    }

    const selfCandidateIds = [
      (business as any).facebook_page_id as string | undefined,
      (business as any).meta_page_id as string | undefined, // compatibility fallback
    ]
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter(Boolean);

    if (selfCandidateIds.includes(recipientId)) {
      throw new Error("Refusing to send Messenger message to business/page identity.");
    }

    assertNotBusinessRecipient({ channel: "messenger", to: recipientId, business });
    logOutboundAttempt({
      channel: "messenger",
      businessId,
      contactId,
      recipient: recipientId,
      recipientSource,
      phoneNumberIdUsed: (business as any).facebook_page_id ?? (business as any).meta_page_id ?? null,
      isTestMode: isLikelyTestMode(),
    });

    const providerResponse = await sendMessengerMessage({
      recipientId,
      text,
      pageAccessToken: (business as any).meta_page_access_token as string | undefined,
    });
    return { sent: true, mode: "live", providerResponse };
  }

  if (channel === "instagram") {
    const recipientId = to.trim();
    if (!recipientId) {
      throw new Error("Missing Instagram recipient id.");
    }

    const selfCandidateIds = [
      (business as any).instagram_account_id as string | undefined,
      (business as any).meta_page_id as string | undefined, // compatibility fallback
    ]
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter(Boolean);

    if (selfCandidateIds.includes(recipientId)) {
      throw new Error("Refusing to send Instagram message to business/account identity.");
    }

    assertNotBusinessRecipient({ channel: "instagram", to: recipientId, business });
    logOutboundAttempt({
      channel: "instagram",
      businessId,
      contactId,
      recipient: recipientId,
      recipientSource,
      phoneNumberIdUsed:
        (business as any).instagram_account_id ?? (business as any).meta_page_id ?? null,
      isTestMode: isLikelyTestMode(),
    });

    const providerResponse = await sendInstagramMessage({
      recipientId,
      text,
      pageAccessToken: (business as any).meta_page_access_token as string | undefined,
    });
    return { sent: true, mode: "live", providerResponse };
  }

  // webchat currently writes outbound messages to the shared `messages` table and is polled by widget.
  return { sent: false, mode: "stub", providerResponse: null };
}

