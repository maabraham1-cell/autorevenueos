/**
 * Twilio number provisioning for businesses: search, purchase, link to business, set webhooks.
 * Used at onboarding (new business) and when a business enables Phone Recovery in settings.
 * Future: releaseNumber, rotateNumber, number pools.
 */

import twilio from "twilio";
import { getSupabaseAdmin } from "@/lib/supabase";
import { normalizePhone } from "@/lib/phone";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

function getTwilioClient(): ReturnType<typeof twilio> | null {
  if (!accountSid || !authToken) return null;
  return twilio(accountSid, authToken);
}

/** Map business location (e.g. from settings) to Twilio country code. Prefer local numbers. */
export function locationToCountryCode(location: string | null | undefined): string {
  if (!location || typeof location !== "string") return "GB";
  const loc = location.trim().toLowerCase();
  if (loc.includes("ireland") || loc === "ireland") return "IE";
  if (loc.includes("scotland") || loc.includes("wales") || loc.includes("northern ireland") || loc.includes("london") || loc.includes("england")) return "GB";
  if (loc.includes("united states") || loc.includes("usa") || loc === "us") return "US";
  return "GB";
}

/** Fallback country codes to try if primary has no available numbers. */
const FALLBACK_COUNTRIES = ["GB", "US", "IE"];

export type ProvisionOptions = {
  businessId: string;
  baseUrl: string;
  location?: string | null;
};

export type ProvisionResult =
  | { ok: true; phoneNumber: string; twilioNumberSid: string }
  | { ok: false; error: string };

/**
 * Idempotent: if business already has twilio_phone_number (and optionally twilio_number_sid), return existing.
 * Otherwise search for an available number (prefer business location country), purchase it, set webhooks, save to business.
 */
export async function provisionNumberForBusiness(options: ProvisionOptions): Promise<ProvisionResult> {
  const { businessId, baseUrl, location } = options;
  const db = getSupabaseAdmin();
  if (!db) {
    return { ok: false, error: "Database not available" };
  }

  const client = getTwilioClient();
  if (!client) {
    return { ok: false, error: "Twilio is not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)" };
  }

  const voiceUrl = `${baseUrl.replace(/\/$/, "")}/api/missed-call`;
  const smsUrl = `${baseUrl.replace(/\/$/, "")}/api/sms-webhook`;

  // Idempotency: already have a number?
  const { data: business, error: fetchError } = await db
    .from("businesses")
    .select("id, twilio_phone_number, twilio_number_sid")
    .eq("id", businessId)
    .single();

  if (fetchError || !business) {
    return { ok: false, error: "Business not found" };
  }

  const existingNumber = (business as { twilio_phone_number?: string }).twilio_phone_number;
  const existingSid = (business as { twilio_number_sid?: string }).twilio_number_sid;
  if (existingNumber && existingNumber.trim()) {
    const normalized = normalizePhone(existingNumber);
    if (normalized) {
      return {
        ok: true,
        phoneNumber: normalized,
        twilioNumberSid: existingSid?.trim() ?? "",
      };
    }
  }

  const countryCode = locationToCountryCode(location ?? null);
  const countriesToTry = [countryCode, ...FALLBACK_COUNTRIES.filter((c) => c !== countryCode)];

  let purchased: { phoneNumber: string; sid: string } | null = null;

  for (const country of countriesToTry) {
    try {
      const list = await client.availablePhoneNumbers(country).local.list({ limit: 5 });
      if (list.length === 0) continue;
      const first = list[0];
      const phoneNumber = (first as { phoneNumber: string }).phoneNumber;
      if (!phoneNumber) continue;

      const incoming = await client.incomingPhoneNumbers.create({
        phoneNumber,
        voiceUrl,
        voiceMethod: "POST",
        smsUrl,
        smsMethod: "POST",
        friendlyName: `AutoRevenueOS-${businessId.slice(0, 8)}`,
      });

      const sid = (incoming as { sid: string }).sid;
      const num = (incoming as { phoneNumber: string }).phoneNumber ?? phoneNumber;
      purchased = { phoneNumber: normalizePhone(num) || num, sid };
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[twilio-number] purchase failed for country", country, msg);
      continue;
    }
  }

  if (!purchased) {
    return { ok: false, error: "No available Twilio numbers in tried countries (GB, US, IE)" };
  }

  const { error: updateError } = await db
    .from("businesses")
    .update({
      twilio_phone_number: purchased.phoneNumber,
      twilio_number_sid: purchased.sid,
    })
    .eq("id", businessId);

  if (updateError) {
    console.error("[twilio-number] failed to save number to business:", updateError.message);
    return { ok: false, error: "Number purchased but failed to save to business" };
  }

  return {
    ok: true,
    phoneNumber: purchased.phoneNumber,
    twilioNumberSid: purchased.sid,
  };
}

/**
 * Update webhooks for an existing Twilio number (e.g. after app URL change).
 * Future: use when baseUrl changes or for bulk webhook update.
 */
export async function setNumberWebhooks(
  twilioNumberSid: string,
  baseUrl: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = getTwilioClient();
  if (!client) return { ok: false, error: "Twilio not configured" };

  const voiceUrl = `${baseUrl.replace(/\/$/, "")}/api/missed-call`;
  const smsUrl = `${baseUrl.replace(/\/$/, "")}/api/sms-webhook`;

  try {
    await client.incomingPhoneNumbers(twilioNumberSid).update({
      voiceUrl,
      voiceMethod: "POST",
      smsUrl,
      smsMethod: "POST",
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * Release a number from a business (future use: when business cancels).
 * Removes from Twilio account and clears business fields.
 */
export async function releaseNumberForBusiness(businessId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = getTwilioClient();
  const db = getSupabaseAdmin();
  if (!client || !db) return { ok: false, error: "Twilio or database not available" };

  const { data: business, error: fetchError } = await db
    .from("businesses")
    .select("twilio_number_sid")
    .eq("id", businessId)
    .single();

  if (fetchError || !business) return { ok: false, error: "Business not found" };
  const sid = (business as { twilio_number_sid?: string }).twilio_number_sid;
  if (!sid?.trim()) return { ok: false, error: "No Twilio number assigned" };

  try {
    await client.incomingPhoneNumbers(sid).remove();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Twilio release failed: ${msg}` };
  }

  const { error: updateError } = await db
    .from("businesses")
    .update({ twilio_phone_number: null, twilio_number_sid: null })
    .eq("id", businessId);

  if (updateError) return { ok: false, error: "Number released from Twilio but failed to clear business" };
  return { ok: true };
}
