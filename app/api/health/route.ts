import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const startedAt = Date.now();
  const checks: { name: string; ok: boolean; error?: string }[] = [];

  // Basic Supabase connectivity check
  try {
    const { error } = await supabase
      .from("businesses")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (error) {
      checks.push({ name: "supabase", ok: false, error: error.message });
    } else {
      checks.push({ name: "supabase", ok: true });
    }
  } catch (e: any) {
    checks.push({
      name: "supabase",
      ok: false,
      error: e?.message ?? "Unexpected error",
    });
  }

  const allOk = checks.every((c) => c.ok);

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      checks,
      response_time_ms: Date.now() - startedAt,
    },
    { status: allOk ? 200 : 503 }
  );
}

