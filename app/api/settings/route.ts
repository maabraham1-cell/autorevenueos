import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUserAndBusiness } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";

export async function GET(request: NextRequest) {
  try {
    const { user, business } = await getCurrentUserAndBusiness(request);

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    if (!business) {
      return NextResponse.json(
        { error: "No business linked to this user" },
        { status: 400 },
      );
    }

    const abv =
      typeof (business as any).average_booking_value === "number" &&
      (business as any).average_booking_value > 0
        ? (business as any).average_booking_value
        : 60;
    const cpl =
      typeof (business as any).cost_per_lead === "number"
        ? (business as any).cost_per_lead
        : 3;

    return NextResponse.json({
      id: business.id,
      name: (business.name as string) ?? "",
      industry: (business.industry as string) ?? "",
      booking_link: (business.booking_link as string) ?? "",
      average_booking_value: abv,
      location: ((business as any).location as string) ?? "",
      auto_reply_template: ((business as any).auto_reply_template as string) ?? "",
      meta_page_id: ((business as any).meta_page_id as string) ?? "",
      cost_per_lead: cpl,
      currency_code: ((business as any).currency_code as string) ?? "GBP",
      locale: ((business as any).locale as string) ?? "en-GB",
      twilio_phone_number: ((business as any).twilio_phone_number as string) ?? "",
      acuity_api_key: ((business as any).acuity_api_key as string) ?? "",
      square_merchant_id: ((business as any).square_merchant_id as string) ?? "",
      activation_status: ((business as any).activation_status as string) ?? "payment_required",
      twilio_provisioning_error: ((business as any).twilio_provisioning_error as string) ?? "",
    });
  } catch (e) {
    console.error("[settings] unexpected error:", e);
    return NextResponse.json(
      { error: "Failed to load settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user, business } = await getCurrentUserAndBusiness(request);

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    if (!business) {
      return NextResponse.json(
        { error: "No business linked to this user" },
        { status: 404 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};

    const name =
      typeof body.name === "string" ? body.name.trim().slice(0, 200) : null;
    if (name && name.length > 0) {
      updates.name = name;
    }

    const industry =
      typeof body.industry === "string"
        ? body.industry.trim().slice(0, 200)
        : null;
    if (industry !== null) {
      updates.industry = industry || null;
    }

    const bookingLinkRaw =
      typeof body.booking_link === "string"
        ? body.booking_link.trim().slice(0, 500)
        : null;
    if (bookingLinkRaw !== null) {
      let booking_link: string | null = bookingLinkRaw || null;
      if (booking_link && !/^https?:\/\//i.test(booking_link)) {
        booking_link = `https://${booking_link}`;
      }
      updates.booking_link = booking_link;
    }

    if (
      typeof body.average_booking_value === "number" &&
      Number.isFinite(body.average_booking_value)
    ) {
      const v = Math.max(0, Math.min(100000, Math.round(body.average_booking_value)));
      updates.average_booking_value = v;
    }

    const location =
      typeof body.location === "string"
        ? body.location.trim().slice(0, 200)
        : null;
    if (location !== null) {
      updates.location = location || null;
    }

    if (typeof body.auto_reply_template === "string") {
      const tpl = body.auto_reply_template.trim().slice(0, 2000);
      updates.auto_reply_template = tpl.length > 0 ? tpl : null;
    }

    if (typeof body.meta_page_id === "string") {
      const val = body.meta_page_id.trim().slice(0, 200);
      updates.meta_page_id = val.length > 0 ? val : null;
    }

    if (
      typeof body.cost_per_lead === "number" &&
      Number.isFinite(body.cost_per_lead)
    ) {
      const cpl = Math.max(0, Math.min(100000, Math.round(body.cost_per_lead)));
      updates.cost_per_lead = cpl;
    }

    if (typeof body.currency_code === "string") {
      const val = body.currency_code.trim().toUpperCase().slice(0, 10);
      updates.currency_code = val || "GBP";
    }

    if (typeof body.locale === "string") {
      const val = body.locale.trim().slice(0, 50);
      updates.locale = val || "en-GB";
    }

    if (typeof body.twilio_phone_number === "string") {
      const normalized = normalizePhone(body.twilio_phone_number);
      updates.twilio_phone_number = normalized || null;
    }

    if (typeof body.acuity_api_key === "string") {
      const val = body.acuity_api_key.trim().slice(0, 500);
      updates.acuity_api_key = val.length > 0 ? val : null;
    }

    if (typeof body.square_merchant_id === "string") {
      const val = body.square_merchant_id.trim().slice(0, 200);
      updates.square_merchant_id = val.length > 0 ? val : null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true });
    }

    const { error: updateError } = await supabase
      .from("businesses")
      .update(updates)
      .eq("id", business.id);

    if (updateError) {
      console.error("[settings] update error:", updateError.message);
      return NextResponse.json(
        { error: "Failed to save settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[settings] unexpected error:", e);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }
}
