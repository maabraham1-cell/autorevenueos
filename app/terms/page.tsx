'use client';

export default function TermsPage() {
  return (
    <div className="px-4 py-10 bg-[#020617] bg-[radial-gradient(ellipse_at_top,_rgba(37,99,235,0.24),transparent_60%)]">
      <div className="mx-auto max-w-3xl rounded-[18px] border border-[#E5E7EB]/80 bgWHITE/95 px-4 py-8 shadow-[0_32px_80px_rgba(15,23,42,0.55)] sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-[#64748B]">
          These MVP terms govern your use of AutoRevenueOS, a product of AutoRevenue Systems Ltd.
        </p>

        <div className="mt-6 space-y-4 text-sm text-[#111827]">
          <section>
            <h2 className="text-base font-semibold text-[#0F172A]">1. Service</h2>
            <p className="mt-1">
              AutoRevenueOS helps you detect missed enquiries and send automated follow-ups via supported
              messaging channels. The service is provided on an &quot;as is&quot; and &quot;as available&quot; basis.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#0F172A]">2. Your responsibilities</h2>
            <p className="mt-1">
              You are responsible for:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Complying with all applicable laws and platform policies (e.g. telecoms, Meta, GDPR).</li>
              <li>Only sending messages that your customers should reasonably expect to receive.</li>
              <li>Configuring your integrations (e.g. Twilio, Meta) and environment variables correctly.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#0F172A]">3. Data and privacy</h2>
            <p className="mt-1">
              Our use of data is described in the Privacy Policy. By using AutoRevenueOS you confirm that you
              have a lawful basis to process any personal data you send through the platform.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#0F172A]">4. Availability and changes</h2>
            <p className="mt-1">
              AutoRevenue Systems Ltd may update or change AutoRevenueOS from time to time. We aim for high
              uptime but do not guarantee that the service will be uninterrupted or error-free.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#0F172A]">5. Limitation of liability</h2>
            <p className="mt-1">
              To the maximum extent permitted by law, AutoRevenue Systems Ltd will not be liable for any
              indirect, incidental or consequential losses arising from your use of AutoRevenueOS. Your sole
              remedy for dissatisfaction with the service is to stop using it.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#0F172A]">6. Termination</h2>
            <p className="mt-1">
              You may stop using AutoRevenueOS at any time. We may suspend or terminate access if you breach
              these terms or use the service in a way that risks harm to us, our infrastructure or other users.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#0F172A]">7. Changes to these terms</h2>
            <p className="mt-1">
              We may update these MVP terms from time to time. Material changes will apply going forward; by
              continuing to use AutoRevenueOS you agree to the updated terms.
            </p>
          </section>

          <p className="mt-4 text-xs text-[#6B7280]">
            This page is intended as an MVP-level terms summary for early customers and does not replace formal legal advice.
          </p>
        </div>
      </div>
    </div>
  );
}

