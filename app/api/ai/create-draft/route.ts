import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserAndBusiness } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getAIState, upsertBookingDraft } from "@/lib/ai/state";

const LOG_PREFIX = "[ai/create-draft]";

export async function POST(request: NextRequest) {
  try {
    const { user, business } = await getCurrentUserAndBusiness(request);
    if (!user || !business) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      conversationId?: string | null;
    };

    const conversationId =
      typeof body.conversationId === "string" ? body.conversationId.trim() : null;

    if (!conversationId) {
      return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Supabase admin unavailable" }, { status: 500 });
    }

    const { data: conv, error: convErr } = await admin
      .from("conversations")
      .select("id, contact_id, channel")
      .eq("id", conversationId)
      .eq("business_id", business.id)
      .maybeSingle();

    if (convErr || !conv) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const ai = await getAIState(conversationId);
    if (!ai) {
      return NextResponse.json({ error: "No AI state found for conversation" }, { status: 404 });
    }

    // Only create drafts for booking requests.
    if (ai.intent !== "booking_request") {
      return NextResponse.json({ error: "AI intent is not booking_request" }, { status: 400 });
    }

    const entities = ai.entities ?? {
      service: ai.service ?? null,
      preferred_day: ai.preferred_day ?? null,
      preferred_time: ai.preferred_time ?? null,
    };

    await upsertBookingDraft(conversationId, {
      business_id: business.id,
      contact_id: conv.contact_id,
      conversation_id: conv.id,
      source_channel: conv.channel,
      service: entities.service ?? null,
      preferred_day: entities.preferred_day ?? null,
      preferred_time: entities.preferred_time ?? null,
      notes: null,
      status: "draft",
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(`${LOG_PREFIX} unexpected error`, { error: e });
    return NextResponse.json({ error: "Failed to create draft" }, { status: 500 });
  }
}

