/**
 * Booking provider registry: status, trust level, confirmation method, credentials, and blocks.
 * Used for docs, dashboard, settings UI, and integration matrix.
 */

export type ConfirmationMethod =
  | "webhook"
  | "api"
  | "polling"
  | "bridge"
  | "manual_feed"
  | "redirect";

export type ProviderStatus = "full" | "partial" | "scaffolded";

/**
 * Trust level for billing and display:
 * - verified: Native webhook with signature verification, or our own booking page (signed token). Safe to bill.
 * - bridge: Feed/bridge endpoint; trust depends on INBOUND_FEED_SECRET or URL secrecy. Production-safe only when secret is enforced.
 * - unverified: Scaffolded or no verification; use for attribution only until credentials/verification exist.
 */
export type ProviderTrustLevel = "verified" | "bridge" | "unverified";

export type BookingProvider = {
  id: string;
  name: string;
  status: ProviderStatus;
  trustLevel: ProviderTrustLevel;
  confirmationMethod: ConfirmationMethod;
  credentialsNeeded: string[];
  blocksProduction: string | null;
  canTriggerConfirmedBookingsToday: boolean;
  routePath: string;
  notes?: string;
  /** Short label for Settings/Dashboard (e.g. "Verified webhook") */
  trustLabel?: string;
};

export const BOOKING_PROVIDERS: BookingProvider[] = [
  {
    id: "autorevenueos_booking_page",
    name: "AutoRevenueOS booking page",
    status: "full",
    trustLevel: "verified",
    trustLabel: "Verified",
    confirmationMethod: "redirect",
    credentialsNeeded: ["BOOKING_CONFIRM_SECRET or STRIPE_SECRET_KEY"],
    blocksProduction: null,
    canTriggerConfirmedBookingsToday: true,
    routePath: "/api/booking/confirm",
    notes: "Token-based confirm from our booking page.",
  },
  {
    id: "calendly",
    name: "Calendly",
    status: "full",
    trustLevel: "verified",
    trustLabel: "Verified webhook",
    confirmationMethod: "webhook",
    credentialsNeeded: [],
    blocksProduction: null,
    canTriggerConfirmedBookingsToday: true,
    routePath: "/api/webhooks/calendly",
  },
  {
    id: "cal.com",
    name: "Cal.com",
    status: "full",
    trustLevel: "verified",
    trustLabel: "Verified webhook",
    confirmationMethod: "webhook",
    credentialsNeeded: [],
    blocksProduction: null,
    canTriggerConfirmedBookingsToday: true,
    routePath: "/api/webhooks/calcom",
  },
  {
    id: "acuity",
    name: "Acuity Scheduling (Square)",
    status: "full",
    trustLevel: "verified",
    trustLabel: "Verified webhook",
    confirmationMethod: "webhook",
    credentialsNeeded: ["businesses.acuity_api_key (optional, for signature verification)"],
    blocksProduction: null,
    canTriggerConfirmedBookingsToday: true,
    routePath: "/api/webhooks/acuity",
  },
  {
    id: "square",
    name: "Square Appointments",
    status: "full",
    trustLevel: "verified",
    trustLabel: "Verified webhook",
    confirmationMethod: "webhook",
    credentialsNeeded: ["SQUARE_WEBHOOK_SIGNATURE_KEY", "businesses.square_merchant_id"],
    blocksProduction: null,
    canTriggerConfirmedBookingsToday: true,
    routePath: "/api/webhooks/square",
  },
  {
    id: "google_sheets",
    name: "Google Sheets",
    status: "full",
    trustLevel: "bridge",
    trustLabel: "Bridge (secret required in production)",
    confirmationMethod: "bridge",
    credentialsNeeded: ["INBOUND_FEED_SECRET (required in production)"],
    blocksProduction: null,
    canTriggerConfirmedBookingsToday: true,
    routePath: "/api/webhooks/google-sheets",
    notes: "Apps Script / Make / Zapier post row data; or use generic feed with source google_sheets.",
  },
  {
    id: "feed",
    name: "Generic feed (Zapier / Make / Pipedream)",
    status: "full",
    trustLevel: "bridge",
    trustLabel: "Bridge (secret required in production)",
    confirmationMethod: "bridge",
    credentialsNeeded: ["INBOUND_FEED_SECRET (required in production)"],
    blocksProduction: null,
    canTriggerConfirmedBookingsToday: true,
    routePath: "/api/webhooks/feed",
    notes: "POST JSON with business_id, confirmation_source, external_booking_id, etc.",
  },
  {
    id: "fresha",
    name: "Fresha",
    status: "partial",
    trustLevel: "bridge",
    trustLabel: "Bridge",
    confirmationMethod: "webhook",
    credentialsNeeded: ["Fresha partner/API (future); business_id in URL or body today"],
    blocksProduction: "No public webhook; use Make/Zapier or partner webhook when available.",
    canTriggerConfirmedBookingsToday: true,
    routePath: "/api/webhooks/fresha",
    notes: "Accepts bridge payload or future Fresha webhook. businesses.fresha_venue_id for future mapping.",
  },
  {
    id: "timely",
    name: "Timely",
    status: "partial",
    trustLevel: "bridge",
    trustLabel: "Bridge",
    confirmationMethod: "webhook",
    credentialsNeeded: ["Timely API (future); business_id in URL or body today"],
    blocksProduction: "No public webhook; use Make/Zapier or API polling when credentials available.",
    canTriggerConfirmedBookingsToday: true,
    routePath: "/api/webhooks/timely",
    notes: "Accepts bridge payload or future Timely webhook. businesses.timely_company_id for future.",
  },
  {
    id: "treatwell",
    name: "Treatwell",
    status: "partial",
    trustLevel: "bridge",
    trustLabel: "Bridge",
    confirmationMethod: "webhook",
    credentialsNeeded: ["Treatwell partner (future); business_id in URL or body today"],
    blocksProduction: "Partner/API access for native webhook; use bridge until then.",
    canTriggerConfirmedBookingsToday: true,
    routePath: "/api/webhooks/treatwell",
  },
  {
    id: "cliniko",
    name: "Cliniko",
    status: "partial",
    trustLevel: "bridge",
    trustLabel: "Bridge",
    confirmationMethod: "bridge",
    credentialsNeeded: ["business_id in URL or body"],
    blocksProduction: "No native webhook; use Zapier/Integrately or polling to hit this endpoint.",
    canTriggerConfirmedBookingsToday: true,
    routePath: "/api/webhooks/cliniko",
  },
  {
    id: "setmore",
    name: "Setmore",
    status: "partial",
    trustLevel: "bridge",
    trustLabel: "Bridge",
    confirmationMethod: "bridge",
    credentialsNeeded: ["business_id in URL or body"],
    blocksProduction: "No official public webhook; use bridge (Make/Zapier) to post here.",
    canTriggerConfirmedBookingsToday: true,
    routePath: "/api/webhooks/setmore",
  },
  {
    id: "jane",
    name: "Jane App",
    status: "partial",
    trustLevel: "bridge",
    trustLabel: "Bridge",
    confirmationMethod: "bridge",
    credentialsNeeded: ["business_id in URL or body"],
    blocksProduction: "Jane webhook/polling not wired; use bridge to post here.",
    canTriggerConfirmedBookingsToday: true,
    routePath: "/api/webhooks/jane",
  },
  {
    id: "booksy",
    name: "Booksy",
    status: "partial",
    trustLevel: "bridge",
    trustLabel: "Bridge",
    confirmationMethod: "bridge",
    credentialsNeeded: ["business_id in URL or body"],
    blocksProduction: "Partner access for native webhook; use bridge until then.",
    canTriggerConfirmedBookingsToday: true,
    routePath: "/api/webhooks/booksy",
  },
];

/**
 * Look up provider by confirmation_source (e.g. from confirmed_bookings.confirmation_source).
 * Use for dashboard and settings to show trust level and display name.
 */
export function getProviderBySource(source: string): BookingProvider | null {
  if (!source || typeof source !== "string") return null;
  const normalized = source.trim().toLowerCase();
  return BOOKING_PROVIDERS.find((p) => p.id === normalized) ?? null;
}

/** Allowlisted confirmation_source values for the generic feed (prevents arbitrary source injection). */
export const FEED_ALLOWED_SOURCES: string[] = [
  "google_sheets",
  "zapier",
  "make",
  "pipedream",
  "manual_feed",
  "fresha",
  "timely",
  "treatwell",
  "cliniko",
  "setmore",
  "jane",
  "booksy",
  "acuity",
  "calendly",
  "cal.com",
  "square",
];
