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

AutoRevenueOS does **not** currently implement user authentication or per-business access control. The following routes and their APIs are publicly callable from the frontend:

- `/dashboard` and `/api/dashboard`
- `/inbox` and `/api/inbox`
- `/recoveries` and `/api/recoveries`
- `/settings` and `/api/settings`

For production use, you should protect the app at the deployment layer, for example:

- **Basic HTTP auth** (username/password prompt) on the whole app or at least admin paths.  
- **Cloudflare Access**, Vercel Protection, or a similar access gateway.  
- **IP allowlisting** so only requests from trusted networks (VPN, office) can reach the app.

These controls should sit in front of your deployment and prevent unauthorised access to the UI and its APIs.

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
