/**
 * Cookie consent and conversion cookies (ar_*). First-party only, no personal data.
 * Use only in browser.
 */

import { getCookie, setCookie, AR_COOKIES } from "./cookies";

export type ConsentStatus = "granted" | "rejected" | null;

export function getConsent(): ConsentStatus {
  const v = getCookie(AR_COOKIES.CONSENT.name);
  if (v === "granted" || v === "rejected") return v;
  return null;
}

export function setConsent(status: "granted" | "rejected"): void {
  setCookie(AR_COOKIES.CONSENT.name, status, { maxAgeDays: AR_COOKIES.CONSENT.maxAgeDays });
}

/** Returns true if we may set conversion/functional cookies (ar_vid, ar_source, ar_campaign, ar_chat). */
export function hasConversionConsent(): boolean {
  return getConsent() === "granted";
}

/** Derive traffic source from referrer (no personal data). */
function deriveSource(referrer: string): "direct" | "google" | "twitter" | "referral" {
  if (!referrer || !referrer.trim()) return "direct";
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    if (host.includes("google.")) return "google";
    if (host.includes("twitter.") || host.includes("x.com")) return "twitter";
  } catch {
    // invalid URL
  }
  return "referral";
}

/** Read UTM campaign string from current URL (utm_source, utm_medium, utm_campaign). */
function getUtmCampaignFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const source = params.get("utm_source")?.trim();
  const medium = params.get("utm_medium")?.trim();
  const campaign = params.get("utm_campaign")?.trim();
  if (!source && !medium && !campaign) return null;
  return [source, medium, campaign].filter(Boolean).join("|") || null;
}

/** Call after user accepts cookies: set ar_vid (if missing), ar_source, ar_campaign from current page. */
export function setConversionCookiesOnAccept(): void {
  if (!hasConversionConsent()) return;

  if (!getCookie(AR_COOKIES.VID.name)) {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    setCookie(AR_COOKIES.VID.name, id, { maxAgeDays: AR_COOKIES.VID.maxAgeDays });
  }

  const referrer = typeof document !== "undefined" ? document.referrer ?? "" : "";
  setCookie(AR_COOKIES.SOURCE.name, deriveSource(referrer), {
    maxAgeDays: AR_COOKIES.SOURCE.maxAgeDays,
  });

  const campaign = getUtmCampaignFromUrl();
  if (campaign) {
    setCookie(AR_COOKIES.CAMPAIGN.name, campaign, { maxAgeDays: AR_COOKIES.CAMPAIGN.maxAgeDays });
  }
}

/** Call on page load when consent already granted: ensure ar_vid exists, refresh ar_source and ar_campaign. */
export function refreshConversionCookiesIfConsented(): void {
  if (!hasConversionConsent()) return;
  if (!getCookie(AR_COOKIES.VID.name)) {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    setCookie(AR_COOKIES.VID.name, id, { maxAgeDays: AR_COOKIES.VID.maxAgeDays });
  }
  const referrer = typeof document !== "undefined" ? document.referrer ?? "" : "";
  setCookie(AR_COOKIES.SOURCE.name, deriveSource(referrer), {
    maxAgeDays: AR_COOKIES.SOURCE.maxAgeDays,
  });
  const campaign = getUtmCampaignFromUrl();
  if (campaign) {
    setCookie(AR_COOKIES.CAMPAIGN.name, campaign, { maxAgeDays: AR_COOKIES.CAMPAIGN.maxAgeDays });
  }
}

// --- ar_chat (chat continuity): only set when consent granted ---

export function getChatId(): string | null {
  return getCookie(AR_COOKIES.CHAT.name);
}

/** Set ar_chat to a new or existing ID. Only call when consent is granted. */
export function setChatId(id: string): void {
  if (!hasConversionConsent()) return;
  setCookie(AR_COOKIES.CHAT.name, id, { maxAgeDays: AR_COOKIES.CHAT.maxAgeDays });
}

/** Get or create chat ID: use ar_chat if present and consented; otherwise generate and store only if consented. */
export function getOrCreateChatId(): string {
  if (typeof window === "undefined") return "";
  const existing = getChatId();
  if (existing) return existing;
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  setChatId(id);
  return id;
}
