'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

function AddCardFormInner({
  clientSecret,
  onSuccess,
  onCancel,
  returnPath = '/settings',
}: {
  clientSecret: string;
  onSuccess: () => void;
  onCancel: () => void;
  returnPath?: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setError(null);
    setLoading(true);
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
        setLoading(false);
        return;
      }
      const setupIntent = (result as { setupIntent?: { status: string; id: string } }).setupIntent;
      if (setupIntent?.status === 'succeeded' && setupIntent.id) {
        const res = await fetch('/api/billing/confirm-setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ setup_intent_id: setupIntent.id }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json?.error ?? 'Failed to activate');
          setLoading(false);
          return;
        }
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (!stripePromise) {
    return (
      <p className="text-sm text-amber-700">
        Stripe is not configured (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).
      </p>
    );
  }

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
          {loading ? 'Saving…' : 'Save card and activate'}
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
  onSuccess: () => void;
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
