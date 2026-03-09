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
    <div className="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              AutoRevenueOS Dashboard
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              High-level view of leads recovered and value generated for your business.
            </p>
          </div>
          {loading && (
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Loading…
            </span>
          )}
        </header>

        {error && (
          <div className="rounded-md border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-zinc-900">Recent Recoveries</h2>
            <p className="text-xs text-zinc-500">
              Showing the last {data?.recent_recoveries.length ?? 0} recoveries.
            </p>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Contact</th>
                  <th className="py-2 pr-4">Channel</th>
                </tr>
              </thead>
              <tbody>
                {data?.recent_recoveries.length ? (
                  data.recent_recoveries.map((r) => (
                    <tr key={r.id} className="border-b border-zinc-100 last:border-0">
                      <td className="py-2 pr-4 text-zinc-800">
                        {formatDate(r.created_at)}
                      </td>
                      <td className="py-2 pr-4 text-zinc-700">
                        {r.contact_id ?? 'Unknown contact'}
                      </td>
                      <td className="py-2 pr-4 text-zinc-700">
                        {r.channel ?? 'Unknown'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={3}
                      className="py-6 text-center text-sm text-zinc-500"
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

        <section className="rounded-2xl border border-zinc-200 bg-white/80 p-4 shadow-sm sm:p-6">
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
                  pipeline.map((p) => (
                    <tr
                      key={`${p.contact_id ?? 'unknown'}-${p.created_at}`}
                      className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60"
                    >
                      <td className="py-2.5 pr-4 pl-3 text-zinc-900">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-medium text-zinc-600">
                            {p.contact_id?.slice(0, 2).toUpperCase() ?? '??'}
                          </span>
                          <span className="text-sm font-medium">
                            {p.contact_id ?? 'Unknown contact'}
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
                        <p className="max-w-xs truncate text-sm text-zinc-700">
                          {p.latest_message || 'No message preview available'}
                        </p>
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-zinc-600">
                        {formatDate(p.created_at)}
                      </td>
                    </tr>
                  ))
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
    <div className="flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {label}
        </p>
        <p className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">
          {value}
        </p>
      </div>
      {subtitle && (
        <p className="mt-2 text-xs text-zinc-500">
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
    'bg-zinc-100 text-zinc-700 border-zinc-200';

  if (status === 'Booked') {
    colors = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  } else if (status === 'In Conversation') {
    colors = 'bg-sky-50 text-sky-700 border border-sky-200';
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
    'bg-zinc-50 text-zinc-600 border-zinc-200';

  if (status === 'Booked') {
    colors = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (status === 'In Conversation') {
    colors = 'bg-indigo-50 text-indigo-700 border-indigo-200';
  }

  return <span className={`${base} ${colors}`}>{label}</span>;
}

