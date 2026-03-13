import type { User } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import {
  createServerClient,
  type CookieOptions,
} from "@supabase/auth-helpers-nextjs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type BusinessRow = {
  id: string;
  name: string | null;
  industry: string | null;
  booking_link: string | null;
  average_booking_value?: number | null;
  cost_per_lead?: number | null;
  currency_code?: string | null;
  locale?: string | null;
  location?: string | null;
  auto_reply_template?: string | null;
  meta_page_id?: string | null;
  [key: string]: unknown;
};

/**
 * Get the current authenticated user and their linked business.
 * Uses cookies from the request to avoid next/headers in API routes.
 * Lazily creates a business + profile if the user has none (post signup).
 * Uses the same session-aware client for all DB ops so RLS sees the user.
 */
export async function getCurrentUserAndBusiness(
  request: NextRequest
): Promise<{ user: User | null; business: BusinessRow | null }> {
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(_name: string, _value: string, _options: CookieOptions) {},
      remove(_name: string, _options: CookieOptions) {},
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error("[auth] getUser error:", userError.message);
    return { user: null, business: null };
  }

  if (!user) {
    return { user: null, business: null };
  }

  // Use the same session-aware client so RLS can allow profile/business access
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, business_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[auth] profile lookup error:", profileError.message);
    return { user, business: null };
  }

  let businessId: string | null = profile?.business_id ?? null;

  if (!businessId) {
    // Use service role for bootstrap when set so RLS doesn't block new users
    const adminClient = supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey)
      : supabase;

    const userMeta = (user as any).user_metadata ?? {};
    const businessNameFromMeta =
      (typeof userMeta.business_name === "string" && userMeta.business_name.trim().length > 0
        ? userMeta.business_name.trim()
        : null) ||
      (typeof userMeta.full_name === "string" && userMeta.full_name.trim().length > 0
        ? userMeta.full_name.trim()
        : null) ||
      "New Business";

    const { data: newBusiness, error: insertBizError } = await adminClient
      .from("businesses")
      .insert({ name: businessNameFromMeta })
      .select("id")
      .single();

    if (insertBizError || !newBusiness) {
      console.error("[auth] business create error:", insertBizError?.message);
      return { user, business: null };
    }

    businessId = newBusiness.id;

    if (supabaseServiceKey) {
      const { error: profileInsertError } = await adminClient
        .from("profiles")
        .upsert(
          { id: user.id, business_id: businessId },
          { onConflict: "id" }
        );
      if (profileInsertError) {
        console.error("[auth] profile upsert error:", profileInsertError.message);
        return { user, business: null };
      }
    } else {
      const { error: profileLinkError } = await supabase.rpc("link_profile_to_business", {
        p_user_id: user.id,
        p_business_id: businessId,
      });
      if (profileLinkError) {
        console.error("[auth] link_profile_to_business error:", profileLinkError.message);
        return { user, business: null };
      }
    }
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .single();

  if (businessError || !business) {
    console.error("[auth] business load error:", businessError?.message);
    return { user, business: null };
  }

  return { user, business: business as BusinessRow };
}
