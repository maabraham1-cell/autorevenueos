import { type NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUserAndBusiness } from "@/lib/auth";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp";
import { normalizePhone } from "@/lib/phone";

const CHANNEL = "whatsapp";
const LOG_PREFIX = "[inbox/whatsapp/send]";

type ReplyBody = {
  contact_id: string;
  body: string;
};

/** Digits only for comparison (no + or spaces). */
function digitsOnly(s: string | null | undefined): string {
  if (s == null || typeof s !== "string") return "";
  return s.replace(/\D/g, "");
}

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
    .select("id, phone, external_id")
    .eq("id", contactId)
    .eq("business_id", business.id)
    .eq("channel", CHANNEL)
    .maybeSingle();

  if (contactError || !contact) {
    return NextResponse.json(
      { error: "Contact not found or not a WhatsApp contact" },
      { status: 404 },
    );
  }

  // Recipient must be the contact's WhatsApp identity (sender from webhook). Never use business numbers.
  const contactPhone = (contact.phone as string | null) ?? "";
  const contactExternalId = (contact.external_id as string | null) ?? "";
  const toNumber = contactExternalId.trim() || contactPhone.trim();

  if (!toNumber) {
    return NextResponse.json(
      { error: "WhatsApp contact has no phone identifier. Replies must go to the customer who sent the message." },
      { status: 400 },
    );
  }

  const businessMobile = (business as any).business_mobile as string | null | undefined;
  const businessMobileDigits = digitsOnly(businessMobile);
  const toDigits = digitsOnly(toNumber);

  if (businessMobileDigits && toDigits && businessMobileDigits === toDigits) {
    console.warn(LOG_PREFIX + " blocked: reply target is business number", {
      business_id: business.id,
      contact_id: contact.id,
      toNumber: toNumber.slice(0, 6) + "…",
    });
    return NextResponse.json(
      { error: "Cannot send WhatsApp reply to the business number. Select the customer conversation to reply to the person who messaged you." },
      { status: 400 },
    );
  }

  const phoneNumberId = (business as any).whatsapp_phone_number_id ?? (business as any).meta_page_id;
  const sourceOfTo = contactExternalId.trim() ? "contact.external_id" : "contact.phone";
  const usingEnvPhoneNumberIdFallback = !phoneNumberId && !!process.env.META_WHATSAPP_PHONE_NUMBER_ID;

  console.log(LOG_PREFIX + " sending", {
    business_id: business.id,
    contact_id: contact.id,
    to_digits_prefix: toDigits.slice(0, 6) + "…",
    source: sourceOfTo,
    phone_number_id: phoneNumberId ?? "(env fallback from META_WHATSAPP_PHONE_NUMBER_ID)",
    is_env_phone_id_fallback: usingEnvPhoneNumberIdFallback,
  });

  try {
    await sendWhatsAppTextMessage({
      to: toNumber,
      text,
      phoneNumberId: phoneNumberId as string | undefined,
      accessToken: (business as any).meta_page_access_token as string | undefined,
    });
  } catch (e) {
    console.error(LOG_PREFIX + " sendWhatsAppTextMessage error", { error: e, contact_id: contact.id, to_digits_prefix: toDigits.slice(0, 6) + "…" });
    return NextResponse.json(
      { error: "Failed to send WhatsApp message" },
      { status: 502 },
    );
  }

  // Store outbound message so it appears immediately in the inbox thread.
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
    console.error(LOG_PREFIX + " insert error:", insertError?.message);
    // At this point the message was already sent to WhatsApp; we still return 200
    // so the UI does not retry blindly. The history will catch up on next poll.
    return NextResponse.json(
      { error: "WhatsApp message sent but failed to log in inbox" },
      { status: 200 },
    );
  }

  return NextResponse.json({
    id: inserted.id,
    direction: "outbound",
    body: inserted.body,
    created_at: inserted.created_at,
  });
}

