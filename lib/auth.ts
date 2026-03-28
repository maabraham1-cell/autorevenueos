import type { User } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import {
  createServerClient,
  type CookieOptions,
} from "@supabase/auth-helpers-nextjs";
import { isAdminRole } from "@/lib/roles";

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
export type ProfileRole =
  | "admin"
  | "customer"
  | "platform_admin"
  | "owner"
  | "member";

export async function getCurrentUserAndBusiness(
  request: NextRequest
): Promise<{ user: User | null; business: BusinessRow | null; role: ProfileRole }> {
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
    return { user: null, business: null, role: "owner" };
  }

  if (!user) {
    return { user: null, business: null, role: "owner" };
  }

  // Use the same session-aware client so RLS can allow profile/business access
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, business_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[auth] profile lookup error:", profileError.message);
    return { user, business: null, role: "owner" };
  }

  let businessId: string | null = profile?.business_id ?? null;

  if (profile && isAdminRole(profile.role as string)) {
    return {
      user,
      business: null,
      role: (profile.role as ProfileRole) ?? "admin",
    };
  }

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
    const businessMobile =
      typeof userMeta.business_mobile === "string" && userMeta.business_mobile.trim().length > 0
        ? userMeta.business_mobile.trim()
        : null;
    const businessType =
      typeof userMeta.business_type === "string" && userMeta.business_type.trim().length > 0
        ? userMeta.business_type.trim()
        : null;

    const { data: newBusiness, error: insertBizError } = await adminClient
      .from("businesses")
      .insert({
        name: businessNameFromMeta,
        industry: businessType,
        business_mobile: businessMobile,
      })
      .select("id")
      .single();

    if (insertBizError || !newBusiness) {
      console.error("[auth] business create error:", insertBizError?.message);
      return { user, business: null, role: "owner" };
    }

    businessId = newBusiness.id;

    const profileTitle =
      typeof userMeta.title === "string" && userMeta.title.trim().length > 0
        ? userMeta.title.trim()
        : null;
    const profileFirstName =
      typeof userMeta.first_name === "string" && userMeta.first_name.trim().length > 0
        ? userMeta.first_name.trim()
        : null;
    const profileLastName =
      typeof userMeta.last_name === "string" && userMeta.last_name.trim().length > 0
        ? userMeta.last_name.trim()
        : null;

    if (supabaseServiceKey) {
      const { error: profileInsertError } = await adminClient
        .from("profiles")
        .upsert(
          {
            id: user.id,
            business_id: businessId,
            title: profileTitle,
            first_name: profileFirstName,
            last_name: profileLastName,
          },
          { onConflict: "id" }
        );
      if (profileInsertError) {
        console.error("[auth] profile upsert error:", profileInsertError.message);
        return { user, business: null, role: "owner" };
      }
    } else {
      const { error: profileLinkError } = await supabase.rpc("link_profile_to_business", {
        p_user_id: user.id,
        p_business_id: businessId,
      });
      if (profileLinkError) {
        console.error("[auth] link_profile_to_business error:", profileLinkError.message);
        return { user, business: null, role: "owner" };
      }
      if (profileTitle ?? profileFirstName ?? profileLastName) {
        await supabase
          .from("profiles")
          .update({
            title: profileTitle,
            first_name: profileFirstName,
            last_name: profileLastName,
          })
          .eq("id", user.id);
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
    return { user, business: null, role: (profile?.role as ProfileRole) ?? "owner" };
  }

  return {
    user,
    business: business as BusinessRow,
    role: (profile?.role as ProfileRole) ?? "owner",
  };
}
