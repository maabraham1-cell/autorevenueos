'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabaseBrowser';

/**
 * After clicking the "Reset password" link in email, user is redirected here
 * (via /auth/callback?next=/auth/set-password). They set a new password, are
 * signed out, and must log in again.
 */
export default function SetPasswordPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
      await supabase.auth.signOut();
      setTimeout(() => router.replace('/login?redirectTo=/dashboard'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] px-4">
        <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-lg">
          <p className="text-sm font-medium text-[#0F172A]">Password updated.</p>
          <p className="mt-2 text-xs text-[#64748B]">Please log in again to continue.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020617] px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
        <h1 className="text-lg font-bold text-[#0F172A]">Set new password</h1>
        <p className="mt-1 text-sm text-[#64748B]">Choose a new password for your AutoRevenueOS account.</p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#64748B]">New password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#64748B]">Confirm password</label>
            <input
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#1E3A8A] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#2563EB] disabled:opacity-60"
          >
            {loading ? 'Updating…' : 'Set password'}
          </button>
        </form>
      </div>
    </div>
  );
}
