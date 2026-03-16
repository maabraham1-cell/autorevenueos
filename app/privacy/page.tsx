'use client';

import { LegalPageLayout, type TocItem } from '@/components/legal/LegalPageLayout';

const LAST_UPDATED = 'Last updated: 13 March 2026';

const TOC: TocItem[] = [
  { id: 'introduction', label: 'Introduction' },
  { id: 'information-we-collect', label: 'Information we collect' },
  { id: 'how-we-use', label: 'How we use information' },
  { id: 'legal-basis', label: 'Legal basis (UK GDPR)' },
  { id: 'data-sharing', label: 'Data sharing with service providers' },
  { id: 'data-retention', label: 'Data retention' },
  { id: 'security', label: 'Security measures' },
  { id: 'international-transfers', label: 'International data transfers' },
  { id: 'your-rights', label: 'Your rights under UK GDPR' },
  { id: 'cookies', label: 'Cookies and tracking' },
  { id: 'policy-updates', label: 'Policy updates' },
  { id: 'contact', label: 'Contact information' },
];

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated={LAST_UPDATED} toc={TOC}>
      <section id="introduction">
        <h2>1. Introduction</h2>
        <p>
          AutoRevenue Systems LTD (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates AutoRevenueOS, a software platform that helps
          businesses recover missed revenue by re-engaging leads through messaging channels. This Privacy Policy
          explains how we collect, use, store, and protect personal data when you use our website, the
          AutoRevenueOS application, and related services. We are committed to handling personal data in
          accordance with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.
          We act as a data controller in respect of account and usage data, and as a data processor (on your
          behalf) where we process customer contact and messaging data that you control through the platform.
        </p>
      </section>

      <section id="information-we-collect">
        <h2>2. Information we collect</h2>
        <p>
          We may collect and process the following categories of information:
        </p>
        <h3>Account information</h3>
        <p>
          When you register and use AutoRevenueOS, we collect your email address, password (stored in hashed
          form), and any profile details you provide (e.g. full name, phone number). We may also store
          authentication and session data necessary to keep you logged in and to secure your account.
        </p>
        <h3>Business information</h3>
        <p>
          We collect and store information about the business(es) you create in the Service, such as business
          name, industry, website, booking or callback links, and messaging configuration (e.g. templates,
          phone numbers you connect). This allows us to provide the Service and personalise your experience.
        </p>
        <h3>Customer contact and messaging data</h3>
        <p>
          In order to provide the Service, we process data about your end customers that you submit or that
          flows through the platform: for example, phone numbers, names, and the content of missed-call events,
          inbound messages, and outbound messages sent via the Service. AutoRevenueOS is a platform provider:
          you (or your business) are the sender of communications; we process this data on your behalf to
          deliver the Service. You are responsible for ensuring you have a lawful basis and, where required,
          consent to process this data.
        </p>
        <h3>Technical information</h3>
        <p>
          We automatically collect certain technical data when you use our website or the Service, including IP
          address, browser type and version, device type, operating system, and approximate location (e.g.
          country or region). We may also collect logs of requests, errors, and performance data to operate,
          secure, and improve the Service.
        </p>
      </section>

      <section id="how-we-use">
        <h2>3. How we use information</h2>
        <p>
          We use the information we collect to:
        </p>
        <ul>
          <li>Provide, operate, and maintain the AutoRevenueOS platform (e.g. account management, dashboards, inbox, recoveries, integrations).</li>
          <li>Process missed-call and messaging data so you can follow up with your customers via SMS, WhatsApp, and other supported channels.</li>
          <li>Send you service-related communications (e.g. account notifications, security alerts, product updates) where necessary for the performance of our contract or our legitimate interests.</li>
          <li>Improve the Service, diagnose issues, and analyse usage in an aggregated or anonymised way.</li>
          <li>Comply with legal obligations and enforce our Terms of Service.</li>
          <li>Protect the security and integrity of our systems and users.</li>
        </ul>
        <p>
          We do not use your or your customers&apos; data for marketing our own products to your end customers;
          we act as a platform provider supporting your communications.
        </p>
      </section>

      <section id="legal-basis">
        <h2>4. Legal basis under UK GDPR</h2>
        <p>
          We process personal data only where we have a valid legal basis:
        </p>
        <ul>
          <li><strong>Contract:</strong> Processing necessary to perform our contract with you (e.g. account creation, providing the Service, billing).</li>
          <li><strong>Legitimate interests:</strong> Where necessary for our legitimate interests (e.g. security, fraud prevention, improving the Service, analytics) and not overridden by your rights.</li>
          <li><strong>Legal obligation:</strong> Where required to comply with law (e.g. responding to lawful requests, retaining records).</li>
          <li><strong>Consent:</strong> Where we rely on consent (e.g. optional marketing from us, non-essential cookies), you may withdraw it at any time.</li>
        </ul>
        <p>
          Where we process personal data on your behalf as a processor (e.g. your end customers&apos; contact and
          messaging data), you are responsible for establishing your own lawful basis (e.g. consent or
          legitimate interest) for that processing.
        </p>
      </section>

      <section id="data-sharing">
        <h2>5. Data sharing with service providers</h2>
        <p>
          We share data only as necessary to operate the Service and as described in this policy. We use the
          following categories of service providers, who act as processors (or, where applicable, sub-processors)
          under written agreements that require them to protect personal data:
        </p>
        <ul>
          <li><strong>Twilio:</strong> For telephony and SMS delivery. Message content and recipient identifiers may be processed by Twilio in accordance with their privacy policy and our instructions.</li>
          <li><strong>Meta (Instagram / Facebook):</strong> Where you use our Meta integration, data necessary for messaging (e.g. identifiers, message content) may be processed by Meta in accordance with their terms and our configuration.</li>
          <li><strong>Hosting and infrastructure:</strong> We use hosting and database providers (e.g. Supabase, Vercel or similar) to run the Service. These providers process data in the UK, EEA, or other locations where we have appropriate safeguards in place.</li>
        </ul>
        <p>
          We do not sell personal data to third parties. We may disclose data if required by law, to protect our
          rights or safety, or in connection with a merger, sale, or restructuring, subject to confidentiality
          and data protection obligations.
        </p>
      </section>

      <section id="data-retention">
        <h2>6. Data retention</h2>
        <p>
          We retain personal data only for as long as necessary to fulfil the purposes set out in this policy,
          including to provide the Service, comply with legal obligations (e.g. tax, regulatory), resolve
          disputes, and enforce our agreements. Account and business data are generally retained while your
          account is active and for a reasonable period after closure to allow for reactivation and legal
          compliance. Messaging and recovery data are retained in line with your use of the Service and our
          backup and retention schedules. You may request deletion of your account and associated data; we will
          honour such requests where consistent with our legal and operational requirements. Aggregated or
          anonymised data may be retained longer for analytics and improvement.
        </p>
      </section>

      <section id="security">
        <h2>7. Security measures</h2>
        <p>
          We implement appropriate technical and organisational measures to protect personal data against
          unauthorised access, alteration, disclosure, or destruction. These include encryption in transit and
          at rest where applicable, access controls, secure authentication, and regular review of our security
          practices. Our service providers are selected with regard to their security and compliance posture.
          No method of transmission or storage is completely secure; we encourage you to use strong passwords
          and to notify us promptly of any suspected unauthorised access.
        </p>
      </section>

      <section id="international-transfers">
        <h2>8. International data transfers</h2>
        <p>
          Your data may be processed in the United Kingdom and, where we use service providers or systems
          located outside the UK (e.g. in the EEA or the US), we ensure appropriate safeguards are in place,
          such as UK adequacy decisions, standard contractual clauses, or other mechanisms approved under UK
          data protection law. You may request details of the safeguards we use for specific transfers by
          contacting us at the details below.
        </p>
      </section>

      <section id="your-rights">
        <h2>9. Your rights under UK GDPR</h2>
        <p>
          If you are in the UK (or our processing is subject to UK GDPR), you have the right to:
        </p>
        <ul>
          <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
          <li><strong>Rectification:</strong> Request correction of inaccurate or incomplete data.</li>
          <li><strong>Erasure:</strong> Request deletion of your personal data in certain circumstances.</li>
          <li><strong>Restrict processing:</strong> Request that we limit how we use your data in certain cases.</li>
          <li><strong>Data portability:</strong> Receive your data in a structured, machine-readable format where applicable.</li>
          <li><strong>Object:</strong> Object to processing based on legitimate interests or for direct marketing.</li>
          <li><strong>Withdraw consent:</strong> Where we rely on consent, withdraw it at any time.</li>
          <li><strong>Complain:</strong> Lodge a complaint with the Information Commissioner&apos;s Office (ICO) in the UK.</li>
        </ul>
        <p>
          To exercise these rights, contact us at <a href="mailto:support@autorevenueos.com">support@autorevenueos.com</a>. We will respond within the
          timeframes required by law. For data we process on your behalf as a processor (e.g. your end
          customers&apos; data), we will assist you in responding to their requests where set out in our agreement
          with you.
        </p>
      </section>

      <section id="cookies">
        <h2>10. Cookies and tracking technologies</h2>
        <p>
          We use a minimal set of cookies and browser storage. We use session and authentication cookies
          (set by our auth provider) to keep you logged in; these are strictly necessary. The website chat
          widget stores a single random visitor identifier in local storage only after you first open the chat,
          so we can associate your messages with the same conversation; we do not use this for tracking or
          advertising. We do not currently use analytics or marketing cookies. For a full list of what we use,
          why, and how to manage it, see our <a href="/cookies">Cookie Policy</a>. You can adjust your browser
          settings to refuse or delete cookies and local storage; disabling essential cookies may prevent you
          from staying logged in.
        </p>
      </section>

      <section id="policy-updates">
        <h2>11. Policy updates</h2>
        <p>
          We may update this Privacy Policy from time to time to reflect changes in our practices, the Service,
          or legal requirements. We will post the updated policy on this page and update the &quot;Last updated&quot;
          date. If we make material changes that affect how we use your personal data, we will provide
          additional notice (e.g. by email or a prominent notice in the Service) where appropriate. We
          encourage you to review this policy periodically.
        </p>
      </section>

      <section id="contact">
        <h2>12. Contact information</h2>
        <p>
          For questions about this Privacy Policy, your personal data, or to exercise your rights, please
          contact us:
        </p>
        <p className="mt-2 text-[#334155]">
          <strong>AutoRevenue Systems LTD</strong><br />
          Office 326, 18 Young St, UNIT LGE<br />
          Edinburgh EH2 4JB<br />
          Scotland
        </p>
        <p className="mt-2">
          Email: <a href="mailto:support@autorevenueos.com">support@autorevenueos.com</a>
        </p>
      </section>
    </LegalPageLayout>
  );
}
