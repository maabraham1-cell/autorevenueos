# Booking confirmation architecture

## Summary

- **Recoveries** = attribution only (re-engaged lead). No Stripe meter.
- **Confirmed bookings** = chargeable. Stripe `confirmed_bookings` meter is sent **only** when a trusted confirmation is recorded.
- Link clicks remain attribution-only; we never send meter events on link click alone.

## Source of truth

- Table: `confirmed_bookings` (recovery_id, contact_id, business_id, external_booking_id, confirmed_at, confirmation_source, billed_at, idempotency_key, billing_status, billing_error).
- **Only** `recordConfirmedBooking()` in `lib/confirm-booking.ts` may call Stripe (via `lib/stripe-meter.ts`). No other code path may trigger usage. Recoveries and link clicks never call the meter.
- **billed_at** means strictly “meter event successfully reported to Stripe”. It does NOT mean the invoice has been paid.
- Idempotency: same booking is never billed twice. Dedupe by `(business_id, external_booking_id, confirmation_source)` for integrations, or by `idempotency_key` when provided. Duplicate confirmations return **success** with the existing `confirmed_booking_id` (idempotent; no user-facing error).
- `billing_status`: `pending` | `sent` | `skipped` | `failed`. Audit log in `billing_events`. Failed billing can be retried via `POST /api/billing/retry` (body: `{ confirmed_booking_id }`); Dashboard shows a “Retry billing” button for failed rows.

## Confirmation sources (see [BOOKING_INTEGRATIONS.md](BOOKING_INTEGRATIONS.md) for full list)

1. **`autorevenueos_booking_page`** – Our minimal booking/confirmation page.
2. **Calendly** – Webhook `invitee.created`; map by email to contact/recovery.
3. **Cal.com** – Webhook “Booking Created”; map by attendee email.
4. **Acuity** – Webhook appointment `scheduled`; verify with `businesses.acuity_api_key`.
5. **Square Appointments** – Webhook `booking.created`; map `merchant_id` via `businesses.square_merchant_id`.
6. **Scaffolded (501):** Cliniko, Setmore, Jane App, Fresha, Booksy — see BOOKING_INTEGRATIONS.md.

## First integration recommendation: **Calendly**

- **Why:** Very common for SMBs (salons, clinics, consultants). Simple webhook (`invitee.created`), clear payload (invitee email, event URI). One webhook URL per business: `.../api/webhooks/calendly?business_id=<UUID>`.
- **Setup:** In Calendly create a webhook for “Invitee created” pointing to that URL. Add `email` to contacts (migration included) so we can match invitee → contact and optionally → recovery.
- **Alternative:** Cal.com is a strong alternative (open source, similar webhook model) if your target customers use it.

## If broad integrations are slow: AutoRevenueOS booking page

- **Minimal flow:** Public page `/book/[businessId]?contact_id=...&recovery_id=...`. We issue a short-lived signed token; on “Confirm booking” we verify the token and record one confirmed booking (source `autorevenueos_booking_page`), then report to Stripe.
- **Use case:** Businesses that don’t have (or don’t want to connect) Calendly/Cal.com can use our link in messages; the customer confirms on our page and we still charge only on that confirmation.

## Billing alignment

- **Stripe meter:** Create a meter in Stripe with event name `confirmed_bookings`, customer mapping key `stripe_customer_id`, value key `value` (value = 1 per event).
- **When we report:** Only inside `recordConfirmedBooking()` after a successful insert. Stripe idempotency uses `confirmed_bookings.id` so the same row is never double-counted. Application-level dedupe prevents duplicate rows (external_booking_id + source, or idempotency_key).
- **When we do not report:** Recovery creation (meta-webhook, etc.), link clicks, or any path that does not call `recordConfirmedBooking()`.
- **Visibility:** Dashboard shows Recovered leads (attribution), Confirmed bookings, and Billed bookings separately. Failed or skipped billing events appear in the dashboard and are logged in `billing_events`.

## End-to-end validation

Repeatable test flows for the live billing loop (confirmed booking success, duplicate confirmation, Stripe meter failure, manual retry success) are in **[BOOKING_BILLING_E2E_VALIDATION.md](BOOKING_BILLING_E2E_VALIDATION.md)**. Use them to prove the confirmation + billing flow is stable before widening integrations.

## Environment

- `STRIPE_SECRET_KEY` – required to report meter events.
- `BOOKING_CONFIRM_SECRET` – required for the AutoRevenueOS booking page token (defaults to `STRIPE_SECRET_KEY` if unset).
- `SUPABASE_SERVICE_ROLE_KEY` – required for inserting `confirmed_bookings` and for webhooks.
- Optional: `businesses.stripe_customer_id` – set when the business is onboarded to Stripe so we can report usage.
