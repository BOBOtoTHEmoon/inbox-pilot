'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Search } from 'lucide-react';
import { ConversationList } from '@/components/inbox/ConversationList';
import { MessageThread } from '@/components/inbox/MessageThread';
import { ConversationHeader } from '@/components/inbox/ConversationHeader';
import { CustomerPanel } from '@/components/inbox/CustomerPanel';
import { EmptyInbox } from '@/components/inbox/EmptyInbox';
import { useConversations } from '@/hooks/useConversations';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getConversationLabel, matchesFilter, type InboxFilter } from '@/lib/labels';
import type { Conversation } from '@/types';
import { ChannelIcon, type Channel } from '@/components/ui/ChannelIcon';

type ChannelFilter = 'all' | Extract<Channel, 'instagram' | 'whatsapp' | 'email'>;

const CHANNELS: { key: ChannelFilter; label: string; soon?: boolean }[] = [
  { key: 'all', label: 'All channels' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'whatsapp', label: 'WhatsApp', soon: true },
  { key: 'email', label: 'Email', soon: true },
];

// TODO: Replace with actual business ID from auth context
const BUSINESS_ID = process.env.NEXT_PUBLIC_BUSINESS_ID || 'demo';

const FILTERS: { key: InboxFilter; label: string }[] = [
  { key: 'needs_reply', label: 'Needs reply' },
  { key: 'follow_up', label: 'Follow up' },
  { key: 'all_open', label: 'All' },
  { key: 'closed', label: 'Done' },
];

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

export default function InboxPage() {
  const [filter, setFilter] = useState<InboxFilter>('needs_reply');
    const [channel, setChannel] = useState<ChannelFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const searchRef = useRef<HTMLInputElement>(null);
  const lastSelected = useRef<Conversation | null>(null);

  const { conversations, loading, updateConversation } = useConversations({
    businessId: BUSINESS_ID,
    status: filter === 'closed' ? 'closed' : 'open',
  });

  // Labels and reply windows depend on the time, so refresh every minute
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

    // Ask the AI to tag conversations that have no label yet (for example, just imported).
  // Runs once per visit; new messages are tagged as they arrive.
  const labelled = useRef(false);
  useEffect(() => {
    if (!isSupabaseConfigured || loading || labelled.current) return;
    const needsLabel = conversations.some(
      (c) =>
        c.status !== 'closed' &&
        c.last_customer_message_at &&
        (!c.ai_labeled_at || new Date(c.ai_labeled_at) < new Date(c.last_customer_message_at))
    );
    if (!needsLabel) return;
    labelled.current = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      fetch('/api/ai/label', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.session?.access_token || ''}`,
        },
        body: JSON.stringify({ businessId: BUSINESS_ID }),
      }).catch(() => {});
    })();
  }, [conversations, loading]);

  // Which Instagram account this inbox belongs to
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase
      .from('businesses')
      .select('instagram_username')
      .eq('id', BUSINESS_ID)
      .maybeSingle()
      .then(({ data }) => setAccount(data?.instagram_username || null));
  }, []);

  const counts = useMemo(() => {
    const open = conversations.filter((c) => c.status !== 'closed');
    return {
      needs_reply: open.filter((c) => getConversationLabel(c, now)?.key === 'needs_reply').length,
      follow_up: open.filter((c) => getConversationLabel(c, now)?.key === 'follow_up').length,
    };
  }, [conversations, now]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations
      .filter((c) => matchesFilter(c, filter, now))
      .filter(
        (c) =>
          !q ||
          [c.customer_name, c.customer_username, c.last_message_preview, c.customer_email]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q))
      );
  }, [conversations, filter, now, search]);

  // Keep showing the open conversation even if it just left the current tab
  const selected =
    conversations.find((c) => c.id === selectedId) ||
    (lastSelected.current?.id === selectedId ? lastSelected.current : null);
  if (selected) lastSelected.current = selected;

  const select = (conv: Conversation | null) => {
    setSelectedId(conv?.id || null);
    if (conv && !conv.is_read) updateConversation(conv.id, { is_read: true });
  };

  // Mark done, then move straight to the next conversation in the list
  const markDone = (conv: Conversation) => {
    const index = visible.findIndex((c) => c.id === conv.id);
    const next = visible[index + 1] || visible[index - 1] || null;
    updateConversation(conv.id, { status: 'closed' });
    const onDesktop = window.matchMedia('(min-width: 768px)').matches;
    select(onDesktop ? next : null);
  };

  // Keyboard shortcuts on desktop: J/K to move, E to mark done, / to search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) {
        if (e.key === 'Escape' && isTyping(e.target)) (e.target as HTMLElement).blur();
        return;
      }
      const index = visible.findIndex((c) => c.id === selectedId);
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        select(visible[Math.min(visible.length - 1, index + 1)] || null);
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        select(visible[Math.max(0, index - 1)] || null);
      } else if (e.key === 'e' && selected && selected.status !== 'closed') {
        e.preventDefault();
        markDone(selected);
      } else if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'Escape') {
        setDetailsOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="flex h-full">
      {/* Conversation list */}
      <section
        className={clsx(
          'w-full flex-col border-r border-border bg-surface md:flex md:w-[340px] lg:w-[360px] md:shrink-0',
          selected ? 'hidden' : 'flex'
        )}
        aria-label="Inbox"
      >
        <div className="px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-3 md:pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="text-[17px] font-semibold tracking-[-0.01em]">Inbox</h1>
            {account && <span className="truncate text-xs text-ink-muted">@{account}</span>}
          </div>

          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people and messages"
              aria-label="Search conversations"
              className="h-9 w-full rounded-lg bg-surface-raised pl-8 pr-3 text-base md:text-[13px] outline-none focus-visible:outline-none ring-1 ring-transparent placeholder:text-ink-faint focus:bg-surface focus:ring-border-strong"
            />
          </div>

          <div className="mt-3 flex gap-1 overflow-x-auto" role="tablist" aria-label="Filter conversations">
            {FILTERS.map((f) => {
              const count = f.key === 'needs_reply' || f.key === 'follow_up' ? counts[f.key] : null;
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(f.key)}
                  className={clsx(
                    'flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                    active ? 'bg-ink text-white' : 'text-ink-muted hover:bg-surface-overlay hover:text-ink'
                  )}
                >
                  {f.label}
                  {count !== null && count > 0 && (
                    <span
                      className={clsx(
                        'min-w-[1.25rem] rounded-full px-1.5 text-center text-[11px] tabular-nums',
                        active
                          ? 'bg-white/20 text-white'
                          : f.key === 'needs_reply'
                          ? 'bg-danger-light text-danger'
                          : 'bg-warning-light text-warning'
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          
          <div className="mt-2 flex gap-1.5 overflow-x-auto" aria-label="Filter by channel">
            {CHANNELS.map((c) => (
              <button
                key={c.key}
                onClick={() => setChannel(c.key)}
                aria-pressed={channel === c.key}
                className={clsx(
                  'flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  channel === c.key ? 'border-surface-overlay bg-surface-overlay text-ink' : 'border-border text-ink-light hover:bg-surface-raised'
                )}
              >
                {c.key !== 'all' && <ChannelIcon channel={c.key} />}
                {c.label}
                {c.soon && <span className="text-[10px] text-ink-muted">Soon</span>}
              </button>
            ))}
          </div>
        </div>

                {CHANNELS.find((c) => c.key === channel)?.soon ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 pb-24 text-center">
            <ChannelIcon channel={channel as Channel} className="h-6 w-6" />
            <p className="mt-3 text-sm font-medium">
              {channel === 'whatsapp' ? 'WhatsApp is coming soon' : 'Email is coming soon'}
            </p>
            <p className="mt-1 max-w-[17rem] text-[13px] leading-relaxed text-ink-muted">
              {channel === 'whatsapp'
                ? 'WhatsApp chats will sit here next to Instagram, sorted the same way.'
                : 'Customer emails will sit here too, so you can follow up after Instagram’s 24 hours.'}
            </p>
          </div>
        ) : (
          <ConversationList
            conversations={visible}
            filter={filter}
            loading={loading}
            selectedId={selectedId}
            now={now}
            searching={!!search.trim()}
            onSelect={select}
          />
        )}
      </section>

      {/* Open conversation. Full screen on phones, covering the tab bar */}
      <section
        className={clsx(
          'min-w-0 flex-1 flex-col bg-surface',
          selected ? 'fixed inset-0 z-40 flex md:static md:z-auto' : 'hidden md:flex'
        )}
        aria-label="Conversation"
      >
        {selected ? (
          <>
            <ConversationHeader
              conversation={selected}
              detailsOpen={detailsOpen}
              onBack={() => select(null)}
              onToggleDetails={() => setDetailsOpen((v) => !v)}
              onDone={() => markDone(selected)}
              onReopen={() => updateConversation(selected.id, { status: 'open' })}
            />
            <MessageThread conversation={selected} businessId={BUSINESS_ID} now={now} />
          </>
        ) : (
          <EmptyInbox waiting={counts.needs_reply} />
        )}
      </section>

      {/* Customer details: always visible on wide screens, a slide-over otherwise */}
      {selected && (
        <CustomerPanel
          conversation={selected}
          now={now}
          onUpdate={(fields) => updateConversation(selected.id, fields)}
          className="hidden xl:flex"
        />
      )}
      {selected && detailsOpen && (
        <div className="xl:hidden fixed inset-0 z-50 flex justify-end">
          <button
            aria-label="Close details"
            onClick={() => setDetailsOpen(false)}
            className="absolute inset-0 bg-ink/20"
          />
          <CustomerPanel
            conversation={selected}
            now={now}
            onUpdate={(fields) => updateConversation(selected.id, fields)}
            onClose={() => setDetailsOpen(false)}
            className="relative flex h-full w-full max-w-[360px] animate-panel-in shadow-[-8px_0_24px_rgba(22,22,26,0.08)]"
          />
        </div>
      )}
    </div>
  );
}