import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendRecoverySms } from "@/lib/sms";

export async function GET() {
  return NextResponse.json({ message: "missed-call route works" });
}

export async function POST(request: Request) {
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (businessError) {
    return NextResponse.json(
      { success: false, error: businessError.message },
      { status: 500 }
    );
  }
  if (!business) {
    return NextResponse.json(
      { success: false, error: "No business found" },
      { status: 500 }
    );
  }

  // Basic Twilio Voice compatibility: accept form-encoded payload and
  // use the caller number when present. If this is called from another
  // system, we fall back to a test number.
  const rawBody = await request.text();
  const params = new URLSearchParams(rawBody);
  const fromNumber =
    params.get("From") ??
    "+447700900123";

  const normalizedPhone = fromNumber.replace(/\s+/g, "");

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .insert({
      business_id: business.id,
      phone: normalizedPhone,
      name: "Caller",
    })
    .select()
    .single();

  if (contactError) {
    return NextResponse.json(
      { success: false, error: contactError.message },
      { status: 500 }
    );
  }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({
      business_id: business.id,
      contact_id: contact.id,
      source_channel: "phone",
      event_type: "missed_call",
      payload: { from: normalizedPhone, status: "missed" },
    })
    .select()
    .single();

  if (eventError) {
    return NextResponse.json(
      { success: false, error: eventError.message },
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

  if (messageError) {
    return NextResponse.json(
      { success: false, error: messageError.message },
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
      to: contact.phone ?? normalizedPhone,
      businessName: business.name,
      bookingLink: business.booking_link ?? null,
    });
  } catch (smsError) {
    const message =
      smsError instanceof Error ? smsError.message : "SMS send failed";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }

  // Attach the actual SMS body to the stored outbound message
  if (message) {
    await supabase
      .from("messages")
      .update({ body: sms.body })
      .eq("id", message.id);
  }

  return NextResponse.json({
    success: true,
    business,
    contact,
    event,
    message,
    sms,
  });
}

