import twilio from "twilio";

type VerifyArgs = {
  authToken: string;
  url: string;
  rawBody: string;
  headerSignature: string | null;
};

/**
 * Verify an incoming Twilio webhook request using the X-Twilio-Signature header.
 * Returns true when the signature is valid, false otherwise.
 */
export function verifyTwilioRequest({
  authToken,
  url,
  rawBody,
  headerSignature,
}: VerifyArgs): boolean {
  if (!authToken) return false;
  if (!headerSignature) return false;

  // Twilio sends application/x-www-form-urlencoded payloads for standard webhooks.
  // We convert the raw body into an object of key/value pairs for validation.
  const params = new URLSearchParams(rawBody);
  const data: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    data[key] = value;
  }

  try {
    return twilio.validateRequest(authToken, headerSignature, url, data);
  } catch (e) {
    console.error("[twilio] validateRequest error:", e);
    return false;
  }
}

