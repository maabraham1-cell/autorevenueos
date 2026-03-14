'use client';

import { LegalPageLayout, type TocItem } from '@/components/legal/LegalPageLayout';

const LAST_UPDATED = 'Last updated: 13 March 2026';

const TOC: TocItem[] = [
  { id: 'introduction', label: 'Introduction' },
  { id: 'definitions', label: 'Definitions' },
  { id: 'description-of-service', label: 'Description of the Service' },
  { id: 'account-registration', label: 'Account & responsibilities' },
  { id: 'acceptable-use', label: 'Acceptable use' },
  { id: 'messaging-compliance', label: 'Messaging compliance' },
  { id: 'third-party-integrations', label: 'Third-party integrations' },
  { id: 'fees-and-billing', label: 'Fees and billing' },
  { id: 'intellectual-property', label: 'Intellectual property' },
  { id: 'data-ownership', label: 'Data ownership' },
  { id: 'service-availability', label: 'Service availability' },
  { id: 'limitation-of-liability', label: 'Limitation of liability' },
  { id: 'indemnification', label: 'Indemnification' },
  { id: 'suspension-termination', label: 'Suspension and termination' },
  { id: 'governing-law', label: 'Governing law' },
  { id: 'contact', label: 'Contact information' },
];

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service" lastUpdated={LAST_UPDATED} toc={TOC}>
      <section id="introduction">
        <h2>1. Introduction</h2>
        <p>
          These Terms of Service (&quot;Terms&quot;) are a legal agreement between you and AutoRevenue Systems LTD
          (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), a company registered in Scotland. They govern your access to and use of
          AutoRevenueOS, our software-as-a-service platform that helps businesses recover missed revenue by
          re-engaging leads through messaging channels. By creating an account or using the service, you agree to
          these Terms. If you are using AutoRevenueOS on behalf of an organisation, you represent that you have
          authority to bind that organisation to these Terms.
        </p>
      </section>

      <section id="definitions">
        <h2>2. Definitions</h2>
        <ul>
          <li><strong>Service</strong> means the AutoRevenueOS platform, including the dashboard, inbox, recoveries tools, integrations, APIs, and any related software or documentation we provide.</li>
          <li><strong>You</strong> (or &quot;Customer&quot;) means the individual or legal entity that has registered an account and uses the Service.</li>
          <li><strong>Business</strong> means the business profile (e.g. name, contact details, messaging configuration) you create and manage within the Service.</li>
          <li><strong>Customer Data</strong> means any data (including personal data) that you or your end customers submit or that we process on your behalf in connection with the Service.</li>
          <li><strong>Third-Party Services</strong> means external services you connect to AutoRevenueOS, such as Twilio, Meta (Instagram/Facebook), or booking systems.</li>
        </ul>
      </section>

      <section id="description-of-service">
        <h2>3. Description of the Service</h2>
        <p>
          AutoRevenueOS provides tools to detect missed calls and inbound messages, send automated or manual
          follow-ups via SMS, WhatsApp, and other supported channels, and track recoveries. The Service is
          offered as a hosted platform; we do not make outbound calls or send messages on our own behalf. We act
          as a platform provider: you configure your phone numbers and messaging channels, and the Service
          facilitates messaging and workflows that you control. We may add, change, or discontinue features in
          line with our roadmap and these Terms.
        </p>
      </section>

      <section id="account-registration">
        <h2>4. Account registration and responsibilities</h2>
        <p>
          You must register for an account using accurate, current information and keep your account details and
          contact information up to date. You are responsible for maintaining the confidentiality of your login
          credentials and for all activity that occurs under your account. You must notify us promptly of any
          unauthorised access or breach of security. Each account is intended for use by a single business (or
          distinct business unit as permitted by your plan); you may not share account access in a way that
          circumvents intended usage or limits.
        </p>
      </section>

      <section id="acceptable-use">
        <h2>5. Acceptable use</h2>
        <p>
          You must use the Service only in accordance with these Terms and all applicable laws and regulations.
          You must not:
        </p>
        <ul>
          <li>Use the Service for any illegal purpose or to send illegal, harmful, or fraudulent content.</li>
          <li>Use the Service to send spam, unsolicited commercial messages, or to harass or abuse recipients.</li>
          <li>Attempt to gain unauthorised access to the Service, our systems, or other users&apos; accounts or data.</li>
          <li>Reverse engineer, decompile, or attempt to extract the source code of the Service (except to the extent permitted by applicable law).</li>
          <li>Resell or sublicense the Service in a manner that competes with our offering unless we have agreed in writing.</li>
          <li>Use the Service in any way that could impair, overburden, or harm our infrastructure or other users.</li>
        </ul>
        <p>
          We may suspend or terminate access if we reasonably believe you have violated acceptable use or
          applicable law.
        </p>
      </section>

      <section id="messaging-compliance">
        <h2>6. Messaging compliance responsibilities</h2>
        <p>
          <strong>You are solely responsible for ensuring that your use of the Service complies with all
          applicable messaging, telecommunications, and marketing laws.</strong> This includes laws relating to
          SMS, WhatsApp, and other channels (e.g. TCPA, GDPR, PECR, and platform policies such as Meta&apos;s
          Business and Commerce policies). AutoRevenueOS is a platform provider: we do not send communications
          on our own behalf. The messages sent through the Service are sent by you (or your Business), using
          phone numbers and channels you configure. Accordingly:
        </p>
        <ul>
          <li>You must only message end customers who have given valid consent (or where another lawful basis
            applies) to receive communications from you via the channel and for the purpose you are using.</li>
          <li>You are responsible for obtaining and documenting consent, honouring opt-outs, and complying with
            SMS and marketing regulations in the jurisdictions where you and your recipients are located.</li>
          <li>You must not use the Service to send marketing messages where consent or an applicable exception
            has not been obtained, or in breach of platform terms (e.g. Meta, Twilio).</li>
        </ul>
        <p>
          We may provide guidance or tools to support compliance (e.g. opt-out handling), but such guidance does
          not constitute legal advice. You should seek your own legal advice to ensure your messaging practices
          are compliant.
        </p>
      </section>

      <section id="third-party-integrations">
        <h2>7. Third-party integrations</h2>
        <p>
          The Service can integrate with third-party services such as:
        </p>
        <ul>
          <li><strong>Twilio</strong> — for telephony and SMS. Your use of Twilio is subject to Twilio&apos;s terms and
            policies; you are responsible for your Twilio account and configuration (e.g. phone numbers, credentials).</li>
          <li><strong>Meta (Instagram / Facebook)</strong> — for messaging and optional social features. Your use is
            subject to Meta&apos;s terms and policies, including Business and Commerce policies. You are responsible
            for obtaining any required approvals and maintaining compliance.</li>
          <li><strong>Booking systems and other tools</strong> — where we offer integrations (e.g. Calendly, Fresha),
            your use of those integrations is also subject to the relevant third party&apos;s terms. We do not
            guarantee continued availability of any specific integration.</li>
        </ul>
        <p>
          We are not responsible for the availability, performance, or policies of third-party services. You
          configure and maintain your own accounts and credentials with those providers; we do not store or use
          your third-party credentials beyond what is necessary to provide the integration.
        </p>
      </section>

      <section id="fees-and-billing">
        <h2>8. Fees and billing</h2>
        <p>
          Current pricing and billing terms are published on our website or communicated to you at sign-up. We
          may offer promotional or introductory pricing; we reserve the right to
          introduce fees in the future with reasonable notice. If we do introduce fees for your plan, we will
          notify you in advance and you may cancel before the change takes effect if you do not agree. For paid
          plans, you agree to pay all applicable fees in the currency and on the billing cycle specified. Fees
          are generally non-refundable unless otherwise stated or required by law. We may change pricing with
          notice; continued use after the effective date of a change constitutes acceptance.
        </p>
      </section>

      <section id="intellectual-property">
        <h2>9. Intellectual property</h2>
        <p>
          We (and our licensors) retain all right, title, and interest in and to the Service, including the
          AutoRevenueOS name, logos, software, design, and documentation. These Terms do not grant you any
          ownership in the Service; we grant you a limited, non-exclusive, non-transferable, revocable licence
          to access and use the Service for your internal business purposes in accordance with these Terms. You
          may not copy, modify, or create derivative works of the Service, or use our trademarks without our
          prior written consent.
        </p>
      </section>

      <section id="data-ownership">
        <h2>10. Data ownership</h2>
        <p>
          You retain ownership of your Customer Data. You grant us a licence to use, store, and process Customer
          Data only as necessary to provide, support, and improve the Service and to comply with our legal
          obligations. Our use of personal data is described in our Privacy Policy. We do not sell your Customer
          Data to third parties for their marketing purposes. You are responsible for ensuring that you have
          appropriate rights and lawful bases to provide Customer Data to us and to use the Service in relation
          to that data.
        </p>
      </section>

      <section id="service-availability">
        <h2>11. Service availability and modifications</h2>
        <p>
          We strive to maintain high availability but do not guarantee uninterrupted or error-free operation.
          We may perform maintenance, updates, or changes to the Service with or without notice where we deem it
          reasonable. We may add, modify, or discontinue features or plans; we will use reasonable efforts to
          give advance notice of material changes that negatively affect your use. Your sole remedy for
          dissatisfaction with the Service or any change is to stop using it and, where applicable, terminate
          your account in accordance with these Terms.
        </p>
      </section>

      <section id="limitation-of-liability">
        <h2>12. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by applicable law:
        </p>
        <ul>
          <li>The Service is provided &quot;as is&quot; and &quot;as available&quot;. We disclaim all warranties, express or
            implied, including merchantability, fitness for a particular purpose, and non-infringement.</li>
          <li>We (and our directors, employees, and affiliates) shall not be liable for any indirect, incidental,
            special, consequential, or punitive damages, or for loss of profits, revenue, data, or business
            opportunity, whether in contract, tort (including negligence), or otherwise, even if we have been
            advised of the possibility of such damages.</li>
          <li>Our total aggregate liability for any claims arising out of or related to these Terms or the Service
            shall not exceed the greater of (a) the fees you paid to us in the twelve (12) months preceding the
            claim, or (b) one hundred pounds sterling (GBP 100).</li>
        </ul>
        <p>
          Nothing in these Terms excludes or limits our liability for death or personal injury caused by our
          negligence, fraud, or any other liability that cannot be excluded or limited under applicable law.
        </p>
      </section>

      <section id="indemnification">
        <h2>13. Indemnification</h2>
        <p>
          You agree to indemnify, defend, and hold harmless AutoRevenue Systems LTD and its officers, directors,
          employees, and agents from and against any claims, damages, losses, liabilities, costs, and expenses
          (including reasonable legal fees) arising out of or related to: (a) your use of the Service; (b) your
          violation of these Terms or any applicable law; (c) your Customer Data or your messaging practices,
          including any claim that you did not have consent or lawful basis to send communications; or (d) any
          dispute between you and an end customer or third party in connection with the Service. We will notify
          you of any such claim and cooperate with you in its defence at your expense.
        </p>
      </section>

      <section id="suspension-termination">
        <h2>14. Suspension and termination</h2>
        <p>
          You may stop using the Service at any time and may close your account through the Service or by
          contacting us. We may suspend or terminate your access to the Service (or any part of it) immediately
          if: (a) you breach these Terms or acceptable use; (b) your use risks harm to us, our infrastructure, or
          other users; (c) we are required to do so by law or a competent authority; or (d) we discontinue the
          Service or your plan. We will use reasonable efforts to give advance notice of suspension or
          termination where practicable. Upon termination, your right to use the Service ceases; we may delete
          or retain your data in accordance with our Privacy Policy and data retention practices.
        </p>
      </section>

      <section id="governing-law">
        <h2>15. Governing law</h2>
        <p>
          These Terms and any dispute or claim arising out of or in connection with them (including non-contractual
          disputes) shall be governed by and construed in accordance with the laws of Scotland and the United
          Kingdom. The courts of Scotland shall have exclusive jurisdiction to settle any such dispute or claim,
          and you agree to submit to that jurisdiction.
        </p>
      </section>

      <section id="contact">
        <h2>16. Contact information</h2>
        <p>
          For questions about these Terms or the Service, please contact us:
        </p>
        <p className="mt-2 text-[#334155]">
          <strong>AutoRevenue Systems LTD</strong><br />
          Office 326, 18 Young St, UNIT LGE<br />
          Edinburgh EH2 4JB<br />
          Scotland
        </p>
        <p className="mt-2">
          Email: <a href="mailto:hello@autorevenueos.com">hello@autorevenueos.com</a>
        </p>
      </section>
    </LegalPageLayout>
  );
}
