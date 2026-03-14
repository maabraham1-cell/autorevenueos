# Twilio phone number provisioning

AutoRevenueOS can automatically purchase a Twilio phone number for each business and configure it for missed-call detection and recovery SMS.

## Flow

1. **New business signs up**  
   When a business is created (e.g. via `POST /api/setup`), **no** Twilio number is provisioned. The API returns `phone_recovery_available: false`. The business must add a card (Billing) and then enable Phone Recovery in Settings.

2. **Existing business enables Phone Recovery**  
   In Settings → Phone Recovery, if the business has no number yet and billing is active, the user clicks **Enable Phone Recovery**. The app calls `POST /api/settings/provision-phone`, which provisions a number (or returns the existing one) and updates the business. Success is only when a number is actually assigned; failures are stored in `twilio_provisioning_error` and shown in the UI with a Retry option.

3. **Webhooks**  
   The provisioned number is configured so that:
   - **Voice** → `POST {baseUrl}/api/missed-call`
   - **SMS** → `POST {baseUrl}/api/sms-webhook`  
   Existing missed-call and SMS webhook handlers route by `twilio_phone_number` (the “To” number) to the correct business.

4. **Dashboard**  
   Settings shows the **Recovery number** (e.g. `+44 xxxx xxxx`) with the instruction: *“Forward missed calls from your business phone to this number.”* A copy button copies the number.

## When provisioning runs

- **Onboarding:** `POST /api/setup` does **not** provision a Twilio number. It only creates the business and links the profile. Phone Recovery is enabled later in Settings after the user adds a card.
- **Settings:** When the user clicks **Enable Phone Recovery** and the business has no number, `POST /api/settings/provision-phone` runs. It is idempotent: if the business already has a number, it returns that number without purchasing another. On failure, the error is stored in `businesses.twilio_provisioning_error` and returned to the client; the UI shows **Provisioning failed** and a **Retry** button.

## Idempotency

- If `businesses.twilio_phone_number` is already set for the business, `provisionNumberForBusiness` returns that number and does not purchase a new one.
- A business never receives two numbers from this flow.

## Environment

- **`TWILIO_ACCOUNT_SID`** and **`TWILIO_AUTH_TOKEN`** — Required for provisioning and for webhook signature verification / sending SMS. If missing, provisioning is skipped (onboarding still succeeds).
- **`NEXT_PUBLIC_APP_URL`** — Base URL used for voice and SMS webhook URLs (e.g. `https://yourapp.com`). If not set, the setup route uses the request host.

## Location and country

- The business **location** (e.g. from Settings) is used to prefer a local number: UK-style locations → GB, Ireland → IE, otherwise GB then US/IE as fallbacks.
- If no numbers are available in the preferred country, the code tries fallback countries (GB, US, IE) until one succeeds.

## Database

- **`businesses.twilio_phone_number`** — E.164 number used to route webhooks and send recovery SMS.
- **`businesses.twilio_number_sid`** — Twilio IncomingPhoneNumber SID (`PN...`) for the provisioned number. Used for future operations (e.g. update webhooks, release number).
- **`businesses.twilio_provisioning_error`** — Last provisioning error message (cleared on success). Shown in Settings when status is **Provisioning failed**; supports Retry.

Migrations: `20260319000000_business_twilio_number_sid.sql`, `20260321000000_business_twilio_provisioning_error.sql`.

## Code

- **`lib/twilio-number.ts`** — `provisionNumberForBusiness()`, `locationToCountryCode()`, `setNumberWebhooks()`, `releaseNumberForBusiness()` (for future use).
- **`app/api/setup/route.ts`** — Creates business and links profile; does **not** call Twilio. Returns `phone_recovery_available: false` for new businesses.
- **`app/api/settings/provision-phone/route.ts`** — `POST` for the current user’s business; idempotent provision; persists/clears `twilio_provisioning_error`.

## Future

- **Release number** — `releaseNumberForBusiness(businessId)` is implemented; can be exposed (e.g. “Release number” in Settings) when a business cancels.
- **Rotate number** — Implement by releasing the current number and calling `provisionNumberForBusiness` again.
- **Number pools** — Structure allows adding pool-based assignment later.
