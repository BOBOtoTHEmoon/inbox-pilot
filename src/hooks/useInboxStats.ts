'use client';
import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { MOCK_MESSAGES } from '@/lib/mock-data';

export type StatsPeriod = 'today' | '7d' | '30d';

interface Row {
  conversation_id: string;
  sender_type: 'customer' | 'bot' | 'human';
  created_at: string;
}

export interface InboxStats {
  received: number;
  replied: number;
  autoReplied: number;
  people: number;
  // Share of people who messaged and got at least one reply
  replyRate: number | null;
  // Typical time between a customer's message and the first reply, in minutes
  medianResponseMinutes: number | null;
  hourly: number[];
  daily: { date: string; received: number; replied: number }[];
  busiestHour: number | null;
}

function startOf(period: StatsPeriod): Date {
  const now = new Date();
  if (period === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = period === '7d' ? 6 : 29;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function computeStats(rows: Row[], period: StatsPeriod): InboxStats {
  const start = startOf(period);
  const inPeriod = rows.filter((r) => new Date(r.created_at) >= start);

  const hourly = Array(24).fill(0);
  const dayMap = new Map<string, { date: string; received: number; replied: number }>();
  const dayCount = period === 'today' ? 1 : period === '7d' ? 7 : 30;
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    dayMap.set(dayKey(d), { date: d.toISOString(), received: 0, replied: 0 });
  }

  let received = 0;
  let replied = 0;
  let autoReplied = 0;

  for (const r of inPeriod) {
    const d = new Date(r.created_at);
    const bucket = dayMap.get(dayKey(d));
    if (r.sender_type === 'customer') {
      received++;
      hourly[d.getHours()]++;
      if (bucket) bucket.received++;
    } else {
      replied++;
      if (r.sender_type === 'bot') autoReplied++;
      if (bucket) bucket.replied++;
    }
  }

  // Response times and reply rate, per conversation, in time order
  const byConversation = new Map<string, Row[]>();
  for (const r of inPeriod) {
    const list = byConversation.get(r.conversation_id) || [];
    list.push(r);
    byConversation.set(r.conversation_id, list);
  }

  const delays: number[] = [];
  let people = 0;
  let peopleAnswered = 0;

  byConversation.forEach((list) => {
    list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    let waitingSince: number | null = null;
    let hadCustomer = false;
    let answered = false;
    for (const r of list) {
      const t = new Date(r.created_at).getTime();
      if (r.sender_type === 'customer') {
        hadCustomer = true;
        if (waitingSince === null) waitingSince = t;
      } else if (waitingSince !== null) {
        delays.push((t - waitingSince) / 60000);
        waitingSince = null;
        answered = true;
      }
    }
    if (hadCustomer) {
      people++;
      if (answered) peopleAnswered++;
    }
  });

  delays.sort((a, b) => a - b);
  const median = delays.length ? delays[Math.floor(delays.length / 2)] : null;
  const maxHour = Math.max(...hourly);

  return {
    received,
    replied,
    autoReplied,
    people,
    replyRate: people ? Math.round((peopleAnswered / people) * 100) : null,
    medianResponseMinutes: median,
    hourly,
    daily: Array.from(dayMap.values()),
    busiestHour: maxHour > 0 ? hourly.indexOf(maxHour) : null,
  };
}

export function useInboxStats(businessId: string, period: StatsPeriod) {
  const [stats, setStats] = useState<InboxStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      let rows: Row[] = [];

      if (!isSupabaseConfigured) {
        rows = Object.values(MOCK_MESSAGES).flat() as Row[];
      } else {
        const { data } = await supabase
          .from('messages')
          .select('conversation_id, sender_type, created_at')
          .eq('business_id', businessId)
          .gte('created_at', startOf('30d').toISOString())
          .order('created_at', { ascending: true })
          .limit(10000);
        rows = (data as Row[]) || [];
      }

      if (!cancelled) {
        setStats(computeStats(rows, period));
        setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [businessId, period]);

  return { stats, loading };
}