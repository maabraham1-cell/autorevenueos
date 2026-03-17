import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUserAndBusiness } from "@/lib/auth";

const LOG_PREFIX = "[contacts]";

const ALLOWED_STATUSES = new Set([
  "new_lead",
  "in_conversation",
  "waiting_for_customer",
  "booking_requested",
  "booked",
  "lost",
]);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ contactId: string }> },
) {
  try {
    const { user, business } = await getCurrentUserAndBusiness(request);

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (!business) {
      return NextResponse.json({ error: "No business linked" }, { status: 400 });
    }

    const { contactId } = await context.params;
    if (!contactId) {
      return NextResponse.json({ error: "Missing contactId" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("contacts")
      .select("id, business_id, name, phone, channel, status, notes, tags, created_at")
      .eq("id", contactId)
      .eq("business_id", business.id)
      .maybeSingle();

    if (error) {
      console.error(LOG_PREFIX, "GET error", { contactId, error });
      return NextResponse.json({ error: "Failed to load contact" }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error(LOG_PREFIX, "GET unexpected error", { error: e });
    return NextResponse.json(
      { error: "Failed to load contact" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ contactId: string }> },
) {
  try {
    const { user, business } = await getCurrentUserAndBusiness(request);

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (!business) {
      return NextResponse.json({ error: "No business linked" }, { status: 400 });
    }

    const { contactId } = await context.params;
    if (!contactId) {
      return NextResponse.json({ error: "Missing contactId" }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      status?: string;
      notes?: string;
      tags?: string[];
    };

    const updates: Record<string, unknown> = {};

    if (typeof body.name === "string") {
      const n = body.name.trim().slice(0, 200);
      updates.name = n || null;
    }

    if (typeof body.status === "string") {
      const raw = body.status.trim();
      if (raw && ALLOWED_STATUSES.has(raw)) {
        updates.status = raw;
      }
    }

    if (typeof body.notes === "string") {
      const n = body.notes.trim().slice(0, 2000);
      updates.notes = n || null;
    }

    if (Array.isArray(body.tags)) {
      const cleaned = body.tags
        .map((t) => (typeof t === "string" ? t.trim().slice(0, 50) : ""))
        .filter(Boolean);
      updates.tags = cleaned;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true });
    }

    const { error: updateError } = await supabase
      .from("contacts")
      .update(updates)
      .eq("id", contactId)
      .eq("business_id", business.id);

    if (updateError) {
      console.error(LOG_PREFIX, "PATCH update error", {
        contactId,
        error: updateError,
      });
      return NextResponse.json(
        { error: "Failed to update contact" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(LOG_PREFIX, "PATCH unexpected error", { error: e });
    return NextResponse.json(
      { error: "Failed to update contact" },
      { status: 500 },
    );
  }
}

