'use client';

import { clsx } from 'clsx';
import { MessageSquareText, Sparkles, Moon, CircleDashed, MessageCircle } from 'lucide-react';
import type { AutomationRule } from '@/types';
import { describeTrigger, ruleUseCount } from '@/lib/rules';

const ICONS = {
  keyword: MessageSquareText,
  first_message: Sparkles,
  after_hours: Moon,
  story_reply: CircleDashed,
  comment: MessageCircle,
};

interface RuleCardProps {
  rule: AutomationRule;
  onEdit: () => void;
  onToggle: () => void;
}

// One auto-reply, read as a sentence: when this happens, reply with that
export function RuleCard({ rule, onEdit, onToggle }: RuleCardProps) {
  const Icon = ICONS[rule.trigger_type] || MessageSquareText;
  const uses = ruleUseCount(rule);
  const reply = (rule.response as any)?.content || '';

  return (
    <li className="flex items-start gap-3 px-4 py-4">
      <span
        className={clsx(
          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          rule.is_active ? 'bg-surface-overlay text-ink' : 'bg-surface-raised text-ink-faint'
        )}
      >
        <Icon className="h-4 w-4" />
      </span>

      <button onClick={onEdit} className="min-w-0 flex-1 text-left">
        <p className={clsx('text-sm font-medium', !rule.is_active && 'text-ink-muted')}>{rule.name}</p>
        <p className="mt-0.5 text-[13px] text-ink-muted">{describeTrigger(rule)}</p>
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-ink-light">
          <span className="text-ink-faint">Replies: </span>
          {reply}
        </p>
        <p className="mt-2 text-xs text-ink-faint">
          {rule.is_active ? (uses === 0 ? 'Not used yet' : uses === 1 ? 'Used once' : `Used ${uses} times`) : 'Off'}
        </p>
      </button>

      <button
        role="switch"
        aria-checked={rule.is_active}
        aria-label={rule.is_active ? `Turn off ${rule.name}` : `Turn on ${rule.name}`}
        onClick={onToggle}
        className={clsx(
          'relative mt-1 h-5 w-9 shrink-0 rounded-full transition-colors',
          rule.is_active ? 'bg-ink' : 'bg-border-strong'
        )}
      >
        <span
          className={clsx(
            'absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
            rule.is_active ? 'translate-x-[18px]' : 'translate-x-0.5'
          )}
        />
      </button>
    </li>
  );
}