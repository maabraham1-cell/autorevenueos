import { handleInboundMessage } from "@/lib/messaging/handle-inbound-message";

export type MetaChannel = "whatsapp" | "messenger" | "instagram";

export type ProcessInboundMetaMessageInput = {
  businessId: string;
  channel: MetaChannel;
  externalMessageId?: string | null;
  externalContactId?: string | null;
  phone?: string | null;
  displayName?: string | null;
  textBody?: string | null;
  metadata?: Record<string, unknown> | null;
};

type ProcessInboundMetaMessageResult = {
  skipped?: boolean;
  contactId?: string;
  conversationId?: string;
  eventId?: string;
  messageId?: string;
  ai?: {
    intent: string;
    action: string;
    confidence?: number;
  };
  bookingDraftCreated?: boolean;
};

function clampString(s: unknown, maxLen: number): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  if (!t) return null;
  return t.slice(0, maxLen);
}

function normalizeTextBody(textBody: string | null | undefined): string | null {
  const t = clampString(textBody, 4000);
  return t;
}

/**
 * Shared bounded booking assistant pipeline for Meta channels (WhatsApp/Messenger/Instagram).
 * - Inserts contact/conversation/event/message
 * - Runs Phase 2 AI assistant
 * - Stores AI output into `conversations.metadata.ai`
 * - Optionally creates `conversations.metadata.booking_draft`
 * - Inserts attributed booking links when AI requests `send_booking_link`
 * - Does not auto-send outbound replies from webhook ingestion
 *
 * Note: This does not confirm bookings, guess availability or pricing, or trigger billing.
 */
export async function processInboundMetaMessage(
  params: ProcessInboundMetaMessageInput,
): Promise<ProcessInboundMetaMessageResult> {
  const normalizedText = normalizeTextBody(params.textBody);
  const result = await handleInboundMessage({
    businessId: params.businessId,
    channel: params.channel,
    externalMessageId: params.externalMessageId ?? null,
    externalContactId: params.externalContactId ?? null,
    phone: params.phone ?? null,
    displayName: params.displayName ?? null,
    textBody: normalizedText,
    metadata: params.metadata ?? null,
  });

  return {
    skipped: result.skipped,
    contactId: result.contactId ?? undefined,
    conversationId: result.conversationId ?? undefined,
    eventId: result.eventId ?? undefined,
    messageId: result.messageId ?? undefined,
    ai: result.ai
      ? {
          intent: result.ai.intent,
          action: result.ai.action,
          confidence: result.ai.confidence,
        }
      : undefined,
    bookingDraftCreated: result.ai?.action === "create_booking_request_draft",
  };
}

