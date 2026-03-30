'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import type { User } from '@supabase/supabase-js';
import { isGa4AllowedPath, trackEvent } from '@/lib/ga4';
import { fetchSessionRoleFromApi } from '@/lib/client-profile-role';
import { ADMIN_HOME_PATH } from '@/lib/internal-operator';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  const isMarketing =
    pathname === '/' ||
    pathname === '/marketing' ||
    pathname?.startsWith('/marketing#') ||
    pathname?.startsWith('/#');
  const isApp = !isMarketing && pathname !== '/login';

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error?.message?.includes('Refresh Token') || error?.message?.includes('refresh_token')) {
        supabase.auth.signOut().then(() => setUser(null));
        return;
      }
      setUser(session?.user ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    void fetchSessionRoleFromApi().then((r) => {
      if (!cancelled) setIsAdmin(!!r?.isAdmin);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setMobileOpen(false);
    router.push('/login');
  }

  const navItems = isMarketing
    ? [
        { href: '/marketing#how-it-works', label: 'How it works' },
        { href: '/marketing#calculator', label: 'Revenue check' },
        { href: '/marketing#proof', label: 'Proof' },
      ]
    : isAdmin
      ? [
          { href: ADMIN_HOME_PATH, label: 'Overview' },
          { href: '/admin', label: 'Admin' },
          { href: '/admin/customers', label: 'Customers' },
        ]
      : [
          { href: '/dashboard', label: 'Dashboard' },
          { href: '/inbox', label: 'Inbox' },
          { href: '/recoveries', label: 'Recoveries' },
          { href: '/settings', label: 'Settings' },
        ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 border-b border-[#E5E7EB] bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href={isApp && isAdmin ? ADMIN_HOME_PATH : '/'}
            className="flex items-center gap-2"
            aria-label="AutoRevenue OS home"
          >
            <img
              src="/brand/autorevenueos-logo-blue.svg"
              alt="AutoRevenue OS"
              className="h-8 w-auto sm:h-9"
            />
          </Link>
          <nav className="flex items-center gap-1">
            {/* Desktop nav */}
            <div className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname?.startsWith(`${item.href}/`) ||
                  (isMarketing && item.href.startsWith('/marketing#') && pathname === '/marketing');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-[#EFF6FF] text-[#1E3A8A]'
                        : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
              {isApp && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="ml-2 hidden rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-medium text-[#64748B] shadow-sm transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A] sm:inline-flex"
                >
                  Log out
                </button>
              )}
              {isMarketing && user ? (
                <>
                  <Link
                    href={isAdmin ? ADMIN_HOME_PATH : '/dashboard'}
                    className="ml-2 hidden rounded-lg px-3 py-2 text-sm font-medium text-[#64748B] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A] sm:inline-flex"
                  >
                    {isAdmin ? 'Overview' : 'Dashboard'}
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="ml-2 hidden rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-medium text-[#64748B] shadow-sm transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A] sm:inline-flex"
                  >
                    Log out
                  </button>
                </>
              ) : null}
              {isMarketing && !user ? (
                <>
                  <Link
                    href="/login"
                    className="ml-2 hidden rounded-lg px-3 py-2 text-sm font-medium text-[#64748B] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A] sm:inline-flex"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/login?mode=signup"
                    onClick={() => isGa4AllowedPath(pathname) && trackEvent('signup_started')}
                    className="ml-2 hidden items-center justify-center rounded-lg bg-[#1E3A8A] px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#2563EB] hover:shadow-md sm:inline-flex"
                  >
                    Get started
                  </Link>
                </>
              ) : null}
              {isApp ? (
                <Link
                  href="/marketing"
                  className="ml-2 hidden rounded-lg px-3 py-2 text-sm font-medium text-[#64748B] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A] sm:inline-flex"
                >
                  View website
                </Link>
              ) : null}
            </div>

            {/* Mobile toggle */}
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#0F172A] shadow-sm transition-colors hover:bg-[#F9FAFB] md:hidden"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            >
              <span className="sr-only">Toggle navigation</span>
              <span className="flex flex-col gap-1.5">
                <span className={`h-0.5 w-4 rounded-full bg-current transition ${mobileOpen ? 'translate-y-1 rotate-45' : ''}`} />
                <span className={`h-0.5 w-4 rounded-full bg-current transition ${mobileOpen ? 'opacity-0' : ''}`} />
                <span className={`h-0.5 w-4 rounded-full bg-current transition ${mobileOpen ? '-translate-y-1 -rotate-45' : ''}`} />
              </span>
            </button>
          </nav>
        </div>
      </header>

      {/* Mobile menu: fixed below header + safe area so it is never clipped */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[100] md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/25"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div
            className="absolute left-0 right-0 mx-4 flex max-h-[min(85vh,calc(100dvh-env(safe-area-inset-top)-3.5rem-env(safe-area-inset-bottom)))] flex-col overflow-hidden rounded-b-2xl border border-[#E5E7EB] bg-white shadow-xl"
            style={{
              top: 'calc(env(safe-area-inset-top, 0px) + 3.5rem)',
            }}
          >
            <div className="max-h-[inherit] overflow-y-auto overscroll-contain px-4 py-3 sm:px-6">
              <div className="flex flex-col gap-1 pb-[env(safe-area-inset-bottom,0px)]">
                {navItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname?.startsWith(`${item.href}/`) ||
                    (isMarketing && item.href.startsWith('/marketing#') && pathname === '/marketing');
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-[#EFF6FF] text-[#1E3A8A]'
                          : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
                {isApp && (
                  <button
                    type="button"
                    onClick={() => {
                      handleLogout();
                    }}
                    className="mt-1 inline-flex w-full items-center justify-center rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-medium text-[#64748B]"
                  >
                    Log out
                  </button>
                )}
                {isMarketing && user ? (
                  <>
                    <Link
                      href={isAdmin ? ADMIN_HOME_PATH : '/dashboard'}
                      onClick={() => setMobileOpen(false)}
                      className="mt-1 inline-flex w-full items-center justify-center rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-medium text-[#64748B]"
                    >
                      {isAdmin ? 'Overview' : 'Dashboard'}
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleLogout()}
                      className="mt-1 inline-flex w-full items-center justify-center rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-medium text-[#64748B]"
                    >
                      Log out
                    </button>
                  </>
                ) : null}
                {isMarketing && !user ? (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setMobileOpen(false)}
                      className="mt-1 inline-flex w-full items-center justify-center rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-medium text-[#64748B]"
                    >
                      Log in
                    </Link>
                    <Link
                      href="/login?mode=signup"
                      onClick={() => {
                        if (isGa4AllowedPath(pathname)) trackEvent('signup_started');
                        setMobileOpen(false);
                      }}
                      className="mt-1 inline-flex items-center justify-center rounded-lg bg-[#1E3A8A] px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#2563EB] hover:shadow-md"
                    >
                      Get started
                    </Link>
                  </>
                ) : null}
                {isApp ? (
                  <Link
                    href="/marketing"
                    onClick={() => setMobileOpen(false)}
                    className="mt-1 inline-flex items-center justify-center rounded-lg bg-[#1E3A8A] px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#2563EB] hover:shadow-md"
                  >
                    View website
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
      <main className="flex-1">{children}</main>
      {isApp && (
        <>
          {/* Floating support button */}
          <button
            type="button"
            onClick={() => setSupportOpen(true)}
            className="fixed bottom-6 right-4 z-30 inline-flex items-center gap-2 rounded-full bg-[#1E3A8A] px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-slate-900/20 hover:bg-[#2563EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1E3A8A] sm:text-sm sm:right-6"
            aria-haspopup="dialog"
            aria-expanded={supportOpen}
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold">
              ?
            </span>
            <span>Need help?</span>
          </button>

          {/* Support panel */}
          {supportOpen && (
            <div
              className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 px-4 pb-6 pt-12 sm:items-center sm:p-6"
              role="dialog"
              aria-modal="true"
              aria-label="AutoRevenueOS support"
              onClick={() => setSupportOpen(false)}
            >
              <div
                className="w-full max-w-md rounded-2xl border border-[#E5E7EB] bg-white shadow-2xl shadow-slate-900/30"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 border-b border-[#E5E7EB] px-4 py-3 sm:px-5">
                  <div>
                    <h2 className="text-sm font-semibold text-[#0F172A]">Need help?</h2>
                    <p className="mt-1 text-xs text-[#64748B]">
                      If you need help setting up AutoRevenueOS or have a question about billing, integrations, or missed call recovery, contact us.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSupportOpen(false)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#6B7280] hover:bg-[#F3F4F6]"
                    aria-label="Close support panel"
                  >
                    <span className="sr-only">Close</span>
                    ×
                  </button>
                </div>
                <div className="space-y-3 px-4 py-4 text-sm text-[#0F172A] sm:px-5">
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Contact options</p>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-[#0F172A]">Customer support</p>
                          <a href="mailto:support@autorevenueos.com" className="text-xs text-[#2563EB] underline-offset-2 hover:underline">
                            support@autorevenueos.com
                          </a>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText('support@autorevenueos.com')}
                          className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#475569] hover:bg-[#F8FAFC]"
                        >
                          Copy email
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-[#0F172A]">General enquiries</p>
                          <a href="mailto:hello@autorevenueos.com" className="text-xs text-[#2563EB] underline-offset-2 hover:underline">
                            hello@autorevenueos.com
                          </a>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText('hello@autorevenueos.com')}
                          className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#475569] hover:bg-[#F8FAFC]"
                        >
                          Copy email
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-[#0F172A]">Phone</p>
                          <a href="tel:01315070138" className="text-xs text-[#2563EB] underline-offset-2 hover:underline">
                            0131 507 0138
                          </a>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText('0131 507 0138')}
                          className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#475569] hover:bg-[#F8FAFC]"
                        >
                          Copy number
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Quick links</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Link href="/privacy" className="rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-1 text-[#374151] hover:bg-[#EFF6FF]">
                        Privacy Policy
                      </Link>
                      <Link href="/terms" className="rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-1 text-[#374151] hover:bg-[#EFF6FF]">
                        Terms of Service
                      </Link>
                      <Link href="/cookies" className="rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-1 text-[#374151] hover:bg-[#EFF6FF]">
                        Cookie Policy
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      <footer className="border-t border-[#E5E7EB] bg-white py-4">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-4 text-xs text-[#6B7280] sm:flex-row sm:items-center sm:px-6 sm:text-sm">
          <span>© 2026 AutoRevenue Systems Ltd. AutoRevenueOS™. All rights reserved.</span>
          <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-3">
            {isMarketing && (
              <span className="text-[11px] text-[#4B5563]">
                General enquiries:{' '}
                <a href="mailto:hello@autorevenueos.com" className="font-medium underline-offset-2 hover:underline">
                  hello@autorevenueos.com
                </a>{' '}
                · Phone:{' '}
                <a href="tel:01315070138" className="font-medium underline-offset-2 hover:underline">
                  0131 507 0138
                </a>
              </span>
            )}
            <span className="text-[11px] text-[#9CA3AF]">
              We use essential cookies for login and local storage for the website chat. See our{' '}
              <a href="/cookies" className="font-medium text-[#4B5563] underline-offset-2 hover:text-[#111827] hover:underline">
                Cookie Policy
              </a>.
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="/cookies"
                className="text-[11px] font-medium text-[#4B5563] underline-offset-2 hover:text-[#111827] hover:underline"
              >
                Cookie Policy
              </a>
              <a
                href="/privacy"
                className="text-[11px] font-medium text-[#4B5563] underline-offset-2 hover:text-[#111827] hover:underline"
              >
                Privacy Policy
              </a>
              <a
                href="/terms"
                className="text-[11px] font-medium text-[#4B5563] underline-offset-2 hover:text-[#111827] hover:underline"
              >
                Terms of Service
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
