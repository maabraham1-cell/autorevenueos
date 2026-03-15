'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabaseBrowser';

/**
 * Auth callback: after email confirmation (or magic link / recovery), Supabase
 * redirects here with the session in the URL hash. We wait for the session to
 * be established, then redirect to the requested path (default /setup for onboarding).
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');
  const done = useRef(false);

  useEffect(() => {
    const next = searchParams.get('next') || '/setup';
    const supabase = createSupabaseBrowserClient();

    const redirectToNext = () => {
      if (done.current) return;
      done.current = true;
      setStatus('done');
      router.replace(next);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) redirectToNext();
    });

    const timer = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) redirectToNext();
    }, 500);

    const fallback = setTimeout(() => {
      if (!done.current) {
        done.current = true;
        setStatus('error');
        router.replace('/login');
      }
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
      clearTimeout(fallback);
    };
  }, [router, searchParams]);

  if (status === 'error') {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020617] px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-lg">
        <p className="text-sm font-medium text-[#0F172A]">Completing sign in…</p>
        <p className="mt-2 text-xs text-[#64748B]">Redirecting you to finish setup.</p>
      </div>
    </div>
  );
}
