'use client';

export default function PrivacyPage() {
  return (
    <div className="px-4 py-10 bg-[#020617] bg-[radial-gradient(ellipse_at_top,_rgba(37,99,235,0.24),transparent_60%)]">
      <div className="mx-auto max-w-3xl rounded-[18px] border border-[#E5E7EB]/80 bg-white/95 px-4 py-8 shadow-[0_32px_80px_rgba(15,23,42,0.55)] sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-[#64748B]">
          This is a concise, MVP-level privacy policy for AutoRevenueOS, operated by AutoRevenue Systems Ltd.
        </p>

        <div className="mt-6 space-y-4 text-sm text-[#111827]">
          <section>
            <h2 className="text-base font-semibold text-[#0F172A]">Who we are</h2>
            <p className="mt-1">
              AutoRevenueOS is a product of <strong>AutoRevenue Systems Ltd</strong> (referred to as
              &quot;we&quot;, &quot;us&quot; or &quot;our&quot;). We provide software to help businesses
              recover missed revenue from calls and messages.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#0F172A]">What data we process</h2>
            <p className="mt-1">
              AutoRevenueOS processes data provided by you and your customers, including:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Business account details (e.g. name, industry, booking link).</li>
              <li>Contact details from missed calls and messages (e.g. phone numbers, message content).</li>
              <li>Technical logs required to operate and secure the service (e.g. webhook requests, error logs).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#0F172A]">How we use this data</h2>
            <p className="mt-1">
              We use this information to:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Detect and respond to missed calls and inbound messages.</li>
              <li>Send automated replies on your behalf via integrated providers such as Twilio and Meta.</li>
              <li>Display dashboards, inboxes and reports inside AutoRevenueOS.</li>
              <li>Operate, secure and improve the product.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#0F172A]">Website chat and local storage</h2>
            <p className="mt-1">
              The website chat widget stores a random visitor identifier in your browser using{" "}
              <code className="rounded bg-[#F3F4F6] px-1 text-xs">localStorage</code>. This identifier is
              used to link your browser to previous chat messages and does not contain personal information
              by itself.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#0F172A]">Third-party providers</h2>
            <p className="mt-1">
              To deliver the service we may process data through third-party providers such as:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Telecoms and messaging providers (e.g. Twilio, Meta platforms).</li>
              <li>Cloud infrastructure and database providers (e.g. Supabase, hosting platforms).</li>
            </ul>
            <p className="mt-1">
              These providers act as processors on our behalf and are subject to their own terms and privacy
              policies.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#0F172A]">Data retention</h2>
            <p className="mt-1">
              We retain data for as long as necessary to provide the service, comply with our legal obligations
              and resolve disputes. You may ask us to remove specific data where legally permitted.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#0F172A]">Contact</h2>
            <p className="mt-1">
              For any questions about this policy or how AutoRevenueOS handles data, please contact AutoRevenue Systems Ltd
              using the contact details you&apos;ve been provided during onboarding.
            </p>
          </section>

          <p className="mt-4 text-xs text-[#6B7280]">
            This page is intended as an MVP-level privacy summary and does not replace formal legal advice.
          </p>
        </div>
      </div>
    </div>
  );
}

