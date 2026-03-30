import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  createServerClient,
  type CookieOptions,
} from "@supabase/auth-helpers-nextjs";
import { isAdminRole } from "@/lib/roles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const protectedPrefixes = [
  "/dashboard",
  "/inbox",
  "/recoveries",
  "/settings",
  "/operator",
  "/admin",
  "/api/dashboard",
  "/api/inbox",
  "/api/recoveries",
  "/api/settings",
  "/api/operator",
  "/api/booking-integrations",
  "/api/billing/retry",
  "/api/setup",
  "/api/chat/website/reply",
  "/api/test",
  "/api/admin",
];

const adminPrefixes = ["/admin", "/api/admin"];

function isAdminPath(pathname: string): boolean {
  return adminPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );
}

function isLocalHost(req: NextRequest): boolean {
  const host = req.headers.get("host") ?? "";
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const maintenance =
    process.env.MAINTENANCE_MODE === "1" ||
    process.env.MAINTENANCE_MODE === "true";
  if (maintenance && !isLocalHost(req) && pathname !== "/maintenance") {
    return NextResponse.rewrite(new URL("/maintenance", req.url));
  }

  const isProtected = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const res = NextResponse.next();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        res.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        res.cookies.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role as string) ?? "owner";
  const adminUser = isAdminRole(role);

  if (adminUser) {
    const operatorForbiddenPages = [
      "/dashboard",
      "/inbox",
      "/settings",
      "/recoveries",
      "/setup",
    ];
    for (const prefix of operatorForbiddenPages) {
      if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
        return NextResponse.redirect(new URL("/operator", req.url));
      }
    }

    const operatorForbiddenApis = [
      "/api/dashboard",
      "/api/inbox",
      "/api/recoveries",
      "/api/settings",
      "/api/setup",
      "/api/booking-integrations",
      "/api/billing",
      "/api/test",
    ];
    for (const prefix of operatorForbiddenApis) {
      if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
        return NextResponse.json(
          { error: "Not available for internal admin account." },
          { status: 403 },
        );
      }
    }
  }

  if (!adminUser) {
    if (
      pathname === "/operator" ||
      pathname.startsWith("/operator/") ||
      pathname === "/api/operator" ||
      pathname.startsWith("/api/operator/")
    ) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  if (isAdminPath(pathname)) {
    if (!adminUser) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Forbidden. Internal admin access required." },
          { status: 403 },
        );
      }
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
