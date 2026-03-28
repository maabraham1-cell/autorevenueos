import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase";
import { handleInboundMessage } from "@/lib/messaging/handle-inbound-message";
import {
  normalizeInstagramPayload,
  normalizeMessengerPayload,
} from "@/lib/messaging/normalize";

const LOG_PREFIX = "[meta/webhook]";

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

function detectChannel(entry: any): "messenger" | "instagram" {
  // Docs: Instagram IG DM webhooks usually set messaging_product="instagram".
  // Messenger ones are typically not "instagram".
  const messagingProduct =
    entry?.messaging_product ??
    entry?.messagingProduct ??
    entry?.messaging_product_type ??
    null;

  if (messagingProduct === "instagram") return "instagram";
  return "messenger";
}

async function resolveBusinessIdForMetaRecipient(params: {
  businessDb: any;
  recipientId: string;
  entryId?: string | null;
  channel: "messenger" | "instagram";
}): Promise<string | null> {
  const { businessDb, recipientId, entryId, channel } = params;
  const candidates = [recipientId, entryId].filter(
    (x): x is string => typeof x === "string" && x.trim().length > 0,
  );

  const fieldsToTry =
    channel === "instagram"
      ? ["instagram_account_id", "meta_page_id"]
      : ["facebook_page_id", "meta_page_id"];

  for (const candidate of candidates) {
    for (const field of fieldsToTry) {
      const { data, error } = await businessDb
        .from("businesses")
        .select("id")
        .eq(field, candidate)
        .limit(1)
        .maybeSingle();

      // If dedicated columns are not in schema yet, Supabase returns a column error.
      // We continue to keep compatibility with existing `meta_page_id` mapping.
      if (error) continue;
      if (data?.id) return String(data.id);
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  const requestId = `meta-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const rawBody = await request.text();
    const appSecret = process.env.META_APP_SECRET;
    const signatureHeader = request.headers.get("x-hub-signature-256");

    if (!appSecret) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 403 },
      );
    }

    if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
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
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 403 });
    }

    const body = rawBody ? JSON.parse(rawBody) : {};
    const entries = Array.isArray((body as any).entry) ? (body as any).entry : [];

    const admin = getSupabaseAdmin();
    if (!admin) {
      // Fail closed: without service-role we might break idempotency/drafts.
      return NextResponse.json({ error: "Supabase admin unavailable" }, { status: 500 });
    }

    for (const entry of entries) {
      const channel = detectChannel(entry);
      const entryId = typeof entry?.id === "string" ? entry.id : null;

      const messaging = Array.isArray(entry?.messaging) ? entry.messaging : [];
      for (const event of messaging) {
        try {
          if (event?.is_echo === true) continue;
          const senderId = event?.sender?.id ? String(event.sender.id) : "";
          const recipientId = event?.recipient?.id ? String(event.recipient.id) : "";

          const message = event?.message ?? null;
          const mid = message?.mid ? String(message.mid) : null;
          const text = typeof message?.text === "string" ? message.text : null;

          if (!senderId || !recipientId || !text) continue;

          const businessId = await resolveBusinessIdForMetaRecipient({
            businessDb: admin,
            recipientId,
            entryId,
            channel,
          });
          if (!businessId) continue;

          const displayName =
            (typeof event?.sender?.name === "string" && event.sender.name) || null;

          const normalized =
            channel === "instagram"
              ? normalizeInstagramPayload({
                  senderId,
                  mid,
                  textBody: text,
                  displayName,
                  metadata: event as Record<string, unknown>,
                })
              : normalizeMessengerPayload({
                  senderId,
                  mid,
                  textBody: text,
                  displayName,
                  metadata: event as Record<string, unknown>,
                });

          await handleInboundMessage({
            businessId,
            channel: normalized.channel,
            externalMessageId: normalized.externalMessageId,
            externalContactId: normalized.externalContactId,
            phone: normalized.phone,
            displayName: normalized.displayName,
            textBody: normalized.textBody,
            metadata: normalized.metadata,
          });
        } catch (e) {
          // Non-blocking: keep iterating other events.
          console.error(`${LOG_PREFIX} event error`, { requestId, error: e });
        }
      }
    }
  } catch (e) {
    console.error(`${LOG_PREFIX} POST unexpected error`, { requestId, error: e });
  }

  // Always return quickly so Meta doesn't retry too aggressively.
  return NextResponse.json({ success: true }, { status: 200 });
}

