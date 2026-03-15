/**
 * Shared helpers for booking webhooks: map external data to business_id, contact_id, recovery_id.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecordConfirmedBookingInput } from "@/lib/confirm-booking";

export type ContactRecoveryResult = {
  contact_id: string | null;
  recovery_id: string | null;
};

/**
 * Find contact by email for the business; optionally latest recovery for that contact.
 */
export async function findContactAndRecoveryByEmail(
  db: SupabaseClient,
  businessId: string,
  email: string
): Promise<ContactRecoveryResult> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { contact_id: null, recovery_id: null };

  const { data: contactRow } = await db
    .from("contacts")
    .select("id")
    .eq("business_id", businessId)
    .ilike("email", normalized)
    .limit(1)
    .maybeSingle();

  const contactId = (contactRow as { id: string } | null)?.id ?? null;
  let recoveryId: string | null = null;

  if (contactId) {
    const { data: rec } = await db
      .from("recoveries")
      .select("id")
      .eq("business_id", businessId)
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    recoveryId = (rec as { id: string } | null)?.id ?? null;
  }

  return { contact_id: contactId, recovery_id: recoveryId };
}

/** Standard inbound payload from bridges (Zapier, Make, Google Sheets, etc.). */
export type InboundFeedPayload = {
  business_id: string;
  contact_id?: string | null;
  recovery_id?: string | null;
  external_booking_id?: string | null;
  confirmed_at?: string | null;
  confirmation_source?: string | null;
};

/**
 * Parse JSON body into RecordConfirmedBookingInput for feed/google-sheets/bridge endpoints.
 * If allowedSources is set, confirmation_source must be in the list (or use defaultSource).
 * Returns error string if invalid.
 */
export function parseInboundFeedPayload(
  body: unknown,
  options: { allowedSources?: string[]; defaultSource?: string }
): { ok: true; input: RecordConfirmedBookingInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid JSON body" };
  }
  const b = body as Record<string, unknown>;
  const businessId = typeof b.business_id === "string" ? b.business_id.trim() : null;
  if (!businessId) {
    return { ok: false, error: "Missing or invalid business_id" };
  }

  let source: string =
    typeof b.confirmation_source === "string" ? b.confirmation_source.trim() : "";
  if (options.defaultSource) {
    source = source || options.defaultSource;
  }
  if (!source) {
    return { ok: false, error: "Missing confirmation_source" };
  }
  if (options.allowedSources && !options.allowedSources.includes(source)) {
    return { ok: false, error: `confirmation_source not allowed: ${source}` };
  }

  const contactId =
    typeof b.contact_id === "string" && b.contact_id.trim()
      ? b.contact_id.trim()
      : null;
  const recoveryId =
    typeof b.recovery_id === "string" && b.recovery_id.trim()
      ? b.recovery_id.trim()
      : null;
  const externalBookingId =
    typeof b.external_booking_id === "string" && b.external_booking_id.trim()
      ? b.external_booking_id.trim()
      : null;
  let confirmedAt: Date | undefined;
  if (typeof b.confirmed_at === "string" && b.confirmed_at.trim()) {
    const d = new Date(b.confirmed_at.trim());
    if (!isNaN(d.getTime())) confirmedAt = d;
  }

  return {
    ok: true,
    input: {
      business_id: businessId,
      contact_id: contactId,
      recovery_id: recoveryId,
      external_booking_id: externalBookingId,
      confirmation_source: source as RecordConfirmedBookingInput["confirmation_source"],
      confirmed_at: confirmedAt,
    },
  };
}
