import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserAndBusiness } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  assertBillingReadyForOutboundWithClient,
  isBillingOutboundBlockedError,
  OUTBOUND_BILLING_BLOCKED_MESSAGE,
} from "@/lib/billing-outbound-gate";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp";
import { touchConversation } from "@/lib/conversations";
import { getAIState, updateAIState } from "@/lib/ai/state";
import { isSafeAutoSendCandidate } from "@/lib/ai/safety";

const LOG_PREFIX = "[ai/send-reply]";

type Body = {
  conversationId?: string | null;
  contactId?: string | null;
  mode?: "manual" | "auto";
};

function toDigits(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

export async function POST(request: NextRequest) {
  try {
    const { user, business } = await getCurrentUserAndBusiness(request);
    if (!user || !business) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    const conversationId =
      typeof body.conversationId === "string" ? body.conversationId.trim() : null;
    const mode = body.mode === "auto" ? "auto" : "manual";

    if (!conversationId) {
      return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Supabase admin unavailable" }, { status: 500 });
    }

    const { data: conv, error: convErr } = await admin
      .from("conversations")
      .select("id, business_id, contact_id, channel")
      .eq("id", conversationId)
      .maybeSingle();

    if (convErr || !conv || conv.business_id !== business.id) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const ai = await getAIState(conversationId);
    if (!ai || !ai.reply || !ai.action) {
      return NextResponse.json({ error: "No AI reply available" }, { status: 404 });
    }

    // Only allow bounded safe actions.
    if (ai.action !== "ask_followup" && ai.action !== "send_booking_link") {
      return NextResponse.json({ error: "AI action not allowed for sending" }, { status: 400 });
    }

    // If auto mode: require business flag + confidence threshold via safety checks.
    if (mode === "auto") {
      const autoEnabled = (business as any).ai_auto_send_enabled === true || (business as any).ai_auto_send_enabled === "true";
      if (!autoEnabled) {
        return NextResponse.json({ error: "AI auto-send disabled" }, { status: 403 });
      }
      if (
        !isSafeAutoSendCandidate({
          action: ai.action,
          confidence: ai.confidence ?? 0,
          reply: ai.reply,
        })
      ) {
        return NextResponse.json({ error: "AI reply not safe to auto-send" }, { status: 403 });
      }
    }

    try {
      await assertBillingReadyForOutboundWithClient(admin, business.id as string, {
        source: "ai/send-reply",
        mode,
      });
    } catch (e) {
      if (isBillingOutboundBlockedError(e)) {
        return NextResponse.json({ error: OUTBOUND_BILLING_BLOCKED_MESSAGE }, { status: 402 });
      }
      throw e;
    }

    const reply = ai.last_ai_reply ?? ai.reply;

    // Send by channel.
    const channel = conv.channel as string;
    if (channel === "whatsapp") {
      const { data: contactRow, error: contactErr } = await admin
        .from("contacts")
        .select("id, phone, external_id, channel")
        .eq("id", conv.contact_id)
        .eq("business_id", business.id)
        .maybeSingle();

      if (contactErr || !contactRow) {
        return NextResponse.json({ error: "Contact not found" }, { status: 404 });
      }

      if (contactRow.channel !== "whatsapp") {
        return NextResponse.json({ error: "Not a WhatsApp contact" }, { status: 400 });
      }

      const toRaw = (contactRow.external_id as string | null) ?? (contactRow.phone as string | null) ?? null;
      const toDigitsValue = toDigits(toRaw);
      if (!toDigitsValue) {
        return NextResponse.json({ error: "Contact has no phone identifier" }, { status: 400 });
      }

      // Block sending to the business number if we can detect it.
      const businessMobileDigits = toDigits((business as any).business_mobile as string | null | undefined);
      if (businessMobileDigits && businessMobileDigits === toDigitsValue) {
        return NextResponse.json({ error: "Refusing to send to business number" }, { status: 400 });
      }

      const phoneNumberId =
        (business as any).whatsapp_phone_number_id ?? (business as any).meta_page_id;
      const accessToken = (business as any).meta_page_access_token;

      await sendWhatsAppTextMessage({
        to: toDigitsValue,
        text: reply,
        phoneNumberId: phoneNumberId as string | undefined,
        accessToken: accessToken as string | undefined,
        allowEnvFallback: false,
        businessId: business.id as string,
        contactId: conv.contact_id as string,
        recipientSource: (contactRow.external_id ? "contact.external_id" : "contact.phone"),
      });

      const { data: inserted, error: insertErr } = await admin
        .from("messages")
        .insert({
          business_id: business.id,
          contact_id: conv.contact_id,
          channel: "whatsapp",
          direction: "outbound",
          body: reply,
          status: "sent",
          conversation_id: conversationId,
        })
        .select("id, body, created_at")
        .single();

      if (insertErr || !inserted) {
        return NextResponse.json({ error: "Failed to log outbound message" }, { status: 500 });
      }

      await touchConversation({
        supabase: admin,
        conversationId,
        lastMessageAt: inserted.created_at as string,
        lastMessagePreview: reply,
      });

      await updateAIState(conversationId, {
        booking_link_sent: ai.action === "send_booking_link",
        last_ai_reply: reply,
      });

      return NextResponse.json({ success: true, message_id: inserted.id });
    }

    if (channel === "website_chat") {
      const { data: contactRow, error: contactErr } = await admin
        .from("contacts")
        .select("id")
        .eq("id", conv.contact_id)
        .eq("business_id", business.id)
        .eq("channel", "website_chat")
        .maybeSingle();
      if (contactErr || !contactRow) {
        return NextResponse.json({ error: "Contact not found" }, { status: 404 });
      }

      const { data: inserted, error: insertErr } = await admin
        .from("messages")
        .insert({
          business_id: business.id,
          contact_id: contactRow.id,
          channel: "website_chat",
          direction: "outbound",
          body: reply,
          status: "sent",
        })
        .select("id, body, created_at")
        .single();

      if (insertErr || !inserted) {
        return NextResponse.json({ error: "Failed to log outbound message" }, { status: 500 });
      }

      await updateAIState(conversationId, {
        booking_link_sent: false,
        last_ai_reply: reply,
      });

      return NextResponse.json({ success: true, message_id: inserted.id });
    }

    return NextResponse.json({ error: "Channel not supported for AI sends" }, { status: 400 });
  } catch (e) {
    if (isBillingOutboundBlockedError(e)) {
      return NextResponse.json({ error: OUTBOUND_BILLING_BLOCKED_MESSAGE }, { status: 402 });
    }
    console.error(`${LOG_PREFIX} unexpected error`, { error: e });
    return NextResponse.json({ error: "Failed to send AI reply" }, { status: 500 });
  }
}

