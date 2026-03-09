 'use client';

import { useEffect, useState } from 'react';

type DashboardResponse = {
  recovered_leads: number;
  estimated_revenue: number;
  cost: number;
  roi: number;
  recent_recoveries: {
    id: string;
    created_at: string;
    contact_id: string | null;
    channel: string | null;
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

const currencyFormatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

function formatMoney(value: number) {
  return currencyFormatter.format(value);
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
        if (!res.ok) {
          throw new Error(`Dashboard API error: ${res.status}`);
        }
        const json = (await res.json()) as DashboardResponse;
        if (!cancelled) {
          setData(json);
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
  const estimatedRevenue = data?.estimated_revenue ?? 0;
  const cost = data?.cost ?? 0;
  const roi = data?.roi ?? 0;
  const pipeline = data?.pipeline ?? [];

  const recoveredCount = pipeline.filter((p) => p.status === 'Recovered').length;
  const inConversationCount = pipeline.filter((p) => p.status === 'In Conversation').length;
  const bookedCount = pipeline.filter((p) => p.status === 'Booked').length;

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-10 text-[#0F172A]">
      <div className="mx-auto flex max-w-6xl flex-col">
        <header className="animate-fade-in-up flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
              AutoRevenueOS Dashboard
            </h1>
            <p className="mt-2 text-sm text-[#475569]">
              Track how missed enquiries turn into recovered revenue, conversations, and bookings.
            </p>
          </div>
          {loading && (
            <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium uppercase tracking-wide text-[#64748B] shadow-sm">
              Loading…
            </span>
          )}
        </header>

        {error && (
          <div className="animate-fade-in-up mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        )}

        <section className="animate-fade-in-up mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Recovered Leads"
            value={recoveredLeads.toString()}
            subtitle="Total recovery events for this business"
          />
          <MetricCard
            label="Estimated Revenue Recovered"
            value={formatMoney(estimatedRevenue)}
            subtitle="Assuming £60 per recovered lead"
          />
          <MetricCard
            label="AutoRevenueOS Cost"
            value={formatMoney(cost)}
            subtitle="Assuming £3 cost per lead"
          />
          <MetricCard
            label="ROI"
            value={formatRoi(roi)}
            subtitle="Estimated revenue ÷ cost"
          />
        </section>

        <section className="animate-fade-in-up mt-10 rounded-2xl border border-[#E5E7EB] bg-white/90 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_10px_24px_rgba(15,23,42,0.08)] sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[#0F172A]">
                Recent Recoveries
              </h2>
              <p className="mt-1 text-xs text-[#64748B]">
                Latest leads AutoRevenueOS has brought back into your funnel.
              </p>
            </div>
            <p className="text-xs text-[#94A3B8]">
              Showing the last {data?.recent_recoveries.length ?? 0} recoveries.
            </p>
          </div>

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

                    return (
                      <tr
                        key={r.id}
                        className="border-b border-zinc-100 last:border-0 hover:bg-[#F9FAFB] odd:bg-white even:bg-[#F9FAFB]/60"
                      >
                        <td className="py-2.5 pr-4 pl-3 text-[#0F172A]">
                          {formatDate(r.created_at)}
                        </td>
                        <td className="py-2.5 pr-4 text-[#475569]">
                          {displayContact}
                        </td>
                        <td className="py-2.5 pr-4 text-[#475569]">
                          {r.channel ?? 'Unknown'}
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
                        : 'No recoveries recorded yet for this business.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="animate-fade-in-up mt-10 border-t border-[#E5E7EB] pt-8">
          <div className="rounded-2xl border border-[#E5E7EB] bg-white/80 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_10px_24px_rgba(15,23,42,0.08)] sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">
                  Recovered Revenue Pipeline
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  See how recovered enquiries progress from reply to confirmed bookings.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <PipelineCounter label="Recovered" value={recoveredCount} tone="neutral" />
                <PipelineCounter label="In Conversation" value={inConversationCount} tone="info" />
                <PipelineCounter label="Booked" value={bookedCount} tone="success" />
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/60 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    <th className="py-2.5 pr-4 pl-3">Contact</th>
                    <th className="py-2.5 pr-4">Channel</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 pr-4">Est. Value</th>
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

                      return (
                        <tr
                          key={`${p.contact_id ?? 'unknown'}-${p.created_at}`}
                          className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/80 odd:bg-white even:bg-[#F9FAFB]/60"
                        >
                          <td className="py-2.5 pr-4 pl-3 text-zinc-900">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-medium text-zinc-600">
                                {displayContact.slice(0, 2).toUpperCase()}
                              </span>
                              <span className="text-sm font-medium">
                                {displayContact}
                              </span>
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 text-xs font-medium uppercase tracking-wide text-zinc-600">
                            {p.channel ?? 'Unknown'}
                          </td>
                          <td className="py-2.5 pr-4">
                            <StatusBadge status={p.status} />
                          </td>
                          <td className="py-2.5 pr-4 text-zinc-900">
                            {formatMoney(p.estimated_value)}
                          </td>
                          <td className="py-2.5 pr-4 text-xs text-zinc-600">
                            <ProofChip label={p.proof_label} status={p.status} />
                          </td>
                          <td className="py-2.5 pr-4 align-top">
                            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[#94A3B8]">
                              Latest Message
                            </p>
                            <p className="max-w-xs text-sm text-[#475569]">
                              {p.latest_message
                                ? `“${p.latest_message}”`
                                : 'No message preview available'}
                            </p>
                          </td>
                          <td className="py-2.5 pr-4 text-xs text-zinc-600">
                            {formatDate(p.created_at)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-8 text-center text-sm text-zinc-500"
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

type MetricCardProps = {
  label: string;
  value: string;
  subtitle?: string;
};

function MetricCard({ label, value, subtitle }: MetricCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#E5E7EB] bg-white/95 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)] transition-transform transition-shadow duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(15,23,42,0.08),0_16px_32px_rgba(15,23,42,0.10)] sm:p-6">
      <div>
        <div className="mb-3 h-1 w-10 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#1E3A8A]" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748B]">
          {label}
        </p>
        <p className="mt-3 text-2xl font-semibold tracking-tight text-[#0F172A] sm:text-3xl">
          {value}
        </p>
      </div>
      {subtitle && (
        <p className="mt-3 text-xs text-[#94A3B8]">
          {subtitle}
        </p>
      )}
    </div>
  );
}

type PipelineCounterProps = {
  label: string;
  value: number;
  tone?: 'neutral' | 'info' | 'success';
};

function PipelineCounter({ label, value, tone = 'neutral' }: PipelineCounterProps) {
  const toneClasses: Record<string, string> = {
    neutral: 'border-zinc-200 bg-white text-zinc-800',
    info: 'border-sky-100 bg-sky-50 text-sky-800',
    success: 'border-emerald-100 bg-emerald-50 text-emerald-800',
  };

  return (
    <div
      className={`flex items-center gap-2 rounded-full border px-3 py-1 ${toneClasses[tone]}`}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      <span className="text-sm font-semibold text-zinc-900">{value}</span>
    </div>
  );
}

type StatusBadgeProps = {
  status: string;
};

function StatusBadge({ status }: StatusBadgeProps) {
  const base =
    'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border';
  let colors =
    'bg-[#F1F5F9] text-[#475569] border-[#E5E7EB]';

  if (status === 'Booked') {
    colors = 'bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]';
  } else if (status === 'In Conversation') {
    colors = 'bg-[#DBEAFE] text-[#1D4ED8] border-[#BFDBFE]';
  }

  return <span className={`${base} ${colors}`}>{status}</span>;
}

type ProofChipProps = {
  label: string;
  status: string;
};

function ProofChip({ label, status }: ProofChipProps) {
  const base =
    'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border';
  let colors =
    'bg-[#F8FAFC] text-[#64748B] border-[#E5E7EB]';

  if (status === 'Booked') {
    colors = 'bg-[#FFFBEB] text-[#D97706] border-[#FED7AA]';
  } else if (status === 'In Conversation') {
    colors = 'bg-[#EEF2FF] text-[#4F46E5] border-[#C7D2FE]';
  }

  return <span className={`${base} ${colors}`}>{label}</span>;
}
