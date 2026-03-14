# Booking confirmation & billing — end-to-end validation

Repeatable test flows to prove the confirmation + billing loop is stable in live conditions. Run these against a real environment (Stripe test or live) with a business that has `stripe_customer_id` set.

---

## Prerequisites

- One business in the app with **`stripe_customer_id`** set (so meter events can be sent).
- **Stripe**: meter named `confirmed_bookings` with event name `confirmed_bookings`, customer mapping key `stripe_customer_id`, value key `value`.
- **AutoRevenueOS booking page**: `/book/<business_id>` reachable; optional query `?contact_id=...&recovery_id=...`.
- **Env**: `BOOKING_CONFIRM_SECRET` or `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`.

---

## 1. Confirmed booking success

**Goal:** One new confirmed booking is created and the Stripe meter is reported (billing_status = sent, billed_at set).

**Steps:**

1. Open the booking page: `https://<your-domain>/book/<business_id>` (get `business_id` from Settings or DB).
2. Click **Confirm booking**.
3. **Expect:** Success message (“Booking confirmed…”).
4. In **Dashboard**:
   - **Confirmed bookings** count increases by 1.
   - **Billed bookings** count increases by 1.
   - In “Confirmed bookings” table, a new row with **Billing status** = `sent`.
5. In **Stripe Dashboard** (Billing → Meters → your meter): usage for that customer increases by 1 (may take a short delay).
6. In DB: `confirmed_bookings` has one new row with `billing_status = 'sent'` and `billed_at` set. `billing_events` has `confirmed` and `meter_sent` for that booking.

**Pass criteria:** One new confirmed booking, one meter event sent, dashboard and Stripe in sync.

---

## 2. Duplicate confirmation (idempotent success)

**Goal:** Sending the same confirmation again returns success and does **not** create a second row or send a second meter event.

**Steps:**

1. From the **same** booking page session (same idempotency key), click **Confirm booking** again — or reload the page and confirm again with the same link (if the token is still valid and the key is re-used), **or** call the confirm API twice with the same `confirm_token` and `idempotency_key` in quick succession.
2. **Easiest:** Use the same booking page URL, click Confirm. Then (same session) click browser Back, then click Confirm again — the form may resubmit the same idempotency_key.
3. **Expect:** Both responses are HTTP 200 with `success: true` and the same `confirmed_booking_id`. No user-facing error.
4. In **Dashboard**:
   - **Confirmed bookings** count unchanged (still +1 from test 1).
   - **Billed bookings** count unchanged (still +1).
5. In **Stripe:** No extra meter event for that booking (Stripe idempotency by `confirmed_booking_id`).
6. In DB: Still one row for that booking. `billing_events` has a `duplicate_ignored` entry for the second attempt.

**Pass criteria:** Duplicate returns 200 and same id; no second row; no second meter event; duplicate_ignored logged.

---

## 3. Stripe meter failure

**Goal:** When the meter call fails (e.g. invalid key or Stripe down), the booking is still stored and shows `billing_status = failed`; no double-count when retried later.

**Steps:**

1. **Option A (temporary):** Set an invalid `STRIPE_SECRET_KEY` (e.g. `sk_test_invalid`) and restart the app. Create a new confirmed booking (use a different booking page session so a new idempotency_key, or use another business/source).
2. **Option B:** Use Stripe test mode and a customer ID that does not exist or is not in the same account, so the meter call fails.
3. Confirm a booking (e.g. from `/book/<business_id>` with a new session).
4. **Expect:** User still sees success (“Booking confirmed…”). Backend has stored the row and attempted the meter; meter call fails.
5. In **Dashboard**:
   - **Confirmed bookings** count increases by 1.
   - **Billed bookings** count does **not** increase.
   - New row in “Confirmed bookings” with **Billing status** = `failed` and an error snippet. **Retry billing** button is visible.
6. In **billing_events:** `confirmed` and `meter_failed` for that booking.
7. **Restore** valid `STRIPE_SECRET_KEY` (and valid customer) before the next test.

**Pass criteria:** Booking is stored; billing_status = failed; billed_at null; no meter event sent; user sees success; retry available.

---

## 4. Manual retry success

**Goal:** After a failed meter attempt, using “Retry billing” (or `POST /api/billing/retry`) sends the meter event and updates the row to sent.

**Steps:**

1. Start from a confirmed booking with **Billing status** = `failed` (e.g. from test 3, or create one and then break Stripe temporarily).
2. Ensure **Stripe is valid again** (correct `STRIPE_SECRET_KEY`, customer exists, meter configured).
3. In **Dashboard**, in the “Confirmed bookings” table, click **Retry billing** for that row.
4. **Expect:** Button shows “Retrying…” then the row’s status changes to `sent`; **Billed bookings** count increases by 1.
5. In **Stripe:** One new meter event for that customer (for that confirmed_booking id).
6. In DB: That row has `billing_status = 'sent'`, `billed_at` set, `billing_error` null. `billing_events` has another `meter_sent` (e.g. “Stripe meter event reported (retry).”).

**Pass criteria:** Retry sends one meter event; row and dashboard show sent; billed count increases; no duplicate meter for the same booking.

---

## Quick checklist (run in order)

| # | Scenario                 | What to do                          | Pass condition                                      |
|---|--------------------------|-------------------------------------|-----------------------------------------------------|
| 1 | Confirmed booking success| Confirm once from booking page      | +1 confirmed, +1 billed, status sent, Stripe +1     |
| 2 | Duplicate confirmation   | Confirm again (same idempotency)    | 200 both times, no extra row/meter, duplicate_ignored |
| 3 | Stripe meter failure     | Confirm with invalid Stripe config  | Row created, status failed, Retry visible, no meter |
| 4 | Manual retry success     | Click Retry billing for failed row  | Status → sent, +1 billed, Stripe +1                 |

---

## Definitions (for validation)

- **Recovered lead:** Attribution only (re-engagement). Not a confirmed booking; not billed. Counted in “Recovered leads” only.
- **Confirmed booking:** A booking we have recorded as confirmed (our booking page or integration webhook). Stored in `confirmed_bookings`. May or may not be billed.
- **Billed booking:** A confirmed booking for which we successfully reported a meter event to Stripe (`billed_at` set, `billing_status = sent`). **billed_at** means “meter event reported to Stripe” only — it does **not** mean the invoice has been paid.
