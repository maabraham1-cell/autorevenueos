'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabaseBrowser';

function LoginForm() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialMode =
    (searchParams.get('mode') as 'login' | 'signup' | null) ?? 'login';

  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailVerificationSent, setEmailVerificationSent] = useState<string | null>(null);

  useEffect(() => {
    const qMode = searchParams.get('mode');
    if (qMode === 'login' || qMode === 'signup') {
      setMode(qMode);
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEmailVerificationSent(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        const profileName = fullName.trim();
        const bizName = businessName.trim();
        const phoneValue = phone.trim();

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: profileName || null,
              business_name: bizName || null,
              phone: phoneValue || null,
            },
          },
        });
        if (error) throw error;
        setEmailVerificationSent(email);
        return;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }

      const redirectTo = searchParams.get('redirectTo') || '/dashboard';
      router.push(redirectTo);
    } catch (e: any) {
      setError(e?.message ?? 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020617] px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h1 className="text-2xl font-bold text-[#0F172A]">
          {mode === 'login' ? 'Log in to AutoRevenueOS' : 'Start your free trial'}
        </h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Use your work email to access your AutoRevenueOS workspace.
        </p>

        {emailVerificationSent && (
          <div className="mt-3 rounded-lg border border-[#22C55E]/40 bg-[#F0FDF4] px-3 py-3 text-sm text-[#166534]">
            <p className="font-medium">Verification email sent</p>
            <p className="mt-1">
              We’ve sent a verification link to <strong>{emailVerificationSent}</strong>. Please check your inbox and click the link to verify your account. You can log in after verifying.
            </p>
            <button
              type="button"
              onClick={() => setEmailVerificationSent(null)}
              className="mt-2 text-xs font-medium text-[#15803D] underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {mode === 'signup' && (
            <>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Full name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
                  placeholder="e.g. Alex Smith"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Business name
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
                  placeholder="e.g. Oakwood Dental Clinic"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Mobile number
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
                  placeholder="+44 7700 900123"
                />
                <p className="mt-1 text-[11px] text-[#94A3B8]">
                  Used so we can contact you about your account and recoveries. We won&apos;t spam you.
                </p>
              </div>
            </>
          )}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
              Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#1E3A8A] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#2563EB] disabled:opacity-60"
          >
            {loading
              ? 'Please wait…'
              : mode === 'login'
              ? 'Log in'
              : 'Create account'}
          </button>
        </form>

        <button
          type="button"
          className="mt-4 w-full text-center text-xs text-[#64748B]"
          onClick={() =>
            setMode((m) => (m === 'login' ? 'signup' : 'login'))
          }
        >
          {mode === 'login'
            ? 'New here? Start a free trial'
            : 'Already have an account? Log in'}
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#020617] px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <p className="text-center text-sm text-[#64748B]">Loading…</p>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

