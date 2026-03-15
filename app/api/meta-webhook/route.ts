/**
 * Meta (Facebook Messenger / Instagram) webhook.
 * - GET: verification (hub.mode, hub.verify_token, hub.challenge).
 * - POST: incoming events; we log to Supabase, send auto-reply when allowed, and record recovery.
 * Meta replies are subject to platform messaging rules (e.g. 24h window).
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendMetaReply } from "@/lib/meta";
import crypto from "crypto";

const META_CHANNEL = "meta";

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
  const requestId = `meta-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  console.log("[meta-webhook] POST received", { requestId, at: new Date().toISOString() });

  // Verify Meta signature if META_APP_SECRET is configured.
  // This guards against spoofed webhook POSTs.
  try {
    const rawBody = await request.text();

    const appSecret = process.env.META_APP_SECRET;
    const signatureHeader = request.headers.get("x-hub-signature-256");

    if (!appSecret) {
      console.error("[meta-webhook] META_APP_SECRET not set, cannot verify signature", {
        requestId,
      });
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 403 });
    }

    if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
      console.error("[meta-webhook] missing or invalid signature header", { requestId });
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 403 });
    }

    const expected = crypto
      .createHmac("sha256", appSecret)
      .update(rawBody)
      .digest("hex");
    const expectedSig = `sha256=${expected}`;

    const providedBuf = Buffer.from(signatureHeader);
    const expectedBuf = Buffer.from(expectedSig);

    if (
      providedBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(providedBuf, expectedBuf)
    ) {
      console.error("[meta-webhook] signature verification failed", { requestId });
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 403 });
    }

    console.log("[meta-webhook] signature verified", { requestId });

    // After verification, process the payload as JSON.
    // Always return 200 quickly so Meta does not retry; process async and log errors.
    try {
      const body = rawBody ? JSON.parse(rawBody) : {};
      const entries = Array.isArray((body as any).entry) ? (body as any).entry : [];
      for (const entry of entries) {
        const messaging = Array.isArray((entry as any).messaging) ? (entry as any).messaging : [];
        for (const event of messaging) {
          try {
            await processMessagingEvent(event, entry, requestId);
          } catch (e) {
            console.error("[meta-webhook] processMessagingEvent error:", { requestId, error: e });
          }
        }
      }
    } catch (e) {
      console.error("[meta-webhook] POST parse/process error:", { requestId, error: e });
    }
  } catch (e) {
    console.error("[meta-webhook] POST body read error:", { requestId, error: e });
  }
  return NextResponse.json({ success: true }, { status: 200 });
}

async function processMessagingEvent(
  event: Record<string, unknown>,
  entry: Record<string, unknown>,
  requestId: string
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
  console.log("[meta-webhook] incomingPageId", { requestId, raw: pageId, type: typeof pageId });
  const normalizedPageId = String(pageId ?? "").trim();
  console.log("[meta-webhook] incomingPageId normalized", { requestId, normalizedPageId });

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
      console.error("[meta-webhook] Business lookup by meta_page_id failed:", {
        requestId,
        pageId: normalizedPageId,
        error: byPageError.message,
      });
    } else if (byPage) {
      business = byPage;
      console.log("[meta-webhook] matched business", {
        requestId,
        name: business.name,
        meta_page_id: (business as any).meta_page_id,
      });
    } else {
      console.log("[meta-webhook] no business matched normalizedPageId", { requestId });
    }
  }

  if (!business) {
    console.warn("[meta-webhook] no business matched meta_page_id, skipping reply", {
      requestId,
      pageId: normalizedPageId,
    });
    return;
  }

  const messageMid = typeof message?.mid === "string" ? message.mid.trim() : null;
  if (messageMid) {
    const { data: existingMessage } = await supabase
      .from("messages")
      .select("id")
      .eq("business_id", business.id)
      .eq("external_id", messageMid)
      .maybeSingle();
    if (existingMessage) {
      console.log("[meta-webhook] duplicate message (mid) ignored", { requestId, mid: messageMid });
      return;
    }
  }

  let contact: { id: string } | null = null;
  const { data: existingByExternalId } = await supabase
    .from("contacts")
    .select("id")
    .eq("business_id", business.id)
    .eq("channel", META_CHANNEL)
    .eq("external_id", senderId)
    .maybeSingle();
  if (existingByExternalId) {
    contact = existingByExternalId;
  } else {
    const { data: existingByPhone } = await supabase
      .from("contacts")
      .select("id")
      .eq("business_id", business.id)
      .eq("phone", senderId)
      .maybeSingle();
    if (existingByPhone) {
      contact = existingByPhone;
    }
  }
  if (!contact) {
    const { data: inserted, error: insertContactError } = await supabase
      .from("contacts")
      .insert({
        business_id: business.id,
        channel: META_CHANNEL,
        external_id: senderId,
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
      source_channel: META_CHANNEL,
      event_type: "incoming_message",
      payload: webhookSnippet,
    })
    .select("id")
    .single();

  if (eventError) {
    console.error("[meta-webhook] Event insert error:", { requestId, error: eventError.message });
    return;
  }

  const { error: messageError } = await supabase.from("messages").insert({
    business_id: business.id,
    contact_id: contact.id,
    channel: META_CHANNEL,
    direction: "inbound",
    body: messageText,
    external_id: messageMid,
  });
  if (messageError) {
    console.error("[meta-webhook] Message insert error:", { requestId, error: messageError.message });
  } else {
    console.log("[meta-webhook] logged inbound message", {
      requestId,
      businessId: business.id,
      contactId: contact.id,
      channel: META_CHANNEL,
      direction: "inbound",
    });
  }

  // Check whether an outbound auto-reply already existed BEFORE this inbound message.
  const { data: priorOutbound, error: priorOutboundError } = await supabase
    .from("messages")
    .select("id")
    .eq("business_id", business.id)
    .eq("contact_id", contact.id)
    .eq("channel", META_CHANNEL)
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
    .eq("channel", META_CHANNEL)
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
    console.error("[meta-webhook] Existing recovery lookup error:", {
      requestId,
      error: existingRecoveryError.message,
    });
  }

  console.log("[meta-webhook] recovery evaluation state", {
    requestId,
    hadPriorOutgoingReply,
    inboundCount: inboundCount ?? null,
    hasExistingRecovery: !!existingRecovery,
    hasText: messageText.trim().length > 0,
  });

  // Auto-reply (plain text only). Meta replies are subject to platform rules (e.g. 24-hour window).
  // First inbound message triggers an auto-reply only; later inbound messages after an outbound reply
  // are treated as a recovered lead (see recovery logic below).
  // If reply fails (e.g. placeholder META_PAGE_ACCESS_TOKEN), we still return 200 and have already stored inbound data.
  const businessName: string =
    typeof business.name === "string" && business.name.trim().length > 0
      ? business.name.trim()
      : "your business";
  const bookingLinkValue =
    typeof business.booking_link === "string" && business.booking_link.trim().length > 0
      ? business.booking_link.trim()
      : "https://example.com";

  const defaultTemplate =
    "Hi, thanks for messaging {business_name}. You can book here: {booking_link}";

  const storedTemplate =
    typeof (business as any).auto_reply_template === "string" &&
    (business as any).auto_reply_template.trim().length > 0
      ? (business as any).auto_reply_template.trim()
      : null;

  const templateToUse = storedTemplate ?? defaultTemplate;

  const replyText = templateToUse
    .replace(/{business_name}/g, businessName)
    .replace(/{booking_link}/g, bookingLinkValue);
  const pageToken = (business as { meta_page_access_token?: string | null }).meta_page_access_token ?? null;
  try {
    await sendMetaReply({ recipientId: senderId, text: replyText, pageAccessToken: pageToken });
    // Log the outbound auto-reply in messages so we can detect future re-engagement.
    const { error: outboundMessageError } = await supabase.from("messages").insert({
      business_id: business.id,
      contact_id: contact.id,
      channel: META_CHANNEL,
      direction: "outbound",
      body: replyText,
    });
    if (outboundMessageError) {
      console.error("[meta-webhook] Outbound message insert error:", {
        requestId,
        error: outboundMessageError.message,
      });
    } else {
      console.log("[meta-webhook] outbound auto-reply logged", { requestId });
    }
  } catch (e) {
    console.error("[meta-webhook] sendMetaReply error:", { requestId, error: e });
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
      console.error("[meta-webhook] Recovery insert error:", { requestId, error: recoveryError.message });
    } else {
      console.log("[meta-webhook] recovery created for meta engagement", { requestId });
    }
  } else {
    console.log("[meta-webhook] recovery not created (conditions not met)", { requestId });
  }
}
