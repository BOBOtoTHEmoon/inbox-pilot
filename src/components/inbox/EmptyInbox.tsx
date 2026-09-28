'use client';

// Shown on larger screens when no conversation is open
export function EmptyInbox({ waiting }: { waiting: number }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <p className="text-[15px] font-semibold text-ink">
        {waiting === 0
          ? 'You are all caught up'
          : waiting === 1
          ? '1 person is waiting for a reply'
          : `${waiting} people are waiting for a reply`}
      </p>
      <p className="mt-1 text-[13px] text-ink-muted">Pick a conversation to read and reply.</p>

      <dl className="mt-6 hidden grid-cols-[auto_auto] gap-x-3 gap-y-2 text-left text-[13px] text-ink-muted md:grid">
        <dt className="flex gap-1">
          <kbd className="rounded-md border border-border bg-surface-raised px-1.5 text-xs font-medium text-ink">J</kbd>
          <kbd className="rounded-md border border-border bg-surface-raised px-1.5 text-xs font-medium text-ink">K</kbd>
        </dt>
        <dd>Next and previous conversation</dd>
        <dt>
          <kbd className="rounded-md border border-border bg-surface-raised px-1.5 text-xs font-medium text-ink">E</kbd>
        </dt>
        <dd>Mark done</dd>
        <dt>
          <kbd className="rounded-md border border-border bg-surface-raised px-1.5 text-xs font-medium text-ink">/</kbd>
        </dt>
        <dd>Search</dd>
      </dl>
    </div>
  );
}