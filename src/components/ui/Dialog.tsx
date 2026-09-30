'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

// A panel that slides up from the bottom on phones and sits in the middle on larger screens
export function Dialog({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/30" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-surface shadow-[0_20px_60px_rgba(22,22,26,0.25)] animate-slide-up sm:max-w-lg sm:rounded-2xl"
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-5">
          <h2 id="dialog-title" className="text-[15px] font-semibold">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-overlay"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-5">{children}</div>
        {footer && (
          <footer className="shrink-0 border-t border-border px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}