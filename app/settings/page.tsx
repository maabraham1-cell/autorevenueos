'use client';

import { useEffect, useState } from 'react';

type SettingsData = {
  id: string | null;
  name: string;
  industry: string;
  booking_link: string;
  average_booking_value: number;
  location: string;
  auto_reply_template: string;
  meta_page_id: string;
};

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState<Partial<SettingsData>>({});

  const previewText = (() => {
    const businessName =
      (form.name ?? "").trim().length > 0 ? (form.name ?? "").trim() : "your business";
    const bookingLink =
      (form.booking_link ?? "").trim().length > 0
        ? (form.booking_link ?? "").trim()
        : "https://example.com";

    const template =
      (form.auto_reply_template ?? "").trim().length > 0
        ? (form.auto_reply_template ?? "").trim()
        : "Hi, thanks for messaging {business_name}. You can book here: {booking_link}";

    return template
      .replace(/{business_name}/g, businessName)
      .replace(/{booking_link}/g, bookingLink);
  })();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch('/api/settings');
        if (!res.ok) throw new Error('Failed to load settings');
        const json = (await res.json()) as SettingsData;
        if (!cancelled) {
          setData(json);
          setForm({
            name: json.name ?? '',
            industry: json.industry ?? '',
            booking_link: json.booking_link ?? '',
            average_booking_value: json.average_booking_value ?? 60,
            location: json.location ?? '',
            auto_reply_template: json.auto_reply_template ?? '',
            meta_page_id: json.meta_page_id ?? '',
          });
        }
      } catch (e) {
        if (!cancelled) setError('Failed to load settings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name ?? '',
          industry: form.industry ?? '',
          booking_link: form.booking_link ?? '',
          average_booking_value: Number(form.average_booking_value) || 60,
          location: form.location ?? '',
          auto_reply_template: form.auto_reply_template ?? '',
          meta_page_id: form.meta_page_id ?? '',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error ?? 'Failed to save settings');
        return;
      }
      setSuccess(true);
      if (data) {
        setData({
          ...data,
          name: String(form.name ?? ''),
          industry: String(form.industry ?? ''),
          booking_link: String(form.booking_link ?? ''),
          average_booking_value: Number(form.average_booking_value) || 60,
          location: String(form.location ?? ''),
          auto_reply_template: String(form.auto_reply_template ?? ''),
          meta_page_id: String(form.meta_page_id ?? ''),
        });
      }
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 py-10 bg-[#020617] bg-[radial-gradient(ellipse_at_top,_rgba(37,99,235,0.24),transparent_60%)]">
      <div className="mx-auto max-w-2xl rounded-[18px] border border-[#E5E7EB]/80 bg-white/95 px-4 py-8 shadow-[0_32px_80px_rgba(15,23,42,0.55)] sm:px-6 lg:px-8">
        <header className="animate-fade-in-up">
          <h1 className="text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
            Settings
          </h1>
          <p className="mt-2 text-sm text-[#475569]">
            Configure your business for recovered revenue tracking and auto-replies.
          </p>
        </header>

        {error && (
          <div className="animate-fade-in-up mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="animate-fade-in-up mt-4 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 text-sm text-[#166534]">
            Settings saved.
          </div>
        )}

        <section className="card-base animate-fade-in-up mt-8 rounded-[14px] p-6">
          <h2 className="text-sm font-semibold text-[#0F172A]">Business</h2>
          <p className="mt-1 text-xs text-[#64748B]">
            Used for estimated revenue and auto-reply messages.
          </p>

          {loading ? (
            <p className="mt-6 text-sm text-[#94A3B8]">Loading…</p>
          ) : (
            <div className="mt-6 space-y-5">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-[#64748B]">
                  Business name
                </label>
                <input
                  type="text"
                  value={form.name ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1.5 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#0F172A] transition-colors focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
                  placeholder="e.g. Acme Spa"
                />
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-[#64748B]">
                  Industry
                </label>
                <input
                  type="text"
                  value={form.industry ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
                  className="mt-1.5 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#0F172A] transition-colors focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
                  placeholder="e.g. Beauty, Restaurant"
                />
                <p className="mt-1 text-[11px] text-[#94A3B8]">Optional.</p>
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-[#64748B]">
                  Location
                </label>
                <input
                  type="text"
                  value={form.location ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  className="mt-1.5 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#0F172A] transition-colors focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
                  placeholder="e.g. London, UK"
                />
                <p className="mt-1 text-[11px] text-[#94A3B8]">Optional. Used in messaging context only.</p>
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-[#64748B]">
                  Booking link
                </label>
                <input
                  type="url"
                  value={form.booking_link ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, booking_link: e.target.value }))}
                  className="mt-1.5 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#0F172A] transition-colors focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
                  placeholder="https://..."
                />
                <p className="mt-1 text-[11px] text-[#94A3B8]">
                  Included in auto-reply messages. Leave empty to use default.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-[#64748B]">
                  Average booking value (£)
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={form.average_booking_value ?? 60}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      average_booking_value: Math.max(0, parseInt(e.target.value, 10) || 0),
                    }))
                  }
                  className="mt-1.5 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#0F172A] transition-colors focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
                  placeholder="60"
                />
                <p className="mt-1 text-[11px] text-[#94A3B8]">
                  This value is used on Dashboard and Recoveries to calculate estimated recovered revenue and bookings. Default 60.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-[#64748B]">
                  Meta page ID
                </label>
                <input
                  type="text"
                  value={form.meta_page_id ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, meta_page_id: e.target.value }))}
                  className="mt-1.5 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#0F172A] transition-colors focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
                  placeholder="e.g. 123456789012345"
                />
                <p className="mt-1 text-[11px] text-[#94A3B8]">
                  Used to route Meta/Instagram webhook events to this business. Must match the page/account ID configured in Meta.
                </p>
                <p className="mt-1 text-[11px] text-[#94A3B8]">
                  Status:{" "}
                  {(!form.meta_page_id || form.meta_page_id.trim().length === 0) ? (
                    <span className="font-semibold text-[#DC2626]">Not configured</span>
                  ) : (
                    <span className="font-semibold text-[#16A34A]">Configured</span>
                  )}
                  .
                </p>
                <p className="mt-1 text-[11px] text-[#94A3B8]">
                  Test: 1) Set Meta Page ID, 2) Save, 3) Send a test message, 4) Check Inbox.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-[#1E3A8A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2563EB] disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="card-base animate-fade-in-up mt-6 rounded-[14px] p-6">
          <h2 className="text-sm font-semibold text-[#0F172A]">Auto-reply</h2>
          <p className="mt-1 text-xs text-[#64748B]">
            Outgoing message when AutoRevenueOS re-engages a lead.
          </p>
          <div className="mt-3 space-y-2">
            <textarea
              value={form.auto_reply_template ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, auto_reply_template: e.target.value }))}
              rows={5}
              className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#0F172A] transition-colors focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
              placeholder={
                'Hi, thanks for contacting {business_name} 👋\n\nYou can book here:\n{booking_link}'
              }
            />
            <p className="text-[11px] text-[#94A3B8]">
              Supports <code className="rounded bg-[#F1F5F9] px-1">{"{business_name}"}</code> and{" "}
              <code className="rounded bg-[#F1F5F9] px-1">{"{booking_link}"}</code> placeholders. If left blank, a
              default message will be used.
            </p>
            <p className="text-[11px] text-[#94A3B8]">
              {(!form.auto_reply_template || form.auto_reply_template.trim().length === 0)
                ? "Using default template."
                : "Using custom template."}
              {" "}
              {form.auto_reply_template && !form.auto_reply_template.includes("{booking_link}") && (
                <span className="font-semibold text-[#DC2626]">
                  Your template does not include {"{booking_link}"}; make sure customers can still see how to book.
                </span>
              )}
            </p>
            <div className="mt-4 rounded-lg border border-dashed border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2.5 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                Preview
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-[#0F172A]">
                {previewText}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
