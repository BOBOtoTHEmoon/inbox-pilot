'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { X, AtSign, Mail, Phone } from 'lucide-react';
import type { Conversation } from '@/types';
import { getReplyWindow } from '@/lib/labels';
import { Avatar } from './Avatar';

interface CustomerPanelProps {
  conversation: Conversation;
  now: number;
  onUpdate: (fields: Partial<Conversation>) => Promise<void> | void;
  onClose?: () => void;
  className?: string;
}

// A field that saves itself when you click away from it
function SavedField({
  label,
  icon: Icon,
  value,
  placeholder,
  type = 'text',
  onSave,
}: {
  label: string;
  icon: typeof Mail;
  value: string;
  placeholder: string;
  type?: string;
  onSave: (value: string) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(false);

  useEffect(() => setDraft(value), [value]);

  const commit = async () => {
    const clean = draft.trim();
    if (clean === (value || '')) return;
    await onSave(clean);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-xs text-ink-muted">
        {label}
        {saved && <span className="text-success">Saved</span>}
      </span>
      <span className="flex items-center gap-2 rounded-lg border border-border px-2.5 focus-within:border-border-strong">
        <Icon className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
        <input
          type={type}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="h-9 w-full bg-transparent text-base md:text-[13px] outline-none focus-visible:outline-none placeholder:text-ink-faint"
        />
      </span>
    </label>
  );
}

export function CustomerPanel({ conversation, now, onUpdate, onClose, className }: CustomerPanelProps) {
  const name = conversation.customer_name || conversation.customer_username || 'Instagram user';
  const handle =
    conversation.customer_username && conversation.customer_username !== 'unknown'
      ? conversation.customer_username
      : null;
  const notes = (conversation.metadata?.notes as string) || '';
  const [notesDraft, setNotesDraft] = useState(notes);
  const replyWindow = getReplyWindow(conversation, now);
  const autoReplies = conversation.assigned_to === 'bot';

  useEffect(() => setNotesDraft(notes), [notes, conversation.id]);

  return (
    <aside
      className={clsx(
        'w-[320px] shrink-0 flex-col overflow-y-auto scrollbar-thin border-l border-border bg-surface',
        className
      )}
      aria-label="Customer details"
    >
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5">
        <h2 className="text-sm font-semibold">Customer</h2>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close details"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-overlay"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-7 px-5 py-6">
        {/* Who */}
        <div className="flex flex-col items-center text-center">
          <Avatar src={conversation.customer_profile_pic} name={name} size={64} />
          <p className="mt-3 text-[15px] font-semibold text-ink">{name}</p>
          {handle && (

            <a
              href={`https://instagram.com/${handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 flex items-center gap-1 text-[13px] text-ink-muted hover:text-ink"
            >
              <AtSign className="h-3 w-3" />
              {handle}
            </a>
          )}
        </div>

        {/* Instagram's 24-hour rule, in plain words */}
        <div>
          <p className="mb-2 text-xs text-ink-muted">Reply window</p>
          {replyWindow.closed ? (
            <p className="text-[13px] leading-relaxed text-ink-light">
              Closed. Instagram only allows a reply from the Instagram app until they message again.
            </p>
          ) : (
            <>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-overlay" aria-hidden="true">
                <div
                  className={clsx(
                    'h-full rounded-full',
                    replyWindow.tone === 'urgent' ? 'bg-danger' : replyWindow.tone === 'soon' ? 'bg-warning' : 'bg-ink-faint'
                  )}
                  style={{ width: `${Math.max(3, replyWindow.fraction * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-[13px] text-ink-light">{replyWindow.text} from InboxPilot</p>
            </>
          )}
        </div>

        {/* Contact details: needed to reach them after the window closes */}
        <div className="space-y-3">
          <SavedField
            label="Email"
            icon={Mail}
            type="email"
            value={conversation.customer_email || ''}
            placeholder="Add an email"
            onSave={(v) => onUpdate({ customer_email: v || null })}
          />
          <SavedField
            label="Phone or WhatsApp"
            icon={Phone}
            type="tel"
            value={conversation.customer_phone || ''}
            placeholder="Add a number"
            onSave={(v) => onUpdate({ customer_phone: v || null })}
          />
        </div>

        {/* Notes for the team */}
        <label className="block">
          <span className="mb-1 block text-xs text-ink-muted">Notes</span>
          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={() => {
              if (notesDraft !== notes) {
                onUpdate({ metadata: { ...(conversation.metadata || {}), notes: notesDraft } });
              }
            }}
            rows={4}
            placeholder="Sizes, preferences, what they asked about"
            className="w-full resize-none rounded-lg border border-border px-2.5 py-2 text-base md:text-[13px] leading-relaxed outline-none focus-visible:outline-none placeholder:text-ink-faint focus:border-border-strong"
          />
        </label>

        {/* Automations */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-medium text-ink">Auto-replies</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
              Let your automations answer this person.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={autoReplies}
            aria-label="Auto-replies"
            onClick={() => onUpdate({ assigned_to: autoReplies ? 'human' : 'bot' })}
            className={clsx(
              'relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors',
              autoReplies ? 'bg-ink' : 'bg-border-strong'
            )}
          >
            <span
              className={clsx(
                'absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                autoReplies ? 'translate-x-[18px]' : 'translate-x-0.5'
              )}
            />
          </button>
        </div>
      </div>
    </aside>
  );
}