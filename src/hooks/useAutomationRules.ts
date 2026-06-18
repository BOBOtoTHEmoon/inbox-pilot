'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { MOCK_RULES } from '@/lib/mock-data';
import type { AutomationRule } from '@/types';

export function useAutomationRules(businessId: string) {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRules = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setRules(MOCK_RULES);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('business_id', businessId)
      .order('priority', { ascending: false });

    setRules(data || []);
    setLoading(false);
  }, [businessId]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const createRule = async (rule: Partial<AutomationRule>) => {
    if (!isSupabaseConfigured) {
      const newRule = { ...rule, id: `demo-${Date.now()}`, business_id: businessId, stats: { triggered_count: 0, last_triggered_at: null }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as AutomationRule;
      setRules((prev) => [newRule, ...prev]);
      return { data: newRule, error: null };
    }
    const { data, error } = await supabase.from('automation_rules').insert({ ...rule, business_id: businessId }).select().single();
    if (!error && data) setRules((prev) => [data as AutomationRule, ...prev]);
    return { data, error };
  };

  const updateRule = async (ruleId: string, updates: Partial<AutomationRule>) => {
    if (!isSupabaseConfigured) {
      setRules((prev) => prev.map((r) => r.id === ruleId ? { ...r, ...updates } as AutomationRule : r));
      return { data: updates, error: null };
    }
    const { data, error } = await supabase.from('automation_rules').update(updates).eq('id', ruleId).select().single();
    if (!error && data) setRules((prev) => prev.map((r) => (r.id === ruleId ? (data as AutomationRule) : r)));
    return { data, error };
  };

  const deleteRule = async (ruleId: string) => {
    if (!isSupabaseConfigured) {
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
      return { error: null };
    }
    const { error } = await supabase.from('automation_rules').delete().eq('id', ruleId);
    if (!error) setRules((prev) => prev.filter((r) => r.id !== ruleId));
    return { error };
  };

  const toggleRule = async (ruleId: string) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) return;
    return updateRule(ruleId, { is_active: !rule.is_active });
  };

  return { rules, loading, createRule, updateRule, deleteRule, toggleRule, refetch: fetchRules };
}
