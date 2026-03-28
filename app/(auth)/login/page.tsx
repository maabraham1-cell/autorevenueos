'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import { trackEvent } from '@/lib/ga4';
import {
  ADMIN_HOME_PATH,
  defaultPostAuthPathFromRole,
  sanitizeAppPathForAdminRole,
} from '@/lib/internal-operator';
import { getProfileRole } from '@/lib/client-profile-role';
import { authCallbackUrl } from '@/lib/public-app-url';

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

const TITLE_OPTIONS = ['', 'Mr', 'Mrs', 'Miss', 'Ms', 'Dr', 'Prof', 'Prefer not to say'] as const;
const BUSINESS_TYPE_OPTIONS = [
  '',
  'Salon',
  'Clinic',
  'Dental',
  'Aesthetics',
  'Trades',
  'Professional Services',
  'Other',
] as const;

function RequiredAsterisk() {
  return <span className="text-red-600" aria-hidden="true">* </span>;
}

function LoginForm() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialMode =
    (searchParams.get('mode') as 'login' | 'signup' | null) ?? 'login';

  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [title, setTitle] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessMobile, setBusinessMobile] = useState('');
  const [businessType, setBusinessType] = useState('');
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
  /** If Turnstile script/widget never works (blocked, DNS, domain mismatch), fall back to checkbox. */
  const [turnstileUseFallback, setTurnstileUseFallback] = useState(false);
  /** Bump on sign-out so Turnstile remounts and verification UI resets without a full page reload. */
  const [turnstileRemountKey, setTurnstileRemountKey] = useState(0);
  const submittingRef = useRef(false);

  const turnstileWidgetActive = Boolean(TURNSTILE_SITE_KEY) && !turnstileUseFallback;

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

  const signupFieldsComplete =
    title.trim().length > 0 &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    businessName.trim().length > 0 &&
    businessMobile.trim().length > 0 &&
    businessType.trim().length > 0;

  const canSubmit =
    !loading &&
    humanVerified &&
    email.trim().length > 0 &&
    password.trim().length > 0 &&
    (mode === 'login' ||
      (signupFieldsComplete &&
        signupPasswordStrongEnough &&
        passwordConfirm.length > 0 &&
        passwordsMatch));

  useEffect(() => {
    const qMode = searchParams.get('mode');
    if (qMode === 'login' || qMode === 'signup') {
      setMode(qMode);
    }
  }, [searchParams]);

  // Already signed in → leave login page (avoids "stuck" with greyed button + redirectTo in URL).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled || !session?.user) return;
      const role = await getProfileRole(supabase, session.user.id);
      const defaultLanding = defaultPostAuthPathFromRole(role);
      const redirectToRaw = searchParams.get('redirectTo') || defaultLanding;
      let redirectToSafe = redirectToRaw.startsWith('/')
        ? redirectToRaw.replace(/^\/+/, '/')
        : defaultLanding;
      redirectToSafe = sanitizeAppPathForAdminRole(redirectToSafe, role);
      router.replace(redirectToSafe);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams, supabase]);

  // After logout, navigation often mounts this page *after* SIGNED_OUT already fired — remount Turnstile then.
  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || session) return;
      setHumanVerified(false);
      setHumanTouched(false);
      setTurnstileToken('');
      setTurnstileUseFallback(false);
      setTurnstileRemountKey((k) => k + 1);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_OUT') return;
      setHumanVerified(false);
      setHumanTouched(false);
      setTurnstileToken('');
      setTurnstileUseFallback(false);
      setTurnstileRemountKey((k) => k + 1);
      if (typeof window !== 'undefined' && turnstileWidgetIdRef.current) {
        const w = (window as any).turnstile;
        try {
          w?.reset?.(turnstileWidgetIdRef.current);
        } catch {
          /* widget may already be removed */
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || turnstileUseFallback) return;
    const id = window.setTimeout(() => {
      if (!turnstileReady) {
        setTurnstileUseFallback(true);
      }
    }, 12000);
    return () => window.clearTimeout(id);
  }, [TURNSTILE_SITE_KEY, turnstileReady, turnstileUseFallback]);

  useEffect(() => {
    if (turnstileUseFallback && TURNSTILE_SITE_KEY) {
      setHumanVerified(false);
      setTurnstileToken('');
    }
  }, [turnstileUseFallback]);

  useEffect(() => {
    if (!turnstileWidgetActive || !turnstileReady || !turnstileContainerRef.current) return;
    const w = (window as any).turnstile;
    if (!w?.render) return;
    const el = turnstileContainerRef.current;
    // appearance: 'always' avoids Cloudflare's default "managed" UX where the widget
    // often hides or changes shape (described as unpredictable). Users always see the check.
    const widgetId = w.render(el, {
      sitekey: TURNSTILE_SITE_KEY,
      appearance: 'always',
      theme: 'light',
      'refresh-expired': 'auto',
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
    turnstileWidgetIdRef.current = widgetId;
    return () => {
      turnstileWidgetIdRef.current = null;
      if (widgetId != null && w.remove) {
        try {
          w.remove(widgetId);
        } catch (_) {
          /* iframe may already be gone */
        }
      }
    };
  }, [turnstileReady, turnstileWidgetActive, turnstileRemountKey]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    setEmailVerificationSent(null);
    setLoading(true);

    if (!humanVerified) {
      setHumanTouched(true);
      setError('Please verify you are human.');
      setLoading(false);
      submittingRef.current = false;
      return;
    }

    // If Turnstile is enabled, require we actually have a token to verify.
    // This prevents a "Verified" UI state from allowing auth without the token.
    if (turnstileWidgetActive && !turnstileToken) {
      setHumanTouched(true);
      setError('Please verify you are human (missing verification token).');
      resetTurnstile();
      setLoading(false);
      submittingRef.current = false;
      return;
    }

    if (turnstileWidgetActive && turnstileToken) {
      const verifyRes = await fetch('/api/turnstile-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: turnstileToken }),
      });
      if (!verifyRes.ok) {
        resetTurnstile();
        const verifyData = (await verifyRes.json().catch(() => ({}))) as { error?: string };
        setError(verifyData.error ?? 'Human verification failed. Please try again.');
        setLoading(false);
        submittingRef.current = false;
        return;
      }
    }

    if (mode === 'signup') {
      if (!email.trim() || !password.trim()) {
        setError('Please enter your email and password.');
        setLoading(false);
        submittingRef.current = false;
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters.');
        setLoading(false);
        submittingRef.current = false;
        return;
      }
      if (!signupPasswordStrongEnough) {
        setError('Password is too weak. Please use at least 8 characters with letters and numbers.');
        setLoading(false);
        submittingRef.current = false;
        return;
      }
      if (passwordConfirm.length === 0 || passwordConfirm !== password) {
        setError('Passwords do not match.');
        setLoading(false);
        submittingRef.current = false;
        return;
      }
      if (
        !title.trim() ||
        !firstName.trim() ||
        !lastName.trim() ||
        !businessName.trim() ||
        !businessMobile.trim() ||
        !businessType.trim()
      ) {
        setError('Please complete all required fields.');
        setLoading(false);
        submittingRef.current = false;
        return;
      }
    }

    try {
      if (mode === 'signup') {
        const fullNameValue = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: authCallbackUrl('/setup'),
            data: {
              title: title.trim() || null,
              first_name: firstName.trim() || null,
              last_name: lastName.trim() || null,
              full_name: fullNameValue || null,
              business_name: businessName.trim() || null,
              business_mobile: businessMobile.trim() || null,
              business_type: businessType.trim() || null,
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
            const {
              data: { session: sessionAfter },
            } = await supabase.auth.getSession();
            const uid = sessionAfter?.user?.id;
            const role = uid ? await getProfileRole(supabase, uid) : null;
            router.push(
              defaultPostAuthPathFromRole(role) === ADMIN_HOME_PATH
                ? ADMIN_HOME_PATH
                : '/setup',
            );
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

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      const role = user?.id ? await getProfileRole(supabase, user.id) : null;
      const defaultLanding = defaultPostAuthPathFromRole(role);
      const redirectToRaw =
        searchParams.get('redirectTo') || defaultLanding;
      let redirectToSafe = redirectToRaw.startsWith('/')
        ? redirectToRaw.replace(/^\/+/, '/')
        : defaultLanding;
      redirectToSafe = sanitizeAppPathForAdminRole(redirectToSafe, role);
      router.push(redirectToSafe);
    } catch (e: any) {
      if (turnstileWidgetActive) resetTurnstile();
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
      submittingRef.current = false;
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020617] px-4 py-10 sm:py-14">
      <div className={`w-full rounded-2xl bg-white p-6 shadow-xl sm:p-8 ${mode === 'signup' ? 'max-w-lg' : 'max-w-md'}`}>
        <h1 className="text-2xl font-bold text-[#0F172A]">
          {mode === 'login' ? 'Log in to AutoRevenueOS' : 'Create your AutoRevenueOS account'}
        </h1>
        <p className="mt-1 text-sm text-[#64748B]">
          {mode === 'login'
            ? 'Log in to access your account, inbox, and dashboard.'
            : 'Free to install. Only £3 per recovered booking lead. Use your work email to get started.'}
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
              <section className="space-y-4 rounded-lg border border-[#E5E7EB] bg-[#FAFAFA]/50 px-4 py-4">
                <h2 className="text-sm font-bold text-[#0F172A]">About you</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium text-[#0F172A]">
                      <RequiredAsterisk />Title
                    </label>
                    <select
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#0F172A] focus:border-[#1E3A8A] focus:outline-none focus:ring-1 focus:ring-[#1E3A8A]"
                      aria-required="true"
                    >
                      <option value="">Please select</option>
                      {TITLE_OPTIONS.filter((o) => o !== '').map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-[#0F172A]">
                      <RequiredAsterisk />First name
                    </label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#0F172A] focus:border-[#1E3A8A] focus:outline-none focus:ring-1 focus:ring-[#1E3A8A]"
                      aria-required="true"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#0F172A]">
                    <RequiredAsterisk />Last name
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#0F172A] focus:border-[#1E3A8A] focus:outline-none focus:ring-1 focus:ring-[#1E3A8A]"
                    aria-required="true"
                  />
                </div>
              </section>

              <section className="space-y-4 rounded-lg border border-[#E5E7EB] bg-[#FAFAFA]/50 px-4 py-4">
                <h2 className="text-sm font-bold text-[#0F172A]">About your business</h2>
                <div>
                  <label className="block text-sm font-medium text-[#0F172A]">
                    <RequiredAsterisk />Business name
                  </label>
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#0F172A] focus:border-[#1E3A8A] focus:outline-none focus:ring-1 focus:ring-[#1E3A8A]"
                    aria-required="true"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#0F172A]">
                    <RequiredAsterisk />Business type
                  </label>
                  <select
                    required
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#0F172A] focus:border-[#1E3A8A] focus:outline-none focus:ring-1 focus:ring-[#1E3A8A]"
                    aria-required="true"
                  >
                    {BUSINESS_TYPE_OPTIONS.map((opt) => (
                      <option key={opt || '_'} value={opt}>
                        {opt || 'Select'}
                      </option>
                    ))}
                  </select>
                </div>
              </section>
            </>
          )}

          <section className={mode === 'signup' ? 'space-y-4 rounded-lg border border-[#E5E7EB] bg-[#FAFAFA]/50 px-4 py-4' : ''}>
            {mode === 'signup' && (
              <h2 className="text-sm font-bold text-[#0F172A]">Account details</h2>
            )}
            <div>
              <label className="block text-sm font-medium text-[#0F172A]">
                <RequiredAsterisk />Email
              </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#0F172A] focus:border-[#1E3A8A] focus:outline-none focus:ring-1 focus:ring-[#1E3A8A]"
              aria-required="true"
            />
            </div>
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-[#0F172A]">
                  <RequiredAsterisk />Business mobile
                </label>
                <input
                  type="tel"
                  required
                  value={businessMobile}
                  onChange={(e) => setBusinessMobile(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#0F172A] focus:border-[#1E3A8A] focus:outline-none focus:ring-1 focus:ring-[#1E3A8A]"
                  aria-required="true"
                />
                <p className="mt-1 text-xs text-[#64748B]">
                  Used to contact you about your account and recoveries.
                </p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-[#0F172A]">
                <RequiredAsterisk />Password
              </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#0F172A] focus:border-[#1E3A8A] focus:outline-none focus:ring-1 focus:ring-[#1E3A8A]"
              aria-required="true"
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
                      const { error: resetError } = await supabase.auth.resetPasswordForEmail(e, {
                        redirectTo: authCallbackUrl('/auth/set-password'),
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
              <label className="block text-sm font-medium text-[#0F172A]">
                <RequiredAsterisk />Confirm password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#0F172A] focus:border-[#1E3A8A] focus:outline-none focus:ring-1 focus:ring-[#1E3A8A]"
                aria-required="true"
              />
              {!passwordsMatch && passwordConfirm.length > 0 && (
                <p className="mt-1 text-xs text-red-600" role="alert">Passwords do not match.</p>
              )}
            </div>
          )}
          </section>

          <div className="pt-1">
            {turnstileWidgetActive ? (
              <>
                <Script
                  src="https://challenges.cloudflare.com/turnstile/v0/api.js"
                  strategy="afterInteractive"
                  onLoad={() => setTurnstileReady(true)}
                  onError={() => setTurnstileUseFallback(true)}
                />
                <div className="flex flex-col gap-1.5">
                  <div
                    key={turnstileRemountKey}
                    ref={turnstileContainerRef}
                    className="min-h-[65px] w-full"
                  />
                  {humanVerified && (
                    <p className="text-xs font-medium text-emerald-700">✔ Verified</p>
                  )}
                </div>
              </>
            ) : (
              <>
                {TURNSTILE_SITE_KEY && turnstileUseFallback ? (
                  <p className="mb-2 rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                    Security check couldn’t load (blocked or network). Tick the box below to continue.
                  </p>
                ) : null}
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
                      <span className="font-medium text-emerald-700">✔ Verified</span>
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

