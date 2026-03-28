import { normalizePhone } from "@/lib/phone";

export type InboundChannel =
  | "whatsapp"
  | "sms"
  | "messenger"
  | "instagram"
  | "webchat";

export type NormalizedInboundMessage = {
  channel: InboundChannel;
  externalMessageId?: string | null;
  externalContactId?: string | null;
  phone?: string | null;
  displayName?: string | null;
  textBody?: string | null;
  metadata?: Record<string, unknown> | null;
};

function trimOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

export function normalizeWhatsAppPayload(params: {
  from?: string | null;
  messageId?: string | null;
  textBody?: string | null;
  profileName?: string | null;
  metadata?: Record<string, unknown> | null;
}): NormalizedInboundMessage {
  const from = trimOrNull(params.from);
  return {
    channel: "whatsapp",
    externalMessageId: trimOrNull(params.messageId),
    externalContactId: from,
    phone: from,
    displayName: trimOrNull(params.profileName),
    textBody: trimOrNull(params.textBody),
    metadata: params.metadata ?? null,
  };
}

export function normalizeMessengerPayload(params: {
  senderId?: string | null;
  mid?: string | null;
  textBody?: string | null;
  displayName?: string | null;
  metadata?: Record<string, unknown> | null;
}): NormalizedInboundMessage {
  return {
    channel: "messenger",
    externalMessageId: trimOrNull(params.mid),
    externalContactId: trimOrNull(params.senderId),
    phone: null,
    displayName: trimOrNull(params.displayName),
    textBody: trimOrNull(params.textBody),
    metadata: params.metadata ?? null,
  };
}

export function normalizeInstagramPayload(params: {
  senderId?: string | null;
  mid?: string | null;
  textBody?: string | null;
  displayName?: string | null;
  metadata?: Record<string, unknown> | null;
}): NormalizedInboundMessage {
  return {
    channel: "instagram",
    externalMessageId: trimOrNull(params.mid),
    externalContactId: trimOrNull(params.senderId),
    phone: null,
    displayName: trimOrNull(params.displayName),
    textBody: trimOrNull(params.textBody),
    metadata: params.metadata ?? null,
  };
}

export function normalizeSMSPayload(params: {
  fromPhone?: string | null;
  messageSid?: string | null;
  textBody?: string | null;
  metadata?: Record<string, unknown> | null;
}): NormalizedInboundMessage {
  const phone = normalizePhone(params.fromPhone ?? "");
  return {
    channel: "sms",
    externalMessageId: trimOrNull(params.messageSid),
    externalContactId: phone || trimOrNull(params.fromPhone),
    phone: phone || trimOrNull(params.fromPhone),
    displayName: null,
    textBody: trimOrNull(params.textBody),
    metadata: params.metadata ?? null,
  };
}

export function normalizeWebchatPayload(params: {
  visitorId?: string | null;
  textBody?: string | null;
  displayName?: string | null;
  metadata?: Record<string, unknown> | null;
}): NormalizedInboundMessage {
  return {
    channel: "webchat",
    externalMessageId: null,
    externalContactId: trimOrNull(params.visitorId),
    phone: null,
    displayName: trimOrNull(params.displayName) ?? "Website visitor",
    textBody: trimOrNull(params.textBody),
    metadata: params.metadata ?? null,
  };
}

