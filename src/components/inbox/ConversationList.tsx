'use client';

import { useConversations } from '@/hooks/useConversations';
import { clsx } from 'clsx';
import { Bot, User, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Conversation } from '@/types';

interface ConversationListProps {
  businessId: string;
  status: 'open' | 'closed' | 'all';
  selectedId: string | null;
  onSelect: (conversation: Conversation) => void;
}

export function ConversationList({
  businessId,
  status,
  selectedId,
  onSelect,
}: ConversationListProps) {
  const { conversations, loading, unreadCount } = useConversations({
    businessId,
    status,
  });

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="mb-2 rounded-full bg-surface-overlay p-3">
          <Clock className="h-5 w-5 text-ink-muted" />
        </div>
        <p className="text-sm text-ink-muted">No conversations yet</p>
        <p className="mt-1 text-xs text-ink-muted">
          Messages will appear here when customers DM your Instagram
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      {conversations.map((conv) => (
        <button
          key={conv.id}
          onClick={() => onSelect(conv)}
          className={clsx(
            'flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors',
            selectedId === conv.id
              ? 'bg-accent-light'
              : 'hover:bg-surface-overlay',
            !conv.is_read && 'bg-surface-raised'
          )}
        >
          {/* Avatar */}
          <div className="relative shrink-0">
            {conv.customer_profile_pic ? (
              <img
                src={conv.customer_profile_pic}
                alt=""
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-overlay text-ink-muted">
                <User className="h-5 w-5" />
              </div>
            )}
            {!conv.is_read && (
              <div className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent animate-pulse-dot" />
            )}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span
                className={clsx(
                  'truncate text-sm',
                  !conv.is_read ? 'font-semibold text-ink' : 'font-medium text-ink'
                )}
              >
                {conv.customer_name || conv.customer_username || 'Unknown'}
              </span>
              <span className="shrink-0 text-[11px] text-ink-muted">
                {formatDistanceToNow(new Date(conv.last_message_at), {
                  addSuffix: false,
                })}
              </span>
            </div>

            <div className="mt-0.5 flex items-center gap-1.5">
              {/* Bot/Human indicator */}
              {conv.assigned_to === 'bot' ? (
                <Bot className="h-3 w-3 shrink-0 text-bot" />
              ) : (
                <User className="h-3 w-3 shrink-0 text-success" />
              )}
              <p
                className={clsx(
                  'truncate text-xs',
                  !conv.is_read ? 'text-ink-light' : 'text-ink-muted'
                )}
              >
                {conv.last_message_preview || 'No messages'}
              </p>
            </div>

            {/* Tags */}
            {conv.tags.length > 0 && (
              <div className="mt-1.5 flex gap-1">
                {conv.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-surface-overlay px-1.5 py-0.5 text-[10px] text-ink-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
