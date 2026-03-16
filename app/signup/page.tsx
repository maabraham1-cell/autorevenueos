'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function SignupRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const redirectTo = searchParams.get('redirectTo');
    const query = redirectTo ? `?mode=signup&redirectTo=${encodeURIComponent(redirectTo)}` : '?mode=signup';
    router.replace(`/login${query}`);
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020617] px-4 py-10 sm:py-14">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <p className="text-center text-sm text-[#64748B]">Redirecting to signup…</p>
      </div>
    </div>
  );
}

export default function SignupRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#020617] px-4 py-10 sm:py-14">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl sm:p-8">
            <p className="text-center text-sm text-[#64748B]">Redirecting to signup…</p>
          </div>
        </div>
      }
    >
      <SignupRedirectInner />
    </Suspense>
  );
}


