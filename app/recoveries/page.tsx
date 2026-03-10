'use client';

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  StatusBadge,
  SummaryPill,
  SectionHeader,
  ChannelBadge,
  EmptyState,
} from "@/components/ui";

type RecoveryItem = {
  id: string;
  contact_id: string | null;
  channel: string | null;
  created_at: string;
  latest_message: string;
  status: string;
  estimated_value: number;
  proof_label: string;
};

type StatusFilter = "All" | "Recovered" | "In Conversation" | "Follow Up" | "Booked" | "Lost";

type NormalizedStatus = "Recovered" | "In Conversation" | "Follow Up" | "Booked" | "Lost";

type ExtendedPipelineItem = RecoveryItem & {
  _key: string;
  _effectiveStatus: NormalizedStatus;
};

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

function formatMoney(value: number) {
  return currencyFormatter.format(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

type StatusSelectorProps = {
  value: NormalizedStatus;
  onChange: (next: NormalizedStatus) => void;
};

function StatusSelector({ value, onChange }: StatusSelectorProps) {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange(event.target.value as NormalizedStatus);
  };

  return (
    <div className="relative inline-flex cursor-pointer rounded-full transition-[box-shadow] hover:ring-2 hover:ring-[#3B82F6]/30">
      <StatusBadge status={value} showCaret />
      <select
        value={value}
        onChange={handleChange}
        aria-label="Update recovery status"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {(
          ["Recovered", "In Conversation", "Follow Up", "Booked", "Lost"] as NormalizedStatus[]
        ).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function normalizeStatus(status: string): NormalizedStatus {
  if (status === "Booked") return "Booked";
  if (status === "In Conversation") return "In Conversation";
  if (status === "Follow Up") return "Follow Up";
  if (status === "Recovered") return "Recovered";
  if (status === "Lost") return "Lost";
  return "Recovered";
}

function makeRecoveryKey(item: RecoveryItem): string {
  return item.id;
}

export default function RecoveriesPage() {
  const [data, setData] = useState<RecoveryItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, NormalizedStatus>
  >({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/recoveries");
        if (!res.ok) {
          throw new Error(`Recoveries API error: ${res.status}`);
        }
        const json = (await res.json()) as RecoveryItem[];
        if (cancelled) return;
        setData(json);
        setError(null);
      } catch (e) {
        console.error("[recoveries] fetch error", e);
        if (!cancelled) {
          setError("Failed to load recoveries.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const pipeline = data ?? [];

  const extendedPipeline: ExtendedPipelineItem[] = useMemo(() => {
    return pipeline.map((item) => {
      const key = makeRecoveryKey(item);
      const baseStatus = normalizeStatus(item.status);
      const effectiveStatus = statusOverrides[key] ?? baseStatus;
      return { ...item, _key: key, _effectiveStatus: effectiveStatus };
    });
  }, [pipeline, statusOverrides]);

  const {
    totalRecoveries,
    inConversationCount,
    followUpCount,
    bookedCount,
    lostCount,
  } = useMemo(() => {
    let inConversation = 0;
    let followUp = 0;
    let booked = 0;
    let lost = 0;

    for (const item of extendedPipeline) {
      const status = item._effectiveStatus;
      if (status === "In Conversation") {
        inConversation += 1;
      } else if (status === "Follow Up") {
        followUp += 1;
      } else if (status === "Booked") {
        booked += 1;
      } else if (status === "Lost") {
        lost += 1;
      }
    }

    return {
      totalRecoveries: extendedPipeline.length,
      inConversationCount: inConversation,
      followUpCount: followUp,
      bookedCount: booked,
      lostCount: lost,
    };
  }, [extendedPipeline]);

  const visibleRecoveries = useMemo(() => {
    if (statusFilter === "All") return extendedPipeline;
    return extendedPipeline.filter((p) => p._effectiveStatus === statusFilter);
  }, [extendedPipeline, statusFilter]);

  const visibleEstimatedRevenue = useMemo(() => {
    return visibleRecoveries.reduce((sum, r) => sum + r.estimated_value, 0);
  }, [visibleRecoveries]);

  const averageBookingValue = visibleRecoveries[0]?.estimated_value ?? 60;
  const estimatedBookings =
    averageBookingValue > 0
      ? Math.round(visibleEstimatedRevenue / averageBookingValue)
      : 0;

  const hasRecoveries = extendedPipeline.length > 0;
  const router = useRouter();

  const openInboxConversation = (contactId: string | null, channel: string | null) => {
    if (!contactId || !channel) return;
    const params = new URLSearchParams({
      contact: contactId,
      channel: channel,
    });
    router.push(`/inbox?${params.toString()}`);
  };

  return (
    <div className="px-4 py-10 text-[#0F172A]">
      <div className="mx-auto flex max-w-6xl flex-col">
        <header className="animate-fade-in-up flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
              Recoveries
            </h1>
            <p className="mt-2 text-sm text-[#475569]">
              Manage recovered revenue opportunities across your pipeline.
            </p>
          </div>
          {loading && (
            <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#64748B] shadow-[var(--card-shadow)]">
              Loading…
            </span>
          )}
        </header>

        {error && (
          <div className="animate-fade-in-up mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        )}

        {/* Revenue summary block - revenue signal (green) */}
        {hasRecoveries && (
          <section className="animate-fade-in-up mt-6 rounded-[14px] border border-[#BBF7D0] bg-gradient-to-br from-white via-[#F0FDF4]/30 to-[#DCFCE7]/50 p-6 shadow-[var(--card-shadow)] ring-1 ring-[#22C55E]/20 sm:p-8">
            <div>
              <div className="mb-3 h-2 w-14 rounded-full bg-gradient-to-r from-[#22C55E] to-[#16A34A]" />
              <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#166534]">
                Estimated Recovered Revenue
              </h2>
              <p className="mt-3 text-4xl font-bold tracking-tight text-[#166534] sm:text-5xl">
                {formatMoney(visibleEstimatedRevenue)}
              </p>
              <p className="mt-2 text-sm text-[#64748B]">
                Based on current recovered enquiries
              </p>
              {estimatedBookings > 0 && (
                <p className="mt-2 text-sm font-semibold text-[#475569]">
                  ≈ {estimatedBookings} additional booking{estimatedBookings !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </section>
        )}

        {/* KPI cards */}
          <section className="animate-fade-in-up mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryPill
            label="Total Recoveries"
            value={totalRecoveries}
            subtitle="All recovered enquiries in your pipeline"
          />
          <SummaryPill
            label="In Conversation"
            value={inConversationCount}
            subtitle="Leads actively messaging with you"
          />
          <SummaryPill
            label="Follow Up"
            value={followUpCount}
            subtitle="Needs follow-up"
          />
          <SummaryPill
            label="Booked"
            value={bookedCount}
            subtitle="Recovered revenue likely converted to bookings"
            isRevenue
          />
          <SummaryPill
            label="Lost"
            value={lostCount}
            subtitle="No clear response or booking"
          />
        </section>

        {/* Filters */}
        <section className="animate-fade-in-up mt-12">
          <div className="inline-flex flex-wrap gap-1 rounded-xl border border-[#E5E7EB] bg-[#F1F5F9] p-1.5 shadow-[var(--card-shadow)]">
            {(["All", "Recovered", "In Conversation", "Follow Up", "Booked", "Lost"] as StatusFilter[]).map(
              (filter) => {
                const isActive = statusFilter === filter;
                return (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setStatusFilter(filter)}
                    className={`rounded-lg px-4 py-2 text-[11px] font-semibold uppercase tracking-wide transition-all ${
                      isActive
                        ? "bg-white text-[#1E3A8A] shadow-sm ring-1 ring-[#E5E7EB]"
                        : "text-[#64748B] hover:bg-white/60 hover:text-[#475569]"
                    }`}
                  >
                    {filter}
                  </button>
                );
              }
            )}
          </div>
        </section>

        {/* Empty state */}
        {!loading && !hasRecoveries && (
          <div className="mt-12">
            <EmptyState
              title="No recoveries yet"
              description="Once AutoRevenueOS recovers enquiries for your business, they'll appear here."
            />
          </div>
        )}

        {/* Recoveries table */}
        {hasRecoveries && (
          <section className="card-base animate-fade-in-up mt-12 rounded-[14px] p-5 sm:p-6">
            <SectionHeader
              title="Recovered Revenue Pipeline"
              description="Every recovered enquiry and its pipeline status."
              rightContent={
                <p className="text-xs text-[#94A3B8]">
                Showing {visibleRecoveries.length} of {totalRecoveries}{" "}
                {totalRecoveries === 1 ? "recovery" : "recoveries"}
              </p>
              }
            />

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
                    <th className="py-3 pr-4 pl-3">Contact</th>
                    <th className="py-3 pr-4">Channel</th>
                    <th className="py-3 pr-4">Recovered at</th>
                    <th className="py-3 pr-4">Est. Revenue</th>
                    <th className="py-3 pr-4">
                      <div className="flex flex-col">
                        <span>Status</span>
                        <span className="mt-0.5 text-[10px] font-normal normal-case text-[#94A3B8]">
                          Click pill to change
                        </span>
                      </div>
                    </th>
                    <th className="py-3 pr-4">Proof</th>
                    <th className="py-3 pr-4 w-[260px]">Latest Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRecoveries.length ? (
                    visibleRecoveries.map((rec, idx) => {
                      const displayContact =
                        rec.contact_id != null
                          ? rec.channel === "meta"
                            ? "Messenger user"
                            : `Customer #${String(idx + 1)}`
                          : "Unknown contact";

                      const canOpenInbox =
                        rec.contact_id != null && rec.channel != null;

                      return (
                        <tr
                          key={rec._key}
                          onClick={() =>
                            canOpenInbox &&
                            openInboxConversation(rec.contact_id, rec.channel)
                          }
                          className={`group border-b border-[#E5E7EB] transition-colors last:border-0 ${
                            canOpenInbox
                              ? "cursor-pointer hover:bg-[#EFF6FF]/70"
                              : ""
                          }`}
                          title={canOpenInbox ? "Open in Inbox" : undefined}
                        >
                          <td className="py-3.5 pr-4 pl-3 text-[#0F172A]">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F1F5F9] text-[11px] font-medium text-[#64748B]">
                                {displayContact.slice(0, 2).toUpperCase()}
                              </span>
                              <span className="text-sm font-medium">
                                {displayContact}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 pr-4">
                            <ChannelBadge channel={rec.channel} />
                          </td>
                          <td className="py-3.5 pr-4 text-xs text-[#64748B]">
                            {formatDate(rec.created_at)}
                          </td>
                          <td className="py-3.5 pr-4">
                            <span className="font-semibold text-[#166534]">{formatMoney(rec.estimated_value)}</span>
                          </td>
                          <td
                            className="py-3.5 pr-4"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <StatusSelector
                              value={rec._effectiveStatus}
                              onChange={async (next) => {
                                setStatusOverrides((prev) => ({
                                  ...prev,
                                  [rec._key]: next,
                                }));

                                try {
                                  const response = await fetch(
                                    `/api/recoveries/${rec.id}`,
                                    {
                                      method: "PATCH",
                                      headers: {
                                        "Content-Type": "application/json",
                                      },
                                      body: JSON.stringify({ status: next }),
                                    }
                                  );

                                  if (!response.ok) {
                                    console.error(
                                      "[recoveries] status update failed with response",
                                      response.status
                                    );
                                    // Revert optimistic update on failure
                                    setStatusOverrides((prev) => {
                                      const { [rec._key]: _, ...rest } = prev;
                                      return rest;
                                    });
                                  }
                                } catch (e) {
                                  console.error(
                                    "[recoveries] status update failed",
                                    e
                                  );
                                  setStatusOverrides((prev) => {
                                    const { [rec._key]: _, ...rest } = prev;
                                    return rest;
                                  });
                                }
                              }}
                            />
                          </td>
                          <td className="py-3.5 pr-4 text-xs text-[#64748B]">
                            {rec.proof_label}
                          </td>
                          <td className="max-w-[260px] py-3.5 pr-4 align-top">
                            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[#94A3B8]">
                              Latest Message
                            </p>
                            <p
                              className="line-clamp-2 truncate text-[13px] text-[#64748B]"
                              title={rec.latest_message || undefined}
                            >
                              {rec.latest_message
                                ? `“${rec.latest_message}”`
                                : "No message preview"}
                            </p>
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
                        No recoveries match this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

