'use client';

// Saved replies: answers written once and inserted into any chat by typing "/"

import { useCallback, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { ReplyTemplate } from '@/types';

const DEMO: ReplyTemplate[] = [
  {
    id: 'demo-t1',
    business_id: 'demo',
    name: 'Delivery fees',
    shortcut: 'delivery',
    content: 'Hi {name}! Delivery within Lagos is ₦3,000 and takes 1 to 2 working days. Other states are ₦5,000 and take 3 to 5 days.',
    category: 'general',
    variables: [],
    use_count: 4,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-t2',
    business_id: 'demo',
    name: 'Payment details',
    shortcut: 'pay',
    content: 'You can pay by transfer to AuraUp, Moniepoint 1234567890. Send the receipt here and we will confirm your order.',
    category: 'general',
    variables: [],
    use_count: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// "Delivery fees" -> "delivery-fees"
export function toShortcut(text: string) {
  return text
    .toLowerCase()
    .replace(/^\/+/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

export function useReplyTemplates(businessId: string) {
  const [templates, setTemplates] = useState<ReplyTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setTemplates(DEMO);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('reply_templates')
      .select('*')
      .eq('business_id', businessId)
      .order('use_count', { ascending: false });
    setTemplates((data as ReplyTemplate[]) || []);
    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  // Returns an error message, or null when it worked
  const save = async (
    fields: { name: string; shortcut: string; content: string },
    id?: string
  ): Promise<string | null> => {
    const row = { ...fields, shortcut: toShortcut(fields.shortcut || fields.name) };
    if (!isSupabaseConfigured) {
      setTemplates((prev) =>
        id
          ? prev.map((t) => (t.id === id ? { ...t, ...row } : t))
          : [{ ...DEMO[0], ...row, id: `demo-${Date.now()}`, use_count: 0 }, ...prev]
      );
      return null;
    }
    const query = id
      ? supabase.from('reply_templates').update(row).eq('id', id).select().single()
      : supabase.from('reply_templates').insert({ ...row, business_id: businessId }).select().single();
    const { data, error } = await query;
    if (error) {
      return error.code === '23505'
        ? `You already have a saved reply called /${row.shortcut}. Pick another shortcut.`
        : 'Could not save. Check your connection and try again.';
    }
    setTemplates((prev) =>
      id ? prev.map((t) => (t.id === id ? (data as ReplyTemplate) : t)) : [data as ReplyTemplate, ...prev]
    );
    return null;
  };

  const remove = async (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    if (isSupabaseConfigured) await supabase.from('reply_templates').delete().eq('id', id);
  };

  // Count uses so the most useful replies float to the top
  const markUsed = (template: ReplyTemplate) => {
    if (!isSupabaseConfigured) return;
    supabase
      .from('reply_templates')
      .update({ use_count: (template.use_count || 0) + 1 })
      .eq('id', template.id)
      .then(() => {});
  };

  return { templates, loading, save, remove, markUsed };
}

// Fill in {name} with the customer's first name
export function fillTemplate(content: string, customerName?: string | null) {
  const first = (customerName || '').replace(/[^\p{L}\p{N} '-]/gu, '').trim().split(/\s+/)[0] || '';
  return content.replace(/\{name\}/gi, first).replace(/\s+([!,.])/g, '$1').replace(/Hi !/g, 'Hi!');
}