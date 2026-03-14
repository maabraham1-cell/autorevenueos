"use client";

import { useState, useMemo } from "react";

function generateIdempotencyKey(): string {
  return `book-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function BookingConfirmForm({ confirmToken }: { confirmToken: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useMemo(() => generateIdempotencyKey(), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/booking/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirm_token: confirmToken,
          idempotency_key: idempotencyKey,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data.error as string) || "Something went wrong");
        return;
      }
      setDone(true);
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-lg bg-emerald-50 text-emerald-800 px-4 py-3 text-sm">
        Booking confirmed. You’ll hear from the business shortly.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="hidden" name="confirm_token" value={confirmToken} />
      {error && (
        <p className="text-red-600 text-sm mb-3" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-slate-800 text-white font-medium py-3 px-4 hover:bg-slate-700 disabled:opacity-50 disabled:pointer-events-none"
      >
        {loading ? "Confirming…" : "Confirm booking"}
      </button>
    </form>
  );
}
