/**
 * Twilio number provisioning for businesses: search, purchase, link to business, set webhooks.
 * Idempotent: at most one purchased number per business; concurrent requests serialize via DB claim.
 */

import twilio from "twilio";
import { getSupabaseAdmin } from "@/lib/supabase";
import { normalizePhone } from "@/lib/phone";
import { claimTwilioPoolEntry, revertTwilioPoolEntry } from "@/lib/twilio-pool";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

function getTwilioClient(): ReturnType<typeof twilio> | null {
  if (!accountSid || !authToken) return null;
  return twilio(accountSid, authToken);
}

export function friendlyNameForBusiness(businessId: string): string {
  return `AutoRevenueOS-${businessId.slice(0, 8)}`;
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

const FALLBACK_COUNTRIES = ["GB", "US", "IE"];

export type ProvisionOptions = {
  businessId: string;
  baseUrl: string;
  location?: string | null;
};

export type ProvisionMeta = {
  skippedPurchase: boolean;
  purchasedNew: boolean;
  claimOutcome?: string;
  /** True when number came from twilio_number_pool (no new Twilio purchase). */
  fromPool?: boolean;
};

export type ProvisionResult =
  | { ok: true; phoneNumber: string; twilioNumberSid: string; meta: ProvisionMeta }
  | {
      ok: false;
      error: string;
      code?: "PROVISIONING_BUSY" | "NOT_FOUND" | "POOL_EMPTY";
      persistFailure?: boolean;
    };

function logProvision(
  level: "info" | "warn",
  businessId: string,
  msg: string,
  extra?: Record<string, unknown>
) {
  const payload = { business_id: businessId, ...extra };
  if (level === "warn") {
    console.warn(`[twilio-number] ${msg}`, payload);
  } else {
    console.info(`[twilio-number] ${msg}`, payload);
  }
}

async function tryClaimProvisioning(
  db: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  businessId: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await db.rpc("try_claim_twilio_provisioning", {
    p_business_id: businessId,
  });
  if (error) {
    console.error("[twilio-number] try_claim_twilio_provisioning RPC failed:", error.message);
    return null;
  }
  return (data as Record<string, unknown>) ?? null;
}

type PersistNumberOpts = {
  phoneNumberMode?: "dedicated" | "pool";
  poolEntryId?: string | null;
};

async function persistProvisionedNumber(
  db: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  businessId: string,
  phoneNumber: string,
  sid: string,
  opts?: PersistNumberOpts
): Promise<{ ok: true } | { ok: false; error: string }> {
  const patch: Record<string, unknown> = {
    twilio_phone_number: phoneNumber,
    twilio_number_sid: sid,
    phone_recovery_status: "provisioned",
    twilio_provisioning_error: null,
    twilio_provisioning_started_at: null,
  };
  if (opts) {
    patch.phone_number_mode = opts.phoneNumberMode ?? "dedicated";
    patch.twilio_pool_entry_id = opts.poolEntryId ?? null;
  }

  const { error: updateError } = await db.from("businesses").update(patch).eq("id", businessId);

  if (updateError) {
    console.error("[twilio-number] failed to save number to business:", updateError.message);
    return { ok: false, error: "Number purchased but failed to save to business" };
  }
  return { ok: true };
}

async function releaseProvisioningClaim(
  db: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  businessId: string,
  errorMessage: string
): Promise<void> {
  await db
    .from("businesses")
    .update({
      phone_recovery_status: "failed",
      twilio_provisioning_error: errorMessage.slice(0, 1000),
      twilio_provisioning_started_at: null,
    })
    .eq("id", businessId)
    .eq("phone_recovery_status", "provisioning");
}

/**
 * If Twilio already has an incoming number for this business (e.g. partial failure after purchase),
 * link it without buying again.
 */
async function recoverExistingIncomingNumber(
  client: ReturnType<typeof twilio>,
  businessId: string,
  baseUrl: string
): Promise<{ phoneNumber: string; sid: string } | null> {
  const friendly = friendlyNameForBusiness(businessId);
  const voiceUrl = `${baseUrl.replace(/\/$/, "")}/api/missed-call`;
  const smsUrl = `${baseUrl.replace(/\/$/, "")}/api/sms-webhook`;

  const list = await client.incomingPhoneNumbers.list({ friendlyName: friendly, limit: 20 });
  if (!list || list.length === 0) return null;
  if (list.length > 1) {
    logProvision("warn", businessId, "multiple Twilio numbers share friendlyName; using first match", {
      friendly_name: friendly,
      count: list.length,
    });
  }
  const incoming = list[0] as { sid?: string; phoneNumber?: string };
  const sid = incoming.sid?.trim();
  const raw = incoming.phoneNumber?.trim();
  if (!sid || !raw) return null;

  try {
    await client.incomingPhoneNumbers(sid).update({
      voiceUrl,
      voiceMethod: "POST",
      smsUrl,
      smsMethod: "POST",
      friendlyName: friendly,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logProvision("warn", businessId, "recover: webhook update failed", { sid, error: msg });
  }

  const phoneNumber = normalizePhone(raw) || raw;
  logProvision("info", businessId, "recovered existing Twilio number without new purchase", {
    twilio_number_sid: sid,
    skipped_purchase: true,
  });
  return { phoneNumber, sid };
}

/**
 * Idempotent: returns existing number if already provisioned; claims slot; recovers orphans; at most one purchase per business.
 */
export async function provisionNumberForBusiness(options: ProvisionOptions): Promise<ProvisionResult> {
  const { businessId, baseUrl, location } = options;
  const db = getSupabaseAdmin();
  if (!db) {
    return { ok: false, error: "Database not available", persistFailure: false };
  }

  const client = getTwilioClient();
  if (!client) {
    return { ok: false, error: "Twilio is not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)" };
  }

  const trimmedBase = baseUrl.replace(/\/$/, "");

  const { data: business, error: fetchError } = await db
    .from("businesses")
    .select(
      "id, twilio_phone_number, twilio_number_sid, phone_recovery_status, twilio_provisioning_started_at, phone_number_mode"
    )
    .eq("id", businessId)
    .single();

  if (fetchError || !business) {
    return { ok: false, error: "Business not found", code: "NOT_FOUND", persistFailure: false };
  }

  const existingNumber = (business as { twilio_phone_number?: string }).twilio_phone_number;
  const existingSid = (business as { twilio_number_sid?: string }).twilio_number_sid;
  const recoveryStatus = (business as { phone_recovery_status?: string }).phone_recovery_status;

  if (existingNumber && existingNumber.trim()) {
    const normalized = normalizePhone(existingNumber);
    if (normalized) {
      logProvision("info", businessId, "provisioning skipped: number already in database", {
        skipped_purchase: true,
        already_existed: true,
        twilio_number_sid: existingSid ?? null,
      });
      await db
        .from("businesses")
        .update({
          phone_recovery_status: "provisioned",
          twilio_provisioning_error: null,
          twilio_provisioning_started_at: null,
        })
        .eq("id", businessId);
      return {
        ok: true,
        phoneNumber: normalized,
        twilioNumberSid: existingSid?.trim() ?? "",
        meta: { skippedPurchase: true, purchasedNew: false, claimOutcome: "already_in_db" },
      };
    }
  }

  if (
    recoveryStatus === "provisioned" &&
    existingSid &&
    existingSid.trim() &&
    (!existingNumber || !existingNumber.trim())
  ) {
    logProvision("warn", businessId, "inconsistent row: provisioned sid without phone; attempting Twilio recovery");
  }

  const claim = await tryClaimProvisioning(db, businessId);
  if (!claim) {
    return { ok: false, error: "Could not acquire provisioning lock" };
  }

  const outcome = typeof claim.outcome === "string" ? claim.outcome : "";

  if (outcome === "already_provisioned") {
    const phone =
      typeof claim.twilio_phone_number === "string" ? claim.twilio_phone_number.trim() : "";
    const sid = typeof claim.twilio_number_sid === "string" ? claim.twilio_number_sid.trim() : "";
    if (phone) {
      const normalized = normalizePhone(phone) || phone;
      logProvision("info", businessId, "provisioning skipped: claim saw existing provisioned row", {
        skipped_purchase: true,
        already_existed: true,
        twilio_number_sid: sid || null,
      });
      await db
        .from("businesses")
        .update({
          phone_recovery_status: "provisioned",
          twilio_provisioning_error: null,
          twilio_provisioning_started_at: null,
        })
        .eq("id", businessId);
      return {
        ok: true,
        phoneNumber: normalized,
        twilioNumberSid: sid,
        meta: { skippedPurchase: true, purchasedNew: false, claimOutcome: outcome },
      };
    }
    if (sid) {
      try {
        const incoming = await client.incomingPhoneNumbers(sid).fetch();
        const raw = (incoming as { phoneNumber?: string }).phoneNumber?.trim();
        if (raw) {
          const normalized = normalizePhone(raw) || raw;
          const saved = await persistProvisionedNumber(db, businessId, normalized, sid, {
            phoneNumberMode: "dedicated",
            poolEntryId: null,
          });
          if (saved.ok) {
            logProvision("info", businessId, "filled phone from Twilio SID after claim already_provisioned", {
              skipped_purchase: true,
              twilio_number_sid: sid,
            });
            return {
              ok: true,
              phoneNumber: normalized,
              twilioNumberSid: sid,
              meta: { skippedPurchase: true, purchasedNew: false, claimOutcome: "hydrated_from_sid" },
            };
          }
        }
      } catch (e) {
        logProvision("warn", businessId, "could not hydrate phone from SID", {
          sid,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    const recoveredEarly = await recoverExistingIncomingNumber(client, businessId, trimmedBase);
    if (recoveredEarly) {
      const saved = await persistProvisionedNumber(db, businessId, recoveredEarly.phoneNumber, recoveredEarly.sid, {
        phoneNumberMode: "dedicated",
        poolEntryId: null,
      });
      if (saved.ok) {
        return {
          ok: true,
          phoneNumber: recoveredEarly.phoneNumber,
          twilioNumberSid: recoveredEarly.sid,
          meta: { skippedPurchase: true, purchasedNew: false, claimOutcome: "recovered_after_claim" },
        };
      }
    }
    return {
      ok: false,
      error: "Provisioned number exists in database but could not be loaded. Try again or contact support.",
      persistFailure: true,
    };
  }

  if (outcome === "busy") {
    logProvision("info", businessId, "provisioning skipped: another request holds the claim", {
      skipped_purchase: true,
      concurrent: true,
    });
    return {
      ok: false,
      error: "Phone recovery provisioning is already in progress. Retry in a moment.",
      code: "PROVISIONING_BUSY",
      persistFailure: false,
    };
  }

  if (outcome === "not_found") {
    return { ok: false, error: "Business not found", code: "NOT_FOUND", persistFailure: false };
  }

  if (outcome !== "claimed") {
    logProvision("warn", businessId, "unexpected claim outcome", { outcome });
    return { ok: false, error: "Could not start provisioning" };
  }

  logProvision("info", businessId, "provisioning claim acquired", { claim_outcome: outcome });

  const recovered = await recoverExistingIncomingNumber(client, businessId, trimmedBase);
  if (recovered) {
    const saved = await persistProvisionedNumber(db, businessId, recovered.phoneNumber, recovered.sid, {
      phoneNumberMode: "dedicated",
      poolEntryId: null,
    });
    if (!saved.ok) {
      await releaseProvisioningClaim(db, businessId, saved.error);
      return { ok: false, error: saved.error };
    }
    logProvision("info", businessId, "provisioning finished: linked recovered Twilio number", {
      purchased_new: false,
      skipped_purchase: true,
    });
    return {
      ok: true,
      phoneNumber: recovered.phoneNumber,
      twilioNumberSid: recovered.sid,
      meta: { skippedPurchase: true, purchasedNew: false, claimOutcome: "recovered_from_twilio" },
    };
  }

  const numberMode = ((business as { phone_number_mode?: string }).phone_number_mode ?? "dedicated").trim();
  if (numberMode === "pool") {
    const pool = await claimTwilioPoolEntry(db, businessId);
    if (pool.outcome === "empty") {
      const errMsg =
        "Twilio number pool has no available numbers. Add rows to twilio_number_pool (admin) or set phone_number_mode to dedicated.";
      await releaseProvisioningClaim(db, businessId, errMsg);
      logProvision("warn", businessId, "pool mode but no available pool entries", { skipped_purchase: true });
      return { ok: false, error: errMsg, code: "POOL_EMPTY", persistFailure: true };
    }
    if (pool.outcome !== "claimed") {
      const msg = pool.outcome === "error" ? pool.message : "Pool claim failed";
      await releaseProvisioningClaim(db, businessId, msg);
      return { ok: false, error: msg, persistFailure: true };
    }

    const normalizedPool = normalizePhone(pool.phoneE164) || pool.phoneE164;
    const webhookResult = await setNumberWebhooks(pool.twilioNumberSid, trimmedBase);
    if (!webhookResult.ok) {
      await revertTwilioPoolEntry(db, pool.poolEntryId, businessId);
      await releaseProvisioningClaim(db, businessId, webhookResult.error);
      return { ok: false, error: webhookResult.error, persistFailure: true };
    }

    const savedPool = await persistProvisionedNumber(db, businessId, normalizedPool, pool.twilioNumberSid, {
      phoneNumberMode: "pool",
      poolEntryId: pool.poolEntryId,
    });
    if (!savedPool.ok) {
      await revertTwilioPoolEntry(db, pool.poolEntryId, businessId);
      await releaseProvisioningClaim(db, businessId, savedPool.error);
      return { ok: false, error: savedPool.error, persistFailure: true };
    }

    logProvision("info", businessId, "provisioning finished: assigned number from pool", {
      skipped_purchase: true,
      from_pool: true,
      pool_entry_id: pool.poolEntryId,
      twilio_number_sid: pool.twilioNumberSid,
    });

    return {
      ok: true,
      phoneNumber: normalizedPool,
      twilioNumberSid: pool.twilioNumberSid,
      meta: {
        skippedPurchase: true,
        purchasedNew: false,
        claimOutcome: "pool_assigned",
        fromPool: true,
      },
    };
  }

  const voiceUrl = `${trimmedBase}/api/missed-call`;
  const smsUrl = `${trimmedBase}/api/sms-webhook`;
  const friendlyName = friendlyNameForBusiness(businessId);

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
        friendlyName,
      });

      const sid = (incoming as { sid: string }).sid;
      const num = (incoming as { phoneNumber: string }).phoneNumber ?? phoneNumber;
      purchased = { phoneNumber: normalizePhone(num) || num, sid };
      logProvision("info", businessId, "purchased new Twilio incoming number", {
        purchased_new: true,
        twilio_number_sid: sid,
        country,
      });
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[twilio-number] purchase failed for country", country, msg);
      continue;
    }
  }

  if (!purchased) {
    const errMsg = "No available Twilio numbers in tried countries (GB, US, IE)";
    await releaseProvisioningClaim(db, businessId, errMsg);
    return { ok: false, error: errMsg };
  }

  const saved = await persistProvisionedNumber(db, businessId, purchased.phoneNumber, purchased.sid, {
    phoneNumberMode: "dedicated",
    poolEntryId: null,
  });
  if (!saved.ok) {
    logProvision("warn", businessId, "purchase succeeded but DB save failed; number may be orphaned in Twilio — retry will attempt recovery", {
      twilio_number_sid: purchased.sid,
    });
    await releaseProvisioningClaim(db, businessId, saved.error);
    return { ok: false, error: saved.error };
  }

  logProvision("info", businessId, "provisioning finished: new number saved to business", {
    purchased_new: true,
    twilio_number_sid: purchased.sid,
  });

  return {
    ok: true,
    phoneNumber: purchased.phoneNumber,
    twilioNumberSid: purchased.sid,
    meta: { skippedPurchase: false, purchasedNew: true, claimOutcome: "purchased" },
  };
}

/**
 * Update webhooks for an existing Twilio number (e.g. after app URL change).
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
 * Release a number from a business (when business cancels).
 * Removes from Twilio account and clears business fields.
 */
export async function releaseNumberForBusiness(businessId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = getTwilioClient();
  const db = getSupabaseAdmin();
  if (!client || !db) return { ok: false, error: "Twilio or database not available" };

  const { data: business, error: fetchError } = await db
    .from("businesses")
    .select("twilio_number_sid, phone_number_mode, twilio_pool_entry_id")
    .eq("id", businessId)
    .single();

  if (fetchError || !business) return { ok: false, error: "Business not found" };
  const sid = (business as { twilio_number_sid?: string }).twilio_number_sid;
  if (!sid?.trim()) return { ok: false, error: "No Twilio number assigned" };

  const mode = (business as { phone_number_mode?: string }).phone_number_mode ?? "dedicated";
  const poolEntryId = (business as { twilio_pool_entry_id?: string | null }).twilio_pool_entry_id;

  if (mode === "pool" && poolEntryId) {
    const { error: poolErr } = await db.rpc("revert_twilio_pool_entry", {
      p_pool_entry_id: poolEntryId,
      p_business_id: businessId,
    });
    if (poolErr) {
      return { ok: false, error: `Failed to return number to pool: ${poolErr.message}` };
    }
    const { error: updateError } = await db
      .from("businesses")
      .update({
        twilio_phone_number: null,
        twilio_number_sid: null,
        twilio_pool_entry_id: null,
        phone_number_mode: "dedicated",
        phone_recovery_status: "none",
        twilio_provisioning_started_at: null,
      })
      .eq("id", businessId);
    if (updateError) return { ok: false, error: "Pool reverted but failed to clear business fields" };
    logProvision("info", businessId, "released pool assignment (number kept in Twilio for reuse)", {
      pool_entry_id: poolEntryId,
    });
    return { ok: true };
  }

  try {
    await client.incomingPhoneNumbers(sid).remove();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Twilio release failed: ${msg}` };
  }

  const { error: updateError } = await db
    .from("businesses")
    .update({
      twilio_phone_number: null,
      twilio_number_sid: null,
      twilio_pool_entry_id: null,
      phone_recovery_status: "none",
      twilio_provisioning_started_at: null,
    })
    .eq("id", businessId);

  if (updateError) return { ok: false, error: "Number released from Twilio but failed to clear business" };
  return { ok: true };
}
