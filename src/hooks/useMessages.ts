'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { MOCK_MESSAGES } from '@/lib/mock-data';
import type { Message } from '@/types';

export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    // Demo mode
    if (!isSupabaseConfigured) {
      setMessages(MOCK_MESSAGES[conversationId] || []);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(100);

    setMessages(data || []);
    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    fetchMessages();
    if (!conversationId || !isSupabaseConfigured) return;

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, fetchMessages]);

  const sendMessage = async (businessId: string, content: string, igRecipientId: string) => {
    // Demo mode — just add to local state
    if (!isSupabaseConfigured) {
      const newMsg: Message = {
        id: `demo-${Date.now()}`,
        conversation_id: conversationId!,
        business_id: businessId,
        instagram_message_id: null,
        sender_type: 'human',
        content,
        message_type: 'text',
        attachments: [],
        quick_replies: null,
        automation_rule_id: null,
        delivered: true,
        read: true,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, newMsg]);
      return newMsg;
    }

    const { data: newMessage } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, business_id: businessId, sender_type: 'human', content, message_type: 'text' })
      .select()
      .single();

    await fetch('/api/instagram/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId, recipientId: igRecipientId, message: content }),
    });

    return newMessage;
  };

  return { messages, loading, sendMessage, refetch: fetchMessages };
}
