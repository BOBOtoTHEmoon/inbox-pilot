'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { X } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { REPEAT_OPTIONS, TRIGGERS, type RuleDraft, type TriggerType } from '@/lib/rules';

interface RuleEditorProps {
  initial: RuleDraft;
  isNew: boolean;
  onSave: (draft: RuleDraft) => Promise<string | null>;
  onDelete?: () => void;
  onClose: () => void;
}

// Type a word and press Enter (or comma) to add it
function WordsInput({ words, onChange }: { words: string[]; onChange: (w: string[]) => void }) {
  const [text, setText] = useState('');

  const add = (raw: string) => {
    const parts = raw
      .split(',')
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean)
      .filter((p) => !words.includes(p));
    if (parts.length) onChange([...words, ...parts]);
    setText('');
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border px-2 py-1.5 focus-within:border-ink">
      {words.map((w) => (
        <span key={w} className="flex items-center gap-1 rounded-md bg-surface-overlay py-1 pl-2 pr-1 text-[13px]">
          {w}
          <button
            type="button"
            onClick={() => onChange(words.filter((x) => x !== w))}
            aria-label={`Remove ${w}`}
            className="flex h-5 w-5 items-center justify-center rounded text-ink-muted hover:bg-border hover:text-ink"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={text}
        onChange={(e) => {
          if (e.target.value.endsWith(',')) add(e.target.value);
          else setText(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add(text);
          } else if (e.key === 'Backspace' && !text && words.length) {
            onChange(words.slice(0, -1));
          }
        }}
        onBlur={() => text && add(text)}
        placeholder={words.length ? 'Add another' : 'Type a word, then press Enter'}
        className="h-8 min-w-[8rem] flex-1 bg-transparent px-1 text-base md:text-sm outline-none focus-visible:outline-none placeholder:text-ink-faint"
      />
    </div>
  );
}

export function RuleEditor({ initial, isNew, onSave, onDelete, onClose }: RuleEditorProps) {
  const [draft, setDraft] = useState<RuleDraft>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof RuleDraft>(key: K, value: RuleDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const trigger = TRIGGERS.find((t) => t.type === draft.trigger_type)!;
  const needsWords = draft.trigger_type === 'keyword';
  const allowsWords = needsWords || draft.trigger_type === 'comment' || draft.trigger_type === 'story_reply';

  const exampleText =
    draft.trigger_type === 'keyword' && draft.keywords[0]
      ? `Hi, ${draft.keywords[0]}?`
      : trigger.example;

  const handleSave = async () => {
    if (needsWords && draft.keywords.length === 0) {
      setError('Add at least one word to listen for.');
      return;
    }
    if (!draft.reply.trim()) {
      setError('Write the reply that should be sent.');
      return;
    }
    setError(null);
    setSaving(true);
    const problem = await onSave(draft);
    setSaving(false);
    if (problem) setError(problem);
  };

  return (
    <Dialog
      title={isNew ? 'New auto-reply' : 'Edit auto-reply'}
      onClose={onClose}
      footer={
        <div className="flex items-center gap-2">
          {onDelete && (
            <button
              onClick={onDelete}
              className="mr-auto rounded-lg px-3 py-2 text-[13px] font-medium text-danger hover:bg-danger-light transition-colors"
            >
              Delete
            </button>
          )}
          <button
            onClick={onClose}
            className={clsx(
              'rounded-lg border border-border px-3 py-2 text-[13px] font-medium hover:bg-surface-raised',
              !onDelete && 'ml-auto'
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-ink px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {saving ? 'Saving...' : isNew ? 'Turn on' : 'Save'}
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* When */}
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-ink-light">When someone</legend>
          <div className="space-y-1.5">
            {TRIGGERS.map((t) => (
              <label
                key={t.type}
                className={clsx(
                  'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                  draft.trigger_type === t.type ? 'border-ink bg-surface-raised' : 'border-border hover:bg-surface-raised'
                )}
              >
                <input
                  type="radio"
                  name="trigger"
                  checked={draft.trigger_type === t.type}
                  onChange={() => set('trigger_type', t.type as TriggerType)}
                  className="mt-0.5 accent-[var(--color-ink)]"
                />
                <span>
                  <span className="block text-sm font-medium">{t.title}</span>
                  {draft.trigger_type === t.type && (
                    <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">{t.help}</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Words */}
        {allowsWords && (
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink-light">
              {needsWords ? 'Words to listen for' : 'Only when they use these words (optional)'}
            </p>
            <WordsInput words={draft.keywords} onChange={(w) => set('keywords', w)} />
          </div>
        )}

        {/* Reply */}
        <label className="block">
          <span className="mb-2 block text-[13px] font-medium text-ink-light">
            {draft.trigger_type === 'comment' ? 'Send them this DM' : 'Reply with'}
          </span>
          <textarea
            value={draft.reply}
            onChange={(e) => set('reply', e.target.value)}
            rows={4}
            placeholder="Write the message customers will get"
            className="w-full resize-none rounded-lg border border-border px-3 py-2.5 text-base md:text-sm leading-relaxed outline-none focus-visible:outline-none focus:border-ink placeholder:text-ink-faint"
          />
        </label>

        {/* Preview */}
        <div>
          <p className="mb-2 text-[13px] font-medium text-ink-light">Preview</p>
          <div className="space-y-2 rounded-xl bg-surface-raised p-4">
            <div className="flex">
              <span className="max-w-[80%] rounded-[18px] rounded-bl-md bg-surface-overlay px-3.5 py-2 text-sm">
                {draft.trigger_type === 'comment' ? `Commented: ${exampleText}` : exampleText}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="mb-1 text-[11px] font-medium text-bot">Auto-reply</span>
              <span className="max-w-[80%] whitespace-pre-wrap rounded-[18px] rounded-br-md bg-ink px-3.5 py-2 text-sm text-white">
                {draft.reply.trim() || 'Your reply will appear here'}
              </span>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-[13px] font-medium text-ink-light">Name</span>
            <input
              value={draft.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="For example, Price questions"
              className="h-10 w-full rounded-lg border border-border px-3 text-base md:text-sm outline-none focus-visible:outline-none focus:border-ink placeholder:text-ink-faint"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-[13px] font-medium text-ink-light">Reply to the same person</span>
            <select
              value={draft.cooldown_minutes}
              onChange={(e) => set('cooldown_minutes', Number(e.target.value))}
              className="h-10 w-full rounded-lg border border-border bg-surface px-2.5 text-base md:text-sm outline-none focus:border-ink"
            >
              {REPEAT_OPTIONS.map((o) => (
                <option key={o.minutes} value={o.minutes}>
                  {o.label}
                </option>
              ))}
              {!REPEAT_OPTIONS.some((o) => o.minutes === draft.cooldown_minutes) && (
                <option value={draft.cooldown_minutes}>Every {draft.cooldown_minutes} minutes</option>
              )}
            </select>
          </label>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-danger-light px-3 py-2 text-[13px] text-danger">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}