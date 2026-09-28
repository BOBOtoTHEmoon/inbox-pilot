'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { Inbox, Zap, BarChart3, Settings, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const navItems = [
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/automations', label: 'Automations', icon: Zap },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function LogoMark({ className }: { className?: string }) {
  // A speech bubble with a small "sent" tick cut into it
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <path
        d="M9 11.5A3.5 3.5 0 0 1 12.5 8h7A3.5 3.5 0 0 1 23 11.5v5a3.5 3.5 0 0 1-3.5 3.5H15l-4.2 3.2c-.5.4-1.3 0-1.3-.6V20.6A3.5 3.5 0 0 1 9 17.5z"
        fill="#fff"
      />
      <path
        d="m12.8 14.2 2 2 4.4-4.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Only logged-in users can see the dashboard (customer DMs are private)
  useEffect(() => {
    // Demo mode (no Supabase configured locally): skip the login check
    if (!isSupabaseConfigured) {
      setCheckingAuth(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace('/login');
      } else {
        setCheckingAuth(false);
      }
    });
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  if (checkingAuth) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <LogoMark className="h-8 w-8 text-ink animate-pulse-dot" />
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-surface-raised">
      {/* Desktop: slim icon rail */}
      <aside className="hidden md:flex w-16 shrink-0 flex-col items-center border-r border-border bg-surface-raised py-3">
        <Link href="/inbox" aria-label="InboxPilot home" className="mb-5">
          <LogoMark className="h-8 w-8 text-ink" />
        </Link>

        <nav className="flex flex-1 flex-col items-center gap-1">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'group relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                  active
                    ? 'bg-surface text-ink shadow-[0_0_0_1px_var(--color-border)]'
                    : 'text-ink-muted hover:bg-surface-overlay hover:text-ink'
                )}
              >
                <item.icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.2 : 1.8} />
                <span className="pointer-events-none absolute left-12 z-50 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <button
          onClick={handleSignOut}
          title="Sign out"
          aria-label="Sign out"
          className="group relative flex h-10 w-10 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-overlay hover:text-ink transition-colors"
        >
          <LogOut className="h-[18px] w-[18px]" strokeWidth={1.8} />
          <span className="pointer-events-none absolute left-12 z-50 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
            Sign out
          </span>
        </button>
      </aside>

      {/* Page content. On phones, leave room for the bottom bar */}
      <main className="flex-1 overflow-hidden bg-surface pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </main>

      {/* Phones: bottom tab bar */}
      <nav className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="grid h-16 grid-cols-4">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  active ? 'text-ink' : 'text-ink-faint'
                )}
              >
                <item.icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.8} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}