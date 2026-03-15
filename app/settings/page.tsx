'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const AddCardForm = dynamic(() => import('@/components/billing/AddCardForm'), { ssr: false });

const INDUSTRY_OPTIONS = [
  '',
  'Beauty / Salon',
  'Dental',
  'Healthcare Clinic',
  'Fitness / Wellness',
  'Trades / Local Services',
  'Professional Services',
  'Restaurant / Hospitality',
  'Other',
];

const LOCATION_OPTIONS = [
  '',
  'London',
  'South East England',
  'South West England',
  'Midlands',
  'North West England',
  'North East England',
  'Yorkshire',
  'Scotland',
  'Wales',
  'Northern Ireland',
  'Ireland',
  'Other',
];

type SettingsData = {
  id: string | null;
  name: string;
  industry: string;
  booking_link: string;
  average_booking_value: number;
  location: string;
  auto_reply_template: string;
  meta_page_id: string;
  twilio_phone_number?: string;
  acuity_api_key?: string;
  square_merchant_id?: string;
  activation_status?: string;
  twilio_provisioning_error?: string;
};

type BookingIntegrationProvider = {
  id: string;
  name: string;
  status: string;
  trustLevel: string;
  trustLabel: string;
  webhookUrl: string | null;
  setupHint: string | null;
  credentialsNeeded: string[];
  canTriggerConfirmedBookingsToday: boolean;
};

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState<Partial<SettingsData>>({});
  const [noBusiness, setNoBusiness] = useState(false);
  const [setupName, setSetupName] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [locationOther, setLocationOther] = useState('');
  const [bookingIntegrations, setBookingIntegrations] = useState<{
    booking_page_url: string;
    providers: BookingIntegrationProvider[];
    feed_secret_required_in_production?: boolean;
    hint?: { square?: string; acuity?: string };
  } | null>(null);
  const [integrationsLoading, setIntegrationsLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [provisionPhoneLoading, setProvisionPhoneLoading] = useState(false);
  const [provisionPhoneError, setProvisionPhoneError] = useState<string | null>(null);
  const [billingSetupSecret, setBillingSetupSecret] = useState<string | null>(null);
  const [billingSetupLoading, setBillingSetupLoading] = useState(false);
  const [billingSetupError, setBillingSetupError] = useState<string | null>(null);

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

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    setNoBusiness(false);
    try {
      const res = await fetch('/api/settings');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 400 && (json?.error === 'No business linked to this user' || json?.error?.toLowerCase?.().includes('business'))) {
          setNoBusiness(true);
          return;
        }
        if (res.status === 401) {
          setError('Please log in again.');
          return;
        }
        setError(json?.error ?? 'Failed to load settings.');
        return;
      }
      const settings = json as SettingsData;
      setData(settings);
      const loc = (settings.location ?? '').trim();
      const isLocInList = LOCATION_OPTIONS.some((o) => o && o === loc);
      const ind = (settings.industry ?? '').trim();
      const industryInList = INDUSTRY_OPTIONS.some((o) => o && o === ind);
      setForm({
        name: settings.name ?? '',
        industry: industryInList ? ind : '',
        booking_link: settings.booking_link ?? '',
        average_booking_value: settings.average_booking_value ?? 60,
        location: isLocInList ? loc : (loc ? 'Other' : ''),
        auto_reply_template: settings.auto_reply_template ?? '',
        meta_page_id: settings.meta_page_id ?? '',
        twilio_phone_number: settings.twilio_phone_number ?? '',
        acuity_api_key: settings.acuity_api_key ?? '',
        square_merchant_id: settings.square_merchant_id ?? '',
        activation_status: settings.activation_status ?? 'payment_required',
        twilio_provisioning_error: settings.twilio_provisioning_error ?? '',
      });
      setLocationOther(isLocInList ? '' : loc);
    } catch (e) {
      setError('Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (noBusiness || !data?.id) return;
    let cancelled = false;
    setIntegrationsLoading(true);
    fetch('/api/booking-integrations')
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && (json?.booking_page_url || json?.providers)) setBookingIntegrations(json);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setIntegrationsLoading(false); });
    return () => { cancelled = true; };
  }, [data?.id, noBusiness]);

  const handleCreateBusiness = async () => {
    setSetupError(null);
    setSetupLoading(true);
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: (setupName || 'New Business').trim() || 'New Business' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSetupError(json?.error ?? 'Failed to create business');
        return;
      }
      await loadSettings();
      setNoBusiness(false);
      setSetupName('');
    } catch (e) {
      setSetupError('Something went wrong. Please try again.');
    } finally {
      setSetupLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const locationValue = (form.location === 'Other' ? locationOther : (form.location ?? '')).trim() || null;
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name ?? '',
          industry: (form.industry ?? '').trim() || null,
          booking_link: form.booking_link ?? '',
          average_booking_value: Number(form.average_booking_value) || 60,
          location: locationValue,
          auto_reply_template: form.auto_reply_template ?? '',
          meta_page_id: form.meta_page_id ?? '',
          acuity_api_key: form.acuity_api_key ?? '',
          square_merchant_id: form.square_merchant_id ?? '',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error ?? 'Failed to save settings');
        return;
      }
      setSuccess(true);
      if (data) {
        const loc = form.location === 'Other' ? locationOther : (form.location ?? '');
        setData({
          ...data,
          name: String(form.name ?? ''),
          industry: String(form.industry ?? ''),
          booking_link: String(form.booking_link ?? ''),
          average_booking_value: Number(form.average_booking_value) || 60,
          location: String(loc ?? ''),
          auto_reply_template: String(form.auto_reply_template ?? ''),
          meta_page_id: String(form.meta_page_id ?? ''),
          twilio_phone_number: String(form.twilio_phone_number ?? ''),
          acuity_api_key: String(form.acuity_api_key ?? ''),
          square_merchant_id: String(form.square_merchant_id ?? ''),
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

        {noBusiness && (
          <div className="animate-fade-in-up mt-6 rounded-xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="text-lg font-semibold text-[#0F172A]">Create your business</h2>
            <p className="mt-1 text-sm text-[#64748B]">
              Your account isn’t linked to a business yet. Add a business name below to get started — you can change it anytime in Settings.
            </p>
            <div className="mt-4">
              <label className="block text-xs font-medium uppercase tracking-wide text-[#64748B]">
                Business name
              </label>
              <input
                type="text"
                value={setupName}
                onChange={(e) => setSetupName(e.target.value)}
                placeholder="e.g. Acme Spa"
                className="mt-1.5 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#0F172A] focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
              />
            </div>
            {setupError && (
              <p className="mt-2 text-sm text-red-600">{setupError}</p>
            )}
            <button
              type="button"
              onClick={handleCreateBusiness}
              disabled={setupLoading}
              className="mt-4 rounded-lg bg-[#1E3A8A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2563EB] disabled:opacity-60"
            >
              {setupLoading ? 'Creating…' : 'Create business'}
            </button>
          </div>
        )}

        <section className="card-base animate-fade-in-up mt-8 rounded-[14px] p-6">
          <h2 className="text-sm font-semibold text-[#0F172A]">Business</h2>
          <p className="mt-1 text-xs text-[#64748B]">
            Used for estimated revenue and auto-reply messages.
          </p>

          {loading ? (
            <p className="mt-6 text-sm text-[#94A3B8]">Loading…</p>
          ) : noBusiness ? (
            <p className="mt-6 text-sm text-[#94A3B8]">Create your business above to see settings.</p>
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
                <select
                  value={form.industry ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
                  className="mt-1.5 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#0F172A] transition-colors focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
                >
                  {INDUSTRY_OPTIONS.map((opt) => (
                    <option key={opt || '_'} value={opt}>{opt || 'Select industry…'}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-[#94A3B8]">Optional.</p>
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-[#64748B]">
                  Location
                </label>
                <select
                  value={form.location ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  className="mt-1.5 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#0F172A] transition-colors focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
                >
                  {LOCATION_OPTIONS.map((opt) => (
                    <option key={opt || '_'} value={opt}>{opt || 'Select location…'}</option>
                  ))}
                </select>
                {form.location === 'Other' && (
                  <input
                    type="text"
                    value={locationOther}
                    onChange={(e) => setLocationOther(e.target.value)}
                    placeholder="e.g. Bristol, UK"
                    className="mt-2 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
                  />
                )}
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

              <div className="border-t border-[#E5E7EB] pt-4 mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Booking integration credentials</h3>
                <p className="mt-1 text-[11px] text-[#94A3B8]">Optional. Used for webhook verification or mapping.</p>
                <div className="mt-3 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[#475569]">Acuity API key</label>
                    <input
                      type="password"
                      autoComplete="off"
                      value={form.acuity_api_key ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, acuity_api_key: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
                      placeholder="Acuity API key for signature verification"
                    />
                    <p className="mt-1 text-[11px] text-[#94A3B8]">For Acuity webhook signature verification (x-acuity-signature).</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#475569]">Square merchant ID</label>
                    <input
                      type="text"
                      value={form.square_merchant_id ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, square_merchant_id: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
                      placeholder="Square merchant ID"
                    />
                    <p className="mt-1 text-[11px] text-[#94A3B8]">So we can map Square booking.created webhooks to this business.</p>
                  </div>
                </div>
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

        {!noBusiness && data?.id && (
          <section className="card-base animate-fade-in-up mt-6 rounded-[14px] p-6">
            <h2 className="text-sm font-semibold text-[#0F172A]">Billing &amp; activation</h2>
            <p className="mt-1 text-xs text-[#64748B]">
              Add a card to activate AutoRevenueOS. You&apos;ll only be charged when a booking is confirmed (£3 per confirmed booking). No upfront charge.
            </p>
            {(form.activation_status ?? data?.activation_status ?? 'payment_required') === 'active' ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">
                  Card on file • AutoRevenueOS is active
                </span>
              </div>
            ) : (
              <>
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <p className="font-medium">Add your card to activate AutoRevenueOS</p>
                  <p className="mt-1 text-amber-800">Phone recovery and confirmed booking billing are available only after a payment method is on file.</p>
                </div>
                {billingSetupError && (
                  <p className="mt-2 text-sm text-red-600" role="alert">{billingSetupError}</p>
                )}
                {!billingSetupSecret ? (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={async () => {
                        setBillingSetupError(null);
                        setBillingSetupLoading(true);
                        try {
                          const res = await fetch('/api/billing/setup-intent', { method: 'POST' });
                          const json = await res.json().catch(() => ({}));
                          if (!res.ok) {
                            setBillingSetupError(json?.error ?? 'Failed to start setup');
                            return;
                          }
                          setBillingSetupSecret(json.clientSecret);
                        } catch {
                          setBillingSetupError('Something went wrong. Please try again.');
                        } finally {
                          setBillingSetupLoading(false);
                        }
                      }}
                      disabled={billingSetupLoading}
                      className="rounded-lg bg-[#1E3A8A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2563EB] disabled:opacity-60"
                    >
                      {billingSetupLoading ? 'Loading…' : 'Add your card'}
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
                    <AddCardForm
                      clientSecret={billingSetupSecret}
                      onSuccess={() => {
                        setBillingSetupSecret(null);
                        loadSettings();
                        setForm((f) => ({ ...f, activation_status: 'active' }));
                        setData((d) => (d ? { ...d, activation_status: 'active' } : d));
                      }}
                      onCancel={() => setBillingSetupSecret(null)}
                    />
                  </div>
                )}
              </>
            )}
          </section>
        )}

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

        <section className="card-base animate-fade-in-up mt-6 rounded-[14px] p-6">
          <h2 className="text-sm font-semibold text-[#0F172A]">Phone Recovery</h2>
          <p className="mt-1 text-xs text-[#64748B]">
            A dedicated number for missed-call detection and recovery SMS. Forward your business calls to it so we can capture missed calls and send booking links. Setup success does not assign a number — enable here after adding a card.
          </p>
          {noBusiness || !data?.id ? (
            <>
              <p className="mt-3 text-sm font-medium text-[#64748B]">Status: Not set up</p>
              <p className="mt-2 text-sm text-[#94A3B8]">Create or select your business above to enable Phone Recovery.</p>
            </>
          ) : (() => {
            const hasNumber = Boolean((form.twilio_phone_number ?? '').trim());
            const persistedError = (form.twilio_provisioning_error ?? data?.twilio_provisioning_error ?? '').trim();
            const isBillingActive = (form.activation_status ?? data?.activation_status) === 'active';
            const status: 'active' | 'pending' | 'failed' | 'inactive' =
              hasNumber ? 'active' : provisionPhoneLoading ? 'pending' : persistedError ? 'failed' : 'inactive';
            return (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-[#64748B]">Status:</span>
                  {status === 'active' && (
                    <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">Active</span>
                  )}
                  {status === 'pending' && (
                    <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-800">Provisioning…</span>
                  )}
                  {status === 'failed' && (
                    <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800">Provisioning failed</span>
                  )}
                  {status === 'inactive' && (
                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">Not set up</span>
                  )}
                </div>
                {status === 'active' && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-wide text-[#64748B]">Recovery number</label>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2.5 text-sm font-medium text-[#0F172A] font-mono">
                          {(form.twilio_phone_number ?? '').trim()}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const num = (form.twilio_phone_number ?? '').trim();
                            if (num) {
                              navigator.clipboard.writeText(num);
                              setCopiedUrl('recovery_number');
                              setTimeout(() => setCopiedUrl(null), 2000);
                            }
                          }}
                          className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-medium text-[#475569] hover:bg-[#F8FAFC]"
                        >
                          {copiedUrl === 'recovery_number' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-[#475569]">
                      Forward missed calls from your business phone to this number.
                    </p>
                  </div>
                )}
                {status === 'failed' && (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                      <p className="font-medium">Provisioning failed</p>
                      <p className="mt-1">{persistedError || provisionPhoneError || 'No number was assigned. Please try again.'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        setProvisionPhoneError(null);
                        setProvisionPhoneLoading(true);
                        try {
                          const res = await fetch('/api/settings/provision-phone', { method: 'POST' });
                          const json = await res.json().catch(() => ({}));
                          if (!res.ok) {
                            setProvisionPhoneError(json?.error ?? 'Failed to provision number');
                            await loadSettings();
                            return;
                          }
                          await loadSettings();
                          setForm((f) => ({ ...f, twilio_phone_number: json.phoneNumber ?? '', twilio_provisioning_error: '' }));
                          setData((d) => (d ? { ...d, twilio_phone_number: json.phoneNumber ?? '', twilio_provisioning_error: '' } : d));
                        } catch {
                          setProvisionPhoneError('Something went wrong. Please try again.');
                        } finally {
                          setProvisionPhoneLoading(false);
                        }
                      }}
                      disabled={provisionPhoneLoading}
                      className="rounded-lg bg-[#1E3A8A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2563EB] disabled:opacity-60"
                    >
                      {provisionPhoneLoading ? 'Retrying…' : 'Retry provisioning'}
                    </button>
                  </div>
                )}
                {status === 'inactive' && (
                  isBillingActive ? (
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={async () => {
                          setProvisionPhoneError(null);
                          setProvisionPhoneLoading(true);
                          try {
                            const res = await fetch('/api/settings/provision-phone', { method: 'POST' });
                            const json = await res.json().catch(() => ({}));
                            if (!res.ok) {
                              setProvisionPhoneError(json?.error ?? 'Failed to provision number');
                              await loadSettings();
                              return;
                            }
                            await loadSettings();
                            setForm((f) => ({ ...f, twilio_phone_number: json.phoneNumber ?? '', twilio_provisioning_error: '' }));
                          } catch {
                            setProvisionPhoneError('Something went wrong. Please try again.');
                          } finally {
                            setProvisionPhoneLoading(false);
                          }
                        }}
                        disabled={provisionPhoneLoading}
                        className="rounded-lg bg-[#1E3A8A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2563EB] disabled:opacity-60"
                      >
                        {provisionPhoneLoading ? 'Provisioning…' : 'Enable Phone Recovery'}
                      </button>
                      <p className="mt-2 text-[11px] text-[#94A3B8]">
                        A Twilio number will be purchased and voice/SMS webhooks configured. Success only when a number is shown above.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      <p className="font-medium">Add your card to activate first</p>
                      <p className="mt-1 text-amber-800">Phone Recovery is available after you add a payment method in Billing &amp; activation above.</p>
                    </div>
                  )
                )}
                {status === 'pending' && (
                  <p className="mt-4 text-sm text-[#64748B]">Request in progress. Do not leave this page until a number appears or an error is shown.</p>
                )}
                {provisionPhoneError && status !== 'failed' && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {provisionPhoneError}
                  </div>
                )}
              </>
            );
          })()}
        </section>

        <section className="card-base animate-fade-in-up mt-6 rounded-[14px] p-6">
          <h2 className="text-sm font-semibold text-[#0F172A]">Booking integrations</h2>
          <p className="mt-1 text-xs text-[#64748B]">
            Use these URLs in your booking system to send confirmed bookings to AutoRevenueOS. Only confirmed bookings (not link clicks) trigger billing. Trust: <strong>Verified</strong> = native/signed; <strong>Bridge</strong> = feed/automation (set INBOUND_FEED_SECRET in production).
          </p>
          {bookingIntegrations?.feed_secret_required_in_production && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              In production, generic feed and Google Sheets endpoints require <code className="rounded bg-amber-100 px-1">INBOUND_FEED_SECRET</code> to be set; otherwise they return 503. Set the secret in your environment and send <code className="rounded bg-amber-100 px-1">Authorization: Bearer &lt;secret&gt;</code>.
            </div>
          )}
          {integrationsLoading ? (
            <p className="mt-4 text-sm text-[#94A3B8]">Loading URLs…</p>
          ) : bookingIntegrations?.providers?.length ? (
            <div className="mt-4 space-y-4">
              {bookingIntegrations.providers.map((p) => (
                <div key={p.id} className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC]/50 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-[#0F172A]">{p.name}</span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        p.trustLevel === 'verified' ? 'bg-emerald-100 text-emerald-800' :
                        p.trustLevel === 'bridge' ? 'bg-sky-100 text-sky-800' :
                        'bg-slate-100 text-slate-600'
                      }`}
                      title={p.trustLabel}
                    >
                      {p.trustLabel}
                    </span>
                    {p.status === 'partial' && (
                      <span className="text-[11px] text-[#64748B]">Partial</span>
                    )}
                  </div>
                  {p.setupHint && (
                    <p className="mt-1 text-[11px] text-[#64748B]">{p.setupHint}</p>
                  )}
                  {p.webhookUrl && (
                    <div className="mt-2 flex gap-2">
                      <input
                        readOnly
                        value={p.webhookUrl}
                        className="flex-1 rounded border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[11px] text-[#0F172A] font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(p.webhookUrl!);
                          setCopiedUrl(p.id);
                          setTimeout(() => setCopiedUrl(null), 2000);
                        }}
                        className="rounded border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#475569] hover:bg-[#F8FAFC]"
                      >
                        {copiedUrl === p.id ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  )}
                  {p.id === 'feed' && bookingIntegrations.feed_secret_required_in_production && (
                    <p className="mt-1.5 text-[11px] text-amber-700">Requires Bearer token in production.</p>
                  )}
                </div>
              ))}
            </div>
          ) : !noBusiness && data?.id ? (
            <p className="mt-4 text-sm text-[#94A3B8]">Could not load integrations. Check you are signed in.</p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
