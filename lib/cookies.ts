/**
 * First-party cookie helpers. All cookies use SameSite=Lax, path=/; Secure when on HTTPS.
 * For use in browser only (document.cookie).
 */

function defaultOpts(): string {
  const secure = typeof window !== "undefined" && window.location?.protocol === "https:" ? "; Secure" : "";
  return `path=/; SameSite=Lax${secure}`;
}

function maxAgeSeconds(days: number): number {
  return Math.round(days * 24 * 60 * 60);
}

export function setCookie(
  name: string,
  value: string,
  options: { maxAgeDays: number } = { maxAgeDays: 365 }
): void {
  if (typeof document === "undefined") return;
  const maxAge = maxAgeSeconds(options.maxAgeDays);
  const encoded = encodeURIComponent(value);
  document.cookie = `${name}=${encoded}; ${defaultOpts()}; max-age=${maxAge}`;
}

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function deleteCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; ${defaultOpts()}; max-age=0`;
}

/** Cookie names and max-age (days) for the AutoRevenueOS strategy */
export const AR_COOKIES = {
  VID: { name: "ar_vid", maxAgeDays: 365 },
  SOURCE: { name: "ar_source", maxAgeDays: 90 },
  CAMPAIGN: { name: "ar_campaign", maxAgeDays: 90 },
  CHAT: { name: "ar_chat", maxAgeDays: 30 },
  CONSENT: { name: "ar_cookie_consent", maxAgeDays: 365 },
} as const;
