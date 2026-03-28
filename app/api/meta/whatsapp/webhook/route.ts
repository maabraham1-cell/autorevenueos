import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase";
import { supabase as anonSupabase } from "@/lib/supabase";
import { normalizePhone } from "@/lib/phone";
import { handleInboundMessage } from "@/lib/messaging/handle-inbound-message";
import { normalizeWhatsAppPayload } from "@/lib/messaging/normalize";

const WHATSAPP_CHANNEL = "whatsapp";
const LOG_PREFIX = "[whatsapp-webhook]";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const verifyToken = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    verifyToken === process.env.META_VERIFY_TOKEN &&
    challenge != null &&
    challenge !== ""
  ) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const requestId = `wa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const rawBody = await request.text();

    const appSecret = process.env.META_APP_SECRET;
    const signatureHeader = request.headers.get("x-hub-signature-256");

    if (!appSecret) {
      console.error(`${LOG_PREFIX} META_APP_SECRET not set, cannot verify signature`, {
        requestId,
      });
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 403 });
    }

    if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
      console.error(`${LOG_PREFIX} missing or invalid signature header`, { requestId });
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
      console.error(`${LOG_PREFIX} signature verification failed`, { requestId });
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 403 });
    }

    // --- Explicit logging: raw webhook body (truncated) ---
    const bodySnippet =
      typeof rawBody === "string" ? rawBody.slice(0, 500) : String(rawBody).slice(0, 500);
    console.log(`${LOG_PREFIX} POST body snippet`, { requestId, bodyLength: rawBody?.length, bodySnippet });

    try {
      const body = rawBody ? JSON.parse(rawBody) : {};
      const entries = Array.isArray((body as any).entry) ? (body as any).entry : [];

      console.log(`${LOG_PREFIX} parsed entries count`, { requestId, entriesCount: entries.length });

      for (const entry of entries) {
        const changes = Array.isArray((entry as any).changes) ? (entry as any).changes : [];

        for (let i = 0; i < changes.length; i++) {
          const change = changes[i] as any;
          try {
            await processWhatsAppChange(change, entry, requestId, i);
          } catch (e) {
            console.error(`${LOG_PREFIX} processWhatsAppChange error`, {
              requestId,
              changeIndex: i,
              error: e,
            });
          }
        }
      }
    } catch (e) {
      console.error(`${LOG_PREFIX} POST parse/process error`, { requestId, error: e });
    }
  } catch (e) {
    console.error(`${LOG_PREFIX} POST body read error`, { requestId, error: e });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}

async function processWhatsAppChange(
  change: Record<string, unknown>,
  entry: Record<string, unknown>,
  requestId: string,
  changeIndex: number
): Promise<void> {
  const changeField = (change as any).field;
  const value = (change as any).value as any;

  console.log(`${LOG_PREFIX} change`, {
    requestId,
    changeIndex,
    changeField,
    valueKeys: value ? Object.keys(value) : [],
  });

  // Only process message events; status updates etc. use value.statuses, not value.messages
  if (changeField !== "messages") {
    console.log(`${LOG_PREFIX} skip: change.field is not 'messages'`, {
      requestId,
      changeField,
    });
    return;
  }

  if (!value) {
    console.log(`${LOG_PREFIX} skip: no value`, { requestId });
    return;
  }

  const messages = Array.isArray(value.messages) ? value.messages : [];

  if (messages.length === 0) {
    console.log(`${LOG_PREFIX} skip: value.messages empty (e.g. status update)`, {
      requestId,
      valueKeys: Object.keys(value),
    });
    return;
  }

  const metadata = value.metadata as
    | { phone_number_id?: string; display_phone_number?: string }
    | undefined;

  const phoneNumberId = (metadata?.phone_number_id ?? "").toString().trim();
  const displayPhoneRaw = (metadata?.display_phone_number ?? "").toString().trim();
  const displayPhoneNormalized = normalizePhone(displayPhoneRaw) || displayPhoneRaw.replace(/\D/g, "");

  const waMessage = messages[0] as any;
  const from = (waMessage.from ?? "").toString().trim();
  const msgId = (waMessage.id ?? "").toString().trim();
  const textBody =
    typeof waMessage.text?.body === "string" ? (waMessage.text.body as string) : "";

  const contactsArr = Array.isArray((value as any).contacts)
    ? ((value as any).contacts as any[])
    : [];
  const profileNameRaw =
    (contactsArr[0]?.profile?.name && String(contactsArr[0].profile.name).trim()) || "";

  console.log(`${LOG_PREFIX} extracted`, {
    requestId,
    from,
    msgId,
    textBodyLength: textBody.length,
    textBodySnippet: textBody.slice(0, 80),
    phone_number_id: phoneNumberId,
    display_phone_number: displayPhoneRaw,
    display_phone_normalized: displayPhoneNormalized,
  });

  if (!from) {
    console.log(`${LOG_PREFIX} skip: missing from`, { requestId });
    return;
  }

  const fromDigits = from.replace(/\D/g, "");
  const displayDigits = displayPhoneRaw.replace(/\D/g, "");
  if (displayDigits && fromDigits === displayDigits) {
    console.warn(`${LOG_PREFIX} sanity: 'from' equals display_phone_number (business number); contact will still use sender 'from'`, {
      requestId,
      from,
    });
  }
  // Contact identity must always be the message sender (`from`). Never use display_phone_number or any business number for contact.phone / contact.external_id.

  const webhookSnippet = {
    from,
    text: textBody,
    msg_id: msgId || null,
    phone_number_id: phoneNumberId || null,
    display_phone_number: displayPhoneRaw || null,
  };

  const db = getSupabaseAdmin();
  if (!db) {
    console.error(`${LOG_PREFIX} SUPABASE_SERVICE_ROLE_KEY not set; using anon client (RLS may block writes)`, {
      requestId,
    });
  }
  const supabase = db ?? anonSupabase;

  // --- Business resolution: try whatsapp_phone_number_id, then meta_page_id, then display_phone vs business_mobile ---
  let business: any | null = null;
  let businessMatchReason: string | null = null;

  if (phoneNumberId) {
    const byWhatsAppId = await supabase
      .from("businesses")
      .select("id, name, booking_link, ai_auto_send_enabled, whatsapp_phone_number_id, meta_page_id, meta_page_access_token")
      .eq("whatsapp_phone_number_id", phoneNumberId)
      .limit(1)
      .maybeSingle();
    if (byWhatsAppId.error) {
      console.error(`${LOG_PREFIX} business lookup by whatsapp_phone_number_id error`, {
        requestId,
        phoneNumberId,
        error: byWhatsAppId.error,
        errorMessage: byWhatsAppId.error.message,
      });
    } else if (byWhatsAppId.data) {
      business = byWhatsAppId.data;
      businessMatchReason = "whatsapp_phone_number_id";
    }
  }

  if (!business && phoneNumberId) {
    const byMetaPageId = await supabase
      .from("businesses")
      .select("id, name, booking_link, ai_auto_send_enabled, whatsapp_phone_number_id, meta_page_id, meta_page_access_token")
      .eq("meta_page_id", phoneNumberId)
      .limit(1)
      .maybeSingle();
    if (byMetaPageId.error) {
      console.error(`${LOG_PREFIX} business lookup by meta_page_id error`, {
        requestId,
        phoneNumberId,
        error: byMetaPageId.error,
      });
    } else if (byMetaPageId.data) {
      business = byMetaPageId.data;
      businessMatchReason = "meta_page_id";
    }
  }

  if (!business && (displayPhoneNormalized || displayPhoneRaw)) {
    const candidates = [
      displayPhoneNormalized,
      displayPhoneRaw.replace(/\D/g, ""),
      displayPhoneNormalized ? displayPhoneNormalized.replace(/^\+/, "") : "",
    ].filter(Boolean);
    const seen = new Set<string>();
    for (const candidate of candidates) {
      if (!candidate || seen.has(candidate)) continue;
      seen.add(candidate);
      const byMobile = await supabase
        .from("businesses")
        .select("id, name, business_mobile, booking_link, ai_auto_send_enabled, whatsapp_phone_number_id, meta_page_id, meta_page_access_token")
        .eq("business_mobile", candidate)
        .limit(1)
        .maybeSingle();
      if (byMobile.error) {
        console.error(`${LOG_PREFIX} business lookup by business_mobile error`, {
          requestId,
          candidate,
          error: byMobile.error,
        });
        continue;
      }
      if (byMobile.data) {
        business = byMobile.data;
        businessMatchReason = "business_mobile";
        break;
      }
    }
  }

  if (!business) {
    console.warn(`${LOG_PREFIX} no business matched; skipping`, {
      requestId,
      phone_number_id: phoneNumberId,
      display_phone_number: displayPhoneRaw,
      display_phone_normalized: displayPhoneNormalized,
      hint: "Set businesses.whatsapp_phone_number_id or businesses.meta_page_id to the WhatsApp Phone Number ID, or businesses.business_mobile to the display number (E.164).",
    });
    return;
  }

  console.log(`${LOG_PREFIX} business resolved`, {
    requestId,
    businessId: business.id,
    businessName: (business as any).name,
    businessMatchReason,
    phone_number_id: phoneNumberId,
    display_phone_number: displayPhoneRaw,
  });

  // Idempotency: do not store the same WhatsApp message twice
  if (msgId) {
    const { data: existingMessage, error: existingError } = await supabase
      .from("messages")
      .select("id")
      .eq("business_id", business.id)
      .eq("external_id", msgId)
      .maybeSingle();

    if (existingError) {
      console.error(`${LOG_PREFIX} idempotency check error`, {
        requestId,
        msgId,
        error: existingError,
      });
    }
    if (existingMessage) {
      console.log(`${LOG_PREFIX} duplicate message (external_id) ignored`, { requestId, msgId });
      return;
    }
  }

  const normalized = normalizeWhatsAppPayload({
    from,
    messageId: msgId ?? null,
    textBody: textBody ?? null,
    profileName: profileNameRaw ?? null,
    metadata: webhookSnippet as any,
  });

  const result = await handleInboundMessage({
    businessId: business.id as string,
    channel: normalized.channel,
    externalMessageId: normalized.externalMessageId,
    externalContactId: normalized.externalContactId,
    phone: normalized.phone,
    displayName: normalized.displayName,
    textBody: normalized.textBody,
    metadata: normalized.metadata,
  });

  console.log(`${LOG_PREFIX} meta inbound processed`, {
    requestId,
    skipped: result.skipped,
    contactId: result.contactId,
    conversationId: result.conversationId,
    ai: result.ai,
    bookingDraftCreated: result.ai?.action === "create_booking_request_draft",
  });
}
