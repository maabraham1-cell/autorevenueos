'use client';

import { useEffect, useMemo, useState } from "react";
import { websiteChatConfig } from "@/lib/chatConfig";

type OperatorStatus = "online" | "usually-fast" | "offline";

type WebsiteMessage = {
  id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  created_at: string;
};

function getOrCreateVisitorId(): string | null {
  if (typeof window === "undefined") return null;
  const key = "ar_os_website_visitor";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    const id = crypto.randomUUID();
    window.localStorage.setItem(key, id);
    return id;
  }
  const id = Math.random().toString(36).slice(2);
  window.localStorage.setItem(key, id);
  return id;
}

export function WebsiteChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<WebsiteMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status: OperatorStatus = websiteChatConfig.status;
  const statusLabel = websiteChatConfig.labels[status];

  const statusColor = useMemo(() => {
    if (status === "online") return "bg-emerald-400";
    if (status === "usually-fast") return "bg-amber-300";
    return "bg-slate-400";
  }, [status]);

  useEffect(() => {
    const visitorId = getOrCreateVisitorId();
    if (!visitorId) return;

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/chat/website?visitorId=${encodeURIComponent(visitorId)}`);
        if (!res.ok) {
          throw new Error(`Failed to load chat (${res.status})`);
        }
        const data = (await res.json()) as WebsiteMessage[];
        if (cancelled) return;
        setMessages(data);
        setError(null);
      } catch (e) {
        console.error("[WebsiteChatWidget] load error", e);
        if (!cancelled) setError("Unable to load previous messages.");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setBootstrapped(true);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    const visitorId = getOrCreateVisitorId();
    if (!visitorId) return;

    const optimistic: WebsiteMessage = {
      id: `local-${Date.now()}`,
      direction: "inbound",
      body: trimmed,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimistic]);
    setInput("");

    try {
      const res = await fetch("/api/chat/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId, message: trimmed }),
      });

      if (!res.ok) {
        throw new Error(`Failed to send (${res.status})`);
      }

      const saved = (await res.json()) as WebsiteMessage;
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? saved : m)),
      );
    } catch (e) {
      console.error("[WebsiteChatWidget] send error", e);
      setError("Message not sent. Please try again.");
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(trimmed);
    }
  }

  const hasMessages = messages.length > 0;

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#1E3A8A] text-white shadow-[0_20px_40px_rgba(15,23,42,0.5)] transition hover:bg-[#2563EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-[#60A5FA]"
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        <span className="text-lg font-semibold">OS</span>
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-5 z-40 w-[320px] overflow-hidden rounded-2xl border border-slate-800/70 bg-[#020617] text-slate-100 shadow-[0_28px_80px_rgba(0,0,0,0.75)] sm:w-[360px]">
          {/* Header with operator status */}
          <div className="border-b border-slate-800/80 bg-gradient-to-r from-[#020617] via-[#020617] to-[#0B1120] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-100">
                  Chat with AutoRevenueOS
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  We&apos;ll help you capture more revenue from missed calls.
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/80 px-2 py-0.5">
                  <span className={`h-2 w-2 rounded-full ${statusColor}`} />
                  <span className="text-[10px] font-medium text-slate-200">
                    {statusLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex max-h-[380px] flex-col bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900">
            <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 text-[13px]">
              <div className="rounded-2xl bg-slate-900/80 px-3 py-2 text-slate-200 ring-1 ring-slate-700/80">
                <p className="font-semibold text-slate-100">
                  Welcome to AutoRevenueOS 👋
                </p>
                <p className="mt-1 text-[12px] text-slate-300">
                  Share a bit about your business and how many calls you&apos;re
                  missing. We&apos;ll show you how much revenue AutoRevenueOS
                  could recover.
                </p>
              </div>

              {error && (
                <p className="text-[11px] text-amber-300">
                  {error}
                </p>
              )}

              {loading && !bootstrapped && (
                <p className="text-[11px] text-slate-400">Loading previous messages…</p>
              )}

              {hasMessages &&
                messages.map((m) => {
                  const isVisitor = m.direction === "inbound";
                  const bubbleBase =
                    "inline-block max-w-[80%] rounded-2xl px-3 py-2 text-[13px] shadow-sm";
                  const bubbleClasses = isVisitor
                    ? "bg-[#1E293B] text-slate-100 border border-slate-700"
                    : "bg-[#1D4ED8] text-white border border-[#1D4ED8]/80";

                  return (
                    <div
                      key={m.id}
                      className={`flex ${isVisitor ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`flex flex-col gap-1 ${
                          isVisitor ? "items-end" : "items-start"
                        }`}
                      >
                        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                          {isVisitor ? "You" : "AutoRevenueOS"}
                        </span>
                        <span className={`${bubbleBase} ${bubbleClasses}`}>
                          {m.body ?? ""}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Composer */}
            <form
              onSubmit={handleSend}
              className="border-t border-slate-800/80 bg-slate-950/90 px-3 py-2"
            >
              <div className="flex items-end gap-2">
                <textarea
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    status === "offline"
                      ? "Leave a message — we’ll email you back."
                      : "Type your message…"
                  }
                  className="max-h-24 flex-1 resize-none rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-[13px] text-slate-100 outline-none placeholder:text-slate-500 focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]"
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#2563EB] text-xs font-semibold text-white shadow-md transition disabled:cursor-not-allowed disabled:bg-slate-700"
                >
                  ↑
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

