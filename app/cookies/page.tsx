'use client';

import { LegalPageLayout, type TocItem } from '@/components/legal/LegalPageLayout';

const LAST_UPDATED = 'Last updated: 13 March 2026';

const TOC: TocItem[] = [
  { id: 'introduction', label: 'Introduction' },
  { id: 'cookie-list', label: 'List of cookies' },
  { id: 'strictly-necessary', label: 'Strictly necessary' },
  { id: 'functional', label: 'Functional' },
  { id: 'conversion', label: 'Conversion (with consent)' },
  { id: 'analytics', label: 'Google Analytics 4' },
  { id: 'no-marketing', label: 'No other marketing trackers' },
  { id: 'technical', label: 'Technical details' },
  { id: 'managing-cookies', label: 'Managing cookies' },
  { id: 'contact', label: 'Contact' },
];

export default function CookiesPage() {
  return (
    <LegalPageLayout title="Cookie Policy" lastUpdated={LAST_UPDATED} toc={TOC}>
      <section id="introduction">
        <h2>1. Introduction</h2>
        <p>
          This Cookie Policy explains how AutoRevenue Systems LTD (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) uses cookies
          when you use the AutoRevenueOS website and application. We use a minimal set of first-party cookies:
          essential cookies for the service and your consent choice, and           optional cookies for conversion tracking
          (e.g. visit → calculator → chat → signup) only if you accept. We use Google Analytics 4 (GA4) on the
          marketing site and login page only when you have accepted cookies; IP addresses are anonymised and we
          track a minimal set of events. We do not use other marketing or third-party advertising trackers. Our
          own cookies are first-party, use Secure and SameSite=Lax, and we do not store personal data in them.
        </p>
      </section>

      <section id="cookie-list">
        <h2>2. List of cookies</h2>
        <p>
          In addition to authentication cookies set by our login provider (Supabase), we use the following
          first-party cookies:
        </p>
        <table className="mt-4 w-full border-collapse text-sm [&_td]:border [&_td]:border-[#E5E7EB] [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-[#E5E7EB] [&_th]:bg-[#F8FAFC] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left">
          <thead>
            <tr>
              <th>Name</th>
              <th>Purpose</th>
              <th>Duration</th>
              <th>Essential</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>ar_cookie_consent</code></td>
              <td>Stores your cookie consent decision (Accept / Reject optional cookies).</td>
              <td>12 months</td>
              <td>Yes</td>
            </tr>
            <tr>
              <td><code>ar_vid</code></td>
              <td>Unique visitor ID for conversion tracking (e.g. visit → calculator → chat → signup).</td>
              <td>12 months</td>
              <td>No</td>
            </tr>
            <tr>
              <td><code>ar_source</code></td>
              <td>Traffic source (direct, google, twitter, referral).</td>
              <td>90 days</td>
              <td>No</td>
            </tr>
            <tr>
              <td><code>ar_campaign</code></td>
              <td>UTM campaign data when present in the URL.</td>
              <td>90 days</td>
              <td>No</td>
            </tr>
            <tr>
              <td><code>ar_chat</code></td>
              <td>Website chat session continuity so your messages stay in one conversation.</td>
              <td>30 days</td>
              <td>No</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3">
          Authentication cookies (e.g. <code>sb-*-auth-token</code>) are set by Supabase when you log in; see
          &quot;Strictly necessary&quot; below.
        </p>
      </section>

      <section id="strictly-necessary">
        <h2>3. Strictly necessary</h2>
        <h3>ar_cookie_consent</h3>
        <p>
          We store your choice (Accept or Reject optional cookies) so we do not ask again on every visit. This
          cookie is essential for the consent mechanism and does not require consent itself under UK/ePrivacy rules.
        </p>
        <h3>Authentication (Supabase)</h3>
        <p>
          When you log in, our authentication provider sets cookies so your session is recognised and you stay
          logged in. These are strictly necessary for the service. Name pattern: <code>sb-*-auth-token</code> and
          related chunked cookies. Session-based duration.
        </p>
      </section>

      <section id="functional">
        <h2>4. Functional</h2>
        <h3>ar_chat</h3>
        <p>
          The website chat widget uses this cookie to associate your messages with the same conversation when
          you return. It is set only when you have accepted optional cookies and when you first open the chat.
          If you reject optional cookies, chat still works within a single session using session storage only.
          Duration: 30 days. First-party, no personal data.
        </p>
      </section>

      <section id="conversion">
        <h2>5. Conversion (with consent)</h2>
        <p>
          If you click &quot;Accept&quot; in our cookie banner, we set the following cookies to understand how visitors
          move through the site (e.g. visit → calculator → chat → signup). We use this only to improve our
          product and messaging; we do not use them for advertising or to identify you personally.
        </p>
        <ul>
          <li><strong>ar_vid</strong> — A random unique visitor ID. Duration: 12 months.</li>
          <li><strong>ar_source</strong> — Traffic source: direct, google, twitter, or referral (derived from referrer, not personal data). Duration: 90 days.</li>
          <li><strong>ar_campaign</strong> — UTM campaign data (utm_source, utm_medium, utm_campaign) when present in the URL. Duration: 90 days.</li>
        </ul>
      </section>

      <section id="analytics">
        <h2>6. Google Analytics 4</h2>
        <p>
          When you have accepted optional cookies, we load Google Analytics 4 (GA4) only on the marketing site
          (home and marketing pages) and the login page. We do not load or track GA4 on authenticated app pages
          (e.g. dashboard, inbox, settings). GA4 is used to understand how visitors move through the site
          (e.g. page views, use of the revenue calculator, chat, and signup). We have configured IP anonymisation
          and send only a minimal set of events (page_view, calculator_used, chat_started, signup_started,
          signup_completed). Google may set cookies such as <code>_ga</code> and <code>_ga_*</code> when GA4 is
          loaded; these are non-essential and are only set after you accept. For more information, see
          Google&apos;s <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a> and
          <a href="https://policies.google.com/technologies/cookies" target="_blank" rel="noopener noreferrer"> use of cookies</a>.
        </p>
      </section>

      <section id="no-marketing">
        <h2>7. No other marketing trackers</h2>
        <p>
          We do not use marketing cookies other than the analytics described above, third-party advertising
          cookies, or social-media pixels. If we introduce any additional tracking in the future, we will update
          this policy and obtain consent where required.
        </p>
      </section>

      <section id="technical">
        <h2>8. Technical details</h2>
        <p>
          All cookies we set use <strong>Secure</strong> (sent only over HTTPS), <strong>SameSite=Lax</strong>, and
          <strong> path=/</strong>. They are first-party only. We do not store personal data in these cookies;
          values are random identifiers or non-personal categories (e.g. &quot;google&quot;, &quot;direct&quot;).
        </p>
      </section>

      <section id="managing-cookies">
        <h2>8. Managing cookies</h2>
        <p>
          You can block or delete cookies in your browser settings. Blocking strictly necessary cookies may
          prevent you from staying logged in or from having your consent choice remembered. If you previously
          accepted optional cookies and want to withdraw, clear the <code>ar_cookie_consent</code>, <code>ar_vid</code>,
          <code>ar_source</code>, <code>ar_campaign</code>, and <code>ar_chat</code> cookies; we will show the
          banner again and will not set conversion cookies until you accept.
        </p>
        <p>
          For more about how we process personal data, see our <a href="/privacy">Privacy Policy</a>.
        </p>
      </section>

      <section id="contact">
        <h2>10. Contact</h2>
        <p>
          For questions about this Cookie Policy, contact us at{' '}
          <a href="mailto:hello@autorevenueos.com">hello@autorevenueos.com</a>.
        </p>
        <p className="mt-2 text-[#334155]">
          <strong>AutoRevenue Systems LTD</strong><br />
          Office 326, 18 Young St, UNIT LGE<br />
          Edinburgh EH2 4JB<br />
          Scotland
        </p>
      </section>
    </LegalPageLayout>
  );
}
