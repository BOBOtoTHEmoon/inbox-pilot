'use client';

import { useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { toShortcut } from '@/hooks/useReplyTemplates';
import type { ReplyTemplate } from '@/types';

interface EditorProps {
  template: ReplyTemplate | null;
  onSave: (fields: { name: string; shortcut: string; content: string }) => Promise<string | null>;
  onDelete?: () => void;
  onClose: () => void;
}

export function SavedReplyEditor({ template, onSave, onDelete, onClose }: EditorProps) {
  const [name, setName] = useState(template?.name || '');
  const [shortcut, setShortcut] = useState(template?.shortcut || '');
  const [shortcutEdited, setShortcutEdited] = useState(!!template);
  const [content, setContent] = useState(template?.content || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) return setError('Give it a short name, like "Delivery fees".');
    if (!content.trim()) return setError('Write the message to insert.');
    setError(null);
    setSaving(true);
    const problem = await onSave({ name: name.trim(), shortcut: shortcut || name, content: content.trim() });
    setSaving(false);
    if (problem) setError(problem);
  };

  const field =
    'w-full rounded-lg border border-border px-3 text-base md:text-sm outline-none focus-visible:outline-none focus:border-ink placeholder:text-ink-faint';

  return (
    <Dialog
      title={template ? 'Edit saved reply' : 'New saved reply'}
      onClose={onClose}
      footer={
        <div className="flex items-center gap-2">
          {onDelete && (
            <button
              onClick={onDelete}
              className="mr-auto rounded-lg px-3 py-2 text-[13px] font-medium text-danger hover:bg-danger-light"
            >
              Delete
            </button>
          )}
          <button
            onClick={onClose}
            className={`rounded-lg border border-border px-3 py-2 text-[13px] font-medium hover:bg-surface-raised ${onDelete ? '' : 'ml-auto'}`}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-ink px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
          <label className="block">
            <span className="mb-2 block text-[13px] font-medium text-ink-light">Name</span>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!shortcutEdited) setShortcut(toShortcut(e.target.value));
              }}
              placeholder="Delivery fees"
              className={`h-10 ${field}`}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-[13px] font-medium text-ink-light">Shortcut</span>
            <span className="flex h-10 items-center rounded-lg border border-border px-3 focus-within:border-ink">
              <span className="text-ink-faint">/</span>
              <input
                value={shortcut}
                onChange={(e) => {
                  setShortcut(toShortcut(e.target.value));
                  setShortcutEdited(true);
                }}
                placeholder="delivery"
                className="h-full w-full bg-transparent pl-0.5 text-base md:text-sm outline-none focus-visible:outline-none placeholder:text-ink-faint"
              />
            </span>
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-[13px] font-medium text-ink-light">Message</span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            placeholder="Hi {name}! Delivery within Lagos is..."
            className={`resize-none py-2.5 leading-relaxed ${field}`}
          />
          <span className="mt-1.5 block text-xs text-ink-faint">
            Write {'{name}'} and it becomes the customer&apos;s first name.
          </span>
        </label>

        {error && (
          <p role="alert" className="rounded-lg bg-danger-light px-3 py-2 text-[13px] text-danger">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}

export function SavedReplyList({
  templates,
  onEdit,
}: {
  templates: ReplyTemplate[];
  onEdit: (t: ReplyTemplate) => void;
}) {
  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {templates.map((t) => (
        <li key={t.id}>
          <button onClick={() => onEdit(t)} className="flex w-full items-start gap-3 px-4 py-4 text-left hover:bg-surface-raised">
            <span className="mt-0.5 shrink-0 rounded-md bg-surface-overlay px-1.5 py-0.5 font-mono text-xs text-ink">
              /{t.shortcut}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{t.name}</span>
              <span className="mt-0.5 line-clamp-2 block text-[13px] leading-relaxed text-ink-muted">{t.content}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}