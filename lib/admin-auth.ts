import type { User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  createServerClient,
  type CookieOptions,
} from "@supabase/auth-helpers-nextjs";
import { isAdminRole } from "@/lib/roles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

/**
 * Confirms the request is from an authenticated internal admin (`profiles.role`).
 * Does not bootstrap businesses (unlike getCurrentUserAndBusiness).
 */
export async function requireAdmin(
  request: NextRequest,
): Promise<{ user: User; role: string } | { response: NextResponse }> {
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
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role as string) ?? "owner";
  if (!isAdminRole(role)) {
    return {
      response: NextResponse.json(
        { error: "Forbidden. Internal admin access required." },
        { status: 403 },
      ),
    };
  }

  return { user, role };
}

/** @deprecated Use requireAdmin — kept for older imports */
export async function requirePlatformAdmin(
  request: NextRequest,
): Promise<{ user: User } | { response: NextResponse }> {
  const r = await requireAdmin(request);
  if ("response" in r) {
    return r;
  }
  return { user: r.user };
}
