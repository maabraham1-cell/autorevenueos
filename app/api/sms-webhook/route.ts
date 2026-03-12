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
  let finalStatus = 500;
  console.log("[sms-webhook] route hit");

  try {
    const rawBody = await request.text();
    console.log("[sms-webhook] raw body:", rawBody);

    const params = new URLSearchParams(rawBody);

    const from = params.get("From");
    const to = params.get("To");
    const body = params.get("Body") ?? "";

    console.log("[sms-webhook] parsed payload:", {
      From: from,
      To: to,
      Body: body,
    });

    if (!from) {
      console.error("[sms-webhook] missing From in payload");
      finalStatus = 500;
      console.log("[sms-webhook] responding with status", finalStatus);
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          status: finalStatus,
          headers: { "Content-Type": "text/xml" },
        },
      );
    }

    const business = await getActiveBusiness();
    console.log("[sms-webhook] business lookup result:", business?.id ?? null);

    if (!business) {
      console.error("[sms-webhook] no active business configured");
      finalStatus = 500;
      console.log("[sms-webhook] responding with status", finalStatus);
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          status: finalStatus,
          headers: { "Content-Type": "text/xml" },
        },
      );
    }

    const normalizedFrom = from.replace(/\s+/g, "");

    const {
      data: existingContact,
      error: contactError,
    } = await supabase
      .from("contacts")
      .select("*")
      .eq("business_id", business.id)
      .eq("phone", normalizedFrom)
      .maybeSingle();

    if (contactError) {
      console.error(
        "[sms-webhook] contact lookup error:",
        contactError.message,
      );
    } else {
      console.log("[sms-webhook] contact lookup result:", existingContact?.id);
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
        finalStatus = 500;
        console.log("[sms-webhook] responding with status", finalStatus);
        return new NextResponse(
          '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
          {
            status: finalStatus,
            headers: { "Content-Type": "text/xml" },
          },
        );
      }

      contactId = created.id as string;
      console.log("[sms-webhook] created contact:", contactId);
    }

    const insertPayload = {
      business_id: business.id,
      contact_id: contactId,
      channel: "sms",
      direction: "inbound",
      body,
      status: "received",
    };

    console.log("[sms-webhook] insert payload:", insertPayload);

    const { data: inserted, error: insertError } = await supabase
      .from("messages")
      .insert(insertPayload)
      .select("id, business_id, contact_id, channel, direction, body, created_at")
      .maybeSingle();

    if (insertError || !inserted) {
      console.error(
        "[sms-webhook] failed to insert message:",
        insertError?.message ?? "no row returned",
      );
      finalStatus = 500;
      console.log("[sms-webhook] responding with status", finalStatus);
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          status: finalStatus,
          headers: { "Content-Type": "text/xml" },
        },
      );
    }

    console.log("[sms-webhook] message insert succeeded, row:", inserted);

    // Minimal TwiML response with no auto-reply (you can add one later).
    finalStatus = 200;
    console.log("[sms-webhook] responding with status", finalStatus);
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: finalStatus,
        headers: { "Content-Type": "text/xml" },
      },
    );
  } catch (e) {
    console.error("[sms-webhook] unexpected error:", e);
    finalStatus = 500;
    console.log("[sms-webhook] responding with status", finalStatus);
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: finalStatus,
        headers: { "Content-Type": "text/xml" },
      },
    );
  } finally {
    console.log("[sms-webhook] final response status:", finalStatus);
  }
}

