'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { websiteChatConfig } from "@/lib/chatConfig";
import { getOrCreateChatId, hasConversionConsent } from "@/lib/consent";
import { trackEvent } from "@/lib/ga4";

type OperatorStatus = "online" | "usually-fast" | "offline";

type WebsiteMessage = {
  id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  created_at: string;
};

const SESSION_CHAT_KEY = "ar_chat_session";

/**
 * Gets or creates a visitor ID for website chat. Uses ar_chat cookie when consent
 * is granted (30-day continuity); otherwise sessionStorage for session-only.
 */
function getOrCreateVisitorId(hasConsent: boolean): string {
  if (typeof window === "undefined") return "";
  if (hasConsent) return getOrCreateChatId();
  let id = window.sessionStorage.getItem(SESSION_CHAT_KEY);
  if (id) return id;
  id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  window.sessionStorage.setItem(SESSION_CHAT_KEY, id);
  return id;
}

export function WebsiteChatWidget() {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<WebsiteMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const status: OperatorStatus = websiteChatConfig.status;
  const statusLabel = websiteChatConfig.labels[status];

  const statusColor = useMemo(() => {
    if (status === "online") return "bg-emerald-400";
    if (status === "usually-fast") return "bg-amber-300";
    return "bg-slate-400";
  }, [status]);

  // Defer creating/storing visitor ID until user first opens chat (privacy-first).
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const chatStartedTrackedRef = useRef(false);

  useEffect(() => {
    if (!isOpen || visitorId !== null) return;
    setVisitorId(getOrCreateVisitorId(hasConversionConsent()));
  }, [isOpen, visitorId]);

  useEffect(() => {
    if (!isOpen || chatStartedTrackedRef.current) return;
    chatStartedTrackedRef.current = true;
    trackEvent("chat_started");
  }, [isOpen]);

  useEffect(() => {
    const id = visitorId;
    if (!id) return;

    let cancelled = false;

    async function load(visitorIdParam: string) {
      try {
        setLoading(true);
        const res = await fetch(`/api/chat/website?visitorId=${encodeURIComponent(visitorIdParam)}`);
        if (!res.ok) {
          throw new Error(`Failed to load chat (${res.status})`);
        }
        const data = (await res.json()) as WebsiteMessage[];
        if (cancelled) return;
        setMessages(Array.isArray(data) ? data : []);
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

    load(id);

    return () => {
      cancelled = true;
    };
  }, [visitorId]);

  useEffect(() => {
    const id = visitorId;
    if (!isOpen || !id) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/chat/website?visitorId=${encodeURIComponent(id as string)}`);
        if (!res.ok) return;
        const data = (await res.json()) as WebsiteMessage[];
        if (!Array.isArray(data)) return;
        setMessages((prev) => {
          const byId = new Map(prev.map((m) => [m.id, m]));
          for (const m of data) {
            byId.set(m.id, m);
          }
          return [...byId.values()].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });
      } catch {
        // ignore poll errors
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [isOpen, visitorId]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    const id = visitorId;
    if (!trimmed || !id) return;

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
        body: JSON.stringify({ visitorId: id, message: trimmed }),
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

  const widgetContent = (
    <>
      {/* Floating button — message box style, fixed to viewport bottom-right */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="group flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1E3A8A] text-white transition-all duration-200 hover:bg-[#2563EB] hover:shadow-[0_4px_20px_rgba(30,58,138,0.55),0_0_0_1px_rgba(255,255,255,0.1),0_0_36px_8px_rgba(37,99,235,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-[#60A5FA]"
        style={{
          position: "fixed",
          right: "1.25rem",
          bottom: "max(1.25rem, env(safe-area-inset-bottom, 1.25rem))",
          left: "auto",
          zIndex: 9999,
          boxShadow:
            "0 4px 14px 0 rgba(30, 58, 138, 0.5), 0 0 0 1px rgba(255,255,255,0.08), 0 0 28px 4px rgba(37, 99, 235, 0.35)",
        }}
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={28}
          height={28}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-7 w-7 shrink-0"
          aria-hidden
        >
          <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      {/* Panel — fixed bottom-right above the button */}
      {isOpen && (
        <div
          className="z-[9998] w-[320px] overflow-hidden rounded-2xl border border-slate-800/70 bg-[#020617] text-slate-100 shadow-[0_28px_80px_rgba(0,0,0,0.75)] sm:w-[360px]"
          style={{
            position: "fixed",
            right: "1.25rem",
            bottom: "max(4.5rem, calc(env(safe-area-inset-bottom, 0px) + 3.5rem))",
            left: "auto",
          }}
        >
          {/* Header with operator status + close button */}
          <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 bg-gradient-to-r from-[#020617] via-[#020617] to-[#0B1120] px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-100">
                Chat with AutoRevenueOS
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                We&apos;ll help you capture more revenue from missed calls.
              </p>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-slate-900/80 px-2 py-0.5">
                <span className={`h-2 w-2 rounded-full ${statusColor}`} />
                <span className="text-[10px] font-medium text-slate-200">
                  {statusLabel}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800/80 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]"
              aria-label="Close chat"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
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
                    "inline-block max-w-[80%] rounded-2xl px-4 py-2.5 text-center text-[13px] shadow-sm";
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
                          {isVisitor ? "You" : "Support"}
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
                  disabled={!input.trim() || !visitorId}
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

  // Only render after mount to avoid hydration mismatch (portal + document.body not available on server).
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(widgetContent, document.body);
}

