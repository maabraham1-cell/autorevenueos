import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUserAndBusiness } from "@/lib/auth";

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

    if (typeof body.name === "string" && body.name.trim().length > 0) {
      updates.name = body.name.trim();
    }
    if (typeof body.industry === "string") {
      updates.industry = body.industry.trim() || null;
    }
    if (typeof body.booking_link === "string") {
      updates.booking_link = body.booking_link.trim() || null;
    }
    if (
      typeof body.average_booking_value === "number" &&
      body.average_booking_value >= 0
    ) {
      updates.average_booking_value = Math.round(body.average_booking_value);
    }
    if (typeof body.location === "string") {
      updates.location = body.location.trim() || null;
    }
    if (typeof body.auto_reply_template === "string") {
      const tpl = body.auto_reply_template.trim();
      updates.auto_reply_template = tpl.length > 0 ? tpl : null;
    }
    if (typeof body.meta_page_id === "string") {
      const val = body.meta_page_id.trim();
      updates.meta_page_id = val.length > 0 ? val : null;
    }
    if (typeof body.cost_per_lead === "number" && body.cost_per_lead >= 0) {
      updates.cost_per_lead = body.cost_per_lead;
    }
    if (typeof body.currency_code === "string") {
      const val = body.currency_code.trim().toUpperCase();
      updates.currency_code = val || "GBP";
    }
    if (typeof body.locale === "string") {
      const val = body.locale.trim();
      updates.locale = val || "en-GB";
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
