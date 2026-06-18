'use client';

import { useState, useRef, useEffect } from 'react';
import { useMessages } from '@/hooks/useMessages';
import { clsx } from 'clsx';
import { Send, Bot, Zap, Paperclip, Smile } from 'lucide-react';
import { format } from 'date-fns';
import type { Conversation } from '@/types';

interface MessageThreadProps {
  conversation: Conversation;
  businessId: string;
}

export function MessageThread({ conversation, businessId }: MessageThreadProps) {
  const { messages, loading, sendMessage } = useMessages(conversation.id);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when conversation changes
  useEffect(() => {
    inputRef.current?.focus();
    setDraft('');
  }, [conversation.id]);

  const handleSend = async () => {
    if (!draft.trim() || sending) return;

    setSending(true);
    try {
      await sendMessage(
        businessId,
        draft.trim(),
        conversation.customer_instagram_id
      );
      setDraft('');
    } catch (err) {
      console.error('Failed to send:', err);
    }
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-3"
      >
        {messages.map((msg, i) => {
          const isCustomer = msg.sender_type === 'customer';
          const isBot = msg.sender_type === 'bot';
          const showTimestamp =
            i === 0 ||
            new Date(msg.created_at).getTime() -
              new Date(messages[i - 1].created_at).getTime() >
              5 * 60 * 1000;

          return (
            <div key={msg.id}>
              {/* Timestamp separator */}
              {showTimestamp && (
                <div className="flex justify-center py-2">
                  <span className="rounded-full bg-surface-overlay px-3 py-1 text-[10px] text-ink-muted">
                    {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                  </span>
                </div>
              )}

              {/* Message bubble */}
              <div
                className={clsx(
                  'flex animate-slide-up',
                  isCustomer ? 'justify-start' : 'justify-end'
                )}
              >
                <div
                  className={clsx(
                    'max-w-[70%] rounded-2xl px-4 py-2.5',
                    isCustomer &&
                      'bg-surface-overlay text-ink rounded-bl-md',
                    isBot &&
                      'bg-bot-light text-ink border border-bot/10 rounded-br-md',
                    msg.sender_type === 'human' &&
                      'bg-accent text-white rounded-br-md'
                  )}
                >
                  {/* Bot indicator */}
                  {isBot && (
                    <div className="mb-1 flex items-center gap-1">
                      <Zap className="h-3 w-3 text-bot" />
                      <span className="text-[10px] font-medium text-bot">
                        Auto-reply
                      </span>
                    </div>
                  )}

                  {/* Message content */}
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {msg.content}
                  </p>

                  {/* Quick replies */}
                  {msg.quick_replies && msg.quick_replies.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {msg.quick_replies.map((qr: any, idx: number) => (
                        <span
                          key={idx}
                          className="rounded-full border border-current/20 px-3 py-1 text-xs"
                        >
                          {qr.label}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Timestamp */}
                  <p
                    className={clsx(
                      'mt-1 text-[10px]',
                      isCustomer && 'text-ink-muted',
                      isBot && 'text-bot/60',
                      msg.sender_type === 'human' && 'text-white/60'
                    )}
                  >
                    {format(new Date(msg.created_at), 'h:mm a')}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2 rounded-xl border border-border bg-surface-raised p-2 focus-within:border-accent transition-colors">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
            rows={1}
            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-ink-muted"
            style={{
              minHeight: '36px',
              maxHeight: '120px',
              height: 'auto',
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            className={clsx(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
              draft.trim() && !sending
                ? 'bg-accent text-white hover:bg-accent-hover'
                : 'bg-surface-overlay text-ink-muted'
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}
