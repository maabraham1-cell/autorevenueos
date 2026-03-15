# Booking confirmation integrations

This document lists which booking systems are **fully integrated**, **partially integrated**, or **scaffolded**, and what is required to trigger `confirmed_bookings` (and thus Stripe meter events).

## Trust levels

- **Verified** — Native webhook with signature verification (e.g. Calendly, Cal.com, Acuity, Square) or our own booking page (signed token). Safe to bill; source is cryptographically or token-verified.
- **Bridge** — Feed or automation endpoint (generic feed, Google Sheets, Fresha/Timely/Cliniko/Setmore/Jane/Booksy bridge). Trust depends on **INBOUND_FEED_SECRET** in production; when set, callers must send `Authorization: Bearer <INBOUND_FEED_SECRET>`.
- **Unverified** — Scaffolded or no verification; for attribution only until credentials exist.

In **production** (`NODE_ENV=production`), the generic feed and Google Sheets endpoints **require** `INBOUND_FEED_SECRET` to be set; otherwise they return **503** (feed disabled). This makes bridge usage explicit and production-safe.

---

## Confirmation model (consistent across all sources)

Each confirmed booking is stored in `confirmed_bookings` with:

| Field | Description |
|-------|-------------|
| `business_id` | Our business (required). |
| `contact_id` | Our contact when we can match (e.g. by email from provider). |
| `recovery_id` | Linked recovery when we find one for that contact. |
| `external_booking_id` | Provider’s booking/id so we can dedupe. |
| `confirmed_at` | When the booking was confirmed (provider time when available). |
| `confirmation_source` | e.g. `calendly`, `cal.com`, `acuity`, `square`, `google_sheets`, `fresha`, … |
| `billed_at` | Set when we successfully reported to Stripe (null if no Stripe customer or report failed). |

Stripe meter events for `confirmed_bookings` are sent **only** when a row is inserted via `recordConfirmedBooking()`. Link clicks and recoveries never trigger the meter.

---

## Provider registry and matrix

See **Integration matrix** table below. Programmatic registry: `lib/booking-providers.ts`.

---

## Fully integrated (webhook → confirmed_booking → optional Stripe meter)

### Calendly

- **Webhook:** `POST /api/webhooks/calendly?business_id=<BUSINESS_UUID>`
- **Trigger:** Calendly “Invitee created” (invitee schedules an event).
- **Setup:** In Calendly create a webhook subscription for “Invitee created” with the URL above.
- **Mapping:** Invitee email → `contact_id` / `recovery_id`. `external_booking_id` = invitee or event URI.
- **Credentials:** None required. Optional: Calendly signature verification if they provide a signing key.

### Cal.com

- **Webhook:** `POST /api/webhooks/calcom?business_id=<BUSINESS_UUID>`
- **Trigger:** “Booking Created” (or “Booking Confirmed”) in Cal.com developer webhooks.
- **Setup:** Cal.com → Settings → Developer → Webhooks; add Subscriber URL; select “Booking Created”.
- **Mapping:** First attendee email → contact/recovery. `external_booking_id` = payload `uid`.
- **Credentials:** None required. Optional: webhook secret for verification.

### Acuity Scheduling (Square)

- **Webhook:** `POST /api/webhooks/acuity?business_id=<BUSINESS_UUID>`
- **Trigger:** Acuity “appointment scheduled”.
- **Setup:** Acuity Integrations → Webhook URL. Set `businesses.acuity_api_key` for signature verification.
- **Mapping:** No email in webhook; `contact_id`/`recovery_id` null. `external_booking_id` = `acuity:<appointment_id>`.
- **Credentials:** Per business: `businesses.acuity_api_key` (optional, for verification).

### Square Appointments

- **Webhook:** `POST /api/webhooks/square`
- **Trigger:** Square “booking.created”.
- **Setup:** Square Developer Dashboard → webhook for “booking.created”. Env: `SQUARE_WEBHOOK_SIGNATURE_KEY`. Per business: `businesses.square_merchant_id`.
- **Mapping:** `merchant_id` → business. No customer in payload; `external_booking_id` = `square:<booking_id>`.
- **Credentials:** `SQUARE_WEBHOOK_SIGNATURE_KEY`; per business: `businesses.square_merchant_id`.

### Generic feed (Zapier / Make / Pipedream)

- **Webhook:** `POST /api/webhooks/feed`
- **Body (JSON):** `business_id`, `confirmation_source` (allowlisted), `external_booking_id?`, `contact_id?`, `recovery_id?`, `confirmed_at?`
- **Credentials:** Optional `INBOUND_FEED_SECRET` → `Authorization: Bearer <secret>`.

### Google Sheets

- **Webhook:** `POST /api/webhooks/google-sheets?business_id=<BUSINESS_UUID>` or body `business_id`
- **Body:** `external_booking_id?`, `email?`, `contact_id?`, `recovery_id?`, `confirmed_at?`. We resolve contact/recovery from `email` when provided.
- **Docs:** See `docs/GOOGLE_SHEETS_BOOKING_FEED.md` (Apps Script sample, row mapping, Make/Zapier).
- **Credentials:** Optional `INBOUND_FEED_SECRET`.

### AutoRevenueOS booking page

- **Flow:** Customer opens `/book/<businessId>?contact_id=...&recovery_id=...`, gets signed token, then POSTs to `POST /api/booking/confirm` with that token.
- **Credentials:** `BOOKING_CONFIRM_SECRET` or `STRIPE_SECRET_KEY` for token signing.

---

## Partially integrated (bridge or stub; can trigger confirmed_bookings today)

These endpoints **accept a standardised payload** (and optionally future native webhooks). Use them from Make/Zapier/Pipedream or a small polling job until the provider offers native webhooks or API.

### Fresha

- **Route:** `POST /api/webhooks/fresha?business_id=<UUID>`
- **Body:** `business_id?`, `external_booking_id` or `booking_id`, `email?`, `confirmed_at?`
- **Credentials:** None for bridge. Future: `businesses.fresha_venue_id`, `businesses.fresha_webhook_secret` when partner webhook is available.
- **Blocks full production:** No public webhook; use bridge or partner webhook when available.

### Timely

- **Route:** `POST /api/webhooks/timely?business_id=<UUID>`
- **Body:** `business_id?`, `external_booking_id` or `appointment_id`, `email?`, `confirmed_at?`
- **Credentials:** None for bridge. Future: `businesses.timely_company_id`, `businesses.timely_webhook_secret` for API polling or webhook.
- **Blocks full production:** No public webhook; use bridge or API polling when credentials available.

### Treatwell

- **Route:** `POST /api/webhooks/treatwell?business_id=<UUID>`
- **Body:** `business_id?`, `external_booking_id` or `booking_id`, `email?`, `confirmed_at?`
- **Blocks full production:** Partner/API access for native webhook; use bridge until then.

### Cliniko

- **Route:** `POST /api/webhooks/cliniko?business_id=<UUID>`
- **Body:** `business_id?`, `external_booking_id` or `appointment_id`, `email?`, `confirmed_at?`
- **Blocks full production:** No native webhook; use Zapier/Integrately or poll Cliniko API and POST here.

### Setmore

- **Route:** `POST /api/webhooks/setmore?business_id=<UUID>`
- **Body:** `business_id?`, `external_booking_id` or `appointment_id`, `email?`, `confirmed_at?`
- **Blocks full production:** No official public webhook; use bridge to post here.

### Jane App

- **Route:** `POST /api/webhooks/jane?business_id=<UUID>`
- **Body:** `business_id?`, `external_booking_id` or `appointment_id`, `email?`, `confirmed_at?`
- **Blocks full production:** Jane webhook/polling not wired; use bridge to post here.

### Booksy

- **Route:** `POST /api/webhooks/booksy?business_id=<UUID>`
- **Body:** `business_id?`, `external_booking_id` or `booking_id`, `email?`, `confirmed_at?`
- **Blocks full production:** Partner access for native webhook; use bridge until then.

---

## How `confirmed_bookings` is triggered (summary)

Stripe meter events are sent **only** when:

1. **Provider webhook** – Calendly, Cal.com, Acuity, Square sends a webhook; we verify (when configured), then call `recordConfirmedBooking(...)`.
2. **Generic feed / Google Sheets** – Zapier, Make, Pipedream, or Apps Script POSTs to `/api/webhooks/feed` or `/api/webhooks/google-sheets` with valid payload → `recordConfirmedBooking(...)`.
3. **Bridge endpoints** – Fresha, Timely, Treatwell, Cliniko, Setmore, Jane, Booksy: when something (automation or future webhook) POSTs the expected body → `recordConfirmedBooking(...)`.
4. **AutoRevenueOS booking page** – User confirms on our page; we verify the token and call `recordConfirmedBooking(..., confirmation_source: "autorevenueos_booking_page")`.

They are **not** triggered by recovery creation, link clicks, or any path that does not go through `recordConfirmedBooking()`.

---

## Integration matrix

| Provider | Status | Confirmation method | Credentials needed | What blocks full production | Can trigger confirmed_bookings today |
|----------|--------|---------------------|--------------------|-----------------------------|--------------------------------------|
| AutoRevenueOS booking page | full | redirect | BOOKING_CONFIRM_SECRET or STRIPE_SECRET_KEY | — | Yes |
| Calendly | full | webhook | None | — | Yes |
| Cal.com | full | webhook | None | — | Yes |
| Acuity (Square) | full | webhook | businesses.acuity_api_key (optional) | — | Yes |
| Square Appointments | full | webhook | SQUARE_WEBHOOK_SIGNATURE_KEY, businesses.square_merchant_id | — | Yes |
| Generic feed (Zapier/Make/Pipedream) | full | bridge | INBOUND_FEED_SECRET (optional) | — | Yes |
| Google Sheets | full | bridge | INBOUND_FEED_SECRET (optional) | — | Yes |
| Fresha | partial | webhook (bridge today) | business_id in URL/body; future: fresha_venue_id, fresha_webhook_secret | No public webhook; use bridge or partner | Yes |
| Timely | partial | webhook (bridge today) | business_id in URL/body; future: timely_company_id, timely_webhook_secret | No public webhook; use bridge or API polling | Yes |
| Treatwell | partial | webhook (bridge today) | business_id in URL/body | Partner/API for native webhook | Yes |
| Cliniko | partial | bridge | business_id in URL/body | No native webhook; use Zapier/polling | Yes |
| Setmore | partial | bridge | business_id in URL/body | No official public webhook | Yes |
| Jane App | partial | bridge | business_id in URL/body | Jane webhook/polling not wired | Yes |
| Booksy | partial | bridge | business_id in URL/body | Partner access for native webhook | Yes |

---

## Environment and database

- **Stripe:** `STRIPE_SECRET_KEY`; create a meter named `confirmed_bookings` in Stripe.
- **Booking page:** `BOOKING_CONFIRM_SECRET` (optional; falls back to `STRIPE_SECRET_KEY`).
- **Square:** `SQUARE_WEBHOOK_SIGNATURE_KEY` (optional but recommended).
- **Feed/Sheets:** `INBOUND_FEED_SECRET` — **required in production** for `/api/webhooks/feed` and `/api/webhooks/google-sheets`. When set, requests must send `Authorization: Bearer <INBOUND_FEED_SECRET>`. If not set in production, those endpoints return 503.
- **Per business:** `businesses.stripe_customer_id` (for billing), `businesses.acuity_api_key`, `businesses.square_merchant_id`, and optional provider fields from migration `20260318000000_booking_provider_settings.sql` (fresha_venue_id, timely_company_id, etc.).
- **Contacts:** `contacts.email` improves matching for Calendly, Cal.com, and all bridge endpoints that send `email`.
