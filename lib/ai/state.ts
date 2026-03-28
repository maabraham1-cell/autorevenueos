import { getSupabaseAdmin } from "@/lib/supabase";
import type { AIAction, AIIntent } from "@/lib/ai/assistant";

export type BookingDraft = {
  business_id: string;
  contact_id: string;
  conversation_id: string;
  source_channel: string; // channel for the thread (e.g. whatsapp)
  service?: string | null;
  preferred_day?: string | null;
  preferred_time?: string | null;
  notes?: string | null;
  status: "draft";
};

export type AIState = {
  intent?: AIIntent;
  confidence?: number;
  entities?: {
    service?: string | null;
    preferred_day?: string | null;
    preferred_time?: string | null;
    customer_name?: string | null;
  };
  action?: AIAction;
  last_action?: AIAction;

  // Backwards/compat fields (older Phase 1 code stored flattened fields)
  service?: string | null;
  preferred_day?: string | null;
  preferred_time?: string | null;

  reply?: string;
  last_ai_reply?: string;
  booking_link_sent?: boolean;
  handoff_required?: boolean;
  reasoning?: string | null;
};

export async function getAIState(conversationId: string | null | undefined): Promise<AIState | null> {
  if (!conversationId) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("conversations")
    .select("metadata")
    .eq("id", conversationId)
    .maybeSingle();

  if (error) return null;
  const metadata = (data?.metadata ?? {}) as Record<string, unknown>;
  const aiUnknown = metadata["ai"];
  if (!aiUnknown || typeof aiUnknown !== "object") return null;
  return aiUnknown as AIState;
}

export async function updateAIState(
  conversationId: string | null | undefined,
  partialState: Partial<AIState>,
): Promise<void> {
  if (!conversationId) return;
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const { data, error } = await supabase
    .from("conversations")
    .select("metadata")
    .eq("id", conversationId)
    .maybeSingle();

  if (error || !data) return;

  const oldMeta = (data.metadata ?? {}) as Record<string, unknown>;
  const oldAiUnknown = oldMeta["ai"];
  const oldAi =
    oldAiUnknown && typeof oldAiUnknown === "object"
      ? (oldAiUnknown as AIState)
      : ({} as AIState);
  const cleanedPartial: Partial<AIState> = Object.fromEntries(
    Object.entries(partialState).filter(([, v]) => v !== undefined),
  ) as Partial<AIState>;
  const mergedAi: AIState = { ...oldAi, ...cleanedPartial };

  const newMeta = {
    ...oldMeta,
    ai: mergedAi,
  };

  await supabase.from("conversations").update({ metadata: newMeta }).eq("id", conversationId);
}

function cleanPartial<T extends object>(partial: Partial<T>): Partial<T> {
  return Object.fromEntries(
    Object.entries(partial).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

export async function getBookingDraft(
  conversationId: string | null | undefined,
): Promise<BookingDraft | null> {
  if (!conversationId) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("conversations")
    .select("metadata")
    .eq("id", conversationId)
    .maybeSingle();

  if (error) return null;
  const metadata = (data?.metadata ?? {}) as Record<string, unknown>;
  const draftUnknown = metadata["booking_draft"];
  if (!draftUnknown || typeof draftUnknown !== "object") return null;
  return draftUnknown as BookingDraft;
}

export async function upsertBookingDraft(
  conversationId: string | null | undefined,
  draft: BookingDraft,
): Promise<void> {
  if (!conversationId) return;
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const { data, error } = await supabase
    .from("conversations")
    .select("metadata")
    .eq("id", conversationId)
    .maybeSingle();

  if (error || !data) return;

  const oldMeta = (data.metadata ?? {}) as Record<string, unknown>;
  const oldDraftUnknown = oldMeta["booking_draft"];
  const oldDraft =
    oldDraftUnknown && typeof oldDraftUnknown === "object"
      ? (oldDraftUnknown as Partial<BookingDraft>)
      : ({} as Partial<BookingDraft>);

  const mergedDraft: BookingDraft = {
    ...oldDraft,
    ...cleanPartial(draft),
    status: "draft",
  } as BookingDraft;

  const newMeta = {
    ...oldMeta,
    booking_draft: mergedDraft,
  };

  await supabase
    .from("conversations")
    .update({ metadata: newMeta })
    .eq("id", conversationId);
}

