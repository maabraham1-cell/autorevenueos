'use client';

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { hasConversionConsent } from "@/lib/consent";
import { isGa4AllowedPath, isGa4Configured, loadGa4, trackPageView } from "@/lib/ga4";

export function GA4Loader() {
  const pathname = usePathname();
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!isGa4Configured()) return;
    const allowed = isGa4AllowedPath(pathname);
    const consent = hasConversionConsent();

    if (allowed && consent) {
      if (!loadedRef.current) {
        loadGa4();
        loadedRef.current = true;
      }
      trackPageView(pathname ?? undefined);
    }
  }, [pathname]);

  return null;
}
