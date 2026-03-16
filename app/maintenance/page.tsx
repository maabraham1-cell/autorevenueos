'use client';

import Link from "next/link";

export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-[#f4f7fb] px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-[640px]">
        <div className="mb-6 text-center">
          <span className="inline-flex items-center justify-center rounded-full bg-white/80 px-4 py-2 text-xs font-semibold tracking-[0.2em] text-[#1E3A8A] shadow-sm shadow-slate-300/60">
            AUTOREVENUEOS
          </span>
        </div>
        <div className="rounded-3xl bg-white px-6 py-8 shadow-[0_24px_60px_rgba(15,23,42,0.10)] border border-slate-100 sm:px-8 sm:py-10">
          <div className="text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Recover Missed Bookings Automatically
            </h1>
            <p className="mt-3 text-sm text-slate-600 sm:text-base">
              AutoRevenueOS detects missed calls and messages customers instantly so
              businesses never lose a booking.
            </p>
          </div>

          <p className="mt-6 text-xs text-slate-500 text-center sm:text-sm">
            We&apos;re currently upgrading the platform while we finish new AI messaging
            features. Join the early access list and we&apos;ll notify you when we reopen.
          </p>

          <form
            className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <input
              type="email"
              required
              placeholder="Enter your email"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-[#1E3A8A] focus:outline-none focus:ring-1 focus:ring-[#1E3A8A]"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-[#1E3A8A] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#1E3A8A]/40 transition hover:bg-[#243c9a] sm:w-auto"
            >
              Get Early Access
            </button>
          </form>

          <p className="mt-3 text-[11px] text-slate-400 text-center">
            By joining, you&apos;ll receive occasional product updates. No spam, ever.
          </p>
        </div>

        <footer className="mt-6 text-center text-[11px] text-slate-500">
          <p>AutoRevenueOS — AI that turns missed calls into booked appointments.</p>
          <p className="mt-1">
            <Link
              href="/privacy"
              className="underline decoration-slate-300 hover:decoration-slate-500"
            >
              Privacy
            </Link>{" "}
            ·{" "}
            <Link
              href="/terms"
              className="underline decoration-slate-300 hover:decoration-slate-500"
            >
              Terms
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
