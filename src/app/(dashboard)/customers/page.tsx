'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { ArrowLeft, Bell, Search, MessageCircle, Sparkles } from 'lucide-react';
import { Avatar } from '@/components/inbox/Avatar';
import { ChannelIcon, CHANNEL_NAMES } from '@/components/ui/ChannelIcon';
import { PreviewBanner } from '@/components/ui/PreviewBanner';
import { SAMPLE_CUSTOMERS, naira, totalSpent, type SampleCustomer, type SampleOrder } from '@/lib/sample-data';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { authHeaders } from '@/hooks/useCatalog';
import { displayPhone } from '@/lib/phone';
import { shortTime } from '@/lib/time';
import { AI_LABELS } from '@/lib/labels';

const BUSINESS_ID = process.env.NEXT_PUBLIC_BUSINESS_ID || 'demo';

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

function CustomersPreview() {
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

// ============================================
// REAL CUSTOMERS
// ============================================

interface LiveSale {
  id: string;
  sale_number: number;
  total: number;
  status: 'completed' | 'voided';
  created_at: string;
  items: { title: string; variant_label: string | null; quantity: number }[];
}

interface LiveConversation {
  id: string;
  last_message_at: string;
  last_message_preview: string | null;
  ai_label: keyof typeof AI_LABELS | null;
  ai_summary: string | null;
  status: string;
}

interface LiveCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  instagram_username: string | null;
  profile_pic: string | null;
  created_at: string;
  sales: LiveSale[];
  conversations: LiveConversation[];
  // worked out on the page
  spent: number;
  orders: number;
  lastActive: string;
}

function LiveProfile({ customer, onBack }: { customer: LiveCustomer; onBack?: () => void }) {
  const router = useRouter();
  const latestChat = [...customer.conversations].sort((a, b) => b.last_message_at.localeCompare(a.last_message_at))[0];
  const ai = latestChat?.ai_label && latestChat.ai_summary ? AI_LABELS[latestChat.ai_label] : null;
  const since = new Date(customer.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const channels = [
    customer.phone && {
      channel: 'whatsapp' as const,
      label: 'WhatsApp',
      value: displayPhone(customer.phone),
      href: `https://wa.me/${customer.phone.replace(/\D/g, '')}`,
    },
    customer.instagram_username && {
      channel: 'instagram' as const,
      label: 'Instagram',
      value: `@${customer.instagram_username}`,
      href: `https://instagram.com/${customer.instagram_username}`,
    },
    customer.email && { channel: 'email' as const, label: 'Email', value: customer.email, href: `mailto:${customer.email}` },
  ].filter(Boolean) as { channel: 'whatsapp' | 'instagram' | 'email'; label: string; value: string; href: string }[];

  const openChat = () => {
    if (!latestChat) return;
    try {
      localStorage.setItem('inboxpilot.openConversation', latestChat.id);
    } catch {}
    router.push('/inbox');
  };

  const sales = [...customer.sales].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="mx-auto max-w-2xl px-5 pb-tabbar pt-[calc(1rem+env(safe-area-inset-top))] md:pt-8">
      {onBack && (
        <button onClick={onBack} aria-label="Back to customers" className="-ml-2 mb-2 flex h-11 w-11 items-center justify-center rounded-lg text-ink-light hover:bg-surface-overlay md:hidden">
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}

      <div className="flex flex-col items-center text-center">
        <Avatar src={customer.profile_pic} name={customer.name} size={72} />
        <h2 className="mt-3 text-xl font-bold tracking-[-0.01em]">{customer.name}</h2>
        <p className="mt-0.5 text-[13px] text-ink-muted">Customer since {since}</p>
        {latestChat && (
          <button onClick={openChat} className="mt-3 flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-2 text-[13px] font-medium text-white hover:bg-accent-hover">
            <MessageCircle className="h-4 w-4" />
            Open chat
          </button>
        )}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-border bg-border text-center">
        {[
          { label: 'Spent', value: naira(customer.spent) },
          { label: 'Orders', value: String(customer.orders) },
          { label: 'Chats', value: String(customer.conversations.length) },
        ].map((s) => (
          <div key={s.label} className="bg-surface px-2 py-3">
            <p className="text-[17px] font-bold tabular-nums">{s.value}</p>
            <p className="text-xs text-ink-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {ai && latestChat?.ai_summary && (
        <div className={clsx('mt-5 flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed', ai.strip)}>
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <span className="font-semibold">{ai.text}.</span> {latestChat.ai_summary}
          </p>
        </div>
      )}

      <section className="mt-7">
        <h3 className="text-[13px] font-semibold">Reach them on</h3>
        {channels.length === 0 ? (
          <p className="mt-2 text-[13px] text-ink-muted">No contact details yet.</p>
        ) : (
          <ul className="mt-1">
            {channels.map((c) => (
              <li key={c.channel}>
                <a href={c.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 border-b border-border py-3 hover:bg-surface-raised">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-raised">
                    <ChannelIcon channel={c.channel} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{c.label}</span>
                    <span className="block truncate text-xs text-ink-muted">{c.value}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-7">
        <h3 className="text-[13px] font-semibold">Purchases</h3>
        {sales.length === 0 ? (
          <p className="mt-2 text-[13px] text-ink-muted">
            No purchases yet. Shop sales appear here when their phone number is used at the till.
          </p>
        ) : (
          <ul className="mt-1">
            {sales.map((o) => {
              const voided = o.status === 'voided';
              const summary = o.items.map((i) => `${i.quantity > 1 ? `${i.quantity} x ` : ''}${i.title}`).join(', ');
              return (
                <li key={o.id} className="flex gap-3 border-b border-border py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-raised">
                    <ChannelIcon channel="store" className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="truncate font-medium">{summary || 'Sale'}</span>
                      <span className={clsx('font-semibold tabular-nums', voided && 'text-ink-muted line-through')}>{naira(Number(o.total))}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3 text-xs text-ink-muted">
                      <span>
                        #{o.sale_number}, in store, {new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <span className={clsx('rounded-full px-2 py-0.5 text-[11px] font-semibold', voided ? 'bg-danger-light text-danger' : 'bg-success-light text-success')}>
                        {voided ? 'Voided' : 'Paid'}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function LiveCustomers() {
  const [customers, setCustomers] = useState<LiveCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phoneOpen, setPhoneOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('customers')
      .select(
        'id, name, phone, email, instagram_username, profile_pic, created_at, sales(id, sale_number, total, status, created_at, items:sale_items(title, variant_label, quantity)), conversations(id, last_message_at, last_message_preview, ai_label, ai_summary, status)'
      )
      .eq('business_id', BUSINESS_ID)
      .limit(1000);
    const list = ((data || []) as any[]).map((c) => {
      const sales = (c.sales || []) as LiveSale[];
      const conversations = (c.conversations || []) as LiveConversation[];
      const completed = sales.filter((s) => s.status === 'completed');
      const times = [c.created_at, ...sales.map((s) => s.created_at), ...conversations.map((v) => v.last_message_at)];
      return {
        ...c,
        sales,
        conversations,
        spent: completed.reduce((sum, s) => sum + Number(s.total), 0),
        orders: completed.length,
        lastActive: times.sort().pop(),
      } as LiveCustomer;
    });
    list.sort((a, b) => b.lastActive.localeCompare(a.lastActive));
    setCustomers(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      await load();
      // Make sure every Instagram conversation has a profile, then refresh
      const res = await fetch('/api/customers/link', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ businessId: BUSINESS_ID }),
      }).catch(() => null);
      const json = res ? await res.json().catch(() => ({})) : {};
      if (json.linked > 0) load();
    })();
    try {
      const wanted = localStorage.getItem('inboxpilot.openCustomer');
      if (wanted) {
        setSelectedId(wanted);
        setPhoneOpen(true);
        localStorage.removeItem('inboxpilot.openCustomer');
      }
    } catch {}
  }, [load]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter(
      (c) => !q || [c.name, c.instagram_username, c.email, c.phone].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
    );
  }, [customers, search]);

  const selected = customers.find((c) => c.id === selectedId) || (phoneOpen ? null : list[0]) || null;

  return (
    <div className="flex h-full">
      <section className={clsx('w-full flex-col border-r border-border md:flex md:w-[360px] md:shrink-0', phoneOpen && selected ? 'hidden' : 'flex')} aria-label="Customers">
        <div className="px-4 pb-3 pt-[calc(1rem+env(safe-area-inset-top))] md:pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="text-[17px] font-semibold tracking-[-0.01em]">Customers</h1>
            <span className="text-xs text-ink-muted">{customers.length}</span>
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
        </div>

        {loading ? (
          <div className="mx-4 h-32 rounded-xl bg-surface-raised" />
        ) : list.length === 0 ? (
          <p className="px-8 py-16 text-center text-[13px] text-ink-muted">
            {customers.length ? 'No customers match.' : 'Customers appear here from Instagram DMs and shop sales.'}
          </p>
        ) : (
          <ul className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-tabbar">
            {list.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => {
                    setSelectedId(c.id);
                    setPhoneOpen(true);
                  }}
                  className={clsx('flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors', selected?.id === c.id ? 'md:bg-surface-overlay' : 'hover:bg-surface-raised')}
                >
                  <Avatar src={c.profile_pic} name={c.name} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">{c.name}</span>
                      <span className="shrink-0 text-xs text-ink-muted">{shortTime(c.lastActive)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5">
                        {c.phone && <ChannelIcon channel="whatsapp" />}
                        {c.instagram_username && <ChannelIcon channel="instagram" />}
                        {c.email && <ChannelIcon channel="email" />}
                        {c.orders > 0 && <ChannelIcon channel="store" />}
                      </span>
                      <span className="text-xs tabular-nums text-ink-muted">{c.orders ? `${naira(c.spent)} spent` : 'No purchases yet'}</span>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={clsx('flex-1 overflow-y-auto scrollbar-thin', phoneOpen && selected ? 'block' : 'hidden md:block')} aria-label="Customer profile">
        {selected ? (
          <LiveProfile customer={selected} onBack={() => setPhoneOpen(false)} />
        ) : (
          !loading && <p className="px-8 py-24 text-center text-[13px] text-ink-muted">Pick a customer to see their profile.</p>
        )}
      </section>
    </div>
  );
}

export default function CustomersPage() {
  return isSupabaseConfigured ? <LiveCustomers /> : <CustomersPreview />;
}