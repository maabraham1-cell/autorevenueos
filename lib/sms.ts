import twilio from "twilio";

type SendRecoverySmsArgs = {
  to: string;
  fromNumber: string;
  businessName: string;
  bookingLink: string | null;
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
}: SendRecoverySmsArgs): Promise<SendRecoverySmsResult> {
  if (!client) {
    throw new Error(
      "Twilio client is not configured. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.",
    );
  }

  const from = fromNumber.replace(/\s+/g, "");
  if (!from) {
    throw new Error("From number is required to send recovery SMS.");
  }

  const toNormalized = to.replace(/\s+/g, "");

  const body = `Sorry we missed your call to ${businessName}. You can book here: ${
    bookingLink ?? ""
  }`;

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

