/**
 * Google Analytics 4 — loaded only on marketing and login (not in authenticated app).
 * UK GDPR: only loads when cookie consent is granted. IP anonymized. Minimal events.
 */

const MEASUREMENT_ID = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID : undefined;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

function getDataLayer(): unknown[] {
  if (typeof window === "undefined") return [];
  if (!window.dataLayer) window.dataLayer = [];
  return window.dataLayer;
}

/** Call gtag if GA4 is loaded and measurement ID is set. */
function gtag(...args: unknown[]): void {
  if (!MEASUREMENT_ID || typeof window === "undefined") return;
  getDataLayer().push(args);
  if (window.gtag) window.gtag(...args);
}

/** Load the gtag script. Call only when consent granted and on allowed pages. */
export function loadGa4(): void {
  if (!MEASUREMENT_ID || typeof document === "undefined" || typeof window === "undefined") return;
  if (document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtagFn() {
    window.dataLayer?.push(arguments);
  };
  gtag("js", new Date());

  // Anonymize IP for UK GDPR
  gtag("config", MEASUREMENT_ID, {
    anonymize_ip: true,
    send_page_view: false, // we send page_view manually when we want it
  });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

/** Send page_view. Call only when GA4 is loaded (marketing/login + consent). */
export function trackPageView(path?: string): void {
  if (!MEASUREMENT_ID) return;
  gtag("event", "page_view", {
    page_path: path ?? (typeof window !== "undefined" ? window.location.pathname : "/"),
  });
}

export type GA4EventName =
  | "page_view"
  | "calculator_used"
  | "chat_started"
  | "signup_started"
  | "signup_completed";

/** Send a named event. No-op if GA4 not loaded or no consent. */
export function trackEvent(
  eventName: GA4EventName,
  params?: Record<string, string | number | boolean>
): void {
  if (!MEASUREMENT_ID) return;
  gtag("event", eventName, params ?? {});
}

/** Check if GA4 measurement ID is configured. */
export function isGa4Configured(): boolean {
  return Boolean(MEASUREMENT_ID);
}

/** Paths where GA4 is loaded (marketing + login). Used to only send events from allowed pages. */
export function isGa4AllowedPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === "/" || pathname === "/login") return true;
  if (pathname === "/marketing" || pathname.startsWith("/marketing")) return true;
  return false;
}
