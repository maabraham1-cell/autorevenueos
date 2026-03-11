import Link from 'next/link';

export default function Home() {
  return (
    <div className="px-4 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-xl">
          <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#1E3A8A] shadow-lg">
            <span className="text-xl font-bold text-white">AR</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
            Turn missed calls into booked customers automatically.
          </h1>
          <p className="mt-4 text-lg text-[#475569]">
            AutoRevenueOS detects every missed call, replies instantly by SMS or WhatsApp, and
            converts more of your leads into revenue.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-xl bg-[#1E3A8A] px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#2563EB] hover:shadow-lg"
            >
              Go to dashboard
            </Link>
            <Link
              href="/recoveries"
              className="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-6 py-3 text-sm font-semibold text-[#0F172A] transition-colors hover:bg-[#F8FAFC]"
            >
              View recoveries
            </Link>
          </div>
          <p className="mt-6 text-xs text-[#94A3B8]">
            Built for UK salons, clinics, trades and professional services.
          </p>
        </div>
      </div>
    </div>
  );
}
