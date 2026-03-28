import type { SupabaseClient } from "@supabase/supabase-js";

type Channel = "whatsapp" | "sms" | "messenger" | "instagram" | "website_chat";

export async function findOrCreateContact(params: {
  supabase: SupabaseClient;
  businessId: string;
  channel: Channel;
  externalContactId?: string | null;
  phone?: string | null;
  displayName?: string | null;
}): Promise<{ id: string } | null> {
  const { supabase, businessId, channel } = params;
  const externalContactId = (params.externalContactId ?? "").trim();
  const phone = (params.phone ?? "").trim();
  const displayName = (params.displayName ?? "").trim();

  // Unified matching strategy:
  // - WhatsApp/SMS: prefer phone, fallback external id
  // - Messenger/Instagram/Web chat: prefer external id, fallback phone
  const preferPhone = channel === "whatsapp" || channel === "sms";

  const primary = preferPhone ? phone : externalContactId;
  const secondary = preferPhone ? externalContactId : phone;

  const tryLookupByExternal = async (value: string) => {
    if (!value) return null;
    const { data } = await supabase
      .from("contacts")
      .select("id, name")
      .eq("business_id", businessId)
      .eq("channel", channel)
      .eq("external_id", value)
      .maybeSingle();
    return data ?? null;
  };

  const tryLookupByPhone = async (value: string) => {
    if (!value) return null;
    const { data } = await supabase
      .from("contacts")
      .select("id, name")
      .eq("business_id", businessId)
      .eq("channel", channel)
      .eq("phone", value)
      .maybeSingle();
    return data ?? null;
  };

  let contact =
    preferPhone
      ? (await tryLookupByPhone(primary)) ?? (await tryLookupByExternal(secondary))
      : (await tryLookupByExternal(primary)) ?? (await tryLookupByPhone(secondary));

  if (!contact) {
    // Last-resort cross-channel phone fallback to reduce duplicates on migrations.
    if (phone) {
      const { data: byPhoneCrossChannel } = await supabase
        .from("contacts")
        .select("id, name")
        .eq("business_id", businessId)
        .eq("phone", phone)
        .limit(1)
        .maybeSingle();
      contact = byPhoneCrossChannel ?? null;
    }
  }

  if (!contact) {
    const { data: created } = await supabase
      .from("contacts")
      .insert({
        business_id: businessId,
        channel,
        external_id: externalContactId || null,
        phone: phone || null,
        name: displayName || null,
      })
      .select("id, name")
      .maybeSingle();

    if (!created?.id) return null;
    contact = created;
  }

  // One-way name enrichment.
  if (displayName && (!contact.name || String(contact.name).trim().length === 0)) {
    await supabase.from("contacts").update({ name: displayName }).eq("id", contact.id);
  }

  return { id: String(contact.id) };
}

