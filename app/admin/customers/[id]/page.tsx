"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { AdminCustomerDetail } from "@/lib/admin/customers-types";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-[#f0f3f7] py-3 sm:grid-cols-[minmax(0,200px)_1fr] sm:gap-6">
      <dt className="text-xs font-semibold uppercase tracking-wide text-[#697386]">
        {label}
      </dt>
      <dd className="text-sm text-[#0a2540]">{value}</dd>
    </div>
  );
}

export default function AdminCustomerDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const [customer, setCustomer] = useState<AdminCustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/customers/${encodeURIComponent(id)}`, {
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof body?.error === "string"
            ? body.error
            : `Failed to load (${res.status})`,
        );
        setCustomer(null);
        return;
      }
      setCustomer(body.customer ?? null);
    } catch {
      setError("Network error");
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-[#f6f9fc] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link
            href="/admin/customers"
            className="text-sm font-medium text-[#635bff] hover:underline"
          >
            ← Customers
          </Link>
        </div>

        <div className="overflow-hidden rounded-lg border border-[#e6ebf1] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="border-b border-[#e6ebf1] px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[#425466]">
              Business
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-[#0a2540]">
              {loading ? "Loading…" : customer?.name ?? "—"}
            </h1>
          </div>

          <div className="px-5 pb-5">
            {error ? (
              <p className="mt-4 text-sm text-red-600">{error}</p>
            ) : null}
            {!loading && !error && !customer ? (
              <p className="mt-4 text-sm text-[#697386]">Not found.</p>
            ) : null}
            {customer ? (
              <dl className="mt-2">
                <DetailRow label="Business ID" value={customer.id} />
                <DetailRow
                  label="Created"
                  value={dateFmt.format(new Date(customer.created_at))}
                />
                <DetailRow
                  label="Email"
                  value={customer.email ?? "—"}
                />
                <DetailRow
                  label="Business mobile"
                  value={customer.business_mobile ?? "—"}
                />
                <DetailRow
                  label="Twilio number"
                  value={customer.twilio_phone_number ?? "—"}
                />
                <DetailRow
                  label="Phone number mode"
                  value={
                    <span>
                      {customer.phone_number_mode ?? "dedicated"}
                      {customer.twilio_pool_entry_id ? (
                        <span className="ml-2 text-xs text-[#697386]">
                          (pool entry {customer.twilio_pool_entry_id})
                        </span>
                      ) : null}
                    </span>
                  }
                />
                <DetailRow
                  label="Industry"
                  value={customer.industry ?? "—"}
                />
                <DetailRow
                  label="Activation"
                  value={customer.activation_status ?? "—"}
                />
                <DetailRow
                  label="Booking link"
                  value={
                    customer.booking_link ? (
                      <a
                        href={customer.booking_link}
                        className="break-all text-[#635bff] hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {customer.booking_link}
                      </a>
                    ) : (
                      "—"
                    )
                  }
                />
                <div className="mt-6 border-t border-[#e6ebf1] pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#697386]">
                    Metrics
                  </p>
                </div>
                <DetailRow
                  label="Contacts"
                  value={
                    <span className="tabular-nums">{customer.contact_count}</span>
                  }
                />
                <DetailRow
                  label="Conversations"
                  value={
                    <span className="tabular-nums">
                      {customer.conversation_count}
                    </span>
                  }
                />
                <DetailRow
                  label="Recoveries"
                  value={
                    <span className="tabular-nums">{customer.recovery_count}</span>
                  }
                />
                <DetailRow
                  label="Confirmed bookings"
                  value={
                    <span className="tabular-nums">
                      {customer.confirmed_booking_count}
                    </span>
                  }
                />
              </dl>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
