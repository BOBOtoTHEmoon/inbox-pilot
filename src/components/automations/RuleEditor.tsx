'use client';

import { useState } from 'react';
import { X, Plus, Minus } from 'lucide-react';
import type { AutomationRule } from '@/types';

interface RuleEditorProps {
  rule: AutomationRule | null; // null = creating new
  onSave: (data: Partial<AutomationRule>) => Promise<void>;
  onClose: () => void;
}

export function RuleEditor({ rule, onSave, onClose }: RuleEditorProps) {
  const [name, setName] = useState(rule?.name || '');
  const [triggerType, setTriggerType] = useState<string>(
    rule?.trigger_type || 'keyword'
  );
  const [keywords, setKeywords] = useState<string[]>(
    (rule?.trigger_config as any)?.keywords || ['']
  );
  const [matchMode, setMatchMode] = useState<string>(
    (rule?.trigger_config as any)?.match_mode || 'fuzzy'
  );
  const [responseContent, setResponseContent] = useState(
    (rule?.response as any)?.content || ''
  );
  const [priority, setPriority] = useState(rule?.priority || 5);
  const [cooldown, setCooldown] = useState(rule?.cooldown_minutes || 15);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !responseContent.trim()) return;

    setSaving(true);
    const triggerConfig: any = { type: triggerType };

    if (triggerType === 'keyword' || triggerType === 'comment') {
      triggerConfig.keywords = keywords.filter((k) => k.trim());
      if (triggerType === 'keyword') triggerConfig.match_mode = matchMode;
    }

    await onSave({
      name: name.trim(),
      trigger_type: triggerType as any,
      trigger_config: triggerConfig,
      response_type: 'single',
      response: {
        content: responseContent.trim(),
        message_type: 'text',
      },
      priority,
      cooldown_minutes: cooldown,
      is_active: true,
    });

    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-2xl border border-border bg-surface shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">
            {rule ? 'Edit Rule' : 'New Automation Rule'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-ink-muted hover:bg-surface-overlay transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto scrollbar-thin p-5 space-y-5">
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">
              Rule Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Pricing Inquiry"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
            />
          </div>

          {/* Trigger Type */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">
              Trigger Type
            </label>
            <select
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
            >
              <option value="keyword">Keyword Match (DM contains keywords)</option>
              <option value="comment">Comment-to-DM (comment triggers DM)</option>
              <option value="story_reply">Story Reply</option>
              <option value="first_message">First Message (new customer)</option>
              <option value="after_hours">After Hours</option>
            </select>
          </div>

          {/* Keywords (for keyword & comment triggers) */}
          {(triggerType === 'keyword' || triggerType === 'comment') && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-muted">
                Keywords
              </label>
              <div className="space-y-2">
                {keywords.map((kw, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={kw}
                      onChange={(e) => {
                        const next = [...keywords];
                        next[i] = e.target.value;
                        setKeywords(next);
                      }}
                      placeholder="e.g. price, how much"
                      className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
                    />
                    {keywords.length > 1 && (
                      <button
                        onClick={() =>
                          setKeywords(keywords.filter((_, j) => j !== i))
                        }
                        className="rounded-lg p-2 text-ink-muted hover:bg-danger-light hover:text-danger transition-colors"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => setKeywords([...keywords, ''])}
                  className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add keyword
                </button>
              </div>

              {triggerType === 'keyword' && (
                <div className="mt-3">
                  <label className="mb-1.5 block text-xs font-medium text-ink-muted">
                    Match Mode
                  </label>
                  <div className="flex gap-2">
                    {(['fuzzy', 'contains', 'exact'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setMatchMode(mode)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          matchMode === mode
                            ? 'bg-accent-light text-accent'
                            : 'bg-surface-overlay text-ink-muted hover:text-ink'
                        }`}
                      >
                        {mode === 'fuzzy'
                          ? 'Fuzzy (typo-tolerant)'
                          : mode === 'contains'
                          ? 'Contains'
                          : 'Exact Match'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Response Content */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">
              Auto-Reply Message
            </label>
            <textarea
              value={responseContent}
              onChange={(e) => setResponseContent(e.target.value)}
              placeholder="Type the message that will be sent automatically..."
              rows={5}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent transition-colors resize-none"
            />
            <p className="mt-1 text-[11px] text-ink-muted">
              {responseContent.length}/1000 characters
            </p>
          </div>

          {/* Priority & Cooldown */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-muted">
                Priority (higher = checked first)
              </label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                min={0}
                max={100}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-muted">
                Cooldown (minutes)
              </label>
              <input
                type="number"
                value={cooldown}
                onChange={(e) => setCooldown(Number(e.target.value))}
                min={0}
                max={1440}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-overlay transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !responseContent.trim() || saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : rule ? 'Save Changes' : 'Create Rule'}
          </button>
        </div>
      </div>
    </div>
  );
}
