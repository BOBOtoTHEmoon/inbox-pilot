'use client';

import { clsx } from 'clsx';
import { X } from 'lucide-react';

// ── Badge ──
export function Badge({
  children,
  variant = 'default',
  className,
}: {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'bot' | 'accent';
  className?: string;
}) {
  const styles: Record<string, string> = {
    default: 'bg-surface-overlay text-ink-muted',
    success: 'bg-success-light text-success',
    warning: 'bg-warning-light text-warning',
    danger: 'bg-danger-light text-danger',
    bot: 'bg-bot-light text-bot',
    accent: 'bg-accent-light text-accent',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
        styles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

// ── Toggle Switch ──
export function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors',
        checked ? 'bg-accent' : 'bg-border-strong',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span
        className={clsx(
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform mt-0.5',
          checked ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}

// ── Spinner ──
export function Spinner({ size = 'sm' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeMap = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-8 w-8' };
  return (
    <div
      className={clsx(
        'animate-spin rounded-full border-2 border-accent border-t-transparent',
        sizeMap[size]
      )}
    />
  );
}

// ── Modal Shell ──
export function Modal({
  children,
  onClose,
  title,
  maxWidth = 'max-w-lg',
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm">
      <div
        className={clsx(
          'mx-4 w-full rounded-2xl border border-border bg-surface shadow-xl',
          maxWidth
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-ink-muted hover:bg-surface-overlay transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Empty State ──
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 rounded-2xl bg-surface-overlay p-4">
        <Icon className="h-8 w-8 text-ink-muted" />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
