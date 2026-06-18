'use client';

import { useState } from 'react';
import { ConversationList } from '@/components/inbox/ConversationList';
import { MessageThread } from '@/components/inbox/MessageThread';
import { ConversationHeader } from '@/components/inbox/ConversationHeader';
import { EmptyInbox } from '@/components/inbox/EmptyInbox';
import type { Conversation } from '@/types';

// TODO: Replace with actual business ID from auth context
const BUSINESS_ID = process.env.NEXT_PUBLIC_BUSINESS_ID || 'demo';

export default function InboxPage() {
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [statusFilter, setStatusFilter] = useState<'open' | 'closed' | 'all'>(
    'open'
  );

  return (
    <div className="flex h-full">
      {/* Left: Conversation List */}
      <div className="w-80 flex-shrink-0 border-r border-border flex flex-col">
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <h1 className="text-sm font-semibold">Inbox</h1>
          <div className="flex gap-1">
            {(['open', 'closed', 'all'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-accent-light text-accent'
                    : 'text-ink-muted hover:bg-surface-overlay'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <ConversationList
          businessId={BUSINESS_ID}
          status={statusFilter}
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
