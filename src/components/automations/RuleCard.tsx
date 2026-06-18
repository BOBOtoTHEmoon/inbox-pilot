'use client';

import {
  MessageSquare,
  MessageCircle,
  Clock,
  Star,
  Reply,
  Zap,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { AutomationRule } from '@/types';

const triggerIcons: Record<string, typeof MessageSquare> = {
  keyword: MessageSquare,
  comment: MessageCircle,
  story_reply: Reply,
  first_message: Star,
  after_hours: Clock,
};

const triggerLabels: Record<string, string> = {
  keyword: 'Keyword Match',
  comment: 'Comment-to-DM',
  story_reply: 'Story Reply',
  first_message: 'First Message',
  after_hours: 'After Hours',
};

interface RuleCardProps {
  rule: AutomationRule;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}

export function RuleCard({ rule, onEdit, onToggle, onDelete }: RuleCardProps) {
  const TriggerIcon = triggerIcons[rule.trigger_type] || Zap;
  const triggerConfig = rule.trigger_config as any;

  return (
    <div
      className={clsx(
        'group rounded-xl border p-4 transition-colors',
        rule.is_active
          ? 'border-border bg-surface hover:border-border-strong'
          : 'border-border bg-surface-overlay/50 opacity-60'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left info */}
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={clsx(
              'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
              rule.is_active ? 'bg-bot-light text-bot' : 'bg-surface-overlay text-ink-muted'
            )}
          >
            <TriggerIcon className="h-4 w-4" />
          </div>

          <div className="min-w-0">
            <h3 className="text-sm font-medium">{rule.name}</h3>
            <p className="mt-0.5 text-xs text-ink-muted">
              {triggerLabels[rule.trigger_type]}
              {triggerConfig?.keywords && (
                <span>
                  {' '}
                  · Keywords:{' '}
                  {triggerConfig.keywords.slice(0, 3).join(', ')}
                  {triggerConfig.keywords.length > 3 &&
                    ` +${triggerConfig.keywords.length - 3}`}
                </span>
              )}
            </p>

            {/* Response preview */}
            {rule.response && (
              <p className="mt-2 line-clamp-2 rounded-lg bg-surface-overlay px-3 py-2 text-xs text-ink-light">
                {(rule.response as any).content?.slice(0, 120)}
                {(rule.response as any).content?.length > 120 && '...'}
              </p>
            )}

            {/* Stats */}
            <div className="mt-2 flex items-center gap-3 text-[11px] text-ink-muted">
              <span>Triggered {rule.stats?.triggered_count ?? rule.triggered_count ?? 0} times</span>
              <span>·</span>
              <span>Priority {rule.priority}</span>
              <span>·</span>
              <span>{rule.cooldown_minutes}min cooldown</span>
            </div>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="rounded-md p-1.5 text-ink-muted hover:bg-surface-overlay hover:text-ink transition-colors"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="rounded-md p-1.5 text-ink-muted hover:bg-danger-light hover:text-danger transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onToggle}
            className="rounded-md p-1.5 transition-colors"
            title={rule.is_active ? 'Disable' : 'Enable'}
          >
            {rule.is_active ? (
              <ToggleRight className="h-5 w-5 text-success" />
            ) : (
              <ToggleLeft className="h-5 w-5 text-ink-muted" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
