# Booking confirmation integrations

This document lists which booking systems are **fully integrated**, **partially integrated**, or **scaffolded**, and what is required to trigger `confirmed_bookings` (and thus Stripe meter events).

## Confirmation model (consistent across all sources)

Each confirmed booking is stored in `confirmed_bookings` with:

| Field | Description |
|-------|-------------|
| `business_id` | Our business (required). |
| `contact_id` | Our contact when we can match (e.g. by email from provider). |
| `recovery_id` | Linked recovery when we find one for that contact. |
| `external_booking_id` | Provider’s booking/id so we can dedupe. |
| `confirmed_at` | When the booking was confirmed (provider time when available). |
| `confirmation_source` | e.g. `calendly`, `cal.com`, `acuity`, `square`, `autorevenueos_booking_page`. |
| `billed_at` | Set when we successfully reported to Stripe (null if no Stripe customer or report failed). |

Stripe meter events for `confirmed_bookings` are sent **only** when a row is inserted here (and the business has `stripe_customer_id`). Link clicks and recoveries never trigger the meter.

---

## Fully integrated (webhook → confirmed_booking → optional Stripe meter)

These work end-to-end once configured: provider sends webhook → we verify (when applicable) → we insert `confirmed_bookings` and optionally report to Stripe.

### 1. Calendly

- **Webhook:** `POST /api/webhooks/calendly?business_id=<BUSINESS_UUID>`
- **Trigger:** Calendly “Invitee created” (invitee schedules an event).
- **Setup:** In Calendly create a webhook subscription for “Invitee created” with the URL above. Keep the URL private.
- **Mapping:** We use invitee email to find `contact_id` and latest `recovery_id` for that business. `external_booking_id` = invitee or event URI.
- **Credentials:** None required in app. Optional: add Calendly signature verification if they provide a signing key.

### 2. Cal.com

- **Webhook:** `POST /api/webhooks/calcom?business_id=<BUSINESS_UUID>`
- **Trigger:** “Booking Created” (or “Booking Confirmed”) in Cal.com developer webhooks.
- **Setup:** In Cal.com go to Settings → Developer → Webhooks; add Subscriber URL above; select “Booking Created”.
- **Mapping:** We use first attendee email for `contact_id` / `recovery_id`. `external_booking_id` = payload `uid`.
- **Credentials:** None required. Optional: set a secret in Cal.com and verify (e.g. `CAL_WEBHOOK_SECRET`) if you add verification.

### 3. Acuity Scheduling (Square)

- **Webhook:** `POST /api/webhooks/acuity?business_id=<BUSINESS_UUID>`
- **Trigger:** Acuity “appointment scheduled” (or “changed” for any change).
- **Setup:** In Acuity Integrations set the Webhook URL above. In AutoRevenueOS set `businesses.acuity_api_key` to that Acuity account’s API key (used to verify `x-acuity-signature`).
- **Mapping:** We do not get email in the webhook; `contact_id` and `recovery_id` are null. `external_booking_id` = `acuity:<appointment_id>`.
- **Credentials:** Per business: `businesses.acuity_api_key` (for signature verification). Optional: if omitted we accept the webhook and rely on URL secrecy.

### 4. Square Appointments

- **Webhook:** `POST /api/webhooks/square` (no query params; we use payload to find business).
- **Trigger:** Square “booking.created”.
- **Setup:** In Square Developer Dashboard create a webhook for “booking.created” with this URL. Set `SQUARE_WEBHOOK_SIGNATURE_KEY` in env (from Square). For each business using Square, set `businesses.square_merchant_id` to their Square merchant ID.
- **Mapping:** `merchant_id` in payload → business via `square_merchant_id`. No customer in payload; `contact_id` and `recovery_id` are null. `external_booking_id` = `square:<booking_id>`.
- **Credentials:** Env `SQUARE_WEBHOOK_SIGNATURE_KEY`. Per business: `businesses.square_merchant_id`.

### 5. AutoRevenueOS booking page

- **Flow:** Customer opens `/book/<businessId>?contact_id=...&recovery_id=...`, gets a signed token, then POSTs to `POST /api/booking/confirm` with that token. We record one confirmed booking with `confirmation_source: autorevenueos_booking_page`.
- **Mapping:** `contact_id` and `recovery_id` come from the signed token (query params). No `external_booking_id` from provider.
- **Credentials:** `BOOKING_CONFIRM_SECRET` (or `STRIPE_SECRET_KEY`) for token signing.

---

## Partially integrated / manual setup

- **Acuity:** Works as above but we cannot link to contact/recovery without fetching appointment by ID (would need Acuity API key and a follow-up fetch).
- **Square:** Works as above but we cannot link to contact/recovery without customer info in the webhook or a separate API call.

---

## Scaffolded (not yet implemented)

These routes exist but return **501** and a short hint. They document what is missing for a full integration.

| Provider | Route | What’s missing |
|----------|--------|----------------|
| **Cliniko** | `POST /api/webhooks/cliniko` | No native webhooks in public API; would need polling or third-party bridge (Integrately, Zapier). |
| **Setmore** | `POST /api/webhooks/setmore` | No official public webhook docs found; need Setmore webhook or API for “appointment created”. |
| **Jane App** | `POST /api/webhooks/jane` | Developer API exists (OAuth, List Appointments); no clear webhook for booking-created; could poll. |
| **Fresha** | `POST /api/webhooks/fresha` | Typically partner/API access required. |
| **Booksy** | `POST /api/webhooks/booksy` | Typically partner/API access required. |

---

## How `confirmed_bookings` is triggered (summary)

Stripe meter events for **confirmed_bookings** are sent **only** when:

1. **Provider webhook** – Calendly, Cal.com, Acuity, or Square sends a webhook; we verify (when configured), then call `recordConfirmedBooking(...)`, which inserts into `confirmed_bookings` and, if the business has `stripe_customer_id`, reports one unit to Stripe and sets `billed_at`.
2. **AutoRevenueOS booking page** – User confirms on our page; we verify the token and call `recordConfirmedBooking(..., confirmation_source: "autorevenueos_booking_page")`.

They are **not** triggered by:

- Recovery creation (meta-webhook, etc.).
- Link clicks (attribution only).
- Any event that does not go through `recordConfirmedBooking()`.

---

## Environment and database

- **Stripe:** `STRIPE_SECRET_KEY`; create a meter named `confirmed_bookings` in Stripe.
- **Booking page:** `BOOKING_CONFIRM_SECRET` (optional; falls back to `STRIPE_SECRET_KEY`).
- **Square:** `SQUARE_WEBHOOK_SIGNATURE_KEY` (optional but recommended).
- **Per business:** `businesses.stripe_customer_id` (for billing), `businesses.acuity_api_key` (Acuity verification), `businesses.square_merchant_id` (Square mapping).
- **Contacts:** `contacts.email` improves matching for Calendly and Cal.com.
