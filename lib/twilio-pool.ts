/**
 * Optional Twilio number pool: assign a pre-provisioned incoming number instead of purchasing.
 * One pool number ↔ one business at a time — same inbound routing as dedicated (lookup by To number).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ClaimPoolResult =
  | { outcome: "claimed"; poolEntryId: string; twilioNumberSid: string; phoneE164: string }
  | { outcome: "empty" }
  | { outcome: "error"; message: string };

export async function claimTwilioPoolEntry(
  db: SupabaseClient,
  businessId: string
): Promise<ClaimPoolResult> {
  const { data, error } = await db.rpc("claim_twilio_pool_entry", {
    p_business_id: businessId,
  });
  if (error) {
    return { outcome: "error", message: error.message };
  }
  const row = data as Record<string, unknown> | null;
  if (!row || typeof row !== "object") {
    return { outcome: "error", message: "Empty claim_twilio_pool_entry response" };
  }
  const o = typeof row.outcome === "string" ? row.outcome : "";
  if (o === "empty") return { outcome: "empty" };
  if (o !== "claimed") {
    return { outcome: "error", message: "Unexpected claim_twilio_pool_entry response" };
  }
  const poolEntryId = typeof row.pool_entry_id === "string" ? row.pool_entry_id : "";
  const sid = typeof row.twilio_number_sid === "string" ? row.twilio_number_sid : "";
  const phone = typeof row.phone_e164 === "string" ? row.phone_e164 : "";
  if (!poolEntryId || !sid || !phone) {
    return { outcome: "error", message: "Incomplete pool claim payload" };
  }
  return {
    outcome: "claimed",
    poolEntryId,
    twilioNumberSid: sid,
    phoneE164: phone,
  };
}

export async function revertTwilioPoolEntry(
  db: SupabaseClient,
  poolEntryId: string,
  businessId: string
): Promise<void> {
  await db.rpc("revert_twilio_pool_entry", {
    p_pool_entry_id: poolEntryId,
    p_business_id: businessId,
  });
}
