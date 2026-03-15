# Billing and activation (card required)

AutoRevenueOS requires a valid card on file before a business can use billable features. No charge is made until a booking is confirmed (£3 per confirmed booking).

## Activation states

| Status | Meaning |
|--------|--------|
| **onboarding** | Just created; not yet configured. |
| **payment_required** | No valid payment method. Business cannot use phone recovery or confirmed booking billing until a card is added. |
| **active** | Card on file. Phone recovery and confirmed booking meter (billing) are enabled. |
| **suspended** | Admin or billing issue (e.g. payment failed). Reserved for future use. |

New businesses are created with `activation_status = 'payment_required'`. They become **active** only after successfully completing the Add Card flow (SetupIntent + confirm-setup).

## Card setup flow

1. User goes to **Settings → Billing & activation**.
2. Clicks **Add your card**.
3. Backend creates or reuses a **Stripe Customer** for the business and creates a **SetupIntent**; returns `client_secret` to the client.
4. Client renders **Stripe Elements** (PaymentElement) with that `client_secret`.
5. User enters card details and submits. Client calls `stripe.confirmSetup({ elements, clientSecret })`.
6. On success, client calls **POST /api/billing/confirm-setup** with `setup_intent_id`.
7. Backend retrieves the SetupIntent, sets the payment method as the customer’s default, and sets **business.activation_status = 'active'** and **business.stripe_default_payment_method_id**.
8. No charge is made; the card is stored for future use (metered billing when a booking is confirmed).

## What is gated

- **recordConfirmedBooking()**  
  Inserts into `confirmed_bookings` always. It **reports to the Stripe meter** only when the business has **stripe_customer_id** and **activation_status === 'active'**. Otherwise it sets `billing_status = 'skipped'` and does not send a meter event.

- **Phone Recovery**  
  **POST /api/settings/provision-phone** returns **402** with message *"Add your card to activate AutoRevenueOS before enabling Phone Recovery"* when **activation_status !== 'active'**. The Settings UI shows “Add your card to activate first” in the Phone Recovery section when not active.

- **Dashboard**  
  When **activation_status !== 'active'**, the dashboard shows a callout: *"Add your card to activate AutoRevenueOS"* with link to Settings.

## Environment

- **STRIPE_SECRET_KEY** — Used for Stripe Customer, SetupIntent, and meter events.
- **NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY** — Used by the Add Card form (Stripe Elements) in the browser.

## Database

- **businesses.activation_status** — `onboarding | payment_required | active | suspended`.
- **businesses.stripe_customer_id** — Set when the customer is created (at first “Add your card” click).
- **businesses.stripe_default_payment_method_id** — Set when SetupIntent is confirmed (card on file).

Migration: `supabase/migrations/20260320000000_business_activation_status.sql`.

## Safety

- **recordConfirmedBooking()** remains the only path that can trigger Stripe usage (meter).
- Meter is sent only when the business is **active** (card on file).
- No upfront charge, no trial, no setup fee — only £3 per confirmed booking, and only after activation.
