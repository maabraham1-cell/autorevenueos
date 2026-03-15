# Auth & signup email rate limit

Supabase Auth applies a **rate limit on emails** sent for signup, password recovery, and email change. When the limit is exceeded, signup (and similar flows) return an error like *"Email rate limit exceeded"*.

## Default behaviour

- **Built-in Supabase SMTP**: typically **3–4 emails per hour** per project (exact value can vary).
- The limit applies to: signup confirmation, password reset, and email update flows.
- If a user tries to sign up twice in a short time (e.g. they fix a field and resubmit), the second attempt can hit this limit.

## Increasing the limit

1. **Supabase Dashboard**  
   Go to **Authentication → Rate Limits** and adjust the email rate limit if the option is available.

2. **Custom SMTP**  
   If you configure [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) for your project, you get more control and can set higher limits in the dashboard or via the [Management API](https://supabase.com/docs/guides/auth/rate-limits).

3. **Management API** (when allowed)  
   Example to raise the limit (e.g. to 10 emails per hour):
   ```bash
   curl -X PATCH "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
     -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"rate_limit_email_sent": 10}'
   ```

## In-app behaviour

The login/signup page detects rate-limit errors from Supabase and shows a friendly message: *"Too many signup attempts. Please wait about an hour before trying again, or try logging in if you already have an account."*
