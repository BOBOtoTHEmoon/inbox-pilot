'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { Plus } from 'lucide-react';
import { useAutomationRules } from '@/hooks/useAutomationRules';
import { useReplyTemplates } from '@/hooks/useReplyTemplates';
import { RuleCard } from '@/components/automations/RuleCard';
import { RuleEditor } from '@/components/automations/RuleEditor';
import { SavedReplyEditor, SavedReplyList } from '@/components/automations/SavedReplies';
import { PRESETS, draftFromRule, describeTrigger, ruleFromDraft, type RuleDraft } from '@/lib/rules';
import type { AutomationRule, ReplyTemplate } from '@/types';

const BUSINESS_ID = process.env.NEXT_PUBLIC_BUSINESS_ID || 'demo';

type Tab = 'auto' | 'saved';

const BLANK_RULE: RuleDraft = {
  name: '',
  trigger_type: 'keyword',
  keywords: [],
  reply: '',
  cooldown_minutes: 60,
};

export default function AutomationsPage() {
  const [tab, setTab] = useState<Tab>('auto');
  const { rules, loading, createRule, updateRule, deleteRule, toggleRule } = useAutomationRules(BUSINESS_ID);
  const replies = useReplyTemplates(BUSINESS_ID);

  // Auto-reply editor: a rule being edited, or a draft for a new one
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [newDraft, setNewDraft] = useState<RuleDraft | null>(null);

  // Saved reply editor: a template being edited, or "new"
  const [editingReply, setEditingReply] = useState<ReplyTemplate | 'new' | null>(null);

  const closeRuleEditor = () => {
    setEditingRule(null);
    setNewDraft(null);
  };

  const saveRule = async (draft: RuleDraft): Promise<string | null> => {
    const fields = ruleFromDraft(draft);
    const result = editingRule
      ? await updateRule(editingRule.id, fields)
      : await createRule({ ...fields, is_active: true });
    if (result?.error) return 'Could not save. Check your connection and try again.';
    closeRuleEditor();
    return null;
  };

  const activeCount = rules.filter((r) => r.is_active).length;
  const unusedPresets = PRESETS.filter(
    (p) => !rules.some((r) => r.name === p.name || (p.trigger_type !== 'keyword' && r.trigger_type === p.trigger_type))
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-4 pt-[calc(1rem+env(safe-area-inset-top))] md:px-6 md:pt-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[17px] font-semibold tracking-[-0.01em]">Automations</h1>
          <button
            onClick={() => (tab === 'auto' ? setNewDraft(BLANK_RULE) : setEditingReply('new'))}
            className="flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-[13px] font-medium text-white hover:bg-accent-hover transition-colors"
          >
            <Plus className="h-4 w-4" />
            {tab === 'auto' ? 'New auto-reply' : 'New saved reply'}
          </button>
        </div>
        <div className="mt-3 flex gap-5" role="tablist">
          {(
            [
              { key: 'auto', label: 'Auto-replies', count: activeCount },
              { key: 'saved', label: 'Saved replies', count: replies.templates.length },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={clsx(
                '-mb-px border-b-2 pb-2.5 text-[13px] font-medium transition-colors',
                tab === t.key ? 'border-ink text-ink' : 'border-transparent text-ink-muted hover:text-ink'
              )}
            >
              {t.label}
              {t.count > 0 && <span className="ml-1.5 tabular-nums text-ink-faint">{t.count}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 pt-5 pb-tabbar md:px-6 md:pt-6">
        <div className="mx-auto max-w-3xl">
          {tab === 'auto' ? (
            <>
              <p className="mb-5 text-[13px] leading-relaxed text-ink-muted">
                Auto-replies answer common messages instantly, even at night. They only answer chats where
                auto-replies are switched on in the customer panel, which is on by default for new chats.
              </p>

              {loading ? (
                <div className="h-32 rounded-xl bg-surface-raised" />
              ) : (
                rules.length > 0 && (
                  <ul className="divide-y divide-border rounded-xl border border-border">
                    {rules.map((rule) => (
                      <RuleCard
                        key={rule.id}
                        rule={rule}
                        onEdit={() => setEditingRule(rule)}
                        onToggle={() => toggleRule(rule.id)}
                      />
                    ))}
                  </ul>
                )
              )}

              {/* Ready-made starting points */}
              {!loading && unusedPresets.length > 0 && (
                <div className={clsx(rules.length > 0 && 'mt-10')}>
                  <h2 className="text-sm font-semibold">
                    {rules.length ? 'More ideas' : 'Start with one of these'}
                  </h2>
                  <p className="mt-1 text-[13px] text-ink-muted">You can change the words and the reply before turning it on.</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {unusedPresets.map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() => setNewDraft(preset)}
                        className="rounded-xl border border-dashed border-border-strong px-4 py-3.5 text-left transition-colors hover:border-ink hover:bg-surface-raised"
                      >
                        <span className="block text-sm font-medium">{preset.name}</span>
                        <span className="mt-0.5 block text-[13px] text-ink-muted">
                          {describeTrigger({
                            trigger_type: preset.trigger_type,
                            trigger_config: { keywords: preset.keywords } as any,
                          })}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="mb-5 text-[13px] leading-relaxed text-ink-muted">
                Write your common answers once. In any chat, type <kbd className="rounded border border-border bg-surface-raised px-1 font-mono text-xs text-ink">/</kbd> and
                pick one, and it is filled in for you to send.
              </p>
              {replies.loading ? (
                <div className="h-32 rounded-xl bg-surface-raised" />
              ) : replies.templates.length ? (
                <SavedReplyList templates={replies.templates} onEdit={(t) => setEditingReply(t)} />
              ) : (
                <div className="rounded-xl border border-dashed border-border-strong px-6 py-10 text-center">
                  <p className="text-sm font-medium">No saved replies yet</p>
                  <p className="mx-auto mt-1 max-w-xs text-[13px] text-ink-muted">
                    Good first ones: delivery fees, payment details, size guide and store address.
                  </p>
                  <button
                    onClick={() => setEditingReply('new')}
                    className="mt-4 rounded-lg bg-ink px-3 py-2 text-[13px] font-medium text-white hover:bg-accent-hover"
                  >
                    Write your first one
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Editors */}
      {(editingRule || newDraft) && (
        <RuleEditor
          initial={editingRule ? draftFromRule(editingRule) : newDraft!}
          isNew={!editingRule}
          onSave={saveRule}
          onDelete={
            editingRule
              ? () => {
                  if (confirm(`Delete "${editingRule.name}"? This cannot be undone.`)) {
                    deleteRule(editingRule.id);
                    closeRuleEditor();
                  }
                }
              : undefined
          }
          onClose={closeRuleEditor}
        />
      )}

      {editingReply && (
        <SavedReplyEditor
          template={editingReply === 'new' ? null : editingReply}
          onSave={async (fields) => {
            const problem = await replies.save(fields, editingReply === 'new' ? undefined : editingReply.id);
            if (!problem) setEditingReply(null);
            return problem;
          }}
          onDelete={
            editingReply !== 'new'
              ? () => {
                  if (confirm(`Delete "${editingReply.name}"?`)) {
                    replies.remove(editingReply.id);
                    setEditingReply(null);
                  }
                }
              : undefined
          }
          onClose={() => setEditingReply(null)}
        />
      )}
    </div>
  );
}