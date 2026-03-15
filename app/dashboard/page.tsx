'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  StatusBadge,
  MetricCard,
  SectionHeader,
  ChannelBadge,
  ProofChip,
  PipelineCounter,
  EmptyState,
} from '@/components/ui';

type DashboardResponse = {
  recovered_leads: number;
  confirmed_bookings: number;
  billed_bookings: number;
  estimated_revenue: number;
  cost: number;
  roi: number;
  average_booking_value?: number;
  currency_code?: string;
  locale?: string;
  activation_status?: string;
  recent_recoveries: {
    id: string;
    created_at: string;
    contact_id: string | null;
    channel: string | null;
  }[];
  recent_confirmed_bookings: {
    id: string;
    confirmed_at: string;
    confirmation_source: string;
    confirmation_source_display_name?: string;
    trust_level: string | null;
    trust_label: string | null;
    billing_status: string;
    billing_error: string | null;
    external_booking_id: string | null;
  }[];
  recent_billing_events: {
    id: string;
    event_type: string;
    message: string | null;
    created_at: string;
    confirmed_booking_id: string | null;
  }[];
  pipeline: {
    contact_id: string | null;
    channel: string | null;
    created_at: string;
    latest_message: string;
    status: string;
    estimated_value: number;
    proof_label: string;
  }[];
};

function formatMoney(value: number, locale = 'en-GB', currency = 'GBP') {
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  });
  return formatter.format(value);
}

function formatRoi(roi: number) {
  if (!Number.isFinite(roi) || roi <= 0) return '0x';
  if (roi >= 100) return `${Math.round(roi)}x`;
  return `${roi.toFixed(1)}x`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch('/api/dashboard');
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 400 && (body?.error === 'No business linked to this user' || body?.error?.includes('business'))) {
            if (!cancelled) setError('no_business');
            return;
          }
          if (res.status === 401) {
            if (!cancelled) setError('Not signed in.');
            return;
          }
          throw new Error(body?.error ?? `Dashboard API error: ${res.status}`);
        }
        if (!cancelled) {
          setData(body as DashboardResponse);
          setError(null);
        }
      } catch (e) {
        console.error('[dashboard] fetch error', e);
        if (!cancelled) {
          setError('Failed to load dashboard data.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const recoveredLeads = data?.recovered_leads ?? 0;
  const confirmedBookings = data?.confirmed_bookings ?? 0;
  const billedBookings = data?.billed_bookings ?? 0;
  const estimatedRevenue = data?.estimated_revenue ?? 0;
  const cost = data?.cost ?? 0;
  const roi = data?.roi ?? 0;
  const averageBookingValue = data?.average_booking_value ?? 60;
  const currencyCode = data?.currency_code ?? 'GBP';
  const locale = data?.locale ?? 'en-GB';
  const pipeline = data?.pipeline ?? [];
  const recentConfirmed = data?.recent_confirmed_bookings ?? [];
  const recentBillingEvents = data?.recent_billing_events ?? [];
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);

  const handleRetryBilling = async (confirmedBookingId: string) => {
    setRetryError(null);
    setRetryingId(confirmedBookingId);
    try {
      const res = await fetch('/api/billing/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed_booking_id: confirmedBookingId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRetryError(json?.error ?? 'Retry failed');
        return;
      }
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          recent_confirmed_bookings: prev.recent_confirmed_bookings.map((r) =>
            r.id === confirmedBookingId ? { ...r, billing_status: 'sent', billing_error: null } : r
          ),
          billed_bookings: (prev.billed_bookings ?? 0) + 1,
        };
      });
    } finally {
      setRetryingId(null);
    }
  };

  const failedOrSkippedEvents = recentBillingEvents.filter(
    (e) => e.event_type === 'meter_failed' || e.event_type === 'meter_skipped_no_customer' || e.event_type === 'duplicate_ignored'
  );

  const estimatedBookings = averageBookingValue > 0 ? Math.round(estimatedRevenue / averageBookingValue) : 0;

  const recoveredCount = pipeline.filter((p) => p.status === 'Recovered').length;
  const inConversationCount = pipeline.filter((p) => p.status === 'In Conversation').length;
  const followUpCount = pipeline.filter((p) => p.status === 'Follow Up').length;
  const bookedCount = pipeline.filter((p) => p.status === 'Booked').length;
  const lostCount = pipeline.filter((p) => p.status === 'Lost').length;

  const router = useRouter();
  const openInboxConversation = (contactId: string | null, channel: string | null) => {
    if (!contactId || !channel) return;
    router.push(`/inbox?contact=${contactId}&channel=${channel}`);
  };

  return (
    <div className="px-4 py-10 bg-[#020617] bg-[radial-gradient(ellipse_at_top,_rgba(37,99,235,0.24),transparent_60%)]">
      <div className="mx-auto flex max-w-6xl flex-col rounded-[18px] border border-[#E5E7EB]/80 bg-white/95 px-4 py-8 shadow-[0_32px_80px_rgba(15,23,42,0.55)] sm:px-6 lg:px-8">
        <header className="animate-fade-in-up flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
              Dashboard
            </h1>
            <p className="mt-2 text-sm text-[#475569]">
              Track recovered revenue, recovered enquiries, and bookings across your pipeline.
            </p>
            <p className="mt-1 text-xs text-[#94A3B8]">
              Messenger Connected • Recovery Engine Active • Webhooks Receiving Messages
            </p>
          </div>
          {loading && (
            <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#64748B] shadow-[var(--card-shadow)]">
              Loading…
            </span>
          )}
        </header>

        {error === 'no_business' && (
          <div className="animate-fade-in-up mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900 shadow-sm">
            <p className="font-medium">Complete your setup</p>
            <p className="mt-1 text-amber-800">Your account isn’t linked to a business yet. Add your business details in Settings to see your dashboard.</p>
            <a href="/settings" className="mt-3 inline-block rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700">
              Open Settings
            </a>
          </div>
        )}
        {!error && data && (data.activation_status ?? 'payment_required') !== 'active' && (
          <div className="animate-fade-in-up mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900 shadow-sm">
            <p className="font-medium">Add your card to activate AutoRevenueOS</p>
            <p className="mt-1 text-amber-800">You&apos;ll only be charged when a booking is confirmed (£3 per confirmed booking). No upfront charge. Phone recovery and billing are active after you add a payment method.</p>
            <a href="/settings" className="mt-3 inline-block rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700">
              Add card in Settings
            </a>
          </div>
        )}
        {error && error !== 'no_business' && (
          <div className="animate-fade-in-up mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        )}

        {/* KPI cards */}
        <section className="animate-fade-in-up mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Primary KPI: Estimated Recovered Revenue - revenue signal (green) */}
          <div className="relative overflow-hidden rounded-[14px] border border-[#BBF7D0] bg-gradient-to-br from-white via-[#F0FDF4]/30 to-[#DCFCE7]/50 p-6 shadow-[var(--card-shadow)] transition-all duration-200 ease-out hover:shadow-[var(--card-shadow-hover)] sm:col-span-2 sm:p-7 ring-1 ring-[#22C55E]/20">
            <div className="absolute top-0 right-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-[#22C55E]/8" />
            <div className="relative">
              <div className="mb-3 h-2 w-14 rounded-full bg-gradient-to-r from-[#22C55E] to-[#16A34A]" />
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#166534]">
                Estimated Recovered Revenue
              </p>
              <p className="mt-4 text-4xl font-bold tracking-tight text-[#166534] sm:text-5xl">
                {formatMoney(estimatedRevenue, locale, currencyCode)}
              </p>
              <p className="mt-3 text-sm text-[#64748B]">
                Value recovered from missed enquiries
              </p>
              {estimatedBookings > 0 && (
                <p className="mt-2 text-sm font-semibold text-[#475569]">
                  ≈ {estimatedBookings} recovered booking lead{estimatedBookings !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
          <MetricCard
            label="Recovered leads"
            value={recoveredLeads.toString()}
            subtitle="Re-engaged leads (attribution only). Never billed."
          />
          <MetricCard
            label="Confirmed bookings"
            value={confirmedBookings.toString()}
            subtitle="Actually confirmed (you or integration). May or may not be billed yet."
          />
          <MetricCard
            label="Billed bookings"
            value={billedBookings.toString()}
            subtitle="Meter event reported to Stripe. billed_at set (not invoice paid)."
          />
          <MetricCard
            label="AutoRevenueOS Cost"
            value={formatMoney(cost, locale, currencyCode)}
            subtitle="Based on your configured cost per lead"
          />
          <MetricCard
            label="ROI"
            value={formatRoi(roi)}
            subtitle="Estimated recovered revenue ÷ cost"
          />
        </section>

        <div className="animate-fade-in-up mt-4 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 text-xs text-[#475569]">
          <p className="font-semibold text-[#0F172A] mb-1.5">Definitions</p>
          <ul className="space-y-1 list-none">
            <li><strong>Recovered lead</strong> — Re-engaged lead (attribution only). We do not bill on this. Shown for pipeline context.</li>
            <li><strong>Confirmed booking</strong> — A booking we recorded as confirmed (AutoRevenueOS booking page or integration webhook). Only these can ever be billed.</li>
            <li><strong>Billed booking</strong> — A confirmed booking for which we successfully reported a meter event to Stripe. <strong>billed_at</strong> means “meter event reported to Stripe” only; it does <strong>not</strong> mean the invoice has been paid.</li>
          </ul>
        </div>

        {/* Recent confirmed bookings */}
        <section className="card-base animate-fade-in-up mt-8 rounded-[14px] p-4 sm:p-6">
          {retryError && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {retryError}
            </p>
          )}
          <SectionHeader
            title="Confirmed bookings"
            description="Only these rows can trigger billing. Source = integration that reported the booking; Trust = verified (native/signed), bridge (feed/automation), or unverified. Billing status: sent = meter event reported to Stripe (billed_at set); failed = meter call failed (use Retry); skipped = no Stripe customer."
            rightContent={
              <p className="text-xs text-[#94A3B8]">
                Last {recentConfirmed.length} · {confirmedBookings} total
              </p>
            }
          />
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F8FAFC] text-xs font-medium uppercase tracking-wide text-[#64748B]">
                  <th className="py-2.5 pr-4 pl-3">Confirmed at</th>
                  <th className="py-2.5 pr-4">Source</th>
                  <th className="py-2.5 pr-4">Trust</th>
                  <th className="py-2.5 pr-4">Billing status</th>
                  <th className="py-2.5 pr-4">External ID</th>
                  <th className="py-2.5 pr-4 pl-3 w-[100px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentConfirmed.length ? (
                  recentConfirmed.map((r) => (
                    <tr key={r.id} className="border-b border-[#E5E7EB] last:border-0 odd:bg-white even:bg-[#F9FAFB]/60">
                      <td className="py-2.5 pr-4 pl-3 text-[#0F172A]">{formatDate(r.confirmed_at)}</td>
                      <td className="py-2.5 pr-4 text-[#475569]">{r.confirmation_source_display_name ?? r.confirmation_source}</td>
                      <td className="py-2.5 pr-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            r.trust_level === 'verified' ? 'bg-emerald-100 text-emerald-800' :
                            r.trust_level === 'bridge' ? 'bg-sky-100 text-sky-800' :
                            'bg-slate-100 text-slate-600'
                          }`}
                          title={r.trust_label ?? undefined}
                        >
                          {r.trust_label ?? r.trust_level ?? '—'}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.billing_status === 'sent' ? 'bg-emerald-100 text-emerald-800' :
                          r.billing_status === 'failed' ? 'bg-red-100 text-red-800' :
                          r.billing_status === 'skipped' ? 'bg-amber-100 text-amber-800' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {r.billing_status}
                        </span>
                        {r.billing_error && (
                          <p className="mt-1 text-[11px] text-red-600" title={r.billing_error}>{r.billing_error.slice(0, 60)}{r.billing_error.length > 60 ? '…' : ''}</p>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-[#64748B] font-mono text-xs truncate max-w-[120px]" title={r.external_booking_id ?? ''}>
                        {r.external_booking_id ?? '—'}
                      </td>
                      <td className="py-2.5 pr-4 pl-3">
                        {r.billing_status === 'failed' ? (
                          <button
                            type="button"
                            onClick={() => handleRetryBilling(r.id)}
                            disabled={retryingId === r.id}
                            className="rounded bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                          >
                            {retryingId === r.id ? 'Retrying…' : 'Retry billing'}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-[#94A3B8]">
                      {loading ? 'Loading…' : 'No confirmed bookings yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Billing events (failed / skipped visibility) */}
        {failedOrSkippedEvents.length > 0 && (
          <section className="card-base animate-fade-in-up mt-6 rounded-[14px] border-amber-200 bg-amber-50/50 p-4 sm:p-6">
            <SectionHeader
              title="Billing events (failed or skipped)"
              description="Confirmations that were not reported to Stripe (failed meter call or no stripe_customer_id). Use Retry billing for failed rows. billed_at is only set when the meter event is successfully reported — not when the invoice is paid."
            />
            <ul className="mt-4 space-y-2">
              {failedOrSkippedEvents.slice(0, 10).map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline gap-2 rounded-lg bg-white/80 px-3 py-2 text-sm">
                  <span className="font-medium text-amber-900">{e.event_type}</span>
                  <span className="text-amber-800">{e.message ?? '—'}</span>
                  <span className="text-xs text-[#64748B]">{formatDate(e.created_at)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Recent Recoveries */}
        <section className="card-base animate-fade-in-up mt-12 rounded-[14px] p-4 sm:p-6">
          <SectionHeader
            title="Recent Recoveries"
            description="Latest recovered enquiries AutoRevenueOS has brought back into your funnel."
            rightContent={
              <p className="text-xs text-[#94A3B8]">
                Showing the last {data?.recent_recoveries.length ?? 0} recoveries.
              </p>
            }
          />

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F8FAFC] text-xs font-medium uppercase tracking-wide text-[#64748B]">
                  <th className="py-2.5 pr-4 pl-3">When</th>
                  <th className="py-2.5 pr-4">Contact</th>
                  <th className="py-2.5 pr-4">Channel</th>
                </tr>
              </thead>
              <tbody>
                {data?.recent_recoveries.length ? (
                  data.recent_recoveries.map((r, idx) => {
                    const displayContact =
                      r.contact_id != null
                        ? r.channel === 'meta'
                          ? 'Messenger user'
                          : `Customer #${String(idx + 1)}`
                        : 'Unknown contact';
                    const canOpenInbox = r.contact_id != null && r.channel != null;

                    return (
                      <tr
                        key={r.id}
                        onClick={() => canOpenInbox && openInboxConversation(r.contact_id, r.channel)}
                        className={`border-b border-[#E5E7EB] last:border-0 odd:bg-white even:bg-[#F9FAFB]/60 ${
                          canOpenInbox ? 'cursor-pointer hover:bg-[#EFF6FF]/70' : 'hover:bg-[#F9FAFB]'
                        }`}
                        title={canOpenInbox ? 'Open in Inbox' : undefined}
                      >
                        <td className="py-2.5 pr-4 pl-3 text-[#0F172A]">
                          {formatDate(r.created_at)}
                        </td>
                        <td className="py-2.5 pr-4 text-[#475569]">
                          {displayContact}
                        </td>
                        <td className="py-2.5 pr-4">
                          <ChannelBadge channel={r.channel} />
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={3}
                      className="py-6 text-center text-sm text-[#94A3B8]"
                    >
                      {loading
                        ? 'Loading recoveries…'
                        : 'No recovered enquiries yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Recovered Revenue Pipeline */}
        <section className="animate-fade-in-up mt-12 border-t border-[#E5E7EB] pt-12">
          <div className="card-base rounded-[14px] p-4 sm:p-6">
            <SectionHeader
              title="Recovered Revenue Pipeline"
              description="Track recovered enquiries from reply to recovered booking leads."
                rightContent={
                <div className="flex flex-wrap gap-2">
                  <PipelineCounter label="Recovered" value={recoveredCount} tone="neutral" />
                  <PipelineCounter label="In Conversation" value={inConversationCount} tone="info" />
                  <PipelineCounter label="Follow Up" value={followUpCount} tone="warning" />
                  <PipelineCounter label="Booked" value={bookedCount} tone="success" />
                  <PipelineCounter label="Lost" value={lostCount} tone="error" />
                </div>
              }
            />

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
                    <th className="py-2.5 pr-4 pl-3">Contact</th>
                    <th className="py-2.5 pr-4">Channel</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 pr-4">Est. Revenue</th>
                    <th className="py-2.5 pr-4">Proof</th>
                    <th className="py-2.5 pr-4 w-[260px]">Latest Message</th>
                    <th className="py-2.5 pr-4">Recovery Date</th>
                  </tr>
                </thead>
                <tbody>
                  {pipeline.length ? (
                    pipeline.map((p, idx) => {
                      const displayContact =
                        p.contact_id != null
                          ? p.channel === 'meta'
                            ? 'Messenger user'
                            : `Customer #${String(idx + 1)}`
                          : 'Unknown contact';

                      const canOpenInbox = p.contact_id != null && p.channel != null;
                      return (
                        <tr
                          key={`${p.contact_id ?? 'unknown'}-${p.created_at}`}
                          onClick={() => canOpenInbox && openInboxConversation(p.contact_id, p.channel)}
                          className={`border-b border-[#E5E7EB] last:border-0 transition-colors odd:bg-white even:bg-[#F9FAFB]/50 ${
                            canOpenInbox ? 'cursor-pointer hover:bg-[#EFF6FF]/70' : 'hover:bg-[#F8FAFC]'
                          }`}
                          title={canOpenInbox ? 'Open in Inbox' : undefined}
                        >
                          <td className="py-2.5 pr-4 pl-3 text-[#0F172A]">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F1F5F9] text-[11px] font-medium text-[#64748B]">
                                {displayContact.slice(0, 2).toUpperCase()}
                              </span>
                              <span className="text-sm font-medium">
                                {displayContact}
                              </span>
                            </span>
                          </td>
                          <td className="py-2.5 pr-4">
                            <ChannelBadge channel={p.channel} />
                          </td>
                          <td className="py-2.5 pr-4">
                            <StatusBadge status={p.status} />
                          </td>
                          <td className="py-2.5 pr-4">
                            <span className="font-semibold text-[#166534]">{formatMoney(p.estimated_value)}</span>
                          </td>
                          <td className="py-2.5 pr-4">
                            <ProofChip label={p.proof_label} status={p.status} />
                          </td>
                          <td className="py-2.5 pr-4 align-top">
                            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[#94A3B8]">
                              Latest Message
                            </p>
                          <p className="max-w-xs text-sm text-[#475569] truncate-2-lines">
                              {p.latest_message
                                ? `“${p.latest_message}”`
                                : 'No message preview available'}
                            </p>
                          </td>
                          <td className="py-2.5 pr-4 text-xs text-[#64748B]">
                            {formatDate(p.created_at)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-8 text-center text-sm text-[#94A3B8]"
                      >
                        {loading
                          ? 'Building recovered revenue pipeline…'
                          : 'No recovered enquiries in the pipeline yet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

