import { getSupabaseAdmin, supabase } from "@/lib/supabase";
import { findOrCreateConversation, touchConversation } from "@/lib/conversations";
import { processInboundMessage } from "@/lib/ai/assistant";
import { upsertBookingDraft, updateAIState } from "@/lib/ai/state";
import { buildWhatsAppBookingLink } from "@/lib/whatsapp";
import { findOrCreateContact } from "@/lib/messaging/contact";

type InboundChannel = "whatsapp" | "sms" | "messenger" | "instagram" | "webchat";

export async function handleInboundMessage(params: {
  businessId: string;
  channel: InboundChannel;
  externalMessageId?: string | null;
  externalContactId?: string | null;
  phone?: string | null;
  displayName?: string | null;
  textBody?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<{
  skipped?: boolean;
  deduped?: boolean;
  contactId?: string | null;
  conversationId?: string | null;
  eventId?: string | null;
  messageId?: string | null;
  ai?: {
    intent: string;
    action: string;
    confidence: number;
  } | null;
}> {
  const db = getSupabaseAdmin() ?? supabase;

  const businessId = params.businessId;
  const channel = params.channel;
  const externalMessageId = (params.externalMessageId ?? "").trim() || null;
  const externalContactId = (params.externalContactId ?? "").trim() || null;
  const phone = (params.phone ?? "").trim() || null;
  const displayName = (params.displayName ?? "").trim() || null;
  const textBodyRaw = (params.textBody ?? "").toString();
  const textBody = textBodyRaw.trim();
  const metadata = params.metadata ?? null;

  if (!businessId || !channel || !textBody) {
    return { skipped: true };
  }

  // Idempotency: do not process same external message twice.
  if (externalMessageId) {
    const { data: existingMessage } = await db
      .from("messages")
      .select("id, contact_id, conversation_id")
      .eq("business_id", businessId)
      .eq("external_id", externalMessageId)
      .maybeSingle();

    if (existingMessage) {
      return {
        skipped: true,
        deduped: true,
        messageId: String(existingMessage.id),
        contactId: (existingMessage.contact_id as string | null) ?? null,
        conversationId: (existingMessage.conversation_id as string | null) ?? null,
      };
    }
  }

  const storageChannel = channel === "webchat" ? "website_chat" : channel;

  const contact = await findOrCreateContact({
    supabase: db as any,
    businessId,
    channel: storageChannel as any,
    externalContactId,
    phone,
    displayName,
  });
  if (!contact?.id) {
    return { skipped: true };
  }

  const conversation = await findOrCreateConversation({
    supabase: db as any,
    businessId,
    contactId: contact.id,
    channel: storageChannel,
    source: `${storageChannel}_inbound`,
    initialMessageAt: new Date().toISOString(),
    initialPreview: textBody,
  });
  const conversationId = conversation ? ((conversation as any).id as string) : null;
  if (!conversationId) {
    return { skipped: true };
  }

  // Insert inbound message first (requested flow).
  let insertedMessage: any = null;
  const { data: insertedAttempt, error: messageError } = await db
    .from("messages")
    .insert({
      business_id: businessId,
      contact_id: contact.id,
      channel: storageChannel,
      direction: "inbound",
      body: textBody,
      status: "received",
      external_id: externalMessageId,
      conversation_id: conversationId,
    })
    .select("id, body, created_at")
    .maybeSingle();

  if (messageError) {
    const msg = messageError.message ?? "";
    const missingConversationId = /conversation_id.*does not exist/i.test(msg);
    if (!missingConversationId) {
      return { skipped: true };
    }
    const { data: insertedLegacy } = await db
      .from("messages")
      .insert({
        business_id: businessId,
        contact_id: contact.id,
        channel: storageChannel,
        direction: "inbound",
        body: textBody,
        status: "received",
        external_id: externalMessageId,
      })
      .select("id, body, created_at")
      .maybeSingle();
    insertedMessage = insertedLegacy ?? null;
  } else {
    insertedMessage = insertedAttempt ?? null;
  }

  if (!insertedMessage?.id) return { skipped: true };

  await touchConversation({
    supabase: db as any,
    conversationId,
    lastMessageAt: insertedMessage.created_at as string,
    lastMessagePreview: textBody,
  });

  const { data: insertedEvent } = await db
    .from("events")
    .insert({
      business_id: businessId,
      contact_id: contact.id,
      source_channel: storageChannel,
      event_type: "incoming_message",
      payload: metadata ?? {
        channel: storageChannel,
        external_message_id: externalMessageId,
      },
      external_id: externalMessageId,
    })
    .select("id")
    .maybeSingle();

  // AI context: last 4 previous thread messages
  const { data: priorRows } = await db
    .from("messages")
    .select("direction, body, created_at")
    .eq("business_id", businessId)
    .eq("conversation_id", conversationId)
    .lt("created_at", insertedMessage.created_at as string)
    .order("created_at", { ascending: false })
    .limit(4);

  const recentMessages =
    (priorRows ?? [])
      .filter((r: any) => typeof r.body === "string" && r.body.trim().length > 0)
      .map((r: any) => ({
        role: (r.direction === "inbound" ? "user" : "assistant") as "user" | "assistant",
        content: r.body as string,
      }))
      .reverse() ?? [];

  // SINGLE centralized AI call for inbound messages.
  const ai = await processInboundMessage({
    message: textBody,
    conversationId,
    contactId: contact.id,
    recentMessages,
  });

  let finalReply = ai.reply;
  if (ai.action === "send_booking_link") {
    const { data: businessRow } = await db
      .from("businesses")
      .select("booking_link")
      .eq("id", businessId)
      .maybeSingle();
    const { data: convRow } = await db
      .from("conversations")
      .select("id, contact_id, missed_call_event_id")
      .eq("id", conversationId)
      .maybeSingle();

    const bookingLink = buildWhatsAppBookingLink({
      bookingLink: (businessRow as any)?.booking_link ?? null,
      source: storageChannel,
      contactId: (convRow as any)?.contact_id ?? contact.id,
      conversationId,
      missedCallId: (convRow as any)?.missed_call_event_id ?? null,
    });
    if (bookingLink) {
      finalReply = finalReply.replaceAll("[[BOOKING_LINK]]", bookingLink);
      if (!finalReply.includes(bookingLink)) {
        finalReply = `${finalReply.trim()}\n${bookingLink}`;
      }
    }
  }

  if (ai.action === "create_booking_request_draft") {
    await upsertBookingDraft(conversationId, {
      business_id: businessId,
      contact_id: contact.id,
      conversation_id: conversationId,
      source_channel: storageChannel,
      service: ai.entities.service ?? null,
      preferred_day: ai.entities.preferred_day ?? null,
      preferred_time: ai.entities.preferred_time ?? null,
      notes: null,
      status: "draft",
    });
  }

  await updateAIState(conversationId, {
    intent: ai.intent,
    confidence: ai.confidence,
    entities: {
      service: ai.entities.service ?? null,
      preferred_day: ai.entities.preferred_day ?? null,
      preferred_time: ai.entities.preferred_time ?? null,
      customer_name: ai.entities.customer_name ?? null,
    },
    action: ai.action,
    last_action: ai.action,
    reply: finalReply,
    last_ai_reply: finalReply,
    handoff_required: ai.action === "handoff",
    booking_link_sent: ai.action === "send_booking_link",
    reasoning: ai.reasoning ?? null,
  });

  return {
    skipped: false,
    deduped: false,
    contactId: contact.id,
    conversationId,
    eventId: insertedEvent?.id ? String(insertedEvent.id) : null,
    messageId: String(insertedMessage.id),
    ai: {
      intent: ai.intent,
      action: ai.action,
      confidence: ai.confidence,
    },
  };
}

