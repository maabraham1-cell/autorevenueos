import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type WebsiteMessage = {
  id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  created_at: string;
};

const CHANNEL = "website_chat";

async function getActiveBusiness() {
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[website chat] business lookup error:", error.message);
    throw new Error("Failed to load business");
  }

  return data;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const visitorId = searchParams.get("visitorId");

  if (!visitorId) {
    return NextResponse.json(
      { error: "Missing visitorId" },
      { status: 400 },
    );
  }

  const business = await getActiveBusiness();
  if (!business) {
    return NextResponse.json<WebsiteMessage[]>([]);
  }

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id")
    .eq("business_id", business.id)
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

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as PostBody | null;

  if (!body || !body.visitorId || !body.message) {
    return NextResponse.json(
      { error: "Missing visitorId or message" },
      { status: 400 },
    );
  }

  const business = await getActiveBusiness();
  if (!business) {
    return NextResponse.json(
      { error: "No active business configured" },
      { status: 400 },
    );
  }

  const visitorId = body.visitorId;
  const text = body.message.slice(0, 2000);

  // Find or create contact for this visitor
  const { data: existingContact, error: contactLookupError } = await supabase
    .from("contacts")
    .select("id")
    .eq("business_id", business.id)
    .eq("external_id", visitorId)
    .maybeSingle();

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

  return NextResponse.json(shaped, { status: 201 });
}

