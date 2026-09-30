'use client';

// Phones only: the places that don't fit in the tab bar
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, LogOut, Settings, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const LINKS = [
  { href: '/automations', label: 'Automations', text: 'Auto-replies and saved replies', icon: Zap },
  { href: '/settings', label: 'Settings', text: 'Instagram, business hours and your account', icon: Settings },
];

export default function MorePage() {
  const router = useRouter();
  return (
    <div className="h-full overflow-y-auto px-4 pb-tabbar pt-[calc(1rem+env(safe-area-inset-top))] md:px-6">
      <h1 className="text-[26px] font-bold tracking-[-0.02em] md:text-[17px] md:font-semibold">More</h1>
      <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-raised">
              <l.icon className="h-5 w-5 text-ink-muted" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium">{l.label}</span>
                <span className="block text-[13px] text-ink-muted">{l.text}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-ink-faint" />
            </Link>
          </li>
        ))}
      </ul>
      <button
        onClick={async () => {
          await supabase.auth.signOut();
          router.replace('/login');
        }}
        className="mt-4 flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3.5 text-left text-[15px] font-medium text-danger hover:bg-danger-light"
      >
        <LogOut className="h-5 w-5" />
        Sign out
      </button>
    </div>
  );
}