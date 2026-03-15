'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const AddCardForm = dynamic(() => import('@/components/billing/AddCardForm'), { ssr: false });

type SetupData = {
  id: string;
  name: string;
  activation_status: string;
  twilio_phone_number?: string;
  twilio_provisioning_error?: string;
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

  const isActive = data?.activation_status === 'active';
  const hasRecoveryNumber = Boolean((data?.twilio_phone_number ?? '').trim());
  const step = !data ? null : !isActive ? 1 : !hasRecoveryNumber ? 2 : 3;

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
          <h1 className="text-xl font-bold text-[#0F172A]">Finish setting up AutoRevenueOS</h1>
          <p className="mt-1 text-sm text-[#64748B]">
            {step === 1 && 'Step 1 of 3 — Add a payment method'}
            {step === 2 && 'Step 2 of 3 — Phone Recovery'}
            {step === 3 && 'Step 3 of 3 — You’re ready'}
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Step 1: Billing activation */}
          {step === 1 && (
            <section className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA]/50 p-5">
              <h2 className="text-sm font-bold text-[#0F172A]">Billing activation</h2>
              <p className="mt-2 text-sm text-[#475569]">
                AutoRevenueOS charges <strong>£3 per confirmed booking</strong>. No upfront fee. We’ll create a Stripe customer and save your card for future billing. You won’t be charged until a booking is confirmed.
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
                      load();
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
              <h2 className="text-sm font-bold text-[#0F172A]">Phone recovery setup</h2>
              <p className="mt-2 text-sm text-[#475569]">
                Enable Phone Recovery to get a dedicated number. Forward your business missed calls to it so we can capture leads and send booking links. You cannot enable phone recovery or trigger SMS until billing is active.
              </p>
              {provisionError && (
                <p className="mt-3 text-sm text-red-600" role="alert">{provisionError}</p>
              )}
              {(data?.twilio_provisioning_error ?? '').trim() && !hasRecoveryNumber && (
                <p className="mt-2 text-sm text-amber-800">{data?.twilio_provisioning_error}</p>
              )}
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
                {provisionLoading ? 'Provisioning…' : 'Enable Phone Recovery'}
              </button>
              <p className="mt-2 text-xs text-[#64748B]">
                A Twilio number will be provisioned and stored on your business. Voice and SMS webhooks will be set automatically.
              </p>
            </section>
          )}

          {/* Step 3: Recovery number and instructions */}
          {step === 3 && (
            <section className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA]/50 p-5">
              <h2 className="text-sm font-bold text-[#0F172A]">Your recovery number</h2>
              <p className="mt-2 text-sm text-[#475569]">
                Forward missed calls from your business phone to this number so we can capture leads and send booking links.
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
