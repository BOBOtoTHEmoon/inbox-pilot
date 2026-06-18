'use client';

import { Inbox } from 'lucide-react';

export function EmptyInbox() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center px-6">
      <div className="mb-4 rounded-2xl bg-surface-overlay p-4">
        <Inbox className="h-8 w-8 text-ink-muted" />
      </div>
      <h2 className="text-lg font-semibold text-ink">Select a conversation</h2>
      <p className="mt-1 max-w-xs text-sm text-ink-muted">
        Pick a conversation from the left to view messages and reply
      </p>
    </div>
  );
}
