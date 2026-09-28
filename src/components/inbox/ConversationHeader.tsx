'use client';

import { ArrowLeft, Check, RotateCcw, PanelRight, Instagram } from 'lucide-react';
import { clsx } from 'clsx';
import type { Conversation } from '@/types';
import { Avatar } from './Avatar';

interface ConversationHeaderProps {
  conversation: Conversation;
  detailsOpen: boolean;
  onBack: () => void;
  onToggleDetails: () => void;
  onDone: () => void;
  onReopen: () => void;
}

export function instagramDmLink(username?: string | null) {
  return username && username !== 'unknown'
    ? `https://ig.me/m/${username}`
    : 'https://www.instagram.com/direct/inbox/';
}

export function ConversationHeader({
  conversation,
  detailsOpen,
  onBack,
  onToggleDetails,
  onDone,
  onReopen,
}: ConversationHeaderProps) {
  const name = conversation.customer_name || conversation.customer_username || 'Instagram user';
  const handle =
    conversation.customer_username && conversation.customer_username !== 'unknown'
      ? conversation.customer_username
      : null;
  const done = conversation.status === 'closed';

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface px-3 md:px-5 pt-[env(safe-area-inset-top)]">
      <button
        onClick={onBack}
        aria-label="Back to inbox"
        className="md:hidden -ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-overlay"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <button
        onClick={onToggleDetails}
        className="flex min-w-0 flex-1 items-center gap-3 text-left xl:pointer-events-none"
        aria-label="Show customer details"
      >
        <Avatar src={conversation.customer_profile_pic} name={name} size={34} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{name}</p>
          {handle && <p className="truncate text-xs text-ink-muted">@{handle}</p>}
        </div>
      </button>

      <div className="flex shrink-0 items-center gap-1">
        <a
          href={instagramDmLink(conversation.customer_username)}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in Instagram"
          aria-label="Open in Instagram"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-overlay hover:text-ink transition-colors"
        >
          <Instagram className="h-[18px] w-[18px]" />
        </a>

        <button
          onClick={onToggleDetails}
          title="Customer details"
          aria-label="Customer details"
          aria-pressed={detailsOpen}
          className={clsx(
            'xl:hidden flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
            detailsOpen ? 'bg-surface-overlay text-ink' : 'text-ink-muted hover:bg-surface-overlay hover:text-ink'
          )}
        >
          <PanelRight className="h-[18px] w-[18px]" />
        </button>

        {done ? (
          <button
            onClick={onReopen}
            className="ml-1 flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] font-medium text-ink hover:bg-surface-raised transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reopen</span>
          </button>
        ) : (
          <button
            onClick={onDone}
            title="Mark done (E)"
            className="ml-1 flex h-9 items-center gap-1.5 rounded-lg bg-ink px-3 text-[13px] font-medium text-white hover:bg-accent-hover transition-colors"
          >
            <Check className="h-4 w-4" />
            <span className="hidden sm:inline">Mark done</span>
          </button>
        )}
      </div>
    </header>
  );
}