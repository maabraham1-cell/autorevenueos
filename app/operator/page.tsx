"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { OperatorOverviewResponse } from "@/lib/operator-types";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function OperatorOverviewPage() {
  const [data, setData] = useState<OperatorOverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/operator/overview", {
        credentials: "include",
        cache: "no-store",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof body?.error === "string"
            ? body.error
            : `Failed (${res.status})`,
        );
        setData(null);
        return;
      }
      setData(body as OperatorOverviewResponse);
    } catch {
      setError("Network error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-[#f6f9fc] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[#425466]">
              Internal
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-[#0a2540]">
              Operator overview
            </h1>
            <p className="mt-1 text-sm text-[#425466]">
              Recent signups and workspace health — not shown to customers.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-md border border-[#e6ebf1] bg-white px-3 py-1.5 text-sm font-medium text-[#0a2540] shadow-sm hover:bg-[#f6f9fc]"
            >
              Refresh
            </button>
            <Link
              href="/inbox"
              className="rounded-md border border-transparent bg-[#1E3A8A] px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-[#2563EB]"
            >
              Inbox
            </Link>
            <Link
              href="/admin/customers"
              className="rounded-md border border-[#e6ebf1] bg-white px-3 py-1.5 text-sm font-medium text-[#0a2540] shadow-sm hover:bg-[#f6f9fc]"
            >
              All customers
            </Link>
          </div>
        </div>

        {error ? (
          <p className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-[#64748B]">Loading…</p>
        ) : data ? (
          <>
            <div className="mb-6 grid gap-3 sm:grid-cols-3">
              {(
                [
                  ["Total businesses", data.stats.totalBusinesses],
                  ["Active (billing on)", data.stats.activeBusinesses],
                  ["With inbox activity", data.stats.businessesWithConversations],
                ] as const
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-lg border border-[#e6ebf1] bg-white px-4 py-3 shadow-sm"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-[#697386]">
                    {label}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-[#0a2540]">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-lg border border-[#e6ebf1] bg-white shadow-sm">
              <div className="border-b border-[#e6ebf1] px-4 py-3">
                <h2 className="text-sm font-semibold text-[#0a2540]">
                  Recent signups
                </h2>
                <p className="text-xs text-[#64748B]">
                  Newest businesses first (up to 25).
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#e6ebf1] bg-[#fafbfc]">
                      <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#697386]">
                        Business
                      </th>
                      <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#697386]">
                        Email
                      </th>
                      <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#697386]">
                        Phone
                      </th>
                      <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#697386]">
                        Created
                      </th>
                      <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#697386]">
                        Contacts
                      </th>
                      <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#697386]">
                        Inbox threads
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0f3f7]">
                    {data.recentSignups.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-[#64748B]"
                        >
                          No businesses yet.
                        </td>
                      </tr>
                    ) : (
                      data.recentSignups.map((row) => (
                        <tr key={row.id} className="hover:bg-[#f6f9fc]">
                          <td className="max-w-[180px] truncate px-4 py-2.5 font-medium text-[#0a2540]">
                            <Link
                              href={`/admin/customers/${row.id}`}
                              className="text-[#635bff] hover:underline"
                            >
                              {row.name}
                            </Link>
                          </td>
                          <td className="max-w-[200px] truncate px-4 py-2 text-[#425466]">
                            {row.email ?? "—"}
                          </td>
                          <td className="max-w-[120px] truncate px-4 py-2 text-[#425466]">
                            {row.phone ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2 text-[#425466] tabular-nums">
                            {dateFmt.format(new Date(row.created_at))}
                          </td>
                          <td className="px-4 py-2 tabular-nums text-[#425466]">
                            {row.contact_count}
                          </td>
                          <td className="px-4 py-2 tabular-nums text-[#425466]">
                            {row.conversation_count}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
