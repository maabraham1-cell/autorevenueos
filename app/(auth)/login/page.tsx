'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import { trackEvent } from '@/lib/ga4';

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

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
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailVerificationSent, setEmailVerificationSent] = useState<string | null>(null);
  const [forgotPasswordSent, setForgotPasswordSent] = useState<string | null>(null);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [humanVerified, setHumanVerified] = useState(false);
  const [humanTouched, setHumanTouched] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const [turnstileReady, setTurnstileReady] = useState(false);

  const resetTurnstile = () => {
    setTurnstileToken('');
    setHumanVerified(false);
    if (typeof window !== 'undefined' && turnstileWidgetIdRef.current) {
      const w = (window as any).turnstile;
      if (w?.reset) w.reset(turnstileWidgetIdRef.current);
    }
  };

  const passwordStrength = (() => {
    const value = password;
    const hasLetter = /[A-Za-z]/.test(value);
    const hasNumber = /[0-9]/.test(value);
    const hasSpecial = /[^A-Za-z0-9]/.test(value);
    if (value.length >= 10 && hasLetter && hasNumber && hasSpecial) return 'strong' as const;
    if (value.length >= 8 && hasLetter && hasNumber) return 'medium' as const;
    if (value.length > 0) return 'weak' as const;
    return null;
  })();

  const passwordsMatch =
    mode !== 'signup' || passwordConfirm.length === 0 || passwordConfirm === password;

  const signupPasswordStrongEnough =
    mode !== 'signup' || passwordStrength === 'medium' || passwordStrength === 'strong';

  const canSubmit =
    !loading &&
    humanVerified &&
    email.trim().length > 0 &&
    password.trim().length > 0 &&
    (!TURNSTILE_SITE_KEY || turnstileToken.length > 0) &&
    (mode === 'login' ||
      (signupPasswordStrongEnough && passwordConfirm.length > 0 && passwordsMatch));

  useEffect(() => {
    const qMode = searchParams.get('mode');
    if (qMode === 'login' || qMode === 'signup') {
      setMode(qMode);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !turnstileReady || !turnstileContainerRef.current) return;
    const w = (window as any).turnstile;
    if (!w?.render) return;
    if (turnstileWidgetIdRef.current) return;
    const id = w.render(turnstileContainerRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token: string) => {
        setTurnstileToken(token);
        setHumanVerified(true);
      },
      'expired-callback': () => {
        setTurnstileToken('');
        setHumanVerified(false);
      },
      'error-callback': () => {
        setTurnstileToken('');
        setHumanVerified(false);
      },
    });
    turnstileWidgetIdRef.current = id;
    return () => {
      if (turnstileWidgetIdRef.current != null && w.remove) {
        try {
          w.remove(turnstileWidgetIdRef.current);
        } catch (_) {}
        turnstileWidgetIdRef.current = null;
      }
    };
  }, [turnstileReady]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEmailVerificationSent(null);

    if (!humanVerified) {
      setHumanTouched(true);
      setError('Please verify you are human.');
      return;
    }

    if (TURNSTILE_SITE_KEY && turnstileToken) {
      setLoading(true);
      const verifyRes = await fetch('/api/turnstile-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: turnstileToken }),
      });
      if (!verifyRes.ok) {
        resetTurnstile();
        const data = await verifyRes.json().catch(() => ({}));
        setError(data?.error ?? 'Verification expired or failed. Please verify again.');
        setLoading(false);
        return;
      }
    }

    if (mode === 'signup') {
      const profileName = fullName.trim();
      const bizName = businessName.trim();
      const phoneValue = phone.trim();
      if (!email.trim() || !password.trim()) {
        setError('Please enter your email and password.');
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }
      if (!signupPasswordStrongEnough) {
        setError('Password is too weak. Please use at least 8 characters with letters and numbers.');
        return;
      }
      if (passwordConfirm.length === 0 || passwordConfirm !== password) {
        setError('Passwords do not match.');
        return;
      }
      if (!profileName || !bizName || !phoneValue) {
        setError('Please fill in your name, business name, and phone number.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const profileName = fullName.trim();
        const bizName = businessName.trim();
        const phoneValue = phone.trim();

        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: origin ? `${origin}/auth/callback?next=/setup` : undefined,
            data: {
              full_name: profileName || null,
              business_name: bizName || null,
              phone: phoneValue || null,
            },
          },
        });

        const isExistingUser =
          signUpError?.message && /already registered|already exists|already been registered/i.test(signUpError.message);
        const existingUserNoIdentities =
          !signUpError && signUpData?.user && (!signUpData.user.identities || signUpData.user.identities.length === 0);

        if (isExistingUser || existingUserNoIdentities) {
          const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
          if (signInErr) {
            setError('An account with this email already exists. Please log in.');
            setMode('login');
            setLoading(false);
            return;
          }
          const settingsRes = await fetch('/api/settings');
          if (settingsRes.status === 400) {
            router.push('/setup');
            return;
          }
          await supabase.auth.signOut();
          setError('An account with this email already exists. Please log in.');
          setMode('login');
          setLoading(false);
          return;
        }

        if (signUpError) throw signUpError;
        setEmailVerificationSent(email);
        trackEvent('signup_completed');
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
      if (TURNSTILE_SITE_KEY) resetTurnstile();
      const msg = e?.message ?? e?.error_description ?? '';
      const isRateLimit =
        /rate limit|rate_limit|too many requests|too many attempts/i.test(msg);
      if (isRateLimit) {
        setError(
          'Too many signup attempts. Please wait about an hour before trying again, or try logging in if you already have an account.'
        );
      } else {
        setError(msg || 'Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020617] px-4 py-10 sm:py-14">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <h1 className="text-2xl font-bold text-[#0F172A]">
          {mode === 'login' ? 'Log in to AutoRevenueOS' : 'Create your AutoRevenueOS account'}
        </h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Free to install. Only £3 per recovered booking lead. Use your work email to get started.
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
              className="mt-2 cursor-pointer text-xs font-medium text-[#15803D] underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {forgotPasswordSent && (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
            <p className="font-medium">Check your email</p>
            <p className="mt-1">We sent a link to <strong>{forgotPasswordSent}</strong> to reset your password.</p>
            <button type="button" onClick={() => setForgotPasswordSent(null)} className="mt-2 text-xs font-medium text-emerald-700 underline hover:no-underline">Dismiss</button>
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
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
                  placeholder="Alex Smith"
                  suppressHydrationWarning
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
                  placeholder="Oakwood Dental Clinic"
                  suppressHydrationWarning
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
                  suppressHydrationWarning
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
              suppressHydrationWarning
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
              suppressHydrationWarning
            />
            {mode === 'signup' && (
              <div className="mt-2 space-y-1">
                <p className="text-[11px] font-medium text-[#64748B]">Password strength</p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
                  <div
                    className={
                      'h-full transition-all ' +
                      (passwordStrength === 'strong'
                        ? 'w-full bg-emerald-500'
                        : passwordStrength === 'medium'
                        ? 'w-2/3 bg-amber-500'
                        : passwordStrength === 'weak'
                        ? 'w-1/3 bg-red-500'
                        : 'w-0 bg-transparent')
                    }
                  />
                </div>
                {passwordStrength && (
                  <p
                    className={
                      'text-[11px] ' +
                      (passwordStrength === 'strong'
                        ? 'text-emerald-700'
                        : passwordStrength === 'medium'
                        ? 'text-amber-700'
                        : 'text-red-700')
                    }
                  >
                    {passwordStrength === 'strong'
                      ? 'Strong — great choice.'
                      : passwordStrength === 'medium'
                      ? 'Medium — good enough to continue.'
                      : 'Weak — use at least 8 characters with letters and numbers.'}
                  </p>
                )}
              </div>
            )}
            {mode === 'login' && (
              <p className="mt-1.5 text-right">
                <button
                  type="button"
                  onClick={async () => {
                    const e = email.trim();
                    if (!e) {
                      setError('Enter your email above first.');
                      return;
                    }
                    setError(null);
                    setForgotPasswordLoading(true);
                    try {
                      const origin = typeof window !== 'undefined' ? window.location.origin : '';
                      const { error: resetError } = await supabase.auth.resetPasswordForEmail(e, {
                        redirectTo: origin ? `${origin}/auth/callback?next=/auth/set-password` : undefined,
                      });
                      if (resetError) throw resetError;
                      setForgotPasswordSent(e);
                    } catch (err: unknown) {
                      setError(err instanceof Error ? err.message : 'Failed to send reset email.');
                    } finally {
                      setForgotPasswordLoading(false);
                    }
                  }}
                  disabled={forgotPasswordLoading}
                  className="text-xs font-medium text-[#2563EB] hover:underline disabled:opacity-60"
                >
                  {forgotPasswordLoading ? 'Sending…' : 'Forgot password?'}
                </button>
              </p>
            )}
          </div>
          {mode === 'signup' && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                Confirm password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
                suppressHydrationWarning
              />
              {!passwordsMatch && passwordConfirm.length > 0 && (
                <p className="mt-1 text-xs text-red-600">Passwords do not match.</p>
              )}
            </div>
          )}
          <div className="pt-1">
            {TURNSTILE_SITE_KEY ? (
              <>
                <Script
                  src="https://challenges.cloudflare.com/turnstile/v0/api.js"
                  strategy="afterInteractive"
                  onLoad={() => setTurnstileReady(true)}
                />
                <div className="flex flex-col gap-1.5">
                  <div ref={turnstileContainerRef} className="min-h-[65px] w-full" />
                  {humanVerified && (
                    <p className="text-xs font-medium text-emerald-700">Verified</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <label className="inline-flex items-center gap-2 text-xs text-[#64748B]">
                  <input
                    type="checkbox"
                    checked={humanVerified}
                    onChange={(e) => {
                      setHumanTouched(true);
                      setHumanVerified(e.target.checked);
                    }}
                    className="h-4 w-4 rounded border-[#CBD5E1] text-[#1E3A8A] focus:ring-[#1E3A8A]"
                  />
                  <span>
                    {humanVerified ? (
                      <span className="font-medium text-emerald-700">Verified</span>
                    ) : (
                      'Verify you are human'
                    )}
                  </span>
                </label>
                {!humanVerified && humanTouched && (
                  <p className="mt-1 text-[11px] text-red-600">Please verify you are human to continue.</p>
                )}
              </>
            )}
          </div>
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full cursor-pointer rounded-lg bg-[#1E3A8A] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-60"
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
          className="mt-4 w-full cursor-pointer text-center text-xs text-[#64748B] transition-colors hover:text-[#2563EB] hover:underline"
          onClick={() =>
            setMode((m) => (m === 'login' ? 'signup' : 'login'))
          }
        >
          {mode === 'login'
            ? 'New here? Create an account'
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
        <div className="flex min-h-screen items-center justify-center bg-[#020617] px-4 py-10 sm:py-14">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl sm:p-8">
            <p className="text-center text-sm text-[#64748B]">Loading…</p>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

