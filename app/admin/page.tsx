'use client';

import Link from 'next/link';

export default function AdminPage() {
  return (
    <div className="px-4 py-10 bg-[#020617] bg-[radial-gradient(ellipse_at_top,_rgba(37,99,235,0.24),transparent_60%)] sm:px-6 lg:px-8 lg:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-[#E5E7EB]/80 bg-white p-6 shadow-xl sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A] sm:text-3xl">
            Platform admin
          </h1>
          <p className="mt-2 text-sm text-[#64748B]">
            System-wide views and tools. Access is restricted to platform administrators.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/admin/customers"
              className="inline-flex items-center justify-center rounded-lg bg-[#0F172A] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1e293b]"
            >
              View customers
            </Link>
            <a
              href="/api/admin/twilio-pool"
              className="inline-flex items-center justify-center rounded-lg border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#0F172A] shadow-sm transition-colors hover:bg-[#F8FAFC]"
            >
              Twilio pool (JSON)
            </a>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-lg border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#0F172A] shadow-sm transition-colors hover:bg-[#F8FAFC]"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
