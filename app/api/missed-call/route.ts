import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendRecoverySms } from "@/lib/sms";
import { verifyTwilioRequest } from "@/lib/twilioWebhook";
import { checkRateLimit } from "@/lib/rateLimit";
import { normalizePhone } from "@/lib/phone";

const SMS_CHANNEL = "sms";

export async function GET() {
  return NextResponse.json({ message: "missed-call route works" });
}

export async function POST(request: Request) {
  const requestId = `missed-call-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  let businessId: string | null = null;

  try {
    const url = request.url;
    const rawBody = await request.text();

    const signature = request.headers.get("x-twilio-signature");
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!authToken) {
      console.error("[missed-call] TWILIO_AUTH_TOKEN not set", {
        requestId,
      });
      return NextResponse.json(
        { success: false, error: "Twilio auth token not configured" },
        { status: 500 }
      );
    }

    const isValid = verifyTwilioRequest({
      authToken,
      url,
      rawBody,
      headerSignature: signature,
    });

    if (!isValid) {
      console.warn("[missed-call] invalid Twilio signature", {
        requestId,
      });
      return NextResponse.json(
        { success: false, error: "Invalid webhook signature" },
        { status: 403 }
      );
    }

    const params = new URLSearchParams(rawBody);
    const fromNumber = normalizePhone(params.get("From"));
    const toNumber = normalizePhone(params.get("To") ?? params.get("Called") ?? "");

    if (!fromNumber) {
      console.error("[missed-call] missing From number", { requestId });
      return NextResponse.json(
        { success: false, error: "Missing From number" },
        { status: 400 }
      );
    }

    // Lightweight rate limit per calling number to reduce abuse.
    const rateKey = `twilio-missed:${fromNumber}`;
    const allowed = checkRateLimit(rateKey, { limit: 10, windowMs: 60_000 });
    if (!allowed) {
      console.warn("[missed-call] rate limit exceeded", {
        requestId,
        from: fromNumber,
      });
      return NextResponse.json(
        { success: false, error: "Too many requests" },
        { status: 429 }
      );
    }

    // Prefer routing by Twilio "To" number when configured on the business.
    let business = null as any;
    let businessError: any = null;

    if (toNumber) {
      const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .eq("twilio_phone_number", toNumber)
        .limit(1)
        .maybeSingle();
      business = data;
      businessError = error;
      if (!business && !error) {
        console.warn("[missed-call] no business matched twilio_phone_number", {
          requestId,
          toNumber,
        });
      }
    }

    if (businessError) {
      console.error("[missed-call] business lookup error:", {
        requestId,
        error: businessError.message,
      });
      return NextResponse.json(
        { success: false, error: "Failed to load business" },
        { status: 500 }
      );
    }

    if (!business) {
      console.warn("[missed-call] no business for this number", {
        requestId,
        toNumber,
      });
      return NextResponse.json(
        { success: false, error: "No business configured for this number" },
        { status: 404 }
      );
    }

    const businessFromNumber = (business.twilio_phone_number ?? "").toString().trim().replace(/\s+/g, "") || null;
    if (!businessFromNumber) {
      console.error("[missed-call] business has no twilio_phone_number", {
        requestId,
        businessId: business.id,
      });
      return NextResponse.json(
        { success: false, error: "Business Twilio number not configured" },
        { status: 500 }
      );
    }

    businessId = business.id as string;

    const callSid = (params.get("CallSid") ?? "").trim();

    console.log("[missed-call] incoming payload", {
      requestId,
      From: fromNumber,
      CallSid: callSid || null,
    });

    // Idempotency: if we've already processed this CallSid, return success without duplicating rows.
    if (callSid) {
      const { data: existingEvent, error: existingError } = await supabase
        .from("events")
        .select("id")
        .eq("business_id", business.id)
        .eq("external_id", callSid)
        .maybeSingle();

      if (existingError) {
        console.error("[missed-call] idempotency check error:", {
          requestId,
          error: existingError.message,
        });
      } else if (existingEvent) {
        console.log("[missed-call] duplicate webhook (CallSid) ignored", {
          requestId,
          eventId: existingEvent.id,
        });
        return NextResponse.json({ success: true, deduped: true });
      }
    }

    const normalizedPhone = fromNumber;

    const { data: contactByExternalId } = await supabase
      .from("contacts")
      .select("id")
      .eq("business_id", business.id)
      .eq("channel", SMS_CHANNEL)
      .eq("external_id", normalizedPhone)
      .maybeSingle();
    let existingContact = contactByExternalId;
    if (!existingContact) {
      const { data: contactByPhone } = await supabase
        .from("contacts")
        .select("id")
        .eq("business_id", business.id)
        .eq("phone", normalizedPhone)
        .maybeSingle();
      existingContact = contactByPhone;
    }

    let contact: { id: string };
    if (existingContact) {
      contact = existingContact;
    } else {
      const { data: created, error: contactError } = await supabase
        .from("contacts")
        .insert({
          business_id: business.id,
          channel: SMS_CHANNEL,
          external_id: normalizedPhone,
          phone: normalizedPhone,
          name: "Caller",
        })
        .select()
        .single();

      if (contactError || !created) {
        console.error("[missed-call] contact insert error:", {
          requestId,
          error: contactError?.message,
        });
        return NextResponse.json(
          { success: false, error: "Failed to create contact" },
          { status: 500 }
        );
      }
      contact = created;
    }

    const { data: event, error: eventError } = await supabase
      .from("events")
      .insert({
        business_id: business.id,
        contact_id: contact.id,
        source_channel: "phone",
        event_type: "missed_call",
        external_id: callSid || null,
        payload: { from: normalizedPhone, status: "missed" },
      })
      .select()
      .single();

    if (eventError || !event) {
      console.error("[missed-call] event insert error:", {
        requestId,
        error: eventError?.message,
      });
      return NextResponse.json(
        { success: false, error: "Failed to create event" },
        { status: 500 }
      );
    }

    const { data: message, error: messageError } = await supabase
      .from("messages")
      .insert({
        business_id: business.id,
        contact_id: contact.id,
        channel: "sms",
        direction: "outbound",
        body: null, // updated after Twilio send
      })
      .select()
      .single();

    if (messageError || !message) {
      console.error("[missed-call] message insert error:", {
        requestId,
        error: messageError?.message,
      });
      return NextResponse.json(
        { success: false, error: "Failed to create message" },
        { status: 500 }
      );
    }

    let sms: {
      success: true;
      provider: string;
      sid: string;
      to: string;
      body: string;
      status: string | null;
    };
    try {
      sms = await sendRecoverySms({
        to: normalizedPhone,
        fromNumber: businessFromNumber,
        businessName: (business.name as string) ?? "your business",
        bookingLink: (business.booking_link as string | null) ?? null,
      });
    } catch (smsError) {
      const messageText =
        smsError instanceof Error ? smsError.message : "SMS send failed";
      console.error("[missed-call] sendRecoverySms error:", {
        requestId,
        error: messageText,
      });
      return NextResponse.json(
        { success: false, error: messageText },
        { status: 500 }
      );
    }

    // Attach the actual SMS body and Twilio SID to the stored outbound message
    await supabase
      .from("messages")
      .update({ body: sms.body, external_id: sms.sid })
      .eq("id", message.id);

    console.log("[missed-call] processed successfully", {
      requestId,
      businessId,
      contactId: contact.id,
      eventId: event.id,
      messageId: message.id,
      smsSid: sms.sid,
    });

    return NextResponse.json({
      success: true,
      business_id: businessId,
      contact_id: contact.id,
      event_id: event.id,
      message_id: message.id,
      sms_sid: sms.sid,
    });
  } catch (e) {
    console.error("[missed-call] unexpected error:", {
      requestId,
      error: e,
      businessId,
    });
    return NextResponse.json(
      { success: false, error: "Unexpected server error" },
      { status: 500 }
    );
  }
}


