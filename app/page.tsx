import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center px-4 py-16">
      <div className="mx-auto max-w-xl text-center">
        <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#1E3A8A] shadow-lg">
          <span className="text-xl font-bold text-white">AR</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
          AutoRevenueOS
        </h1>
        <p className="mt-4 text-lg text-[#475569]">
          Turn missed enquiries into recovered revenue. Track conversations, pipeline, and bookings—all in one place.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-xl bg-[#1E3A8A] px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#2563EB] hover:shadow-lg"
          >
            Dashboard
          </Link>
          <Link
            href="/inbox"
            className="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-6 py-3 text-sm font-semibold text-[#0F172A] transition-colors hover:bg-[#F8FAFC]"
          >
            Inbox
          </Link>
          <Link
            href="/recoveries"
            className="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-6 py-3 text-sm font-semibold text-[#0F172A] transition-colors hover:bg-[#F8FAFC]"
          >
            Recoveries
          </Link>
        </div>
        <p className="mt-8 text-xs text-[#94A3B8]">
          Premium recovery engine for businesses who can&apos;t afford to lose leads.
        </p>
      </div>
    </div>
  );
}
