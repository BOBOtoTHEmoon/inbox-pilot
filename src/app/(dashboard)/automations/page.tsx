'use client';

import { useState } from 'react';
import { useAutomationRules } from '@/hooks/useAutomationRules';
import { RuleCard } from '@/components/automations/RuleCard';
import { RuleEditor } from '@/components/automations/RuleEditor';
import { Plus, Zap } from 'lucide-react';
import type { AutomationRule } from '@/types';

const BUSINESS_ID = process.env.NEXT_PUBLIC_BUSINESS_ID || 'demo';

export default function AutomationsPage() {
  const { rules, loading, createRule, updateRule, deleteRule, toggleRule } =
    useAutomationRules(BUSINESS_ID);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const activeCount = rules.filter((r) => r.is_active).length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold">Automations</h1>
          <span className="rounded-full bg-success-light px-2 py-0.5 text-[11px] font-medium text-success">
            {activeCount} active
          </span>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Rule
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 rounded-2xl bg-bot-light p-4">
              <Zap className="h-8 w-8 text-bot" />
            </div>
            <h2 className="text-lg font-semibold">No automation rules yet</h2>
            <p className="mt-1 max-w-sm text-sm text-ink-muted">
              Create rules to automatically reply to DMs based on keywords,
              comments, story replies, or business hours.
            </p>
            <button
              onClick={() => setIsCreating(true)}
              className="mt-4 flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create your first rule
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {rules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                onEdit={() => setEditingRule(rule)}
                onToggle={() => toggleRule(rule.id)}
                onDelete={() => {
                  if (confirm(`Delete "${rule.name}"?`)) deleteRule(rule.id);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Rule Editor Modal */}
      {(isCreating || editingRule) && (
        <RuleEditor
          rule={editingRule}
          onSave={async (data) => {
            if (editingRule) {
              await updateRule(editingRule.id, data);
            } else {
              await createRule(data);
            }
            setEditingRule(null);
            setIsCreating(false);
          }}
          onClose={() => {
            setEditingRule(null);
            setIsCreating(false);
          }}
        />
      )}
    </div>
  );
}
