import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;
let _adminClient: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url)
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is required. Set it in .env.local and restart the dev server."
    );
  if (!key)
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required. Set it in .env.local and restart the dev server."
    );
  _client = createClient(url, key);
  return _client;
}

/**
 * Server-only. Use for trusted server actions (webhooks, booking confirmation)
 * that must bypass RLS. Returns null if SUPABASE_SERVICE_ROLE_KEY is not set.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (_adminClient) return _adminClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _adminClient = createClient(url, key);
  return _adminClient;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getClient() as unknown as Record<string, unknown>)[prop as string];
  },
});
