import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, supabase } from "@/lib/supabase";
import { getCurrentUserAndBusiness } from "@/lib/auth";
import {
  isBillingOutboundBlockedError,
  OUTBOUND_BILLING_BLOCKED_MESSAGE,
} from "@/lib/billing-outbound-gate";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp";
import { normalizePhone } from "@/lib/phone";
import { findOrCreateConversation, touchConversation } from "@/lib/conversations";

const CHANNEL = "whatsapp";
const LOG_PREFIX = "[inbox/whatsapp/send]";

type ReplyBody = {
  contact_id: string;
  body: string;
};

/** Digits only for comparison (no + or spaces). */
function digitsOnly(s: string | null | undefined): string {
  if (s == null || typeof s !== "string") return "";
  return s.replace(/\D/g, "");
}

export async function POST(request: NextRequest) {
  const { user, business } = await getCurrentUserAndBusiness(request);

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!business) {
    return NextResponse.json(
      { error: "No business linked to this user" },
      { status: 400 },
    );
  }

  const db = getSupabaseAdmin() ?? supabase;

  const body = (await request.json().catch(() => null)) as ReplyBody | null;
  const contactId = typeof body?.contact_id === "string" ? body.contact_id.trim() : "";
  const text = typeof body?.body === "string" ? body.body.trim().slice(0, 2000) : "";

  if (!contactId || !text) {
    return NextResponse.json(
      { error: "Missing contact_id or body" },
      { status: 400 },
    );
  }

  const { data: contact, error: contactError } = await db
    .from("contacts")
    .select("id, phone, external_id")
    .eq("id", contactId)
    .eq("business_id", business.id)
    .eq("channel", CHANNEL)
    .maybeSingle();

  if (contactError || !contact) {
    return NextResponse.json(
      { error: "Contact not found or not a WhatsApp contact" },
      { status: 404 },
    );
  }

  // Recipient must be the contact's WhatsApp identity (sender from webhook). Never use business numbers.
  const contactPhone = (contact.phone as string | null) ?? "";
  const contactExternalId = (contact.external_id as string | null) ?? "";
  const toNumber = contactExternalId.trim() || contactPhone.trim();

  if (!toNumber) {
    return NextResponse.json(
      { error: "WhatsApp contact has no phone identifier. Replies must go to the customer who sent the message." },
      { status: 400 },
    );
  }

  const businessMobile = (business as any).business_mobile as string | null | undefined;
  const businessMobileDigits = digitsOnly(businessMobile);
  const toDigits = digitsOnly(toNumber);

  if (businessMobileDigits && toDigits && businessMobileDigits === toDigits) {
    console.warn(LOG_PREFIX + " blocked: reply target is business number", {
      business_id: business.id,
      contact_id: contact.id,
      toNumber: toNumber.slice(0, 6) + "…",
    });
    return NextResponse.json(
      { error: "Cannot send WhatsApp reply to the business number. Select the customer conversation to reply to the person who messaged you." },
      { status: 400 },
    );
  }

  const phoneNumberId = (business as any).whatsapp_phone_number_id ?? (business as any).meta_page_id;
  const sourceOfTo = contactExternalId.trim() ? "contact.external_id" : "contact.phone";
  const usingEnvPhoneNumberIdFallback = !phoneNumberId && !!process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const isTestMode =
    process.env.MESSAGE_TEST_MODE === "true" || process.env.NODE_ENV !== "production";

  console.log(LOG_PREFIX + " sending", {
    channel: "whatsapp",
    business_id: business.id,
    contact_id: contact.id,
    to_digits_prefix: toDigits.slice(0, 6) + "…",
    recipient_source: sourceOfTo,
    phone_number_id_used:
      phoneNumberId ?? "(env fallback from META_WHATSAPP_PHONE_NUMBER_ID)",
    is_env_phone_id_fallback: usingEnvPhoneNumberIdFallback,
    is_test_mode: isTestMode,
  });

  try {
    await sendWhatsAppTextMessage({
      to: toNumber,
      text,
      phoneNumberId: phoneNumberId as string | undefined,
      accessToken: (business as any).meta_page_access_token as string | undefined,
      allowEnvFallback: false,
      businessId: business.id as string,
      contactId: contact.id as string,
      recipientSource: sourceOfTo,
      isTestMode,
    });
  } catch (e) {
    if (isBillingOutboundBlockedError(e)) {
      return NextResponse.json({ error: OUTBOUND_BILLING_BLOCKED_MESSAGE }, { status: 402 });
    }
    console.error(LOG_PREFIX + " sendWhatsAppTextMessage error", { error: e, contact_id: contact.id, to_digits_prefix: toDigits.slice(0, 6) + "…" });
    return NextResponse.json(
      { error: "Failed to send WhatsApp message" },
      { status: 502 },
    );
  }

  // Store outbound message so it appears immediately in the inbox thread.
  // Attach to an existing open conversation if possible.
  const convClient = db;
  let conversationId: string | null = null;
  try {
    const conv = await findOrCreateConversation({
      supabase: convClient as any,
      businessId: business.id as string,
      contactId: contact.id as string,
      channel: CHANNEL,
      source: "whatsapp_outbound_inbox_reply",
      initialMessageAt: new Date().toISOString(),
      initialPreview: text,
    });
    conversationId = (conv && (conv as any).id) ?? null;
  } catch (e) {
    console.error(LOG_PREFIX + " conversation find/create error", {
      business_id: business.id,
      contact_id: contact.id,
      error: e,
    });
  }

  // Backwards-compatible insert: some environments may not have
  // `messages.conversation_id` yet.
  let inserted: any = null;
  const {
    data: insertedAttempt,
    error: insertAttemptError,
  } = await db
    .from("messages")
    .insert({
      business_id: business.id,
      contact_id: contact.id,
      channel: CHANNEL,
      direction: "outbound",
      body: text,
      status: "sent",
      conversation_id: conversationId,
    })
    .select("id, body, created_at")
    .single();

  if (insertAttemptError) {
    const errMsg = insertAttemptError.message ?? "";
    const missingConversationId = /conversation_id.*does not exist/i.test(errMsg);

    if (!missingConversationId) {
      console.error(LOG_PREFIX + " insert error:", insertAttemptError?.message);
      return NextResponse.json(
        { error: "WhatsApp message sent but failed to log in inbox" },
        { status: 200 },
      );
    }

    const {
      data: insertedLegacy,
      error: legacyInsertError,
    } = await db
      .from("messages")
      .insert({
        business_id: business.id,
        contact_id: contact.id,
        channel: CHANNEL,
        direction: "outbound",
        body: text,
        status: "sent",
      })
      .select("id, body, created_at")
      .single();

    if (legacyInsertError || !insertedLegacy) {
      console.error(LOG_PREFIX + " legacy insert error:", legacyInsertError?.message);
      return NextResponse.json(
        { error: "WhatsApp message sent but failed to log in inbox" },
        { status: 200 },
      );
    }

    inserted = insertedLegacy;
  } else {
    inserted = insertedAttempt;
  }

  if (conversationId) {
    await touchConversation({
      supabase: convClient as any,
      conversationId,
      lastMessageAt: inserted.created_at as string,
      lastMessagePreview: text,
    });
  }

  return NextResponse.json({
    id: inserted.id,
    direction: "outbound",
    body: inserted.body,
    created_at: inserted.created_at,
  });
}

