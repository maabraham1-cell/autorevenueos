'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabaseBrowser';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isMarketing = pathname === '/marketing' || pathname?.startsWith('/marketing#');
  const isApp = !isMarketing && pathname !== '/' && pathname !== '/login';

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
          <Link href="/" className="flex items-center gap-2" aria-label="AutoRevenueOS home">
            <img
              src="/brand/autorevenueos-logo-blue.svg"
              alt="AutoRevenueOS"
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
              {isMarketing ? (
                <>
                  <Link
                    href="/login"
                    className="ml-2 hidden rounded-lg px-3 py-2 text-sm font-medium text-[#64748B] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A] sm:inline-flex"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/login?mode=signup"
                    className="ml-2 hidden items-center justify-center rounded-lg bg-[#1E3A8A] px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#2563EB] hover:shadow-md sm:inline-flex"
                  >
                    Start free trial
                  </Link>
                </>
              ) : (
                <Link
                  href="/marketing"
                  className="ml-2 hidden items-center justify-center rounded-lg bg-[#1E3A8A] px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#2563EB] hover:shadow-md sm:inline-flex"
                >
                  Marketing
                </Link>
              )}
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

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="border-t border-[#E5E7EB] bg-white/95 shadow-md md:hidden">
            <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
              <div className="flex flex-col gap-1">
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
                {isMarketing ? (
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
                      onClick={() => setMobileOpen(false)}
                      className="mt-1 inline-flex items-center justify-center rounded-lg bg-[#1E3A8A] px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#2563EB] hover:shadow-md"
                    >
                      Start free trial
                    </Link>
                  </>
                ) : (
                  <Link
                    href="/marketing"
                    onClick={() => setMobileOpen(false)}
                    className="mt-1 inline-flex items-center justify-center rounded-lg bg-[#1E3A8A] px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#2563EB] hover:shadow-md"
                  >
                    Go to marketing site
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-[#E5E7EB] bg-white py-4">
        <div className="mx-auto flex max-w-6xl justify-between px-4 text-xs text-[#6B7280] sm:px-6 sm:text-sm">
          <span>© 2026 AutoRevenue Systems Ltd. AutoRevenueOS™. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
