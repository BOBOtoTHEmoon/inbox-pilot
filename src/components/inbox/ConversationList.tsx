'use client';

import { clsx } from 'clsx';
import type { Conversation } from '@/types';
import { getConversationLabel, getReplyWindow, type InboxFilter } from '@/lib/labels';
import { shortTime, quietFor } from '@/lib/time';
import { Avatar } from './Avatar';

interface ConversationListProps {
  conversations: Conversation[];
  filter: InboxFilter;
  loading: boolean;
  selectedId: string | null;
  now: number;
  searching: boolean;
  onSelect: (conversation: Conversation) => void;
}

const EMPTY: Record<InboxFilter, { title: string; body: string }> = {
  needs_reply: {
    title: 'Nobody is waiting on you',
    body: 'When a customer messages, they will show up here until someone replies.',
  },
  follow_up: {
    title: 'No one to chase',
    body: 'People who go quiet for a day after your reply will show up here.',
  },
  all_open: {
    title: 'No open conversations',
    body: 'New Instagram DMs will appear here as they arrive.',
  },
  closed: {
    title: 'Nothing marked done yet',
    body: 'Conversations you mark done move here, out of the way.',
  },
};

const BAR_TONE = {
  calm: 'bg-ink-faint',
  soon: 'bg-warning',
  urgent: 'bg-danger',
  closed: 'bg-transparent',
};

const TEXT_TONE = {
  calm: 'text-ink-muted',
  soon: 'text-warning',
  urgent: 'text-danger',
  closed: 'text-ink-faint',
};

export function ConversationList({
  conversations,
  filter,
  loading,
  selectedId,
  now,
  searching,
  onSelect,
}: ConversationListProps) {
  if (loading) {
    return (
      <div className="flex-1 space-y-1 p-2" aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-3">
            <div className="h-10 w-10 rounded-full bg-surface-overlay" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 rounded bg-surface-overlay" />
              <div className="h-3 w-2/3 rounded bg-surface-overlay" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    const empty = searching
      ? { title: 'No matches', body: 'Try a name, username or something they said.' }
      : EMPTY[filter];
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <p className="text-sm font-medium text-ink">{empty.title}</p>
        <p className="mt-1 max-w-[16rem] text-[13px] leading-relaxed text-ink-muted">{empty.body}</p>
      </div>
    );
  }

  return (
        <ul className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-tabbar" role="listbox" aria-label="Conversations">
      {conversations.map((conv) => {
        const label = getConversationLabel(conv, now);
        const selected = selectedId === conv.id;
        const unread = !conv.is_read;
        const fromUs = conv.last_sender_type === 'human' || conv.last_sender_type === 'bot';
        const name = conv.customer_name || conv.customer_username || 'Instagram user';

        return (
          <li key={conv.id} role="option" aria-selected={selected}>
            <button
              onClick={() => onSelect(conv)}
              className={clsx(
                'flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors',
                selected ? 'bg-surface-overlay' : 'hover:bg-surface-raised'
              )}
            >
              <div className="relative">
                <Avatar src={conv.customer_profile_pic} name={name} size={40} />
                {label && label.key !== 'waiting' && (
                  <span
                    className={clsx(
                      'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2',
                      selected ? 'border-surface-overlay' : 'border-surface',
                      label.key === 'needs_reply' ? 'bg-danger' : 'bg-warning'
                    )}
                    aria-hidden="true"
                  />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={clsx(
                      'truncate text-sm',
                      unread ? 'font-semibold text-ink' : 'font-medium text-ink-light'
                    )}
                  >
                    {name}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-xs tabular-nums text-ink-faint">
                    {unread && <span className="h-1.5 w-1.5 rounded-full bg-focus" aria-label="Unread" />}
                    {shortTime(conv.last_message_at, now)}
                  </span>
                </div>

                <p className={clsx('mt-0.5 truncate text-[13px]', unread ? 'text-ink-light' : 'text-ink-muted')}>
                  {fromUs && <span className="text-ink-faint">You: </span>}
                  {conv.last_message_preview || 'No messages yet'}
                </p>

                {/* What this conversation needs */}
                {label?.key === 'needs_reply' && <ReplyWindowBar conv={conv} now={now} />}
                {label?.key === 'follow_up' && (
                  <p className="mt-2 text-xs text-warning">
                    Quiet for {quietFor(conv.last_message_at, now)}
                  </p>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// The 24-hour reply window, drawn as a bar that drains as time runs out
function ReplyWindowBar({ conv, now }: { conv: Conversation; now: number }) {
  const w = getReplyWindow(conv, now);

  if (w.closed) {
    return <p className="mt-2 text-xs text-ink-faint">{w.text}</p>;
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="h-1 w-14 overflow-hidden rounded-full bg-surface-overlay" aria-hidden="true">
        <div
          className={clsx('h-full rounded-full', BAR_TONE[w.tone])}
          style={{ width: `${Math.max(4, w.fraction * 100)}%` }}
        />
      </div>
      <span className={clsx('text-xs tabular-nums', TEXT_TONE[w.tone])}>{w.text}</span>
    </div>
  );
}