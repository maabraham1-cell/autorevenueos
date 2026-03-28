import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserAndBusiness } from "@/lib/auth";
import { getSupabaseAdmin, supabase } from "@/lib/supabase";
import { findOrCreateConversation, touchConversation } from "@/lib/conversations";
import { sendMessage } from "@/lib/messaging/send-message";
import {
  isBillingOutboundBlockedError,
  OUTBOUND_BILLING_BLOCKED_MESSAGE,
} from "@/lib/billing-outbound-gate";

const LOG_PREFIX = "[inbox/meta/send]";

type Body = {
  contact_id: string;
  body: string;
  channel: "messenger" | "instagram";
};

export async function POST(request: NextRequest) {
  try {
    const { user, business } = await getCurrentUserAndBusiness(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (!business) {
      return NextResponse.json({ error: "No business linked to this user" }, { status: 400 });
    }

    const db = getSupabaseAdmin() ?? supabase;

    const body = (await request.json().catch(() => null)) as Body | null;
    const contactId =
      typeof body?.contact_id === "string" ? body.contact_id.trim() : "";
    const text = typeof body?.body === "string" ? body.body.trim().slice(0, 2000) : "";
    const channel = body?.channel;

    if (!contactId || !text || (channel !== "messenger" && channel !== "instagram")) {
      return NextResponse.json({ error: "Missing contact_id/body/channel" }, { status: 400 });
    }

    const { data: contact, error: contactError } = await db
      .from("contacts")
      .select("id, external_id, channel")
      .eq("id", contactId)
      .eq("business_id", business.id)
      .eq("channel", channel)
      .maybeSingle();

    if (contactError || !contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const recipientExternalId = ((contact.external_id as string | null) ?? "").trim();
    if (!recipientExternalId) {
      return NextResponse.json(
        { error: "Contact has no external recipient id for this channel" },
        { status: 400 },
      );
    }

    // Load business sender context. Try dedicated page/account columns first,
    // then gracefully fall back for schemas that don't have them yet.
    let businessRow: Record<string, unknown> | null = null;
    const { data: businessAttempt, error: businessErr } = await db
      .from("businesses")
      .select(
        "id, meta_page_id, meta_page_access_token, facebook_page_id, instagram_account_id",
      )
      .eq("id", business.id)
      .maybeSingle();

    if (!businessErr && businessAttempt) {
      businessRow = businessAttempt as Record<string, unknown>;
    } else {
      const { data: fallbackRow, error: fallbackErr } = await db
        .from("businesses")
        .select("id, meta_page_id, meta_page_access_token")
        .eq("id", business.id)
        .maybeSingle();
      if (fallbackErr || !fallbackRow) {
        return NextResponse.json({ error: "Business not found" }, { status: 500 });
      }
      businessRow = fallbackRow as Record<string, unknown>;
    }

    let sendResult:
      | {
          sent: boolean;
          mode: "live" | "stub";
          providerResponse?: Record<string, unknown> | null;
        }
      | null = null;

    try {
      sendResult = await sendMessage({
        channel,
        to: recipientExternalId,
        text,
        business: businessRow,
        businessId: business.id as string,
        contactId: contact.id as string,
        recipientSource: "external_id",
      });
      console.log(`${LOG_PREFIX} send success`, {
        business_id: business.id,
        contact_id: contact.id,
        channel,
        to_prefix: recipientExternalId.slice(0, 8) + "…",
      });
    } catch (e) {
      if (isBillingOutboundBlockedError(e)) {
        return NextResponse.json({ error: OUTBOUND_BILLING_BLOCKED_MESSAGE }, { status: 402 });
      }
      const errMessage =
        e instanceof Error ? e.message : "Failed to send outbound Meta message";
      console.error(`${LOG_PREFIX} send failed`, {
        business_id: business.id,
        contact_id: contact.id,
        channel,
        to_prefix: recipientExternalId.slice(0, 8) + "…",
        error: errMessage,
      });
      return NextResponse.json({ error: errMessage }, { status: 502 });
    }

    let conversationId: string | null = null;
    const conv = await findOrCreateConversation({
      // Use the server admin client when available.
      supabase: db as any,
      businessId: business.id as string,
      contactId: contact.id as string,
      channel,
      source: `${channel}_outbound_inbox_reply`,
      initialMessageAt: new Date().toISOString(),
      initialPreview: text,
    });
    conversationId = (conv && (conv as any).id) ?? null;

    const deliveryMeta = {
      provider: "meta",
      channel,
      mode: sendResult?.mode ?? "live",
      recipient_external_id_prefix: recipientExternalId.slice(0, 8) + "…",
      provider_response: sendResult?.providerResponse ?? null,
      sent_at: new Date().toISOString(),
    };

    let inserted: any = null;
    const {
      data: insertedAttempt,
      error: insertAttemptError,
    } = await db
      .from("messages")
      .insert({
        business_id: business.id,
        contact_id: contact.id,
        channel,
        direction: "outbound",
        body: text,
        status: "sent",
        conversation_id: conversationId,
        metadata: deliveryMeta,
      })
      .select("id, body, created_at")
      .single();

    if (insertAttemptError) {
      const errMsg = insertAttemptError.message ?? "";
      const missingConversationId = /conversation_id.*does not exist/i.test(errMsg);
      const missingMetadata = /metadata.*does not exist/i.test(errMsg);
      if (!missingConversationId && !missingMetadata) {
        console.error(`${LOG_PREFIX} message log insert failed`, {
          business_id: business.id,
          contact_id: contact.id,
          channel,
          error: insertAttemptError.message,
        });
        return NextResponse.json(
          { error: "Failed to log outbound message" },
          { status: 500 },
        );
      }

      const { data: insertedLegacy } = await db
        .from("messages")
        .insert({
          business_id: business.id,
          contact_id: contact.id,
          channel,
          direction: "outbound",
          body: text,
          status: "sent",
          ...(missingConversationId ? {} : { conversation_id: conversationId }),
        })
        .select("id, body, created_at")
        .single();

      inserted = insertedLegacy ?? null;
    } else {
      inserted = insertedAttempt ?? null;
    }

    if (!inserted?.created_at) {
      return NextResponse.json({ error: "Failed to log outbound message" }, { status: 500 });
    }

    if (conversationId) {
      await touchConversation({
        supabase: db as any,
        conversationId,
        lastMessageAt: inserted.created_at as string,
        lastMessagePreview: text,
      });
    }

    return NextResponse.json({
      success: true,
      id: inserted.id,
      direction: "outbound",
      body: inserted.body,
      created_at: inserted.created_at,
    });
  } catch (e) {
    console.error(`${LOG_PREFIX} unexpected error`, { error: e });
    return NextResponse.json({ error: "Failed to send reply" }, { status: 500 });
  }
}

