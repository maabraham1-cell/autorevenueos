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
  console.log("META WEBHOOK HIT");
  console.log("META WEBHOOK HIT", new Date().toISOString());
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

  // Derive the Meta page / account id for routing. For Messenger page webhooks this is typically the recipient id.
  const pageId =
    recipientId ||
    (typeof (entry as { id?: unknown }).id === "string"
      ? ((entry as { id?: string }).id as string)
      : "");
  console.log("incomingPageId raw:", pageId);
  console.log("incomingPageId type:", typeof pageId);
  const normalizedPageId = String(pageId ?? "").trim();
  console.log("incomingPageId normalized:", normalizedPageId);

  // Prefer routing by pageId (Meta page / IG account) for multi-business support.
  // This requires a businesses.meta_page_id column to exist and be populated.
  // For MVP testing we fall back to the first business when no meta_page_id match is found.
  let business: any | null = null;

  if (normalizedPageId) {
    const { data: byPage, error: byPageError } = await supabase
      .from("businesses")
      .select("*")
      .eq("meta_page_id", normalizedPageId)
      .limit(1)
      .maybeSingle();

    if (byPageError) {
      console.error("[meta-webhook] Business lookup by meta_page_id failed:", byPageError.message, {
        pageId: normalizedPageId,
      });
    } else if (byPage) {
      business = byPage;
      console.log("matched business:", business.name, (business as any).meta_page_id);
      console.log("matched business row:", business);
    } else {
      console.log("no business matched normalizedPageId");
    }
  }

  if (!business) {
    console.warn("[meta-webhook] no business matched meta_page_id, skipping reply", {
      pageId: normalizedPageId,
    });
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

  // Log the current inbound message.
  const { error: messageError } = await supabase.from("messages").insert({
    business_id: business.id,
    contact_id: contact.id,
    channel: "meta",
    direction: "inbound",
  });
  if (messageError) {
    console.error("[meta-webhook] Message insert error:", messageError.message);
  } else {
    console.log("[meta-webhook] logged inbound message", {
      businessId: business.id,
      contactId: contact.id,
      channel: "meta",
      direction: "inbound",
    });
  }

  // Check whether an outbound auto-reply already existed BEFORE this inbound message.
  const { data: priorOutbound, error: priorOutboundError } = await supabase
    .from("messages")
    .select("id")
    .eq("business_id", business.id)
    .eq("contact_id", contact.id)
    .eq("channel", "meta")
    .eq("direction", "outbound")
    .limit(1)
    .maybeSingle();
  const hadPriorOutgoingReply = !!priorOutbound;
  if (priorOutboundError) {
    console.error("[meta-webhook] priorOutbound lookup error:", priorOutboundError.message);
  }

  // Count inbound messages AFTER logging this one. First inbound (count === 1) should NOT create a recovery.
  const { count: inboundCount, error: inboundCountError } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("business_id", business.id)
    .eq("contact_id", contact.id)
    .eq("channel", "meta")
    .eq("direction", "inbound");
  if (inboundCountError) {
    console.error("[meta-webhook] inboundCount lookup error:", inboundCountError.message);
  }

  const { data: existingRecovery, error: existingRecoveryError } = await supabase
    .from("recoveries")
    .select("id")
    .eq("business_id", business.id)
    .eq("contact_id", contact.id)
    .limit(1)
    .maybeSingle();
  if (existingRecoveryError) {
    console.error("[meta-webhook] Existing recovery lookup error:", existingRecoveryError.message);
  }

  console.log("hadPriorOutgoingReply:", hadPriorOutgoingReply);
  console.log("inboundCount:", inboundCount ?? null);
  console.log("existingRecovery:", existingRecovery ?? null);

  // Auto-reply (plain text only). Meta replies are subject to platform rules (e.g. 24-hour window).
  // First inbound message triggers an auto-reply only; later inbound messages after an outbound reply
  // are treated as a recovered lead (see recovery logic below).
  // If reply fails (e.g. placeholder META_PAGE_ACCESS_TOKEN), we still return 200 and have already stored inbound data.
  const replyText = `Hi, thanks for messaging ${business.name}. You can book here: ${
    business.booking_link ?? "https://example.com"
  }`;
  try {
    await sendMetaReply({ recipientId: senderId, text: replyText });
    // Log the outbound auto-reply in messages so we can detect future re-engagement.
    const { error: outboundMessageError } = await supabase.from("messages").insert({
      business_id: business.id,
      contact_id: contact.id,
      channel: "meta",
      direction: "outbound",
      body: replyText,
    });
    if (outboundMessageError) {
      console.error("[meta-webhook] Outbound message insert error:", outboundMessageError.message);
    }
  } catch (e) {
    console.error("[meta-webhook] sendMetaReply error:", e);
  }

  // Recovery: only when the customer meaningfully re-engages AFTER we have already sent an auto-reply.
  // Recovery is only counted when a customer sends a second message, which indicates re-engagement
  // after the auto-reply. First message = auto-reply only; second or later inbound + no existing
  // recovery = recovered lead.
  if (
    messageText.trim().length > 0 &&
    evt?.id &&
    hadPriorOutgoingReply &&
    (inboundCount ?? 0) >= 2 &&
    !existingRecovery
  ) {
    const { error: recoveryError } = await supabase.from("recoveries").insert({
      business_id: business.id,
      contact_id: contact.id,
      event_id: evt.id,
      recovery_type: "meta_message_engagement",
    });
    if (recoveryError) {
      console.error("[meta-webhook] Recovery insert error:", recoveryError.message);
    } else {
      console.log("[meta-webhook] recovery created for meta engagement");
    }
  } else {
    console.log("[meta-webhook] recovery not created (conditions not met)");
  }
}
