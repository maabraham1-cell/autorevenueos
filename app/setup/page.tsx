'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const AddCardForm = dynamic(() => import('@/components/billing/AddCardForm'), { ssr: false });

type SetupData = {
  id: string;
  name: string;
  activation_status: string;
  billing_status?: string;
  phone_recovery_status?: string;
  twilio_phone_number?: string;
  twilio_provisioning_error?: string;
};

type BookingIntegrationProvider = {
  id: string;
  name: string;
  webhookUrl: string | null;
};

export default function SetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [noBusiness, setNoBusiness] = useState(false);
  const [data, setData] = useState<SetupData | null>(null);
  const [billingSecret, setBillingSecret] = useState<string | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [provisionLoading, setProvisionLoading] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [bookingIntegrations, setBookingIntegrations] = useState<{
    booking_page_url: string;
    providers: BookingIntegrationProvider[];
  } | null>(null);
  const [integrationsLoading, setIntegrationsLoading] = useState(false);
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setBillingError(null);
    setProvisionError(null);
    try {
      const res = await fetch('/api/settings');
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      if (res.status === 400 && (json?.error?.toLowerCase?.().includes('business') || json?.error === 'No business linked to this user')) {
        const setupRes = await fetch('/api/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
        const setupJson = await setupRes.json().catch(() => ({}));
        if (!setupRes.ok) {
          setNoBusiness(true);
          setLoading(false);
          return;
        }
        return load();
      }
      if (!res.ok) {
        setLoading(false);
        return;
      }
      setNoBusiness(false);
      setData({
        id: json.id,
        name: json.name ?? '',
        activation_status: json.activation_status ?? 'payment_required',
        billing_status: json.billing_status ?? 'pending',
        phone_recovery_status: json.phone_recovery_status ?? 'none',
        twilio_phone_number: json.twilio_phone_number ?? '',
        twilio_provisioning_error: json.twilio_provisioning_error ?? '',
      });
    } catch {
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!data?.id) return;
    let cancelled = false;
    setIntegrationsLoading(true);
    fetch('/api/booking-integrations')
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && (json?.booking_page_url || json?.providers)) {
          setBookingIntegrations(json);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIntegrationsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [data?.id]);

  const isFullyActive = data?.activation_status === 'active';
  const billingReady = (data?.billing_status ?? 'pending') === 'ready';
  const hasRecoveryNumber = Boolean((data?.twilio_phone_number ?? '').trim());

  const [step, setStep] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    if (!data) return;
    if (!billingReady) {
      setStep(1);
    } else if (!hasRecoveryNumber) {
      setStep(2);
    } else {
      setStep(3);
    }
  }, [data, billingReady, hasRecoveryNumber]);

  const goToStep = (target: 1 | 2 | 3) => {
    if (target === 1) {
      setStep(1);
      return;
    }
    if (target === 2 && billingReady) {
      setStep(2);
      return;
    }
    if (target === 3 && isFullyActive && hasRecoveryNumber) {
      setStep(3);
    }
  };

  const getSelectedProvider = (): BookingIntegrationProvider | null => {
    if (!bookingIntegrations || !selectedSystem) return null;
    const idMap: Record<string, string> = {
      square: 'square',
      fresha: 'fresha',
      timely: 'timely',
      calendly: 'calendly',
      treatwell: 'treatwell',
      google_sheets: 'google_sheets',
      other: 'feed',
    };
    const providerId = idMap[selectedSystem] ?? selectedSystem;
    return bookingIntegrations.providers.find((p) => p.id === providerId) ?? null;
  };

  if (loading && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
          <p className="text-center text-sm text-[#64748B]">Loading…</p>
        </div>
      </div>
    );
  }

  if (noBusiness) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
          <p className="text-sm text-[#64748B]">We couldn’t set up your business. Please try again from Settings.</p>
          <button
            type="button"
            onClick={() => router.push('/settings')}
            className="mt-4 w-full rounded-lg bg-[#1E3A8A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2563EB]"
          >
            Go to Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-lg rounded-2xl border border-[#E5E7EB]/80 bg-white shadow-xl">
        <div className="border-b border-[#E5E7EB] px-6 py-4">
          <h1 className="text-xl font-bold text-[#0F172A]">Set up AutoRevenueOS</h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Follow these steps to activate billing, turn on missed-call recovery, and connect your scheduling system.
          </p>
          {!billingReady && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <p className="font-medium">Add a payment method to activate messaging</p>
              <p className="mt-1 text-amber-800">
                Outbound messaging and automation stay blocked until billing is ready.
              </p>
            </div>
          )}
          <div className="mt-4 flex flex-col gap-2 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goToStep(1)}
                className={`flex-1 rounded-full px-3 py-1.5 text-left ${
                  step === 1
                    ? 'bg-[#1E3A8A] text-white'
                    : 'bg-[#EEF2FF] text-[#1E293B] hover:bg-[#E0E7FF]'
                }`}
              >
                <span className="font-semibold">Step 1</span> — Activate
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goToStep(2)}
                className={`flex-1 rounded-full px-3 py-1.5 text-left ${
                  step === 2
                    ? 'bg-[#1E3A8A] text-white'
                    : billingReady
                      ? 'bg-[#EEF2FF] text-[#1E293B] hover:bg-[#E0E7FF]'
                      : 'bg-[#F8FAFC] text-[#94A3B8] cursor-not-allowed'
                }`}
                disabled={!billingReady}
              >
                <span className="font-semibold">Step 2</span> — Phone
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goToStep(3)}
                className={`flex-1 rounded-full px-3 py-1.5 text-left ${
                  step === 3
                    ? 'bg-[#1E3A8A] text-white'
                    : isFullyActive && hasRecoveryNumber
                      ? 'bg-[#EEF2FF] text-[#1E293B] hover:bg-[#E0E7FF]'
                      : 'bg-[#F8FAFC] text-[#94A3B8] cursor-not-allowed'
                }`}
                disabled={!isFullyActive || !hasRecoveryNumber}
              >
                <span className="font-semibold">Step 3</span> — Scheduling
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Step 1: Billing activation */}
          {step === 1 && (
            <section className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA]/50 p-5">
              <h2 className="text-sm font-bold text-[#0F172A]">Activate your account</h2>
              <p className="mt-2 text-sm text-[#475569]">
                Add your card, then we automatically provision your phone recovery number. Activation completes when both succeed.
                You are only charged £3 when a <strong>confirmed appointment</strong> is received from your scheduling system.
                Messages and enquiries never trigger charges.
              </p>
              {billingError && (
                <p className="mt-3 text-sm text-red-600" role="alert">{billingError}</p>
              )}
              {!billingSecret ? (
                <button
                  type="button"
                  onClick={async () => {
                    setBillingError(null);
                    setBillingLoading(true);
                    try {
                      const res = await fetch('/api/billing/setup-intent', { method: 'POST' });
                      const json = await res.json().catch(() => ({}));
                      if (!res.ok) {
                        setBillingError(json?.error ?? 'Failed to start');
                        return;
                      }
                      setBillingSecret(json.clientSecret);
                    } catch {
                      setBillingError('Something went wrong. Please try again.');
                    } finally {
                      setBillingLoading(false);
                    }
                  }}
                  disabled={billingLoading}
                  className="mt-4 w-full rounded-lg bg-[#1E3A8A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2563EB] disabled:opacity-60"
                >
                  {billingLoading ? 'Loading…' : 'Add payment method'}
                </button>
              ) : (
                <div className="mt-4 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
                  <AddCardForm
                    clientSecret={billingSecret}
                    returnPath="/setup"
                    onSuccess={() => {
                      setBillingSecret(null);
                      void load();
                    }}
                    onCancel={() => setBillingSecret(null)}
                  />
                </div>
              )}
            </section>
          )}

          {/* Step 2: Phone recovery setup */}
          {step === 2 && (
            <section className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA]/50 p-5">
              <h2 className="text-sm font-bold text-[#0F172A]">Turn on missed call recovery</h2>
              <p className="mt-2 text-sm text-[#475569]">
                Forward missed calls from your clinic or practice phone and AutoRevenueOS will automatically text callers with a secure link to request an appointment.
              </p>
              {provisionError && (
                <p className="mt-3 text-sm text-red-600" role="alert">{provisionError}</p>
              )}
              {(data?.twilio_provisioning_error ?? '').trim() && !hasRecoveryNumber && (
                <p className="mt-2 text-sm text-amber-800">{data?.twilio_provisioning_error}</p>
              )}
              {!hasRecoveryNumber ? (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      setProvisionError(null);
                      setProvisionLoading(true);
                      try {
                        const res = await fetch('/api/settings/provision-phone', { method: 'POST' });
                        const json = await res.json().catch(() => ({}));
                        if (!res.ok) {
                          setProvisionError(json?.error ?? 'Failed to provision number');
                          await load();
                          return;
                        }
                        await load();
                      } catch {
                        setProvisionError('Something went wrong. Please try again.');
                      } finally {
                        setProvisionLoading(false);
                      }
                    }}
                    disabled={provisionLoading}
                    className="mt-4 w-full rounded-lg bg-[#1E3A8A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2563EB] disabled:opacity-60"
                  >
                    {provisionLoading ? 'Activating…' : 'Activate phone recovery'}
                  </button>
                  <p className="mt-2 text-xs text-[#64748B]">
                    A Twilio number will be provisioned and stored on your business. Voice and SMS webhooks will be set automatically.
                  </p>
                </>
              ) : (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-[#0F172A]">Your recovery number</h3>
                  <p className="mt-2 text-sm text-[#475569]">
                    Forward missed calls from your clinic or practice phone to this number so AutoRevenueOS can capture enquiries and send your appointment link.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm font-medium text-[#0F172A] font-mono">
                      {(data?.twilio_phone_number ?? '').trim()}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const num = (data?.twilio_phone_number ?? '').trim();
                        if (num) {
                          navigator.clipboard.writeText(num);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }
                      }}
                      className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-medium text-[#475569] hover:bg-[#F8FAFC]"
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Step 3: Connect scheduling system */}
          {step === 3 && (
            <section className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA]/50 p-5">
              <h2 className="text-sm font-bold text-[#0F172A]">Connect your scheduling system</h2>
              <p className="mt-2 text-sm text-[#475569]">
                AutoRevenueOS charges £3 only when a confirmed appointment is received from your scheduling system.
                Choose how you manage appointments and follow the steps to connect.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  { id: 'square', label: 'Square Appointments', logo: 'https://logotyp.us/file/square.svg', alt: 'Square logo' },
                  { id: 'fresha', label: 'Fresha', logo: '/integrations/fresha.svg', alt: 'Fresha logo' },
                  { id: 'timely', label: 'Timely', logo: 'https://logotyp.us/file/timely.svg', alt: 'Timely logo' },
                  { id: 'calendly', label: 'Calendly', logo: '/integrations/calendly.svg', alt: 'Calendly logo' },
                  { id: 'treatwell', label: 'Treatwell', logo: undefined, alt: 'Treatwell' },
                  { id: 'google_sheets', label: 'Google Sheets', logo: undefined, alt: 'Google Sheets' },
                  { id: 'other', label: 'Other', logo: undefined, alt: 'Other scheduling systems' },
                ].map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setSelectedSystem(card.id)}
                    className={`flex h-full flex-col items-start rounded-lg border px-4 py-3 text-left ${
                      selectedSystem === card.id
                        ? 'border-[#1E3A8A] bg-[#EEF2FF]'
                        : 'border-[#E5E7EB] bg-white hover:border-[#1E3A8A]/60 hover:bg-[#F9FAFB]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {card.logo && (
                        <img
                          src={card.logo}
                          alt={card.alt}
                          className="h-6 w-auto object-contain"
                          loading="lazy"
                          draggable={false}
                        />
                      )}
                      <span className="text-sm font-semibold text-[#0F172A]">{card.label}</span>
                    </div>
                    <span className="mt-1 text-xs text-[#64748B]">
                      {card.id === 'other'
                        ? 'Use automation tools or another scheduling system.'
                        : 'Connect confirmed appointments from this system to AutoRevenueOS.'}
                    </span>
                    <span className="mt-2 inline-flex rounded-full bg-[#1E3A8A] px-3 py-1 text-xs font-semibold text-white">
                      Connect
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-6 rounded-lg border border-dashed border-[#E5E7EB] bg-white p-4">
                {!bookingIntegrations || integrationsLoading ? (
                  <p className="text-sm text-[#94A3B8]">Loading connection instructions…</p>
                ) : !selectedSystem ? (
                  <p className="text-sm text-[#64748B]">Select your scheduling system above to see the steps.</p>
                ) : (
                  (() => {
                    const provider = getSelectedProvider();
                    const webhookUrl = provider?.webhookUrl ?? '';
                    const titleMap: Record<string, string> = {
                      square: 'Connect Square Appointments',
                      fresha: 'Connect Fresha',
                      timely: 'Connect Timely',
                      calendly: 'Connect Calendly',
                      treatwell: 'Connect Treatwell',
                      google_sheets: 'Connect Google Sheets',
                      other: 'Connect with automation tools',
                    };
                    const title = titleMap[selectedSystem] ?? `Connect ${provider?.name ?? 'your system'}`;

                    return (
                      <div>
                        <h3 className="text-sm font-semibold text-[#0F172A]">{title}</h3>
                        {selectedSystem === 'square' && (
                          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[#475569]">
                            <li>Open the Square Developer Dashboard and sign in.</li>
                            <li>Go to Webhooks (or Subscriptions).</li>
                            <li>Create a new webhook or subscription for booking / appointment events.</li>
                            <li>Paste the Webhook URL from AutoRevenueOS into the destination URL field and save.</li>
                            <li>Make a test appointment to check that AutoRevenueOS receives it.</li>
                          </ol>
                        )}
                        {selectedSystem === 'calendly' && (
                          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[#475569]">
                            <li>Open Calendly and go to Integrations.</li>
                            <li>Find Webhooks (or API &amp; webhooks) and create a new webhook subscription.</li>
                            <li>Select invitee created / invitee canceled (or equivalent booking events).</li>
                            <li>Paste the Webhook URL from AutoRevenueOS into the URL field and save.</li>
                            <li>Schedule a test appointment in Calendly to confirm it appears in AutoRevenueOS.</li>
                          </ol>
                        )}
                        {selectedSystem === 'google_sheets' && (
                          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[#475569]">
                            <li>Use Google Apps Script, Zapier or Make to watch your bookings sheet.</li>
                            <li>Trigger the flow when a row is added or updated for a confirmed appointment.</li>
                            <li>Add an action that POSTs the row data to the Webhook URL from AutoRevenueOS.</li>
                            <li>Map sheet columns to patient/client name, phone and appointment date/time.</li>
                            <li>Add a test row to confirm AutoRevenueOS receives the appointment.</li>
                          </ol>
                        )}
                        {selectedSystem === 'fresha' && (
                          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[#475569]">
                            <li>Use Zapier, Make or another automation tool connected to Fresha.</li>
                            <li>Create a workflow that triggers when an appointment is confirmed.</li>
                            <li>Add an action that POSTs the appointment details to the Webhook URL from AutoRevenueOS.</li>
                            <li>Include at least the patient/client name, phone number and appointment date/time.</li>
                            <li>Turn the workflow on and create a test appointment to confirm it reaches AutoRevenueOS.</li>
                          </ol>
                        )}
                        {selectedSystem === 'timely' && (
                          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[#475569]">
                            <li>Use Zapier, Make or another automation tool connected to Timely.</li>
                            <li>Create a workflow that triggers when an appointment is confirmed.</li>
                            <li>Add an action that POSTs the appointment details to the Webhook URL from AutoRevenueOS.</li>
                            <li>Include at least the patient/client name, phone number and appointment date/time.</li>
                            <li>Turn the workflow on and create a test appointment to confirm it reaches AutoRevenueOS.</li>
                          </ol>
                        )}
                        {selectedSystem === 'treatwell' && (
                          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[#475569]">
                            <li>Use a Treatwell integration, Zapier, Make or another automation tool.</li>
                            <li>Trigger the flow when an appointment is confirmed.</li>
                            <li>Add an action that POSTs the appointment details to the Webhook URL from AutoRevenueOS.</li>
                            <li>Include at least the patient/client name, phone number and appointment date/time.</li>
                            <li>Turn the flow on and create a test appointment to verify it reaches AutoRevenueOS.</li>
                          </ol>
                        )}
                        {selectedSystem === 'other' && (
                          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[#475569]">
                            <li>Use Zapier, Make, Pipedream or another automation tool.</li>
                            <li>Trigger the flow when an appointment is confirmed in your scheduling system or CRM.</li>
                            <li>Add an action that POSTs the appointment details to the Webhook URL from AutoRevenueOS.</li>
                            <li>Include at least the patient/client name, phone number and appointment date/time.</li>
                            <li>Turn the flow on and create a test appointment to make sure AutoRevenueOS records it.</li>
                          </ol>
                        )}
                        <div className="mt-4">
                          <label className="block text-xs font-medium uppercase tracking-wide text-[#64748B]">
                            Webhook URL
                          </label>
                          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                            <input
                              readOnly
                              value={webhookUrl}
                              className="flex-1 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-xs font-mono text-[#0F172A]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (!webhookUrl) return;
                                navigator.clipboard.writeText(webhookUrl);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 2000);
                              }}
                              className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-xs font-medium text-[#475569] hover:bg-[#F8FAFC]"
                            >
                              {copied ? 'Copied' : 'Copy URL'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            </section>
          )}

          {/* Completed: Recovery number and instructions (after scheduling step) */}
          {step === 3 && hasRecoveryNumber && (
            <section className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA]/50 p-5">
              <h2 className="text-sm font-bold text-[#0F172A]">Your recovery number</h2>
              <p className="mt-2 text-sm text-[#475569]">
                Forward missed calls from your clinic or practice phone to this number so we can capture enquiries and send your appointment link.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm font-medium text-[#0F172A] font-mono">
                  {(data?.twilio_phone_number ?? '').trim()}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const num = (data?.twilio_phone_number ?? '').trim();
                    if (num) {
                      navigator.clipboard.writeText(num);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }
                  }}
                  className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-medium text-[#475569] hover:bg-[#F8FAFC]"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="w-full rounded-lg bg-[#1E3A8A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2563EB]"
                >
                  Go to dashboard
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/settings')}
                  className="w-full rounded-lg border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-medium text-[#475569] hover:bg-[#F8FAFC]"
                >
                  Settings
                </button>
              </div>
            </section>
          )}

          {step !== 3 && (
            <p className="text-center text-xs text-[#94A3B8]">
              You can complete the remaining steps later from <button type="button" onClick={() => router.push('/settings')} className="font-medium text-[#2563EB] hover:underline">Settings</button>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
