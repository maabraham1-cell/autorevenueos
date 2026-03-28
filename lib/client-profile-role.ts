import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Client-side profile role from Supabase (RLS: user reads own row).
 * Prefer this where a browser Supabase client is already available.
 */
export async function getProfileRole(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return (data?.role as string | undefined) ?? null;
}

/**
 * Uses cookie session + server route (same source as middleware checks).
 */
export async function fetchSessionRoleFromApi(): Promise<{
  role: string | null;
  isAdmin: boolean;
} | null> {
  const res = await fetch("/api/session/role", { credentials: "same-origin" });
  if (res.status === 401) return null;
  if (!res.ok) return null;
  const j = (await res.json()) as { role?: string; isAdmin?: boolean };
  return {
    role: j.role ?? null,
    isAdmin: !!j.isAdmin,
  };
}
