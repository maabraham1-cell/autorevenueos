# Cookies and browser storage (technical reference)

This document describes the cookies and storage AutoRevenueOS uses. For user-facing wording, see the [Cookie Policy](/cookies) page.

## Summary

| Cookie / storage | Type | Purpose | Essential | Duration |
|------------------|------|---------|-----------|----------|
| Supabase auth | Cookie | Session / login | Yes | Session |
| `ar_cookie_consent` | Cookie | Consent decision | Yes | 12 months |
| `ar_vid` | Cookie | Unique visitor ID (conversion) | No | 12 months |
| `ar_source` | Cookie | Traffic source (direct/google/twitter/referral) | No | 90 days |
| `ar_campaign` | Cookie | UTM campaign data | No | 90 days |
| `ar_chat` | Cookie | Website chat continuity | No (functional) | 30 days |
| `ar_chat_session` | sessionStorage | Chat ID when consent not granted (session-only) | — | Session |

All `ar_*` cookies: first-party, Secure, SameSite=Lax, path=/. No personal data stored.

---

## 1. Supabase authentication (cookies)

- **Source:** `createBrowserClient` / `createServerClient` from `@supabase/auth-helpers-nextjs`.
- **Names:** e.g. `sb-*-auth-token` and chunked variants.
- **Set by:** Supabase client; we do not set these ourselves.

---

## 2. AutoRevenueOS first-party cookies (lib/cookies.ts, lib/consent.ts)

- **ar_cookie_consent** — Set when user clicks Accept or Reject in the cookie banner. Values: `granted` | `rejected`. Essential (no consent required for this cookie).
- **ar_vid** — Random UUID, set when user accepts. Used for conversion journey (visit → calculator → chat → signup). Only set if consent granted.
- **ar_source** — Derived from `document.referrer`: `direct` (empty), `google`, `twitter`, or `referral`. Refreshed on each load when consent granted.
- **ar_campaign** — From URL query: `utm_source`, `utm_medium`, `utm_campaign` joined by `|`. Set/refreshed when UTM present and consent granted.
- **ar_chat** — Random ID for chat widget continuity. Set when user has consented and first opens chat. If consent not granted, chat uses sessionStorage key `ar_chat_session` for session-only continuity.

---

## Consent flow

- **CookieConsentBanner** (components/CookieConsentBanner.tsx): Shown until `ar_cookie_consent` is set. Accept → set consent, then set ar_vid (if missing), ar_source, ar_campaign. Reject → set consent only.
- **refreshConversionCookiesIfConsented()**: Called on load when consent already granted; ensures ar_vid exists and refreshes ar_source and ar_campaign.

---

## Files involved

- **Cookie util:** `lib/cookies.ts` (setCookie, getCookie, AR_COOKIES)
- **Consent + conversion:** `lib/consent.ts` (getConsent, setConsent, setConversionCookiesOnAccept, refreshConversionCookiesIfConsented, getOrCreateChatId)
- **Banner:** `components/CookieConsentBanner.tsx`
- **Chat:** `components/chat/WebsiteChatWidget.tsx` (uses getOrCreateChatId when consented, else sessionStorage)
- **Layout:** `app/layout.tsx` (includes CookieConsentBanner)
- **Policy:** `app/cookies/page.tsx`
