import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  return NextResponse.json({ message: "API test route works" });
}

export async function POST() {
  const { data, error } = await supabase
    .from("businesses")
    .insert({
      name: "Test Business",
      industry: "Test",
      booking_link: "https://example.com",
    })
    .select()
    .single();

  console.log("Supabase result:", { data, error });
  console.log("Supabase error:", error);

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message, details: error },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data });
}
