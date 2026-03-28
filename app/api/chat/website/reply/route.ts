import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, supabase } from "@/lib/supabase";
import { getCurrentUserAndBusiness } from "@/lib/auth";
import {
  assertBillingReadyForOutboundWithClient,
  isBillingOutboundBlockedError,
  OUTBOUND_BILLING_BLOCKED_MESSAGE,
} from "@/lib/billing-outbound-gate";

const CHANNEL = "website_chat";

type ReplyBody = {
  contact_id: string;
  body: string;
};

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

  const body = (await request.json().catch(() => null)) as ReplyBody | null;
  const contactId = typeof body?.contact_id === "string" ? body.contact_id.trim() : "";
  const text = typeof body?.body === "string" ? body.body.trim().slice(0, 2000) : "";

  if (!contactId || !text) {
    return NextResponse.json(
      { error: "Missing contact_id or body" },
      { status: 400 },
    );
  }

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .eq("business_id", business.id)
    .eq("channel", CHANNEL)
    .maybeSingle();

  if (contactError || !contact) {
    return NextResponse.json(
      { error: "Contact not found or not a website chat contact" },
      { status: 404 },
    );
  }

  const db = getSupabaseAdmin() ?? supabase;
  try {
    await assertBillingReadyForOutboundWithClient(db, business.id as string, {
      channel: "website_chat",
      source: "chat/website/reply",
    });
  } catch (e) {
    if (isBillingOutboundBlockedError(e)) {
      return NextResponse.json({ error: OUTBOUND_BILLING_BLOCKED_MESSAGE }, { status: 402 });
    }
    throw e;
  }

  const { data: inserted, error: insertError } = await supabase
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

  if (insertError || !inserted) {
    console.error("[website chat reply] insert error:", insertError?.message);
    return NextResponse.json(
      { error: "Failed to send reply" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    id: inserted.id,
    direction: "outbound",
    body: inserted.body,
    created_at: inserted.created_at,
  });
}
