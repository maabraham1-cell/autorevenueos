import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

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
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getClient() as unknown as Record<string, unknown>)[prop as string];
  },
});
