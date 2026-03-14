'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getConsent, setConsent, setConversionCookiesOnAccept, refreshConversionCookiesIfConsented } from "@/lib/consent";

/** Only show the consent banner on public marketing pages (GDPR: not on app pages). */
function isMarketingPage(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/" || pathname === "/marketing" || pathname.startsWith("/marketing");
}

export function CookieConsentBanner() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [consent, setConsentState] = useState<"granted" | "rejected" | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const current = getConsent();
    setConsentState(current);
    if (current === "granted") {
      refreshConversionCookiesIfConsented();
    }
  }, [mounted]);

  function handleAccept() {
    setConsent("granted");
    setConversionCookiesOnAccept();
    setConsentState("granted");
  }

  function handleReject() {
    setConsent("rejected");
    setConsentState("rejected");
  }

  if (!mounted || !isMarketingPage(pathname) || consent !== null) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-[10000] border-t border-[#E5E7EB] bg-white/98 px-4 py-2.5 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] backdrop-blur-sm sm:px-5"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-[#475569] sm:text-sm">
          We use essential cookies for login. Optional analytics (e.g. Google Analytics) only run if you accept.{" "}
          <Link href="/cookies" className="font-medium text-[#2563EB] underline-offset-2 hover:underline">
            Cookie Policy
          </Link>
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleReject}
            className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#64748B] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A] sm:text-sm sm:px-4 sm:py-2"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="rounded-lg bg-[#1E3A8A] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#2563EB] sm:text-sm sm:px-4 sm:py-2"
          >
            Accept analytics
          </button>
        </div>
      </div>
    </div>
  );
}
