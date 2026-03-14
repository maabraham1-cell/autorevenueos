import { type NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUserAndBusiness } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { sendEmail } from "@/lib/email";

type WebsiteMessage = {
  id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  created_at: string;
};

const CHANNEL = "website_chat";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const visitorId = searchParams.get("visitorId");

  if (!visitorId || visitorId.length > 200) {
    return NextResponse.json(
      { error: "Invalid or missing visitorId" },
      { status: 400 },
    );
  }

  let { user, business } = await getCurrentUserAndBusiness(request);
  if (!business && process.env.NEXT_PUBLIC_WEBSITE_CHAT_BUSINESS_ID) {
    const { data: fallback } = await supabase
      .from("businesses")
      .select("id")
      .eq("id", process.env.NEXT_PUBLIC_WEBSITE_CHAT_BUSINESS_ID)
      .maybeSingle();
    if (fallback) business = fallback as any;
  }

  if (!business) {
    return NextResponse.json<WebsiteMessage[]>([], { status: 200 });
  }

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id")
    .eq("business_id", business.id)
    .eq("channel", CHANNEL)
    .eq("external_id", visitorId)
    .maybeSingle();

  if (contactError) {
    console.error("[website chat] contact lookup error:", contactError.message);
    return NextResponse.json(
      { error: "Failed to load messages" },
      { status: 500 },
    );
  }

  if (!contact) {
    return NextResponse.json<WebsiteMessage[]>([]);
  }

  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select("*")
    .eq("business_id", business.id)
    .eq("contact_id", contact.id)
    .eq("channel", CHANNEL)
    .order("created_at", { ascending: true });

  if (messagesError) {
    console.error("[website chat] messages lookup error:", messagesError.message);
    return NextResponse.json(
      { error: "Failed to load messages" },
      { status: 500 },
    );
  }

  const shaped: WebsiteMessage[] =
    (messages ?? []).map((row: any) => ({
      id: String(row.id),
      direction: (row.direction as "inbound" | "outbound") ?? "inbound",
      body: (row.body as string | null) ?? null,
      created_at: row.created_at as string,
    })) ?? [];

  return NextResponse.json(shaped);
}

type PostBody = {
  visitorId: string;
  message: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as PostBody | null;

  const visitorIdRaw = body?.visitorId ?? "";
  const messageRaw = body?.message ?? "";

  const visitorId = typeof visitorIdRaw === "string" ? visitorIdRaw.trim() : "";
  const message = typeof messageRaw === "string" ? messageRaw.trim() : "";

  if (!visitorId || visitorId.length > 200 || !message) {
    return NextResponse.json(
      { error: "Missing or invalid visitorId or message" },
      { status: 400 },
    );
  }

  // Lightweight per-visitor rate limit to reduce abuse.
  const key = `website-chat:${visitorId}`;
  const allowed = checkRateLimit(key, { limit: 20, windowMs: 60_000 });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many messages, please slow down." },
      { status: 429 },
    );
  }

  let { user, business } = await getCurrentUserAndBusiness(request);
  if (!business && process.env.NEXT_PUBLIC_WEBSITE_CHAT_BUSINESS_ID) {
    const { data: fallback } = await supabase
      .from("businesses")
      .select("id")
      .eq("id", process.env.NEXT_PUBLIC_WEBSITE_CHAT_BUSINESS_ID)
      .maybeSingle();
    if (fallback) business = fallback as any;
  }

  if (!business) {
    return NextResponse.json(
      { error: "Chat is not configured. Please try again later." },
      { status: 503 },
    );
  }

  const text = message.slice(0, 2000);

  // Find or create contact for this visitor
  let existingContact: { id: string } | null = null;
  const { data: byChannelExternalId, error: contactLookupError } = await supabase
    .from("contacts")
    .select("id")
    .eq("business_id", business.id)
    .eq("channel", CHANNEL)
    .eq("external_id", visitorId)
    .maybeSingle();
  existingContact = byChannelExternalId;
  if (!existingContact) {
    const { data: byExternalIdOnly } = await supabase
      .from("contacts")
      .select("id")
      .eq("business_id", business.id)
      .eq("external_id", visitorId)
      .maybeSingle();
    existingContact = byExternalIdOnly;
  }

  if (contactLookupError) {
    console.error(
      "[website chat] contact lookup (POST) error:",
      contactLookupError.message,
    );
    return NextResponse.json(
      { error: "Failed to create message" },
      { status: 500 },
    );
  }

  let contactId = existingContact?.id as string | undefined;

  if (!contactId) {
    const { data: newContact, error: createError } = await supabase
      .from("contacts")
      .insert({
        business_id: business.id,
        channel: CHANNEL,
        external_id: visitorId,
        name: "Website visitor",
      })
      .select("id")
      .maybeSingle();

    if (createError || !newContact) {
      console.error(
        "[website chat] contact create error:",
        createError?.message,
      );
      return NextResponse.json(
        { error: "Failed to create contact" },
        { status: 500 },
      );
    }

    contactId = newContact.id as string;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("messages")
      .insert({
        business_id: business.id,
        contact_id: contactId,
        channel: CHANNEL,
        direction: "inbound",
        body: text,
        status: "received",
      })
    .select("*")
    .maybeSingle();

  if (insertError || !inserted) {
    console.error("[website chat] insert message error:", insertError?.message);
    return NextResponse.json(
      { error: "Failed to store message" },
      { status: 500 },
    );
  }

  const shaped: WebsiteMessage = {
    id: String(inserted.id),
    direction: "inbound",
    body: (inserted.body as string | null) ?? null,
    created_at: inserted.created_at as string,
  };

  // Notify admin when website chat hits the inbox (profile_admin notification).
  const notifyTo = process.env.WEBSITE_CHAT_NOTIFY_EMAIL ?? "hello@autorevenue.com";
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://www.autorevenueos.com");
  const inboxUrl = `${baseUrl}/inbox`;
  const preview = text.slice(0, 200) + (text.length > 200 ? "…" : "");
  await sendEmail({
    to: notifyTo,
    subject: `[AutoRevenueOS] New website chat message`,
    html: `
      <p>A visitor used the website chat and their message is in the Inbox.</p>
      <p><strong>Message preview:</strong></p>
      <p>${escapeHtml(preview)}</p>
      <p><a href="${inboxUrl}">Open Inbox</a></p>
      <p style="color:#64748b;font-size:12px;">AutoRevenueOS website chat</p>
    `.trim(),
  }).catch((e) => console.error("[website chat] notify email error:", e));

  return NextResponse.json(shaped, { status: 201 });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

