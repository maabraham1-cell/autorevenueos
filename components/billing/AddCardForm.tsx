'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

export type AddCardSuccessPayload = {
  fullyActivated: boolean;
  twilioProvisioningError?: string;
};

function AddCardFormInner({
  clientSecret,
  onSuccess,
  onCancel,
  returnPath = '/settings',
}: {
  clientSecret: string;
  onSuccess: (payload: AddCardSuccessPayload) => void;
  onCancel: () => void;
  returnPath?: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'payment' | 'provision'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setError(null);
    setLoading(true);
    setPhase('idle');
    try {
      const result = await stripe.confirmSetup({
        elements,
        clientSecret,
        confirmParams: {
          return_url: (typeof window !== 'undefined' ? window.location.origin : '') + returnPath,
          payment_method_data: {
            billing_details: { address: { country: 'GB' } },
          },
        },
      });
      if (result.error) {
        setError(result.error.message ?? 'Payment failed');
        return;
      }
      const setupIntent = (result as { setupIntent?: { status: string; id: string } }).setupIntent;
      if (setupIntent?.status === 'succeeded' && setupIntent.id) {
        setPhase('provision');
        const res = await fetch('/api/billing/confirm-setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ setup_intent_id: setupIntent.id }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json?.error ?? 'Failed to complete activation');
          return;
        }
        if (json?.success && json?.fullyActivated === false) {
          onSuccess({
            fullyActivated: false,
            twilioProvisioningError:
              typeof json.twilio_provisioning_error === 'string'
                ? json.twilio_provisioning_error
                : undefined,
          });
          return;
        }
        if (json?.success && json?.fullyActivated === true) {
          onSuccess({ fullyActivated: true });
          return;
        }
        setError('Unexpected response from server');
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
      setPhase('idle');
    }
  };

  if (!stripePromise) {
    return (
      <p className="text-sm text-amber-700">
        Stripe is not configured (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).
      </p>
    );
  }

  const loadingLabel =
    phase === 'provision'
      ? 'Provisioning phone recovery number…'
      : phase === 'payment'
        ? 'Saving payment method…'
        : 'Saving…';

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && (
        <p className="text-sm text-red-600" role="alert">{error}</p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!stripe || loading}
          className="rounded-lg bg-[#1E3A8A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2563EB] disabled:opacity-60"
        >
          {loading ? loadingLabel : 'Save card and activate'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-medium text-[#475569] hover:bg-[#F8FAFC] disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
      {loading && (
        <p className="text-xs text-[#64748B]">
          We save your card first, then provision your dedicated phone recovery number. This can take a few seconds.
        </p>
      )}
    </form>
  );
}

export default function AddCardForm({
  clientSecret,
  onSuccess,
  onCancel,
  returnPath,
}: {
  clientSecret: string;
  onSuccess: (payload: AddCardSuccessPayload) => void;
  onCancel: () => void;
  returnPath?: string;
}) {
  if (!stripePromise) return null;
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
      <AddCardFormInner clientSecret={clientSecret} onSuccess={onSuccess} onCancel={onCancel} returnPath={returnPath} />
    </Elements>
  );
}
