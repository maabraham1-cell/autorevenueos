"use client";

import { useEffect, useState, type ReactNode } from "react";
import { fetchSessionRoleFromApi } from "@/lib/client-profile-role";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type SettingsPayload = {
  id?: string;
  name?: string;
  booking_link?: string;
  industry?: string;
  activation_status?: string;
  twilio_phone_number?: string;
  business_mobile?: string;
  meta_page_id?: string;
  meta_page_name?: string;
  twilio_provisioning_error?: string;
  acuity_api_key?: string;
  square_merchant_id?: string;
};

function flagSet(v: string | undefined): "Yes" | "No" {
  return v && String(v).trim().length > 0 ? "Yes" : "No";
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-[#E5E7EB] py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
        {label}
      </dt>
      <dd className="text-sm text-[#0F172A] sm:text-right">{value}</dd>
    </div>
  );
}

export function OperatorWorkspacePanel() {
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snap, setSnap] = useState<SettingsPayload | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void fetchSessionRoleFromApi().then((r) => {
      setIsAdminUser(!!r?.isAdmin);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void fetchSessionRoleFromApi().then((r) => {
        setIsAdminUser(!!r?.isAdmin);
      });
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!open || isAdminUser) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/settings", { credentials: "same-origin" })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as SettingsPayload & {
          error?: string;
        };
        if (!res.ok) {
          throw new Error(body.error || `Failed (${res.status})`);
        }
        if (!cancelled) {
          setSnap(body);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
          setSnap(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, isAdminUser]);

  if (isAdminUser) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#1E3A8A] shadow-sm hover:bg-[#DBEAFE]"
      >
        Workspace
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Operator workspace"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#E5E7EB] bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#E5E7EB] px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-[#0F172A]">
                  Workspace
                </h2>
                <p className="mt-0.5 text-xs text-[#64748B]">
                  Linked business context (read-only).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-[#E5E7EB] px-2 py-1 text-xs font-medium text-[#64748B] hover:bg-[#F8FAFC]"
              >
                Close
              </button>
            </div>

            <div className="px-4 py-3">
              {loading ? (
                <p className="text-sm text-[#64748B]">Loading…</p>
              ) : error ? (
                <p className="text-sm text-red-600">{error}</p>
              ) : snap ? (
                <dl>
                  <Row label="Business" value={snap.name || "—"} />
                  <Row
                    label="Business ID"
                    value={
                      <span className="inline-flex flex-wrap items-center gap-2">
                        <code className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-xs">
                          {snap.id}
                        </code>
                        {snap.id ? (
                          <button
                            type="button"
                            onClick={() =>
                              navigator.clipboard.writeText(snap.id ?? "")
                            }
                            className="text-xs font-medium text-[#2563EB] hover:underline"
                          >
                            Copy
                          </button>
                        ) : null}
                      </span>
                    }
                  />
                  <Row label="Industry" value={snap.industry || "—"} />
                  <Row label="Activation" value={snap.activation_status || "—"} />
                  <Row
                    label="Booking link"
                    value={
                      snap.booking_link ? (
                        <a
                          href={snap.booking_link}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all text-[#2563EB] underline-offset-2 hover:underline"
                        >
                          Open
                        </a>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <Row
                    label="Business mobile"
                    value={snap.business_mobile || "—"}
                  />
                  <Row
                    label="Twilio recovery #"
                    value={snap.twilio_phone_number || "—"}
                  />
                  <Row
                    label="Meta page"
                    value={
                      snap.meta_page_name ||
                      (snap.meta_page_id ? "Connected" : "Not connected")
                    }
                  />
                  <Row label="Acuity API key" value={flagSet(snap.acuity_api_key)} />
                  <Row
                    label="Square merchant"
                    value={flagSet(snap.square_merchant_id)}
                  />
                  {snap.twilio_provisioning_error ? (
                    <Row
                      label="Twilio provision error"
                      value={
                        <span className="text-amber-800">
                          {snap.twilio_provisioning_error}
                        </span>
                      }
                    />
                  ) : null}
                </dl>
              ) : (
                <p className="text-sm text-[#64748B]">No data.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
