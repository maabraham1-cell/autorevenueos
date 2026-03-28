import { NextRequest, NextResponse } from "next/server";
import {
  createServerClient,
  type CookieOptions,
} from "@supabase/auth-helpers-nextjs";
import { isAdminRole } from "@/lib/roles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

/**
 * Returns the authenticated user's profile role (for client UI routing).
 */
export async function GET(request: NextRequest) {
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role as string) ?? "owner";

  return NextResponse.json({
    role,
    isAdmin: isAdminRole(role),
  });
}
