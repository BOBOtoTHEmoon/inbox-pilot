'use client';

// ============================================
// CUSTOMERS PREVIEW
// One profile per person, joining their Instagram, WhatsApp and email with
// every order: from DMs, the website and the shop. Sample data for now.
// ============================================

import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { ArrowLeft, Bell, Search } from 'lucide-react';
import { Avatar } from '@/components/inbox/Avatar';
import { ChannelIcon, CHANNEL_NAMES } from '@/components/ui/ChannelIcon';
import { PreviewBanner } from '@/components/ui/PreviewBanner';
import { SAMPLE_CUSTOMERS, naira, totalSpent, type SampleCustomer, type SampleOrder } from '@/lib/sample-data';

const STATUS_STYLE: Record<SampleOrder['status'], string> = {
  'Awaiting payment': 'bg-warning-light text-warning',
  Paid: 'bg-success-light text-success',
  Delivered: 'bg-surface-overlay text-ink-light',
};

function Profile({ customer, onBack }: { customer: SampleCustomer; onBack?: () => void }) {
  const channels = [
    customer.whatsapp && { channel: 'whatsapp' as const, value: customer.whatsapp, href: `https://wa.me/${customer.whatsapp.replace(/\D/g, '')}` },
    customer.instagram && { channel: 'instagram' as const, value: `@${customer.instagram}`, href: `https://instagram.com/${customer.instagram}` },
    customer.email && { channel: 'email' as const, value: customer.email, href: `mailto:${customer.email}` },
  ].filter(Boolean) as { channel: 'whatsapp' | 'instagram' | 'email'; value: string; href: string }[];

  return (
    <div className="mx-auto max-w-2xl px-5 pb-tabbar pt-[calc(1rem+env(safe-area-inset-top))] md:pt-8">
      {onBack && (
        <button onClick={onBack} aria-label="Back to customers" className="-ml-2 mb-2 flex h-11 w-11 items-center justify-center rounded-lg text-ink-light hover:bg-surface-overlay md:hidden">
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}

      <div className="flex flex-col items-center text-center">
        <Avatar name={customer.name} size={72} />
        <h2 className="mt-3 text-xl font-bold tracking-[-0.01em]">{customer.name}</h2>
        <p className="mt-0.5 text-[13px] text-ink-muted">Customer since {customer.since}, {customer.area}</p>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-border bg-border text-center">
        {[
          { label: 'Spent', value: naira(totalSpent(customer)) },
          { label: 'Orders', value: String(customer.orders.length) },
          { label: 'Channels', value: String(channels.length) },
        ].map((s) => (
          <div key={s.label} className="bg-surface px-2 py-3">
            <p className="text-[17px] font-bold tabular-nums">{s.value}</p>
            <p className="text-xs text-ink-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <section className="mt-7">
        <h3 className="text-[13px] font-semibold">Reach them on</h3>
        <ul className="mt-1">
          {channels.map((c) => (
            <li key={c.channel}>
              <a href={c.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 border-b border-border py-3 hover:bg-surface-raised">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-raised">
                  <ChannelIcon channel={c.channel} className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{CHANNEL_NAMES[c.channel]}</span>
                  <span className="block truncate text-xs text-ink-muted">{c.value}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-7">
        <h3 className="text-[13px] font-semibold">Orders, online and in store</h3>
        {customer.orders.length === 0 ? (
          <p className="mt-2 text-[13px] text-ink-muted">No orders yet.</p>
        ) : (
          <ul className="mt-1">
            {customer.orders.map((o) => (
              <li key={o.id} className="flex gap-3 border-b border-border py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-raised">
                  <ChannelIcon channel={o.source} className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{o.item}</span>
                    <span className="font-semibold tabular-nums">{naira(o.price)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3 text-xs text-ink-muted">
                    <span>{o.id}, {CHANNEL_NAMES[o.source]}, {o.date}</span>
                    <span className={clsx('rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_STYLE[o.status])}>{o.status}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {customer.waitingFor && (
        <section className="mt-7">
          <h3 className="text-[13px] font-semibold">Waiting for</h3>
          <div className="mt-2 flex items-start gap-3 rounded-xl border border-dashed border-border-strong px-3 py-3">
            <Bell className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />
            <div className="text-[13px]">
              <p className="font-medium">{customer.waitingFor}</p>
              <p className="text-ink-muted">They get a message automatically when it is back in stock.</p>
            </div>
          </div>
        </section>
      )}

      {customer.notes && (
        <section className="mt-7">
          <h3 className="text-[13px] font-semibold">Notes</h3>
          <p className="mt-2 rounded-xl bg-surface-raised px-3 py-3 text-[13px] leading-relaxed text-ink-light">{customer.notes}</p>
        </section>
      )}
    </div>
  );
}

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [desktopId, setDesktopId] = useState(SAMPLE_CUSTOMERS[0].id);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return SAMPLE_CUSTOMERS.filter(
      (c) => !q || [c.name, c.instagram, c.email, c.whatsapp].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
    );
  }, [search]);

  const openOnPhone = selectedId ? SAMPLE_CUSTOMERS.find((c) => c.id === selectedId) : null;
  const shownOnDesktop = SAMPLE_CUSTOMERS.find((c) => c.id === desktopId)!;

  return (
    <div className="flex h-full">
      <section className={clsx('w-full flex-col border-r border-border md:flex md:w-[360px] md:shrink-0', openOnPhone ? 'hidden' : 'flex')} aria-label="Customers">
        <div className="px-4 pb-3 pt-[calc(1rem+env(safe-area-inset-top))] md:pt-4">
          <div className="flex items-baseline gap-3">
            <h1 className="text-[17px] font-semibold tracking-[-0.01em]">Customers</h1>
            <span className="rounded-full bg-surface-overlay px-2 py-0.5 text-[11px] font-medium text-ink-muted">Preview</span>
          </div>
          <label className="relative mt-3 block">
            <span className="sr-only">Search customers</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, handle, phone or email"
              className="h-9 w-full rounded-lg bg-surface-raised pl-8 pr-3 text-base md:text-[13px] outline-none focus-visible:outline-none placeholder:text-ink-faint focus:bg-surface focus:ring-1 focus:ring-border-strong"
            />
          </label>
          <div className="mt-3">
            <PreviewBanner>Sample customers. Each real profile will join a person&apos;s Instagram, WhatsApp, email and every purchase.</PreviewBanner>
          </div>
        </div>

        <ul className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-tabbar">
          {list.map((c) => {
            const active = c.id === desktopId;
            return (
              <li key={c.id}>
                <button
                  onClick={() => {
                    setDesktopId(c.id);
                    setSelectedId(c.id);
                  }}
                  className={clsx('flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors', active ? 'md:bg-surface-overlay' : 'hover:bg-surface-raised')}
                >
                  <Avatar name={c.name} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">{c.name}</span>
                      <span className="shrink-0 text-xs text-ink-muted">{c.lastActive}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5">
                        {c.whatsapp && <ChannelIcon channel="whatsapp" />}
                        {c.instagram && <ChannelIcon channel="instagram" />}
                        {c.email && <ChannelIcon channel="email" />}
                      </span>
                      <span className="text-xs tabular-nums text-ink-muted">
                        {c.orders.length ? `${naira(totalSpent(c))} spent` : 'No orders yet'}
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Desktop: the selected profile beside the list */}
      <section className="hidden flex-1 overflow-y-auto scrollbar-thin md:block" aria-label="Customer profile">
        <Profile customer={shownOnDesktop} />
      </section>

      {/* Phones: the profile fills the screen */}
      {openOnPhone && (
        <section className="flex-1 overflow-y-auto scrollbar-thin md:hidden" aria-label="Customer profile">
          <Profile customer={openOnPhone} onBack={() => setSelectedId(null)} />
        </section>
      )}
    </div>
  );
}