'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { MOCK_CONVERSATIONS } from '@/lib/mock-data';
import type { Conversation } from '@/types';

interface UseConversationsOptions {
  businessId: string;
  status?: 'open' | 'closed' | 'snoozed' | 'all';
}

export function useConversations({ businessId, status = 'open' }: UseConversationsOptions) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    // Demo mode — use mock data
    if (!isSupabaseConfigured) {
      const filtered = status === 'all'
        ? MOCK_CONVERSATIONS
        : MOCK_CONVERSATIONS.filter((c) => c.status === status);
      setConversations(filtered);
      setLoading(false);
      return;
    }

    let query = supabase
      .from('conversations')
      .select('*')
      .eq('business_id', businessId)
      .order('last_message_at', { ascending: false })
      .limit(50);

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error: fetchError } = await query;
    if (fetchError) setError(fetchError.message);
    else setConversations(data || []);
    setLoading(false);
  }, [businessId, status]);

  useEffect(() => {
    fetchConversations();

    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel(`conversations:${businessId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'conversations',
        filter: `business_id=eq.${businessId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setConversations((prev) => [payload.new as Conversation, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setConversations((prev) =>
            prev.map((c) => (c.id === payload.new.id ? (payload.new as Conversation) : c))
              .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
          );
        } else if (payload.eventType === 'DELETE') {
          setConversations((prev) => prev.filter((c) => c.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [businessId, status, fetchConversations]);

  // Actions (no-op in demo mode)
  const markAsRead = async (conversationId: string) => {
    if (!isSupabaseConfigured) {
      setConversations((prev) => prev.map((c) => c.id === conversationId ? { ...c, is_read: true } : c));
      return;
    }
    await supabase.from('conversations').update({ is_read: true }).eq('id', conversationId);
  };

  const closeConversation = async (conversationId: string) => {
    if (!isSupabaseConfigured) {
      setConversations((prev) => prev.map((c) => c.id === conversationId ? { ...c, status: 'closed' as const } : c));
      return;
    }
    await supabase.from('conversations').update({ status: 'closed' }).eq('id', conversationId);
  };

  const assignToHuman = async (conversationId: string) => {
    if (!isSupabaseConfigured) {
      setConversations((prev) => prev.map((c) => c.id === conversationId ? { ...c, assigned_to: 'human' as const } : c));
      return;
    }
    await supabase.from('conversations').update({ assigned_to: 'human' }).eq('id', conversationId);
  };

  const assignToBot = async (conversationId: string) => {
    if (!isSupabaseConfigured) {
      setConversations((prev) => prev.map((c) => c.id === conversationId ? { ...c, assigned_to: 'bot' as const } : c));
      return;
    }
    await supabase.from('conversations').update({ assigned_to: 'bot' }).eq('id', conversationId);
  };

  const addTag = async (conversationId: string, tag: string) => {
    const conv = conversations.find((c) => c.id === conversationId);
    if (!conv) return;
    const newTags = [...new Set([...conv.tags, tag])];
    if (!isSupabaseConfigured) {
      setConversations((prev) => prev.map((c) => c.id === conversationId ? { ...c, tags: newTags } : c));
      return;
    }
    await supabase.from('conversations').update({ tags: newTags }).eq('id', conversationId);
  };

  const unreadCount = conversations.filter((c) => !c.is_read).length;

  return { conversations, loading, error, unreadCount, markAsRead, closeConversation, assignToHuman, assignToBot, addTag, refetch: fetchConversations };
}
