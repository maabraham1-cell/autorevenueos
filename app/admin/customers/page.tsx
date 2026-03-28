"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminCustomerListRow } from "@/lib/admin/customers-types";

type SortKey =
  | "name"
  | "email"
  | "created_at"
  | "phone"
  | "phone_number_mode"
  | "contact_count"
  | "conversation_count"
  | "recovery_count"
  | "confirmed_booking_count";

type SortDir = "asc" | "desc";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

function compareRows(
  a: AdminCustomerListRow,
  b: AdminCustomerListRow,
  key: SortKey,
  dir: SortDir,
): number {
  const mul = dir === "asc" ? 1 : -1;
  if (key === "created_at") {
    return (
      mul *
      (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    );
  }
  if (
    key === "contact_count" ||
    key === "conversation_count" ||
    key === "recovery_count" ||
    key === "confirmed_booking_count"
  ) {
    return mul * (a[key] - b[key]);
  }
  const va = (a[key] ?? "").toString().toLowerCase();
  const vb = (b[key] ?? "").toString().toLowerCase();
  return mul * va.localeCompare(vb);
}

export default function AdminCustomersPage() {
  const router = useRouter();
  const [rows, setRows] = useState<AdminCustomerListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/customers", { credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof body?.error === "string"
            ? body.error
            : `Failed to load (${res.status})`,
        );
        setRows([]);
        return;
      }
      setRows(Array.isArray(body.customers) ? body.customers : []);
    } catch {
      setError("Network error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => compareRows(a, b, sortKey, sortDir)),
    [rows, sortKey, sortDir],
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "created_at" ? "desc" : "asc");
    }
  };

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  return (
    <div className="min-h-screen bg-[#f6f9fc] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[#425466]">
              Platform admin
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-[#0a2540]">
              Customers
            </h1>
            <p className="mt-1 text-sm text-[#425466]">
              All businesses on AutoRevenueOS — read-only.
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
              href="/admin"
              className="rounded-md border border-transparent bg-[#635bff] px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-[#5851e6]"
            >
              Admin home
            </Link>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-[#e6ebf1] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          {error ? (
            <div className="p-6 text-sm text-red-600">{error}</div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#e6ebf1] bg-[#fafbfc]">
                  {(
                    [
                      ["name", "Business"],
                      ["email", "Email"],
                      ["phone", "Phone"],
                      ["phone_number_mode", "Twilio mode"],
                      ["created_at", "Created"],
                      ["contact_count", "Contacts"],
                      ["conversation_count", "Conversations"],
                      ["recovery_count", "Recoveries"],
                      ["confirmed_booking_count", "Bookings"],
                    ] as const
                  ).map(([key, label]) => (
                    <th key={key} className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => toggleSort(key)}
                        className="inline-flex items-center text-xs font-semibold uppercase tracking-wide text-[#697386] hover:text-[#0a2540]"
                      >
                        {label}
                        <span className="ml-0.5 font-normal text-[#a3acb9]">
                          {sortIndicator(key)}
                        </span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f3f7]">
                {loading ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-10 text-center text-sm text-[#697386]"
                    >
                      Loading…
                    </td>
                  </tr>
                ) : sorted.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-10 text-center text-sm text-[#697386]"
                    >
                      No businesses yet.
                    </td>
                  </tr>
                ) : (
                  sorted.map((row) => (
                    <tr
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(`/admin/customers/${row.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(`/admin/customers/${row.id}`);
                        }
                      }}
                      className="cursor-pointer text-[#0a2540] hover:bg-[#f6f9fc]"
                    >
                      <td className="max-w-[200px] truncate px-4 py-2.5 font-medium">
                        {row.name}
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-2.5 text-[#425466]">
                        {row.email ?? "—"}
                      </td>
                      <td className="max-w-[140px] truncate px-4 py-2.5 text-[#425466]">
                        {row.phone ?? "—"}
                      </td>
                      <td className="max-w-[100px] truncate px-4 py-2.5 text-[#425466]">
                        {row.phone_number_mode ?? "dedicated"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-[#425466] tabular-nums">
                        {dateFmt.format(new Date(row.created_at))}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-[#425466]">
                        {row.contact_count}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-[#425466]">
                        {row.conversation_count}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-[#425466]">
                        {row.recovery_count}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-[#425466]">
                        {row.confirmed_booking_count}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
