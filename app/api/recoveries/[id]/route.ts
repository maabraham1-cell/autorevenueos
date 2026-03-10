import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    if (!id) {
      console.error("[recoveries] missing recovery id in route params");
      return NextResponse.json({ success: true });
    }

    const body = await request.json().catch(() => null);
    const status =
      typeof body?.status === "string" ? body.status.trim() : null;

    if (!status) {
      console.error("[recoveries] missing status value in request body");
      return NextResponse.json({ success: true });
    }

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


