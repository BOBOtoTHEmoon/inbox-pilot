'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { Inbox, Zap, BarChart3, Settings, LogOut, Users, Store, MoreHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { LogoMark } from '@/components/ui/LogoMark';
const BUSINESS_ID = process.env.NEXT_PUBLIC_BUSINESS_ID || 'demo';

// Desktop sidebar
const navItems = [
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/sales', label: 'Sales', icon: Store },
  { href: '/automations', label: 'Automations', icon: Zap },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

// Phone tab bar: five places, the rest live under More
const phoneItems = [
  { href: '/inbox', label: 'Inbox', icon: Inbox, match: ['/inbox'] },
  { href: '/customers', label: 'Customers', icon: Users, match: ['/customers'] },
  { href: '/sales', label: 'Sales', icon: Store, match: ['/sales'] },
  { href: '/analytics', label: 'Insights', icon: BarChart3, match: ['/analytics'] },
  { href: '/more', label: 'More', icon: MoreHorizontal, match: ['/more', '/automations', '/settings'] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [waiting, setWaiting] = useState(0);

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

  // How many people are waiting for a reply, shown as a badge on Inbox
  useEffect(() => {
    if (!isSupabaseConfigured || checkingAuth) return;
    const load = () =>
      supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', BUSINESS_ID)
        .eq('status', 'open')
        .eq('last_sender_type', 'customer')
        .then(({ count }) => setWaiting(count || 0));
    load();
    const timer = setInterval(load, 60 * 1000);
    return () => clearInterval(timer);
  }, [checkingAuth, pathname]);

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
                {item.href === '/inbox' && waiting > 0 && (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-surface-raised" />
                )}
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

      {/* Page content. On phones it runs under the floating tab bar */}
      <main className="flex-1 overflow-hidden bg-surface">
        {children}
      </main>

      {/* Phones: floating glass tab bar */}
      <nav
        aria-label="Main"
        className="md:hidden pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
      >
        <div className="pointer-events-auto grid w-full max-w-md grid-cols-5 gap-0.5 rounded-full border border-white/70 bg-[rgba(239,239,241,0.62)] p-1.5 ring-1 ring-ink/[0.06] shadow-[0_10px_40px_rgba(22,22,26,0.16),0_2px_6px_rgba(22,22,26,0.06),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-2xl backdrop-saturate-[1.8]">
                      {phoneItems.map((item) => {
              const active = item.match.some((m) => pathname.startsWith(m));
            const badge = item.href === '/inbox' && waiting > 0 ? waiting : null;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'relative flex flex-col items-center justify-center gap-0.5 rounded-full py-2 text-[10px] font-medium transition-colors',
                  active
                    ? 'bg-white text-ink shadow-[0_1px_4px_rgba(22,22,26,0.10)]'
                    : 'text-ink-muted active:bg-white/60'
                )}
              >
                <span className="relative">
                  <item.icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.2 : 1.8} />
                  {badge !== null && (
                    <span className="absolute -right-3 -top-1.5 min-w-[18px] rounded-full bg-danger px-1 text-center text-[10px] font-semibold leading-[18px] text-white tabular-nums ring-2 ring-white/80">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}