import twilio from "twilio";

type SendRecoverySmsArgs = {
  to: string;
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
const fromNumberRaw = process.env.TWILIO_PHONE_NUMBER;

const client =
  accountSid && authToken
    ? twilio(accountSid, authToken)
    : null;

export async function sendRecoverySms({
  to,
  businessName,
  bookingLink,
}: SendRecoverySmsArgs): Promise<SendRecoverySmsResult> {
  if (!client) {
    throw new Error(
      "Twilio client is not configured. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.",
    );
  }

  if (!fromNumberRaw) {
    throw new Error(
      "TWILIO_PHONE_NUMBER is not set. Please configure your Twilio from number.",
    );
  }

  const from = fromNumberRaw.replace(/\s+/g, "");
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

