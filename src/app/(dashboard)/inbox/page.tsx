'use client';

import { useState } from 'react';
import { ConversationList } from '@/components/inbox/ConversationList';
import { MessageThread } from '@/components/inbox/MessageThread';
import { ConversationHeader } from '@/components/inbox/ConversationHeader';
import { EmptyInbox } from '@/components/inbox/EmptyInbox';
import type { Conversation } from '@/types';
import type { InboxFilter } from '@/lib/labels';

const FILTERS: { key: InboxFilter; label: string }[] = [
  { key: 'needs_reply', label: 'Needs reply' },
  { key: 'follow_up', label: 'Follow up' },
  { key: 'all_open', label: 'All' },
  { key: 'closed', label: 'Closed' },
];

// TODO: Replace with actual business ID from auth context
const BUSINESS_ID = process.env.NEXT_PUBLIC_BUSINESS_ID || 'demo';

export default function InboxPage() {
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [filter, setFilter] = useState<InboxFilter>('needs_reply');

  return (
    <div className="flex h-full">
      {/* Left: Conversation List */}
      <div className="w-80 flex-shrink-0 border-r border-border flex flex-col">
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <h1 className="text-sm font-semibold">Inbox</h1>
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  filter === f.key
                    ? 'bg-accent-light text-accent'
                    : 'text-ink-muted hover:bg-surface-overlay'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <ConversationList
          businessId={BUSINESS_ID}
          filter={filter}
          selectedId={selectedConversation?.id || null}
          onSelect={setSelectedConversation}
        />
      </div>

      {/* Right: Message Thread */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            <ConversationHeader
              conversation={selectedConversation}
              businessId={BUSINESS_ID}
            />
            <MessageThread
              conversation={selectedConversation}
              businessId={BUSINESS_ID}
            />
          </>
        ) : (
          <EmptyInbox />
        )}
      </div>
    </div>
  );
}