import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyTwilioRequest } from "@/lib/twilioWebhook";
import { checkRateLimit } from "@/lib/rateLimit";
import { normalizePhone } from "@/lib/phone";

const SMS_CHANNEL = "sms";

async function getBusinessForTwilio(toNumber: string | null) {
  let business: any = null;
  let errorOut: any = null;

  if (toNumber) {
    const normalized = normalizePhone(toNumber);
    const { data, error } = await supabase
      .from("businesses")
      .select("*")
      .eq("twilio_phone_number", normalized)
      .limit(1)
      .maybeSingle();
    business = data;
    errorOut = error;
    if (!business && !error) {
      console.warn("[sms-webhook] no business matched twilio_phone_number", {
        toNumber: normalized,
      });
    }
  }

  if (errorOut) {
    console.error("[sms-webhook] business lookup error:", errorOut.message);
    throw new Error("Failed to load business");
  }

  return business;
}

export async function POST(request: Request) {
  let finalStatus = 500;
  const requestId = `sms-webhook-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  console.log("[sms-webhook] route hit", { requestId });

  try {
    const url = request.url;
    const rawBody = await request.text();
    console.log("[sms-webhook] raw body:", { requestId, rawBody });

    const signature = request.headers.get("x-twilio-signature");
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!authToken) {
      console.error("[sms-webhook] TWILIO_AUTH_TOKEN not set", { requestId });
      finalStatus = 500;
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          status: finalStatus,
          headers: { "Content-Type": "text/xml" },
        }
      );
    }

    const isValid = verifyTwilioRequest({
      authToken,
      url,
      rawBody,
      headerSignature: signature,
    });

    if (!isValid) {
      console.warn("[sms-webhook] invalid Twilio signature", { requestId });
      finalStatus = 403;
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          status: finalStatus,
          headers: { "Content-Type": "text/xml" },
        }
      );
    }

    const params = new URLSearchParams(rawBody);

    const from = params.get("From");
    const to = params.get("To");
    const body = params.get("Body") ?? "";
    const messageSid = (params.get("MessageSid") ?? "").trim();

    console.log("[sms-webhook] parsed payload:", {
      requestId,
      From: from,
      To: to,
      Body: body,
      MessageSid: messageSid || null,
    });

    if (!from) {
      console.error("[sms-webhook] missing From in payload", { requestId });
      finalStatus = 400;
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          status: finalStatus,
          headers: { "Content-Type": "text/xml" },
        }
      );
    }

    // Lightweight rate limit per sending number to reduce abuse.
    const rateKey = `twilio-sms:${from}`;
    const allowed = checkRateLimit(rateKey, { limit: 20, windowMs: 60_000 });
    if (!allowed) {
      console.warn("[sms-webhook] rate limit exceeded", { requestId, from });
      finalStatus = 429;
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          status: finalStatus,
          headers: { "Content-Type": "text/xml" },
        }
      );
    }

    const business = await getBusinessForTwilio(to);
    console.log("[sms-webhook] business lookup result:", {
      requestId,
      businessId: business?.id ?? null,
    });

    if (!business) {
      console.warn("[sms-webhook] no business configured for this number", {
        requestId,
      });
      finalStatus = 404;
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          status: finalStatus,
          headers: { "Content-Type": "text/xml" },
        }
      );
    }

    // Idempotency: ignore duplicate MessageSid payloads.
    if (messageSid) {
      const { data: existingMessage, error: existingError } = await supabase
        .from("messages")
        .select("id")
        .eq("business_id", business.id)
        .eq("external_id", messageSid)
        .maybeSingle();

      if (existingError) {
        console.error("[sms-webhook] idempotency check error:", {
          requestId,
          error: existingError.message,
        });
      } else if (existingMessage) {
        console.log("[sms-webhook] duplicate webhook (MessageSid) ignored", {
          requestId,
          messageId: existingMessage.id,
        });
        finalStatus = 200;
        return new NextResponse(
          '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
          {
            status: finalStatus,
            headers: { "Content-Type": "text/xml" },
          }
        );
      }
    }

    const normalizedFrom = normalizePhone(from);
    if (!normalizedFrom) {
      console.error("[sms-webhook] invalid From number", { requestId });
      finalStatus = 400;
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { status: finalStatus, headers: { "Content-Type": "text/xml" } },
      );
    }

    let existingContact: { id: string } | null = null;
    const { data: byExternalId } = await supabase
      .from("contacts")
      .select("id")
      .eq("business_id", business.id)
      .eq("channel", SMS_CHANNEL)
      .eq("external_id", normalizedFrom)
      .maybeSingle();
    existingContact = byExternalId;
    if (!existingContact) {
      const { data: byPhone, error: contactError } = await supabase
        .from("contacts")
        .select("id")
        .eq("business_id", business.id)
        .eq("phone", normalizedFrom)
        .maybeSingle();
      if (contactError) {
        console.error("[sms-webhook] contact lookup error:", contactError.message);
      }
      existingContact = byPhone;
    }

    console.log("[sms-webhook] contact lookup result:", {
      requestId,
      contactId: existingContact?.id ?? null,
    });

    let contactId = existingContact?.id as string | undefined;

    if (!contactId) {
      const { data: created, error: createError } = await supabase
        .from("contacts")
        .insert({
          business_id: business.id,
          channel: SMS_CHANNEL,
          external_id: normalizedFrom,
          phone: normalizedFrom,
          name: "SMS lead",
        })
        .select("id")
        .maybeSingle();

      if (createError || !created) {
        console.error(
          "[sms-webhook] failed to create contact:",
          createError?.message
        );
        finalStatus = 500;
        return new NextResponse(
          '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
          {
            status: finalStatus,
            headers: { "Content-Type": "text/xml" },
          }
        );
      }

      contactId = created.id as string;
      console.log("[sms-webhook] created contact:", {
        requestId,
        contactId,
      });
    }

    const insertPayload = {
      business_id: business.id,
      contact_id: contactId,
      channel: "sms",
      direction: "inbound",
      body,
      status: "received",
      external_id: messageSid || null,
    };

    console.log("[sms-webhook] insert payload:", { requestId, insertPayload });

    const { data: inserted, error: insertError } = await supabase
      .from("messages")
      .insert(insertPayload)
      .select(
        "id, business_id, contact_id, channel, direction, body, created_at"
      )
      .maybeSingle();

    if (insertError || !inserted) {
      console.error(
        "[sms-webhook] failed to insert message:",
        insertError?.message ?? "no row returned"
      );
      finalStatus = 500;
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          status: finalStatus,
          headers: { "Content-Type": "text/xml" },
        }
      );
    }

    console.log("[sms-webhook] message insert succeeded", {
      requestId,
      messageId: inserted.id,
    });

    // Minimal TwiML response with no auto-reply (you can add one later).
    finalStatus = 200;
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: finalStatus,
        headers: { "Content-Type": "text/xml" },
      }
    );
  } catch (e) {
    console.error("[sms-webhook] unexpected error:", { requestId, error: e });
    finalStatus = 500;
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: finalStatus,
        headers: { "Content-Type": "text/xml" },
      }
    );
  } finally {
    console.log("[sms-webhook] final response status:", {
      requestId,
      finalStatus,
    });
  }
}


