import twilio from "twilio";
import { assertBillingReadyForOutbound } from "@/lib/billing-outbound-gate";

type SendRecoverySmsArgs = {
  to: string;
  fromNumber: string;
  businessName: string;
  bookingLink: string | null;
  businessId: string;
  contactId?: string | null;
  explicitTestSend?: boolean;
};

type SendRecoverySmsResult = {
  success: true;
  provider: "twilio";
  sid: string;
  to: string;
  body: string;
  status: string | null;
};

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

const client =
  accountSid && authToken
    ? twilio(accountSid, authToken)
    : null;

export async function sendRecoverySms({
  to,
  fromNumber,
  businessName,
  bookingLink,
  businessId,
  contactId = null,
  explicitTestSend = false,
}: SendRecoverySmsArgs): Promise<SendRecoverySmsResult> {
  if (!client) {
    throw new Error(
      "Twilio client is not configured. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.",
    );
  }

  await assertBillingReadyForOutbound(businessId, {
    channel: "sms",
    source: "sendRecoverySms",
    contact_id: contactId ?? null,
  });

  const from = fromNumber.replace(/\s+/g, "");
  if (!from) {
    throw new Error("From number is required to send recovery SMS.");
  }

  const toNormalized = to.replace(/\s+/g, "");
  const fromDigits = from.replace(/\D/g, "");
  const toDigits = toNormalized.replace(/\D/g, "");
  if (fromDigits && toDigits && fromDigits === toDigits) {
    throw new Error("Blocked SMS send: recipient equals business sms_recovery_number.");
  }

  const isTestMode =
    process.env.MESSAGE_TEST_MODE === "true" || process.env.NODE_ENV !== "production";
  if (isTestMode && !explicitTestSend) {
    throw new Error("TEST MODE: SMS send blocked unless explicitly triggered.");
  }

  const body = `Sorry we missed your call to ${businessName}. You can book here: ${
    bookingLink ?? ""
  }`;

  console.log("[sms/send] sending recovery sms", {
    channel: "sms",
    business_id: businessId,
    contact_id: contactId,
    recipient_prefix: toDigits.slice(0, 6) + "…",
    recipient_source: "webhook.From",
    phone_number_id_used: null,
    is_test_mode: isTestMode,
  });

  const message = await client.messages.create({
    to: toNormalized,
    from,
    body,
  });

  return {
    success: true,
    provider: "twilio",
    sid: message.sid,
    to: message.to,
    body: message.body ?? body,
    status: message.status ?? null,
  };
}

