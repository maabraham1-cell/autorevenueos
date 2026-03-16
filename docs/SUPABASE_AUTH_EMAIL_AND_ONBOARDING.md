# Supabase auth email templates and post-confirmation onboarding

This doc covers sender configuration, email template branding, and the post-confirmation redirect so new users land in the correct onboarding flow.

---

## Sender configuration

All authentication and system emails from Supabase Auth should use:

| Setting | Value |
|--------|--------|
| **Sender name** | AutoRevenueOS |
| **Sender email** | noreply@autorevenueos.com |

These are system emails; replies are not expected. In the Supabase Dashboard:

1. Go to **Project Settings → Auth → SMTP Settings** (or use custom SMTP).
2. Set the sender name to **AutoRevenueOS** and sender address to **noreply@autorevenueos.com**.

If you use the built-in Supabase mailer, configure the sender in **Authentication → Email** (or equivalent) so all auth emails (confirm signup, magic link, recovery, invite) use this identity.

**Support contact in emails:**  
Every template footer should reference **support@autorevenueos.com** for help. Use **hello@autorevenueos.com** for general sales or partnership enquiries outside the product.

---

## What’s operational on the site

Not every Supabase email is triggered by the app. This is what the site actually uses today:

| Feature | On the site? | Notes |
|--------|----------------|-------|
| **Confirm sign up** | Yes | Sign up form sends confirmation email; callback redirects to /setup. |
| **Log in (password)** | Yes | Login form uses email + password. |
| **Reset password** | Yes | “Forgot password?” on login sends reset email; user sets new password via Supabase link. |
| **Magic link** | No | No “Log in with magic link” option; templates ready if you add it. |
| **Invite user** | No | No team/invite UI; templates ready if you add it. |
| **Change email address** | No | No account setting to change email; template ready if you add it. |
| **Reauthentication** | No | No sensitive action that requires reauth; template ready if you add it. |
| **Security notifications** | Partial | Sent by Supabase when events happen. “Password changed” is used after reset; others apply if you add change-email, MFA, etc. |

To add more (e.g. magic link, invite, change email), implement the flow in the app and use the existing templates in the Dashboard.

---

## Email templates to update

Templates live in the repo under `docs/` as HTML files. Copy the **Body** (and optionally **Subject**) into the Supabase Dashboard for each type.

### Authentication templates (first screen)

| Supabase template | Subject (suggested) | Body source file |
|-------------------|--------------------|-------------------|
| **Confirm sign up** | Confirm your AutoRevenueOS account | `docs/SUPABASE_EMAIL_CONFIRM_SIGNUP_TEMPLATE.html` |
| **Invite user** | You're invited to AutoRevenueOS | `docs/SUPABASE_EMAIL_INVITE_TEMPLATE.html` |
| **Magic link** | Log in to AutoRevenueOS | `docs/SUPABASE_EMAIL_MAGIC_LINK_TEMPLATE.html` |
| **Change email address** | Confirm your new email address | `docs/SUPABASE_EMAIL_CHANGE_EMAIL_TEMPLATE.html` |
| **Reset password** | Reset your AutoRevenueOS password | `docs/SUPABASE_EMAIL_RECOVERY_PASSWORD_TEMPLATE.html` |
| **Reauthentication** | Confirm reauthentication | `docs/SUPABASE_EMAIL_REAUTHENTICATION_TEMPLATE.html` |

### Security notification templates (second screen)

Enable each notification in **Authentication → Email Templates** (toggle on), then set the body from the file below. These are sent when the user changes password, email, phone, identity, or MFA.

| Supabase notification | Subject (suggested) | Body source file |
|------------------------|---------------------|-------------------|
| **Password changed** | Your password has been changed | `docs/SUPABASE_EMAIL_NOTIFICATION_PASSWORD_CHANGED.html` |
| **Email address changed** | Your email address has been changed | `docs/SUPABASE_EMAIL_NOTIFICATION_EMAIL_CHANGED.html` |
| **Phone number changed** | Your phone number has been changed | `docs/SUPABASE_EMAIL_NOTIFICATION_PHONE_CHANGED.html` |
| **Identity linked** | A new identity has been linked | `docs/SUPABASE_EMAIL_NOTIFICATION_IDENTITY_LINKED.html` |
| **Identity unlinked** | An identity has been unlinked | `docs/SUPABASE_EMAIL_NOTIFICATION_IDENTITY_UNLINKED.html` |
| **Multi-factor authentication method added** | A new MFA method has been added | `docs/SUPABASE_EMAIL_NOTIFICATION_MFA_ADDED.html` |
| **Multi-factor authentication method removed** | An MFA method has been removed | `docs/SUPABASE_EMAIL_NOTIFICATION_MFA_REMOVED.html` |

All of these:

- Use a **white card** layout, ~600px max-width, centred.
- Use **AutoRevenueOS blue** (#1E3A8A) for the main CTA button and branding.
- Include the **AutoRevenueOS** heading and tagline: *Turn missed calls into confirmed bookings automatically.*
- Include the footer: *Need help? Contact support@autorevenueos.com* and the tagline.
- Use **inline CSS** only (email-client safe).
- **Do not remove or rename** Supabase template variables (e.g. `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .Email }}`, `{{ .OldEmail }}`, `{{ .Provider }}`, `{{ .FactorType }}`, etc.).

Auth templates (confirm signup, magic link, reset password, invite, change email) include a blue CTA button; reauthentication shows the one-time code. Security notification templates are text-only (no button).

---

## Confirm-signup email content (reference)

- **Subject:** Confirm your AutoRevenueOS account  
- **Headline:** Confirm your AutoRevenueOS account  
- **Body:** Thanks for signing up for AutoRevenueOS. Click the button below to confirm your email and activate your account. Once confirmed, you'll be able to start recovering missed calls and converting them into bookings automatically.  
- **Button:** Confirm your email  
- **Footer:** If you didn't create an AutoRevenueOS account, you can safely ignore this email. Need help? Contact support@autorevenueos.com. AutoRevenueOS — Turn missed calls into confirmed bookings automatically.

---

## Post-confirmation redirect (new user → /setup)

When a user signs up and then clicks **Confirm your email** in the confirmation email:

1. Supabase validates the token and redirects the browser to the **redirect URL** that was passed at signup.
2. The app passes **emailRedirectTo** in `signUp` options:  
   `{origin}/auth/callback?next=/setup`
3. So after confirmation, the user lands on **/auth/callback?next=/setup** with the session in the URL (hash or query). The callback page establishes the session and then redirects to **next**, i.e. **/setup**.
4. **/setup** (see `app/setup/page.tsx`) immediately redirects to **/settings**, where the user continues onboarding.

**Required Supabase configuration:**

- In **Authentication → URL Configuration**, add to **Redirect URLs**:
  - `https://your-production-domain.com/auth/callback`
  - `http://localhost:3000/auth/callback` (for local dev)
- The confirmation link in the email is generated by Supabase and will send users to the above callback with the session; the callback then sends them to **/setup**.

**Flow summary:**

- New user signs up → receives confirmation email → clicks **Confirm your email** → lands on `/auth/callback?next=/setup` → session is set → redirect to **/setup** → redirect to **/settings** for onboarding.

---

## Onboarding expectations (/setup → /settings)

The **/setup** route redirects to **/settings**. The Settings page is the main onboarding surface:

1. **Business details** — Create or select business; name, industry, booking link, etc.
2. **Payment method** — Billing & activation: add card so the business becomes active.
3. **Phone recovery** — Enable Phone Recovery and (optionally) provision Twilio number.
4. **Twilio recovery number** — Provisioning is triggered from Settings when the user enables Phone Recovery (and has an active billing status).

The goal is that new users complete setup in one place (Settings) without getting lost; **/setup** is a stable entry point that always takes them there.

---

## Human verification (Cloudflare Turnstile)

Login and signup require human verification before submit. If **Cloudflare Turnstile** is configured:

- **Env:** `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (client) and `TURNSTILE_SECRET_KEY` (server).
- The Turnstile widget is shown on the login page; on success it provides a token. On submit, the app calls **`POST /api/turnstile-verify`** with the token; the API verifies it with Cloudflare’s Siteverify API. If verification fails or the token is expired, the user must complete the challenge again.
- After an auth failure (e.g. wrong password), the widget is reset so the user must verify again on retry.
- **Token verification before Supabase:** On submit, the client calls **POST /api/turnstile-verify** with the token before calling Supabase. If verification fails, the error "Human verification failed. Please try again." is shown and Supabase is never called. If it succeeds, signUp or signInWithPassword runs as before; email confirmation and redirect to /setup are unchanged. The submit button stays disabled until Turnstile verification succeeds.

If Turnstile keys are not set, a simple “Verify you are human” checkbox is shown instead (no server verification).

---

## Implementation notes

- Email template HTML is in **docs/**; paste into Supabase Dashboard (Authentication → Email Templates) for each type.
- **Preserve** all Supabase placeholders (e.g. `{{ .ConfirmationURL }}`, `{{ .Email }}` where used).
- Styles are **inline** for compatibility with email clients; avoid external stylesheets or advanced CSS.
- **/auth/callback** is a client page that reads the session from the URL and redirects to `next` (default `/setup`).
- **emailRedirectTo** is set in `app/(auth)/login/page.tsx` in the `signUp` options so new signups send users to the callback and then to **/setup**.
