import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      console.error("[recoveries] missing recovery id in route params");
      return NextResponse.json({ success: true });
    }

    const body = await request.json().catch(() => null);
    const rawStatus =
      typeof body?.status === "string" ? body.status.trim() : null;

    if (!rawStatus) {
      console.error("[recoveries] missing status value in request body");
      return NextResponse.json({ error: "Missing status" }, { status: 400 });
    }

    const allowedStatuses = [
      "Recovered",
      "In Conversation",
      "Follow Up",
      "Booked",
      "Lost",
    ] as const;

    if (!allowedStatuses.includes(rawStatus as (typeof allowedStatuses)[number])) {
      console.error("[recoveries] invalid status value in request body", {
        status: rawStatus,
      });
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const status = rawStatus;

    const { error } = await supabase
      .from("recoveries")
      .update({ status })
      .eq("id", id);

    if (error) {
      console.error("[recoveries] status update error:", error.message);
      return NextResponse.json(
        { error: "Failed to update status" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[recoveries] unexpected status update error:", e);
    return NextResponse.json(
      { error: "Failed to update status" },
      { status: 500 }
    );
  }
}


