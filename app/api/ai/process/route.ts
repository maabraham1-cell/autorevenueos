import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserAndBusiness } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { getSupabaseAdmin } from "@/lib/supabase";
import { handleInboundMessage } from "@/lib/messaging/handle-inbound-message";

const LOG_PREFIX = "[ai/process]";

export async function POST(request: NextRequest) {
  try {
    const { user, business } = await getCurrentUserAndBusiness(request);
    if (!user || !business) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const db = getSupabaseAdmin() ?? supabase;

    const body = (await request.json().catch(() => ({}))) as {
      message?: string;
      conversationId?: string | null;
      contactId?: string | null;
    };

    const message = typeof body.message === "string" ? body.message.trim() : "";
    const conversationId =
      typeof body.conversationId === "string" ? body.conversationId.trim() : null;
    const contactId = typeof body.contactId === "string" ? body.contactId.trim() : null;

    if (!message) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    // Validate scope (business-scoped)
    if (conversationId) {
      const { data: convRow, error: convErr } = await db
        .from("conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("business_id", business.id)
        .maybeSingle();

      if (convErr || !convRow) {
        console.warn(`${LOG_PREFIX} conversation not found in business scope`, {
          businessId: business.id,
          conversationId,
          error: convErr?.message,
        });
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }
    } else if (contactId) {
      const { data: contactRow, error: contactErr } = await db
        .from("contacts")
        .select("id")
        .eq("id", contactId)
        .eq("business_id", business.id)
        .maybeSingle();
      if (contactErr || !contactRow) {
        return NextResponse.json({ error: "Contact not found" }, { status: 404 });
      }
    }

    // Resolve channel + contact identity from conversation/contact when possible,
    // then run the same unified inbound pipeline used by real webhooks.
    let resolvedChannel:
      | "whatsapp"
      | "sms"
      | "messenger"
      | "instagram"
      | "webchat" = "whatsapp";
    let resolvedExternalContactId: string | null = contactId;
    let resolvedPhone: string | null = null;
    let resolvedDisplayName: string | null = null;

    if (conversationId) {
      const { data: convData } = await db
        .from("conversations")
        .select("id, channel, contact_id")
        .eq("id", conversationId)
        .maybeSingle();

      const chRaw = String((convData as any)?.channel ?? "");
      if (chRaw === "website_chat") {
        resolvedChannel = "webchat";
      } else if (
        chRaw === "whatsapp" ||
        chRaw === "sms" ||
        chRaw === "messenger" ||
        chRaw === "instagram"
      ) {
        resolvedChannel = chRaw;
      }

      const resolvedContactId = String((convData as any)?.contact_id ?? contactId ?? "");
      if (resolvedContactId) {
        const { data: c } = await db
          .from("contacts")
          .select("external_id, phone, name")
          .eq("id", resolvedContactId)
          .maybeSingle();
        resolvedExternalContactId = (c as any)?.external_id ?? resolvedExternalContactId;
        resolvedPhone = (c as any)?.phone ?? null;
        resolvedDisplayName = (c as any)?.name ?? null;
      }
    }

    const result = await handleInboundMessage({
      businessId: business.id as string,
      channel: resolvedChannel,
      externalMessageId: null,
      externalContactId: resolvedExternalContactId,
      phone: resolvedPhone,
      displayName: resolvedDisplayName,
      textBody: message,
      metadata: {
        source: "manual_ai_process_endpoint",
        conversationId,
        contactId,
      },
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error(`${LOG_PREFIX} unexpected error`, { error: e });
    return NextResponse.json({ error: "AI processing failed" }, { status: 500 });
  }
}

