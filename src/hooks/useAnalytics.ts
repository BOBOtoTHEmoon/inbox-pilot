'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { MOCK_ANALYTICS } from '@/lib/mock-data';
import type { AnalyticsSummary } from '@/types';

type Period = 'today' | '7d' | '30d';

export function useAnalytics(businessId: string, period: Period = '7d') {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);

    // Demo mode
    if (!isSupabaseConfigured) {
      setSummary({ ...MOCK_ANALYTICS, period });
      setLoading(false);
      return;
    }

    const now = new Date();
    let startDate: Date;
    switch (period) {
      case 'today': startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
      case '7d': startDate = new Date(now.getTime() - 7 * 86400000); break;
      case '30d': startDate = new Date(now.getTime() - 30 * 86400000); break;
    }

    const { data: events } = await supabase
      .from('analytics_events')
      .select('*')
      .eq('business_id', businessId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (!events) { setLoading(false); return; }

    const messagesReceived = events.filter((e) => e.event_type === 'message_received');
    const botReplies = events.filter((e) => e.event_type === 'bot_reply_sent');
    const humanReplies = events.filter((e) => e.event_type === 'human_reply_sent');
    const automationsTriggered = events.filter((e) => e.event_type === 'automation_triggered');

    const keywordCounts: Record<string, number> = {};
    automationsTriggered.forEach((e) => {
      const name = e.metadata?.rule_name || 'Unknown';
      keywordCounts[name] = (keywordCounts[name] || 0) + 1;
    });
    const topAutomations = Object.entries(keywordCounts)
      .map(([rule_name, triggered]) => ({ rule_name, triggered }))
      .sort((a, b) => b.triggered - a.triggered).slice(0, 5);

    const hourlyMap: Record<number, number> = {};
    for (let h = 0; h < 24; h++) hourlyMap[h] = 0;
    messagesReceived.forEach((e) => { hourlyMap[new Date(e.created_at).getHours()]++; });

    const totalReplies = botReplies.length + humanReplies.length;

    setSummary({
      period,
      total_messages_received: messagesReceived.length,
      total_bot_replies: botReplies.length,
      total_human_replies: humanReplies.length,
      avg_response_time_seconds: 0,
      automation_rate: totalReplies > 0 ? Math.round((botReplies.length / totalReplies) * 100) : 0,
      top_keywords: [],
      top_automations: topAutomations,
      conversations_opened: events.filter((e) => e.event_type === 'conversation_opened').length,
      conversations_closed: events.filter((e) => e.event_type === 'conversation_closed').length,
      emails_collected: events.filter((e) => e.event_type === 'email_collected').length,
      products_sent: events.filter((e) => e.event_type === 'product_sent').length,
      hourly_volume: Object.entries(hourlyMap).map(([hour, count]) => ({ hour: Number(hour), count })),
    });
    setLoading(false);
  }, [businessId, period]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  return { summary, loading, refetch: fetchAnalytics };
}
