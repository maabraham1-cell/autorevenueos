'use client';

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  StatusBadge,
  SummaryPill,
  SectionHeader,
  ChannelBadge,
  EmptyState,
} from "@/components/ui";

type InboxMessage = {
  id: string;
  direction: string;
  body: string | null;
  created_at: string;
};

type InboxConversation = {
  contact_id: string | null;
  contact_label: string;
  channel: string | null;
  latest_message: string;
  latest_message_at: string;
  recovery_status: string;
  estimated_value: number;
  proof_label: string;
  messages: InboxMessage[];
  has_unread?: boolean;
};

function makeConversationKey(c: InboxConversation): string {
  return `${c.contact_id ?? "unknown"}::${c.channel ?? "unknown"}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function InboxContent() {
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<InboxConversation[] | null>(
    null
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"All" | "Recovered" | "Follow Up" | "Booked">("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const loadInbox = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/inbox");
      if (!res.ok) {
        throw new Error(`Inbox API error: ${res.status}`);
      }
      const json = (await res.json()) as InboxConversation[];
      setConversations(json);
      setError(null);

      const focusContact = searchParams.get("contact");
      const focusChannel = searchParams.get("channel");
      const focusKey =
        focusContact != null && focusChannel != null
          ? `${focusContact}::${focusChannel}`
          : null;

      const hasFocus =
        focusKey && json.some((c) => makeConversationKey(c) === focusKey);

      setSelectedKey((prev) =>
        hasFocus
          ? focusKey!
          : prev ?? (json.length ? makeConversationKey(json[0]) : null)
      );
    } catch (e) {
      console.error("[inbox] fetch error", e);
      setError("Failed to load inbox conversations.");
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  useEffect(() => {
    const interval = setInterval(loadInbox, 12_000);
    return () => clearInterval(interval);
  }, [loadInbox]);

  const selectedConversation: InboxConversation | null = useMemo(() => {
    if (!conversations || conversations.length === 0) return null;
    if (!selectedKey) return conversations[0] ?? null;
    return (
      conversations.find((c) => makeConversationKey(c) === selectedKey) ??
      conversations[0] ??
      null
    );
  }, [conversations, selectedKey]);

  const filteredConversations = useMemo(() => {
    const list = conversations ?? [];
    if (statusFilter === "All") return list;
    return list.filter((c) => c.recovery_status === statusFilter);
  }, [conversations, statusFilter]);

  const {
    totalConversations,
    recoveredCount,
    inConversationCount,
    bookedCount,
  } = useMemo(() => {
    const list = filteredConversations ?? [];
    const total = list.length;
    let recovered = 0;
    let inConversation = 0;
    let booked = 0;

    for (const conv of list) {
      if (conv.recovery_status === "Booked") {
        booked += 1;
      } else if (conv.recovery_status === "In Conversation") {
        inConversation += 1;
      } else if (conv.recovery_status === "Recovered") {
        recovered += 1;
      }
    }

    return {
      totalConversations: total,
      recoveredCount: recovered,
      inConversationCount: inConversation,
      bookedCount: booked,
    };
  }, [filteredConversations]);

  const hasConversations = (filteredConversations?.length ?? 0) > 0;

  const isWebsiteChat = selectedConversation?.channel === "website_chat";
  const canReply = isWebsiteChat && selectedConversation?.contact_id;

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = replyDraft.trim();
    if (!trimmed || !canReply || sendingReply) return;

    setSendingReply(true);
    setReplyError(null);
    try {
      const res = await fetch("/api/chat/website/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: selectedConversation!.contact_id,
          body: trimmed,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed to send");
      }
      const sent = (await res.json()) as InboxMessage;
      setReplyDraft("");
      setConversations((prev) =>
        prev?.map((c) => {
          const key = makeConversationKey(c);
          if (key !== selectedKey) return c;
          return {
            ...c,
            messages: [...c.messages, sent],
            latest_message: sent.body ?? "",
            latest_message_at: sent.created_at,
            has_unread: false,
          };
        }) ?? null
      );
    } catch (e) {
      setReplyError(e instanceof Error ? e.message : "Failed to send reply");
    } finally {
      setSendingReply(false);
    }
  }

  return (
    <div className="px-4 py-8 bg-[#020617] bg-[radial-gradient(ellipse_at_top,_rgba(37,99,235,0.24),transparent_60%)] sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col rounded-[18px] border border-[#E5E7EB]/80 bg-white/95 px-4 py-8 shadow-[0_32px_80px_rgba(15,23,42,0.55)] sm:px-6 lg:px-8">
        <header className="animate-fade-in-up flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
              Inbox
            </h1>
            <p className="mt-2 text-sm text-[#475569]">
              Recovered conversations—follow up with interested customers.
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

        {/* Summary pills */}
        <section className="animate-fade-in-up mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryPill
            label="Total Conversations"
            value={totalConversations}
            subtitle="All recovered enquiries and active threads"
          />
          <SummaryPill
            label="Recovered"
            value={recoveredCount}
            subtitle="Leads brought back after auto-reply"
          />
          <SummaryPill
            label="In Conversation"
            value={inConversationCount}
            subtitle="Actively messaging with your business"
          />
          <SummaryPill
            label="Booked"
            value={bookedCount}
            subtitle="Likely converted to a recovered booking opportunity"
            isRevenue
          />
        </section>

        {/* Status filters */}
        {conversations && conversations.length > 0 && (
          <section className="mt-6 flex flex-wrap gap-2">
            {(["All", "Recovered", "Follow Up", "Booked"] as const).map((status) => {
              const isActive = statusFilter === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                    isActive
                      ? "bg-[#1E3A8A] text-white shadow-sm"
                      : "bg-white text-[#64748B] border border-[#E5E7EB] hover:bg-[#F8FAFC]"
                  }`}
                >
                  {status}
                </button>
              );
            })}
          </section>
        )}

        {/* Empty state */}
        {!loading && !hasConversations && (
          <div className="mt-12">
            <EmptyState
              title="No conversations yet"
              description="Once AutoRevenueOS recovers enquiries, conversations will appear here."
            />
          </div>
        )}

        {/* Main inbox layout */}
        {hasConversations && (
          <section className="animate-fade-in-up mt-10 grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_1px_minmax(0,1.8fr)]">
            {/* Conversation list */}
            <div className="card-base rounded-[14px] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 pb-2">
                <div>
                  <h2 className="text-sm font-semibold text-[#0F172A]">
                    Conversations
                  </h2>
                  <p className="mt-1 text-xs text-[#64748B]">
                    Recovered enquiries grouped by contact and channel.
                  </p>
                </div>
                <p className="text-xs text-[#94A3B8]">
                  {totalConversations}{" "}
                  {totalConversations === 1 ? "conversation" : "conversations"}
                </p>
              </div>

              <div className="mt-2 max-h-[520px] space-y-1.5 overflow-y-auto pr-1 sm:mt-3">
                {filteredConversations?.map((conv) => {
                  const key = makeConversationKey(conv);
                  const isSelected = key === selectedKey;
                  const baseClasses =
                    "cursor-pointer rounded-xl border px-3.5 py-3 transition-colors duration-200 ease-out";
                  const stateClasses = isSelected
                    ? "border-[#3B82F6] bg-[#EFF6FF] shadow-sm ring-1 ring-[#3B82F6]/30"
                    : "border-transparent bg-white hover:border-[#E5E7EB] hover:bg-[#F8FAFC]";

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedKey(key)}
                      className={`${baseClasses} ${stateClasses} w-full text-left`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {conv.has_unread && (
                              <span
                                className="h-2 w-2 shrink-0 rounded-full bg-[#2563EB]"
                                aria-label="Unread"
                              />
                            )}
                            <span className="text-sm font-semibold text-[#0F172A]">
                              {conv.contact_label}
                            </span>
                            <ChannelBadge channel={conv.channel} />
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-[#6B7280]">
                            {conv.latest_message
                              ? conv.latest_message
                              : "No message preview available"}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <StatusBadge status={conv.recovery_status} />
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
                            {formatTime(conv.latest_message_at)}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Vertical divider between list and detail on desktop */}
            <div className="hidden h-full w-px bg-[#E5E7EB] lg:block" />

            {/* Conversation detail */}
            <div className="card-base rounded-[14px] p-4 sm:p-5 lg:p-6">
              {selectedConversation ? (
                <>
                  <div className="flex flex-col gap-3 border-b border-[#E5E7EB] pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold tracking-tight text-[#0F172A] sm:text-base">
                          {selectedConversation.contact_label}
                        </h2>
                        <ChannelBadge channel={selectedConversation.channel} />
                      </div>
                      <p className="mt-1 text-xs text-[#6B7280]">
                        Last updated {formatDateTime(selectedConversation.latest_message_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <StatusBadge status={selectedConversation.recovery_status} />
                      <span className="inline-flex items-center rounded-full border border-[#BBF7D0] bg-[#F0FDF4] px-2 py-0.5 text-[11px] font-semibold text-[#166534]">
                        <span className="mr-1 text-[#64748B]">Est. value</span>
                        £
                        {selectedConversation.estimated_value.toLocaleString(
                          "en-GB",
                          { maximumFractionDigits: 0 }
                        )}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-[#FED7AA] bg-[#FFFBEB] px-2 py-0.5 text-[11px] font-medium text-[#D97706]">
                        {selectedConversation.proof_label}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 max-h-[420px] space-y-4 overflow-y-auto rounded-2xl bg-[#F9FAFB] px-3 py-3 pr-1 sm:mt-5 sm:px-4 sm:py-4">
                    {selectedConversation.messages.map((msg) => {
                      const isOutbound = msg.direction === "outbound";
                      const bubbleBase =
                        "inline-block max-w-[75%] rounded-2xl border px-3.5 py-2.5 text-sm shadow-sm";
                      const bubbleColors = isOutbound
                        ? "bg-[#0F172A] text-white border-[#1F2937]"
                        : "bg-[#EFF6FF] text-[#0F172A] border-[#DBEAFE]";

                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`flex flex-col gap-1.5 ${
                              isOutbound ? "items-end" : "items-start"
                            }`}
                          >
                            <p className="text-[11px] font-semibold text-[#6B7280]">
                              {isOutbound
                                ? "You"
                                : selectedConversation.contact_label || "Customer"}
                            </p>
                            <div className={bubbleBase + " " + bubbleColors + (isOutbound ? " text-center" : "")}>
                              <p className="whitespace-pre-wrap">
                                {msg.body ||
                                  (isOutbound
                                    ? "Message sent"
                                    : "Message received")}
                              </p>
                            </div>
                            <p className="text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">
                              {formatTime(msg.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {canReply && (
                    <form
                      onSubmit={handleSendReply}
                      className="mt-4 border-t border-[#E5E7EB] pt-4"
                    >
                      {replyError && (
                        <p className="mb-2 text-xs text-red-600">{replyError}</p>
                      )}
                      <div className="flex gap-2">
                        <textarea
                          rows={2}
                          value={replyDraft}
                          onChange={(e) => setReplyDraft(e.target.value)}
                          placeholder="Reply to website visitor…"
                          className="min-w-0 flex-1 rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
                          disabled={sendingReply}
                        />
                        <button
                          type="submit"
                          disabled={!replyDraft.trim() || sendingReply}
                          className="shrink-0 self-end rounded-xl bg-[#1E3A8A] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {sendingReply ? "Sending…" : "Send"}
                        </button>
                      </div>
                      <p className="mt-1.5 text-[11px] text-[#64748B]">
                        Replies appear in the visitor&apos;s chat widget within a few seconds.
                      </p>
                    </form>
                  )}
                </>
              ) : (
                <div className="flex h-full items-center justify-center py-16">
                  <div className="text-center">
                    <h2 className="text-sm font-semibold text-[#0F172A]">
                      No conversation selected.
                    </h2>
                    <p className="mt-2 text-sm text-[#64748B]">
                      Choose a conversation from the left to see the full
                      message history.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium uppercase tracking-wide text-[#64748B] shadow-sm">
            Loading…
          </span>
        </div>
      }
    >
      <InboxContent />
    </Suspense>
  );
}
