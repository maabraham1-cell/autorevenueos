/**
 * Canonical site origin for Supabase auth redirects (password reset, signup confirmation).
 *
 * In production, set NEXT_PUBLIC_APP_URL to your real URL, e.g. https://www.autorevenueos.com
 * (no trailing slash). Otherwise reset/confirm links may use a preview host, http, or wrong
 * domain and the browser will show "can't find server" / DNS errors.
 */
export function getAuthRedirectOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  const normalize = (origin: string): string => {
    // Safety rail for old/misconfigured subdomain links in auth emails.
    if (/^https:\/\/app\.autorevenueos\.com$/i.test(origin)) {
      return "https://www.autorevenueos.com";
    }
    return origin;
  };
  if (typeof window !== "undefined") {
    if (fromEnv) {
      return normalize(fromEnv);
    }
    return normalize(window.location.origin);
  }
  return fromEnv ? normalize(fromEnv) : "";
}

export function authCallbackUrl(nextPath: string): string | undefined {
  const origin = getAuthRedirectOrigin();
  if (!origin) {
    return undefined;
  }
  const path = nextPath.startsWith("/") ? nextPath : `/${nextPath}`;
  return `${origin}/auth/callback?next=${encodeURIComponent(path)}`;
}
