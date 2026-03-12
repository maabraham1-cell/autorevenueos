import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

async function getActiveBusiness() {
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[sms-webhook] business lookup error:", error.message);
    throw new Error("Failed to load business");
  }

  return data;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const params = new URLSearchParams(rawBody);

  const from = params.get("From");
  const to = params.get("To");
  const body = params.get("Body") ?? "";

  if (!from) {
    console.warn("[sms-webhook] missing From in payload");
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      },
    );
  }

  const business = await getActiveBusiness();
  if (!business) {
    console.error("[sms-webhook] no active business configured");
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      },
    );
  }

  const normalizedFrom = from.replace(/\s+/g, "");

  const { data: existingContact, error: contactError } = await supabase
    .from("contacts")
    .select("*")
    .eq("business_id", business.id)
    .eq("phone", normalizedFrom)
    .maybeSingle();

  if (contactError) {
    console.error("[sms-webhook] contact lookup error:", contactError.message);
  }

  let contactId = existingContact?.id as string | undefined;

  if (!contactId) {
    const { data: created, error: createError } = await supabase
      .from("contacts")
      .insert({
        business_id: business.id,
        phone: normalizedFrom,
        name: "SMS lead",
      })
      .select("id")
      .maybeSingle();

    if (createError || !created) {
      console.error(
        "[sms-webhook] failed to create contact:",
        createError?.message,
      );
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          status: 200,
          headers: { "Content-Type": "text/xml" },
        },
      );
    }

    contactId = created.id as string;
  }

  const { error: insertError } = await supabase.from("messages").insert({
    business_id: business.id,
    contact_id: contactId,
    channel: "sms",
    direction: "inbound",
    body,
    status: "received",
  });

  if (insertError) {
    console.error("[sms-webhook] failed to insert message:", insertError.message);
  }

  // Minimal TwiML response with no auto-reply (you can add one later).
  return new NextResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    },
  );
}

