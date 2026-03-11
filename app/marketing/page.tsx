 'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { RevenueCalculator } from '@/components/calculator/RevenueCalculator';

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(37,99,235,0.16),transparent_55%),#F8FAFC]">
      {/* Hero */}
      <section className="px-4 pb-16 pt-12 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-10 lg:flex-row lg:items-center">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#64748B]">
              AutoRevenueOS
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#0B1220] sm:text-4xl lg:text-5xl">
              Stop losing revenue to missed calls.
            </h1>
            <p className="mt-4 text-base text-[#475569] sm:text-lg">
              AutoRevenueOS detects every missed call, sends an instant SMS or WhatsApp, and turns
              more of those moments into booked appointments — automatically.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs text-[#64748B]">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 ring-1 ring-[#E2E8F0]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#F97316]" />
                Missed call
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 ring-1 ring-[#E2E8F0]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
                Instant SMS / WhatsApp reply
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 ring-1 ring-[#E2E8F0]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3B82F6]" />
                Booked customer, automatically
              </span>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="#calculator"
                className="inline-flex items-center justify-center rounded-xl bg-[#1E3A8A] px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#2563EB] hover:shadow-lg"
              >
                Get my free revenue check
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white/90 px-6 py-3 text-sm font-semibold text-[#0F172A] shadow-sm transition-colors hover:bg-[#F8FAFC]"
              >
                View live recoveries
              </Link>
            </div>
            <p className="mt-4 text-xs text-[#94A3B8]">
              Built for UK salons, clinics, trades and professional services. Pay only when it
              books a client.
            </p>
          </div>

          {/* Phone mock / conversation card – closer to Webflow light style */}
          <div className="relative w-full max-w-sm self-stretch">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="relative rounded-[32px] border border-[#E5E7EB] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
            >
              <div className="mb-4 flex items-center justify-between text-xs text-[#94A3B8]">
                <span>15:59</span>
                <span>● ● ● wifi 🔋</span>
              </div>
              <div className="flex items-center gap-3 rounded-3xl border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E5EDFF] text-xs font-semibold text-[#1D4ED8]">
                  OC
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-[#0F172A]">Oakwood Dental Clinic</span>
                  <span className="text-[11px] text-[#94A3B8]">Text Message • SMS</span>
                </div>
              </div>
              <div className="mt-4 space-y-3 text-xs leading-relaxed">
                <div className="max-w-[85%] rounded-2xl bg-[#F1F5F9] px-3 py-2 text-[#0F172A] shadow-sm">
                  Sorry we missed your call 👋
                  <br />
                  Would you like to book an appointment?
                  <br />
                  <br />
                  You can also book here:
                  <br />
                  <span className="text-[#2563EB]">oakwooddental.co/book</span>
                </div>
                <div className="ml-auto max-w-[70%] rounded-2xl bg-[#2563EB] px-3 py-2 text-right text-white shadow-sm">
                  Yes please, tomorrow?
                </div>
                <div className="max-w-[80%] rounded-2xl bg-[#F1F5F9] px-3 py-2 text-[#0F172A] shadow-sm">
                  Great – morning or afternoon?
                </div>
              </div>
              <div className="mt-6 rounded-2xl bg-[#F8FAFC] p-3 text-[11px] text-[#64748B]">
                <p className="font-semibold text-[#0F172A]">This is what your customer sees.</p>
                <p className="mt-1">
                  When a call is missed, AutoRevenueOS springs into action automatically. Your
                  customer receives a friendly, personalised text within seconds and is guided
                  seamlessly toward booking.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Calculator — high priority conversion asset */}
      <section id="calculator" className="px-4 pb-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#64748B]">
              Revenue check
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#0F172A] sm:text-3xl">
              How much revenue are missed calls costing you every month?
            </h2>
            <p className="mt-3 text-sm text-[#475569] sm:text-base">
              Use this calculator to estimate lost revenue from missed calls and see how much
              AutoRevenueOS could automatically recover for your business.
            </p>
          </div>
          <div className="mt-8 max-w-3xl">
            <RevenueCalculator />
          </div>
        </div>
      </section>

      {/* How it works: Detect / Respond / Convert */}
      <section
        id="how-it-works"
        className="border-t border-[#E5E7EB] bg-white/90 px-4 py-12 backdrop-blur-sm sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#64748B]">
              How it works
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#0F172A] sm:text-3xl">
              From missed call to booked customer in three steps.
            </h2>
            <p className="mt-3 text-sm text-[#475569] sm:text-base">
              AutoRevenueOS runs in the background, watching for missed calls, replying instantly,
              and nudging customers to book while they&apos;re still warm.
            </p>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <motion.div
              whileHover={{ y: -3 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="relative overflow-hidden rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] p-5 shadow-sm"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#EEF2FF] text-xs font-semibold text-[#4F46E5]">
                1
              </span>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">
                Detect
              </p>
              <p className="mt-2 text-sm font-semibold text-[#0F172A]">
                Instantly spot every missed call.
              </p>
              <p className="mt-2 text-xs text-[#64748B]">
                AutoRevenueOS listens to your phone line and logs every missed call so no potential
                customer quietly disappears.
              </p>
            </motion.div>
            <motion.div
              whileHover={{ y: -3 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="relative overflow-hidden rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] p-5 shadow-sm"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#ECFDF3] text-xs font-semibold text-[#16A34A]">
                2
              </span>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">
                Respond
              </p>
              <p className="mt-2 text-sm font-semibold text-[#0F172A]">
                Send an automatic message in seconds.
              </p>
              <p className="mt-2 text-xs text-[#64748B]">
                Customers receive a friendly SMS or WhatsApp while they&apos;re still ready to
                book, with a direct link or conversation to confirm a slot.
              </p>
            </motion.div>
            <motion.div
              whileHover={{ y: -3 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="relative overflow-hidden rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] p-5 shadow-sm"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#EFF6FF] text-xs font-semibold text-[#1D4ED8]">
                3
              </span>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">
                Convert
              </p>
              <p className="mt-2 text-sm font-semibold text-[#0F172A]">
                Turn missed calls into booked revenue.
              </p>
              <p className="mt-2 text-xs text-[#64748B]">
                The system guides customers to book or continue the conversation — you only pay when
                real revenue is generated.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Works with your current system (integrations) */}
      <section
        id="integrations"
        className="border-t border-[#E5E7EB] bg-[#F8FAFC] px-4 py-12 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold tracking-tight text-[#0F172A] sm:text-3xl">
              Works with your current booking system — or without one.
            </h2>
            <p className="mt-3 text-sm text-[#475569] sm:text-base">
              AutoRevenueOS works whether you take bookings by phone, WhatsApp, Instagram, or a
              scheduling tool. If you don&apos;t have a booking system yet, we can provide a simple
              booking page that converts.
            </p>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748B]">
                Channels
              </p>
              <p className="mt-2 text-sm font-medium text-[#0F172A]">
                Salons · Clinics · Trades · Professional services
              </p>
              <p className="mt-2 text-xs text-[#64748B]">
                Even if you only take bookings by phone today.
              </p>
            </div>
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748B]">
                Messaging
              </p>
              <p className="mt-2 text-sm font-medium text-[#0F172A]">
                Connects with WhatsApp &amp; Instagram DMs
              </p>
              <p className="mt-2 text-xs text-[#64748B]">
                Keep customers in the channels they already use every day.
              </p>
            </div>
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748B]">
                Integrations
              </p>
              <p className="mt-2 text-sm font-medium text-[#0F172A]">
                Works with your existing tools
              </p>
              <p className="mt-2 text-xs text-[#64748B]">
                Calendly, WhatsApp, Fresha and more — without changing your current workflow.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Proof & trust */}
      <section
        id="proof"
        className="border-t border-[#020617] bg-[#020617] px-4 py-10 sm:px-6 lg:px-8"
      >
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 text-center text-xs text-slate-300 sm:flex-row sm:items-stretch sm:justify-between sm:text-sm">
          <div className="flex-1 rounded-2xl bg-slate-900/60 p-5 ring-1 ring-slate-800/80">
            <p className="text-slate-400">Response speed</p>
            <p className="mt-1 text-lg font-semibold text-white">&lt;30 seconds</p>
            <p className="mt-2 text-[11px] text-slate-400">
              Auto replies fire while the customer is still holding their phone, not hours later.
            </p>
          </div>
          <div className="hidden h-10 w-px bg-slate-800 sm:block" />
          <div className="flex-1 rounded-2xl bg-slate-900/60 p-5 ring-1 ring-slate-800/80">
            <p className="text-slate-400">Engagement</p>
            <p className="mt-1 text-lg font-semibold text-white">95%+ SMS open rates</p>
            <p className="mt-2 text-[11px] text-slate-400">
              Conversations happen in SMS and WhatsApp where customers actually reply.
            </p>
          </div>
          <div className="hidden h-10 w-px bg-slate-800 sm:block" />
          <div className="flex-1 rounded-2xl bg-slate-900/60 p-5 ring-1 ring-slate-800/80">
            <p className="text-slate-400">Automation</p>
            <p className="mt-1 text-lg font-semibold text-white">24/7, 365 days</p>
            <p className="mt-2 text-[11px] text-slate-400">
              AutoRevenueOS works every evening, weekend and bank holiday without adding headcount.
            </p>
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-6xl text-center">
          <Link
            href="#calculator"
            className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[#0F172A] shadow-md transition-all hover:bg-slate-100 hover:shadow-lg"
          >
            Run your free revenue check
          </Link>
        </div>
      </section>
    </div>
  );
}

