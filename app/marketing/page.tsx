 'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { RevenueCalculator } from '@/components/calculator/RevenueCalculator';
import { WebsiteChatWidget } from '@/components/chat/WebsiteChatWidget';

export default function MarketingPage() {
  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#EFF6FF] via-[#F8FAFC] to-white">
      {/* Hero — dark navy showcase, phone as centerpiece with blue glow */}
      <section className="relative min-h-[85vh] overflow-hidden bg-[#0f172a] px-4 pb-24 pt-16 sm:px-6 lg:px-8">
        {/* Layered blue glow behind phone — creates premium spotlight */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          aria-hidden
        >
          <div className="h-[520px] w-[min(100vw,440px)] rounded-full bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(59,130,246,0.28),rgba(30,58,138,0.18),transparent_65%)]" />
        </div>
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          aria-hidden
        >
          <div className="h-[380px] w-[320px] rounded-full bg-[radial-gradient(circle_at_center,rgba(96,165,250,0.2),transparent_60%)]" />
        </div>

        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-14 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          {/* Left: copy — high contrast on dark */}
          <div className="max-w-xl lg:order-1">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#93C5FD]">
              AutoRevenueOS
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Stop losing revenue to missed calls.
            </h1>
            <p className="mt-4 text-base text-slate-300 sm:text-lg">
              AutoRevenueOS detects every missed call, sends an instant SMS or WhatsApp, and turns
              more of those moments into booked appointments — automatically.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-slate-200 ring-1 ring-white/20">
                <span className="h-1.5 w-1.5 rounded-full bg-[#F97316]" />
                Missed call
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-slate-200 ring-1 ring-white/20">
                <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
                Instant SMS / WhatsApp reply
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-slate-200 ring-1 ring-white/20">
                <span className="h-1.5 w-1.5 rounded-full bg-[#60A5FA]" />
                Booked customer, automatically
              </span>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="#calculator"
                className="inline-flex items-center justify-center rounded-xl bg-[#2563EB] px-6 py-3 text-sm font-semibold text-white shadow-[0_0_40px_-8px_rgba(59,130,246,0.6)] transition-all hover:bg-[#3B82F6] hover:shadow-[0_0_48px_-6px_rgba(59,130,246,0.7)]"
              >
                Get my free revenue check
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/10 hover:border-white/40"
              >
                View live recoveries
              </Link>
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Built for UK salons, clinics, trades and professional services. Pay only when it
              books a client.
            </p>
          </div>

          {/* Phone — centerpiece with strong shadow and glow */}
          <div className="relative w-full max-w-[340px] shrink-0 lg:order-2 lg:max-w-[360px]">
            <div
              className="absolute inset-0 rounded-[40px] blur-3xl opacity-40"
              style={{
                background: 'radial-gradient(circle at 50% 50%, rgba(59,130,246,0.35), transparent 70%)',
              }}
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="relative rounded-[32px] border border-white/20 bg-white p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_32px_64px_-12px_rgba(0,0,0,0.5),0_24px_48px_-12px_rgba(30,58,138,0.25),0_0_80px_-24px_rgba(59,130,246,0.35)]"
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

      {/* Calculator — dark blue framed section, premium product surface */}
      <section
        id="calculator"
        className="relative overflow-hidden bg-[#0f172a] px-4 py-16 sm:px-6 lg:px-8"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(30,58,138,0.4), transparent 60%)',
          }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#93C5FD]">
              Revenue check
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              How much revenue are missed calls costing you every month?
            </h2>
            <p className="mt-3 text-sm text-slate-300 sm:text-base">
              Use this calculator to estimate lost revenue from missed calls and see how much
              AutoRevenueOS could automatically recover for your business.
            </p>
          </div>
          <div className="mt-10 max-w-3xl">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white shadow-[0_25px_50px_-12px_rgba(0,0,0,0.35)]">
              <RevenueCalculator />
            </div>
          </div>
        </div>
      </section>

      {/* How it works — dark blue frame, white cards, blue accent flow */}
      <section
        id="how-it-works"
        className="relative overflow-hidden bg-[#0f172a] px-4 py-16 sm:px-6 lg:px-8"
      >
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-1/2 opacity-30"
          style={{
            background: 'linear-gradient(to top, rgba(30,58,138,0.2), transparent)',
          }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#93C5FD]">
              How it works
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              From missed call to booked customer in three steps.
            </h2>
            <p className="mt-3 text-sm text-slate-300 sm:text-base">
              AutoRevenueOS runs in the background, watching for missed calls, replying instantly,
              and nudging customers to book while they&apos;re still warm.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-white p-6 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.2)]"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#1E3A8A] text-xs font-semibold text-white">
                1
              </span>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#1E3A8A]">
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
              whileHover={{ y: -4 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-white p-6 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.2)]"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#1E3A8A] text-xs font-semibold text-white">
                2
              </span>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#1E3A8A]">
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
              whileHover={{ y: -4 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-white p-6 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.2)]"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#1E3A8A] text-xs font-semibold text-white">
                3
              </span>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#1E3A8A]">
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

      {/* Integrations — light section with blue gradient and elevated cards */}
      <section
        id="integrations"
        className="relative overflow-hidden bg-gradient-to-b from-white to-[#EFF6FF]/40 px-4 py-16 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1E3A8A]/70">
              Integrations
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#0F172A] sm:text-3xl">
              Works with your current booking system — or without one.
            </h2>
            <p className="mt-3 text-sm text-[#475569] sm:text-base">
              AutoRevenueOS works whether you take bookings by phone, WhatsApp, Instagram, or a
              scheduling tool. If you don&apos;t have a booking system yet, we can provide a simple
              booking page that converts.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_8px_24px_-8px_rgba(30,58,138,0.12)]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1E3A8A]/80">
                Channels
              </p>
              <p className="mt-2 text-sm font-medium text-[#0F172A]">
                Salons · Clinics · Trades · Professional services
              </p>
              <p className="mt-2 text-xs text-[#64748B]">
                Even if you only take bookings by phone today.
              </p>
            </div>
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_8px_24px_-8px_rgba(30,58,138,0.12)]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1E3A8A]/80">
                Messaging
              </p>
              <p className="mt-2 text-sm font-medium text-[#0F172A]">
                Connects with WhatsApp &amp; Instagram DMs
              </p>
              <p className="mt-2 text-xs text-[#64748B]">
                Keep customers in the channels they already use every day.
              </p>
            </div>
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_8px_24px_-8px_rgba(30,58,138,0.12)]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1E3A8A]/80">
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

      {/* Proof & trust — deep navy, soft blue glow, brand-accent cards */}
      <section
        id="proof"
        className="relative overflow-hidden bg-[#0f172a] px-4 py-16 sm:px-6 lg:px-8"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background: 'radial-gradient(ellipse 100% 80% at 50% 100%, rgba(30,58,138,0.35), transparent 50%)',
          }}
          aria-hidden
        />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-8 text-center text-xs text-slate-300 sm:flex-row sm:items-stretch sm:justify-between sm:text-sm">
          <div className="flex-1 rounded-2xl border border-[#1E3A8A]/40 bg-slate-900/50 p-6 ring-1 ring-[#1E3A8A]/20">
            <p className="text-[#93C5FD]">Response speed</p>
            <p className="mt-2 text-xl font-semibold text-white">&lt;30 seconds</p>
            <p className="mt-2 text-[11px] text-slate-400">
              Auto replies fire while the customer is still holding their phone, not hours later.
            </p>
          </div>
          <div className="hidden h-12 w-px bg-[#1E3A8A]/30 sm:block" />
          <div className="flex-1 rounded-2xl border border-[#1E3A8A]/40 bg-slate-900/50 p-6 ring-1 ring-[#1E3A8A]/20">
            <p className="text-[#93C5FD]">Engagement</p>
            <p className="mt-2 text-xl font-semibold text-white">95%+ SMS open rates</p>
            <p className="mt-2 text-[11px] text-slate-400">
              Conversations happen in SMS and WhatsApp where customers actually reply.
            </p>
          </div>
          <div className="hidden h-12 w-px bg-[#1E3A8A]/30 sm:block" />
          <div className="flex-1 rounded-2xl border border-[#1E3A8A]/40 bg-slate-900/50 p-6 ring-1 ring-[#1E3A8A]/20">
            <p className="text-[#93C5FD]">Automation</p>
            <p className="mt-2 text-xl font-semibold text-white">24/7, 365 days</p>
            <p className="mt-2 text-[11px] text-slate-400">
              AutoRevenueOS works every evening, weekend and bank holiday without adding headcount.
            </p>
          </div>
        </div>
        <div className="relative mx-auto mt-10 max-w-6xl text-center">
          <Link
            href="#calculator"
            className="inline-flex items-center justify-center rounded-xl bg-[#1E3A8A] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#1E3A8A]/30 transition-all hover:bg-[#2563EB] hover:shadow-xl hover:shadow-[#1E3A8A]/40"
          >
            Run your free revenue check
          </Link>
        </div>
      </section>
      <WebsiteChatWidget />
    </div>
  );
}

