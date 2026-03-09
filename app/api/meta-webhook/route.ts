/**
 * Meta (Facebook Messenger / Instagram) webhook.
 * - GET: verification (hub.mode, hub.verify_token, hub.challenge).
 * - POST: incoming events; we log to Supabase, send auto-reply when allowed, and record recovery.
 * Meta replies are subject to platform messaging rules (e.g. 24h window). Real production may need
 * signature verification (X-Hub-Signature-256) and stricter event filtering.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendMetaReply } from "@/lib/meta";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const verifyToken = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  console.log("[meta-webhook] mode:", mode);
  console.log("[meta-webhook] verify_token:", verifyToken);
  console.log("[meta-webhook] env token:", process.env.META_VERIFY_TOKEN);

  if (
    mode === "subscribe" &&
    verifyToken === process.env.META_VERIFY_TOKEN &&
    challenge != null &&
    challenge !== ""
  ) {
    return new NextResponse(challenge, { status: 200 });
  }
  console.warn("[meta-webhook] verification failed", {
    mode,
    verifyToken,
    envToken: process.env.META_VERIFY_TOKEN,
  });
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  // Always return 200 quickly so Meta does not retry; process async and log errors.
  try {
    const body = await request.json();
    const entries = Array.isArray(body.entry) ? body.entry : [];
    for (const entry of entries) {
      const messaging = Array.isArray(entry.messaging) ? entry.messaging : [];
      for (const event of messaging) {
        try {
          await processMessagingEvent(event, entry);
        } catch (e) {
          console.error("[meta-webhook] processMessagingEvent error:", e);
        }
      }
    }
  } catch (e) {
    console.error("[meta-webhook] POST parse/process error:", e);
  }
  return NextResponse.json({ success: true }, { status: 200 });
}

async function processMessagingEvent(
  event: Record<string, unknown>,
  entry: Record<string, unknown>
): Promise<void> {
  const sender = event.sender as { id?: string } | undefined;
  const recipient = event.recipient as { id?: string } | undefined;
  if (!sender?.id) return;

  // Ignore echoes (messages sent by the page itself).
  if (event.is_echo === true) return;

  const message = event.message as { text?: string; mid?: string } | undefined;
  const messageText = typeof message?.text === "string" ? message.text : "";
  // Only process normal text messages.
  if (!message?.text) return;

  const senderId = String(sender.id);
  const recipientId = recipient?.id ? String(recipient.id) : "";
  const timestamp = event.timestamp != null ? Number(event.timestamp) : undefined;
  const webhookSnippet = {
    sender_id: senderId,
    recipient_id: recipientId,
    text: messageText,
    timestamp,
    mid: message.mid,
  };

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (businessError || !business) {
    console.error("[meta-webhook] No business or error:", businessError?.message ?? "No business found");
    return;
  }

  // Create or reuse contact (by business_id + phone/sender id).
  let contact: { id: string } | null = null;
  const { data: existing } = await supabase
    .from("contacts")
    .select("id")
    .eq("business_id", business.id)
    .eq("phone", senderId)
    .maybeSingle();
  if (existing) {
    contact = existing;
  } else {
    const { data: inserted, error: insertContactError } = await supabase
      .from("contacts")
      .insert({
        business_id: business.id,
        phone: senderId,
        name: null,
      })
      .select("id")
      .single();
    if (insertContactError) {
      console.error("[meta-webhook] Contact insert error:", insertContactError.message);
      return;
    }
    contact = inserted;
  }

  const { data: evt, error: eventError } = await supabase
    .from("events")
    .insert({
      business_id: business.id,
      contact_id: contact.id,
      source_channel: "meta",
      event_type: "incoming_message",
      payload: webhookSnippet,
    })
    .select("id")
    .single();

  if (eventError) {
    console.error("[meta-webhook] Event insert error:", eventError.message);
    return;
  }

  const { error: messageError } = await supabase.from("messages").insert({
    business_id: business.id,
    contact_id: contact.id,
    channel: "meta",
    direction: "inbound",
  });
  if (messageError) {
    console.error("[meta-webhook] Message insert error:", messageError.message);
  }

  // Auto-reply (plain text only). Meta replies are subject to platform rules (e.g. 24-hour window).
  // If reply fails (e.g. placeholder META_PAGE_ACCESS_TOKEN), we still return 200 and have already stored inbound data.
  const replyText = `Hi, thanks for your message to ${business.name}. You can book here: ${business.booking_link ?? "https://example.com"}`;
  try {
    await sendMetaReply({ recipientId: senderId, text: replyText });
  } catch (e) {
    console.error("[meta-webhook] sendMetaReply error:", e);
  }

  // MVP recovery: log when customer sends a meaningful message (non-empty text).
  if (messageText.trim().length > 0 && evt?.id) {
    const { error: recoveryError } = await supabase.from("recoveries").insert({
      business_id: business.id,
      contact_id: contact.id,
      event_id: evt.id,
      recovery_type: "meta_message_engagement",
    });
    if (recoveryError) {
      console.error("[meta-webhook] Recovery insert error:", recoveryError.message);
    }
  }
}
