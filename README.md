## AutoRevenueOS

AutoRevenueOS is a Next.js application for turning missed enquiries into recovered revenue.

## Getting Started

First, run the development server:

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) with your browser.

## Deployment Checklist

Before deploying AutoRevenueOS, make sure the following environment variables are set.

### Required environment variables

- **`META_APP_SECRET`** (server only)  
  - The Meta (Facebook/Instagram) app secret.  
  - Used to verify `X-Hub-Signature-256` on `POST /api/meta-webhook`.  
  - Never expose this to the browser.

- **`META_VERIFY_TOKEN`** (server only)  
  - Token used by Meta to verify the webhook URL via `GET /api/meta-webhook`.  
  - Must match the verify token configured in your Meta app settings.

- **`NEXT_PUBLIC_SUPABASE_URL`** (exposed to client)  
  - The Supabase project URL, e.g. `https://xyzcompany.supabase.co`.  
  - Safe to expose; used by the client to talk to Supabase.

- **`SUPABASE_ANON_KEY`** (exposed to client)  
  - Supabase anonymous (public) key.  
  - Used by the client for read/write operations allowed to anon.  
  - Do **not** use the service role key on the client.

- **`SUPABASE_SERVICE_ROLE_KEY`** (server only)  
  - Supabase service role key with elevated privileges.  
  - Only used on the server (e.g. in API routes).  
  - Must never be embedded in client-side code or sent to the browser.

- **`TWILIO_ACCOUNT_SID`** (server only)  
  - Twilio account SID used to send SMS via the Twilio API.

- **`TWILIO_AUTH_TOKEN`** (server only)  
  - Twilio auth token used both for sending messages and verifying `X-Twilio-Signature` on incoming webhooks.

- **`TWILIO_PHONE_NUMBER`** (server only)  
  - Default Twilio phone number used when sending outbound SMS.

- **`META_PAGE_ACCESS_TOKEN`** (server only)  
  - Access token used to send replies via the Meta Graph API.

### Optional

- **`NEXT_PUBLIC_GA_MEASUREMENT_ID`** (exposed to client)  
  - Google Analytics 4 measurement ID (e.g. `G-XXXXXXXXXX`).  
  - If set, GA4 is loaded only on the marketing site and login page when the user has accepted cookies; IP is anonymised and only a minimal set of events is tracked.

- **`RESEND_API_KEY`** (server only)  
  - Resend.com API key for sending email. If set, a notification is sent to `WEBSITE_CHAT_NOTIFY_EMAIL` (default `hello@autorevenue.com`) when someone sends a message via the website chat (so it appears in the Inbox).

- **`WEBSITE_CHAT_NOTIFY_EMAIL`** (server only)  
  - Email address to receive website-chat notifications. Defaults to `hello@autorevenue.com` if not set.

### Webhook Security

- `POST /api/meta-webhook` verifies the Meta webhook signature using `X-Hub-Signature-256` and `META_APP_SECRET`.
- The server:
  - Reads the raw request body.
  - Computes an HMAC SHA-256 signature using `META_APP_SECRET`.
  - Compares it to the `x-hub-signature-256` header.
  - Logs:
    - `[meta-webhook] POST received`
    - `[meta-webhook] signature verified` or `[meta-webhook] signature verification failed`
- If the signature is invalid or missing, the endpoint responds with:

```json
{ "error": "Invalid webhook signature" }
```

and HTTP status **403**.

This prevents spoofed webhook events from creating fake messages or recoveries.

### App Access Protection

AutoRevenueOS uses Supabase Auth for sign-in and a middleware to protect internal pages and APIs.

Protected pages:

- `/dashboard`
- `/inbox`
- `/recoveries`
- `/settings`

Protected APIs:

- `/api/dashboard`
- `/api/inbox`
- `/api/recoveries`
- `/api/recoveries/[id]`
- `/api/settings`
- `/api/setup`
- `/api/chat/website`
- `/api/test`

Public endpoints:

- Marketing and landing pages: `/`, `/marketing`, `/login`
- Webhooks: `/api/missed-call`, `/api/sms-webhook`, `/api/meta-webhook`
- Health check: `/api/health`

All business-scoped queries use the authenticated Supabase user and a `profiles` table to resolve the active `business_id`. For a new user, a business is created and linked automatically.

For higher security (especially in multi-tenant production), you should additionally:

- Enable Supabase Row Level Security (RLS) and back it with the `profiles.business_id` linkage.
- Put the deployment behind WAF/CDN-level protection (e.g. Cloudflare, Vercel protection features) for DDoS and abuse mitigation.

### Testing the Webhook

To validate webhook security end-to-end:

1. **Set env vars**
   - Configure `META_APP_SECRET` and `META_VERIFY_TOKEN` in your deployment environment.

2. **Configure Meta app**
   - Set the webhook URL in your Meta app to `https://your-domain/api/meta-webhook`.
   - Set the verify token to `META_VERIFY_TOKEN`.

3. **Send a real message**
   - From your connected Messenger or Instagram account, send a message to the page.

4. **Check logs**
   - Verify logs show:
     - `[meta-webhook] POST received`
     - `[meta-webhook] signature verified`
     - Subsequent logs for contact/message/recovery processing.

5. **Verify product behavior**
   - Confirm the auto-reply is sent.
   - Confirm Inbox shows the conversation.
   - Confirm Recoveries and Dashboard update as expected after re-engagement.

6. **Test rejection of invalid requests**
   - Manually issue a `POST` to `/api/meta-webhook` without a valid `X-Hub-Signature-256` (e.g. with curl or Postman).
   - Confirm the response is HTTP **403** with:

   ```json
   { "error": "Invalid webhook signature" }
   ```
   - Confirm logs show `[meta-webhook] signature verification failed` or a missing/invalid signature message.

### Smoke tests

For a quick local smoke test (with the dev server running on `http://localhost:3000`):

```bash
npm run smoke
```

This script checks:

- `/api/health`
- `/api/missed-call` (GET)
- `/marketing`

and exits with a non-zero code if any of them return a non-2xx response.
