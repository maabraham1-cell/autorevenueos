# Phone Recovery — end-to-end validation

Repeatable test flows to validate Phone Recovery onboarding, provisioning, missed-call handling, recovery SMS, and inbox reply. Run against a real environment with Twilio and Stripe configured.

---

## Prerequisites

- **Twilio:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`; `NEXT_PUBLIC_APP_URL` for webhooks.
- **Stripe:** Business must have a card on file (`activation_status = active`) before Phone Recovery can be enabled.
- **Supabase:** `businesses.twilio_phone_number`, `businesses.twilio_provisioning_error` (migration applied).

---

## 1. Signup (no number assigned)

**Goal:** Account and business are created; no Twilio number is provisioned. Setup success does **not** imply Phone Recovery is ready.

**Steps:**

1. Sign up or use an account with **no business** linked.
2. Create a business (e.g. Settings → “Create business” or `POST /api/setup` with `{ "name": "Test Business" }`).
3. **Expect:** `success: true`, `businessId`, `phone_recovery_available: false` (for new business). No Twilio number is purchased.
4. In **Settings → Phone Recovery**: status shows **Not set up**. If billing is not active, message: “Add your card to activate first.”
5. In DB: `businesses.twilio_phone_number` and `twilio_number_sid` are null for that business.

**Pass criteria:** Business exists; no number; UI and API do not imply Phone Recovery is active.

---

## 2. Settings provisioning (enable Phone Recovery)

**Goal:** User enables Phone Recovery in Settings; a number is provisioned only when the request succeeds and a number is actually assigned. Status is clearly Active, Pending, or Failed.

**Steps:**

1. Ensure the business has **activation_status = active** (card on file). In Settings → Billing & activation, add a card if needed.
2. Open **Settings → Phone Recovery**. Status should be **Not set up**.
3. Click **Enable Phone Recovery**.
4. **Expect (success):**
   - Status changes to **Provisioning…** then **Active**.
   - A recovery number appears (e.g. `+44 …`) with a Copy button.
   - Instruction: “Forward missed calls from your business phone to this number.”
   - In DB: `businesses.twilio_phone_number` and `twilio_number_sid` set; `twilio_provisioning_error` null.
5. **Expect (failure):** If Twilio fails (e.g. no numbers available, invalid credentials):
   - Status shows **Provisioning failed**.
   - Persisted error message is shown (from `twilio_provisioning_error`).
   - **Retry provisioning** button is available; after retry, settings refetch and updated error or success is shown.
   - In DB: `twilio_provisioning_error` contains the last error (truncated); no number assigned.

**Pass criteria:** Success only when a number is shown; failure state shows persisted error and retry; no conflation of “setup complete” with “Phone Recovery active.”

---

## 3. Forwarded missed call

**Goal:** A call forwarded to the recovery number is received by Twilio, webhook hits `POST /api/missed-call`, and a recovery is created (and optionally recovery SMS sent).

**Steps:**

1. Ensure the business has **Phone Recovery Active** (recovery number in Settings).
2. From another phone, call the **recovery number** (or use Twilio console to simulate an incoming call to that number). Let it ring and hang up (missed call) or ensure the webhook is triggered.
3. **Expect:** Twilio sends a POST to `{APP_URL}/api/missed-call` with `To` = recovery number, `From` = caller.
4. Backend looks up business by `twilio_phone_number`, creates/uses a contact, creates a recovery record, and may send a recovery SMS (see next section).
5. In **Dashboard / Inbox**: the missed-call lead appears; in DB: `recoveries` has a new row for that business and contact.

**Pass criteria:** Webhook returns 200; recovery record exists; no 403 (signature) or 500 (config) under normal conditions.

---

## 4. Recovery SMS

**Goal:** Recovery SMS contains the expected content and booking link; replies are received and stored.

**Steps:**

1. Trigger a missed call (or ensure a recovery was created) so that the system sends a recovery SMS to the caller.
2. On the **caller’s phone**, open the SMS. **Expect:**
   - Message body matches the business’s recovery template (e.g. business name, booking link).
   - Link points to the correct booking page (e.g. `/book/<business_id>?…`).
3. Reply to the SMS from the same phone.
4. **Expect:** Twilio sends a POST to `{APP_URL}/api/sms-webhook` with `To` = recovery number, `From` = replier. Backend looks up business by `To`, finds or creates contact, stores message in `messages`, and associates with recovery/conversation.
5. In **Inbox**: the conversation shows the reply.

**Pass criteria:** SMS received with correct content and link; reply appears in Inbox and in `messages` table.

---

## 5. Inbox reply flow

**Goal:** User can see conversations (including SMS replies) and reply from the Inbox; replies are sent via Twilio and stored.

**Steps:**

1. From **Inbox**, open a conversation that originated from a recovery (e.g. missed call + SMS reply).
2. **Expect:** Conversation shows incoming messages (e.g. SMS reply) and any existing thread.
3. Send a reply from the Inbox UI (e.g. “We’re here until 5pm today”).
4. **Expect:** Backend sends an SMS to the contact’s phone via Twilio; message is stored in `messages` with correct direction; conversation updates.
5. On the **contact’s phone**: receive the reply SMS.

**Pass criteria:** Inbox shows full thread; outbound reply is sent and stored; contact receives SMS.

---

## Summary

| Flow                    | What to validate                                                                 |
|-------------------------|-----------------------------------------------------------------------------------|
| Signup provisioning     | No number assigned; `phone_recovery_available: false`; status “Not set up.”       |
| Settings provisioning   | Active only when number shown; failed state + persisted error + Retry.           |
| Forwarded missed call   | Webhook 200; recovery created; visible in Dashboard/Inbox.                       |
| Recovery SMS            | Content and link correct; reply hits SMS webhook and appears in Inbox.           |
| Inbox reply flow        | Reply sent via Twilio; stored in `messages`; contact receives SMS.               |
