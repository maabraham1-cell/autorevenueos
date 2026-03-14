/**
 * Shared helpers for booking webhooks: map external data to business_id, contact_id, recovery_id.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

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
