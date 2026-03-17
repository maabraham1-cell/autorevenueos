import type { SupabaseClient } from "@supabase/supabase-js";

const LOG_PREFIX = "[conversations]";

type ConversationRow = {
  id: string;
  business_id: string;
  contact_id: string;
  channel: string;
  status: string;
  last_message_at: string;
  last_message_preview: string | null;
};

type FindConversationParams = {
  supabase: SupabaseClient;
  businessId: string;
  contactId: string;
  channel: string;
};

export async function findOpenConversation(
  params: FindConversationParams,
): Promise<ConversationRow | null> {
  const { supabase, businessId, contactId, channel } = params;

  const { data, error } = await supabase
    .from("conversations")
    .select("id, business_id, contact_id, channel, status, last_message_at, last_message_preview")
    .eq("business_id", businessId)
    .eq("contact_id", contactId)
    .eq("channel", channel)
    .eq("status", "open")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(`${LOG_PREFIX} findOpenConversation error`, {
      businessId,
      contactId,
      channel,
      error,
    });
    return null;
  }

  return (data as ConversationRow | null) ?? null;
}

type CreateConversationParams = {
  supabase: SupabaseClient;
  businessId: string;
  contactId: string;
  channel: string;
  source?: string | null;
  missedCallEventId?: string | null;
  initialMessageAt?: string | null;
  initialPreview?: string | null;
};

export async function createConversation(
  params: CreateConversationParams,
): Promise<ConversationRow | null> {
  const {
    supabase,
    businessId,
    contactId,
    channel,
    source,
    missedCallEventId,
    initialMessageAt,
    initialPreview,
  } = params;

  const nowIso = new Date().toISOString();
  const ts = initialMessageAt || nowIso;

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      business_id: businessId,
      contact_id: contactId,
      channel,
      source: source ?? null,
      status: "open",
      started_at: ts,
      last_message_at: ts,
      last_message_preview: initialPreview ? initialPreview.slice(0, 200) : null,
      missed_call_event_id: missedCallEventId ?? null,
    })
    .select("id, business_id, contact_id, channel, status, last_message_at, last_message_preview")
    .single();

  if (error || !data) {
    console.error(`${LOG_PREFIX} createConversation error`, {
      businessId,
      contactId,
      channel,
      error,
    });
    return null;
  }

  return data as ConversationRow;
}

type FindOrCreateParams = FindConversationParams & {
  source?: string | null;
  missedCallEventId?: string | null;
  initialMessageAt?: string | null;
  initialPreview?: string | null;
};

export async function findOrCreateConversation(
  params: FindOrCreateParams,
): Promise<ConversationRow | null> {
  const existing = await findOpenConversation(params);
  if (existing) return existing;

  return createConversation(params);
}

type TouchConversationParams = {
  supabase: SupabaseClient;
  conversationId: string;
  lastMessageAt: string;
  lastMessagePreview: string | null;
};

export async function touchConversation(params: TouchConversationParams): Promise<void> {
  const { supabase, conversationId, lastMessageAt, lastMessagePreview } = params;

  const { error } = await supabase
    .from("conversations")
    .update({
      last_message_at: lastMessageAt,
      last_message_preview: lastMessagePreview ? lastMessagePreview.slice(0, 200) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  if (error) {
    console.error(`${LOG_PREFIX} touchConversation error`, {
      conversationId,
      error,
    });
  }
}

