'use client';

import { useState, useRef, useEffect, Fragment } from 'react';
import { clsx } from 'clsx';
import { ArrowUp, Instagram } from 'lucide-react';
import { useMessages } from '@/hooks/useMessages';
import type { Conversation, Message } from '@/types';
import { getReplyWindow } from '@/lib/labels';
import { describeAttachments } from '@/lib/attachments';
import { clockTime, dayLabel } from '@/lib/time';
import { AttachmentView } from './AttachmentView';
import { instagramDmLink } from './ConversationHeader';

interface MessageThreadProps {
  conversation: Conversation;
  businessId: string;
  now: number;
}

// Messages from the same side within 5 minutes are drawn as one group
const GROUP_GAP_MS = 5 * 60 * 1000;

function sameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

// The text Instagram gives for a media-only message is just a description
// (like "Photo"), so it isn't shown as a separate bubble
function isOnlyDescription(msg: Message) {
  const attachments = msg.attachments || [];
  if (msg.content === '[attachment]') return true;
  return attachments.length > 0 && msg.content === describeAttachments(attachments);
}

export function MessageThread({ conversation, businessId, now }: MessageThreadProps) {
  const { messages, loading, sendMessage } = useMessages(conversation.id);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const replyWindow = getReplyWindow(conversation, now);

  // Keep the newest message in view
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Fresh composer for each conversation
  useEffect(() => {
    setDraft('');
    setSendError(null);
    if (window.matchMedia('(min-width: 768px)').matches) inputRef.current?.focus();
  }, [conversation.id]);

  const resizeInput = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await sendMessage(businessId, text, conversation.customer_instagram_id);
      setDraft('');
      requestAnimationFrame(resizeInput);
    } catch (err: any) {
      setSendError(err?.message || 'Message not sent. Check your connection and try again.');
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

  return (
    <>
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin bg-surface">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-ink border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-ink-muted">
            No messages saved for this conversation yet.
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col px-4 py-6 md:px-8">
            {messages.map((msg, i) => {
              const prev = messages[i - 1];
              const next = messages[i + 1];
              const fromUs = msg.sender_type !== 'customer';
              const isBot = msg.sender_type === 'bot';

              const newDay = !prev || !sameDay(prev.created_at, msg.created_at);
              const sameSideAsPrev =
                !!prev &&
                !newDay &&
                (prev.sender_type !== 'customer') === fromUs &&
                new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < GROUP_GAP_MS;
              const lastInGroup =
                !next ||
                !sameDay(next.created_at, msg.created_at) ||
                (next.sender_type !== 'customer') !== fromUs ||
                new Date(next.created_at).getTime() - new Date(msg.created_at).getTime() >= GROUP_GAP_MS;

              const attachments = msg.attachments || [];
              const showText = !isOnlyDescription(msg);
              const missingMedia = msg.content === '[attachment]' && attachments.length === 0;

              return (
                <Fragment key={msg.id}>
                  {newDay && (
                    <div className="my-4 flex justify-center first:mt-0">
                      <span className="text-xs font-medium text-ink-faint">{dayLabel(msg.created_at, now)}</span>
                    </div>
                  )}

                  <div
                    className={clsx(
                      'flex flex-col animate-slide-up',
                      fromUs ? 'items-end' : 'items-start',
                      sameSideAsPrev ? 'mt-0.5' : 'mt-3'
                    )}
                  >
                    {isBot && !sameSideAsPrev && (
                      <span className="mb-1 text-[11px] font-medium text-bot">Auto-reply</span>
                    )}

                    {attachments.map((a, idx) => (
                      <div key={idx} className="mb-0.5">
                        <AttachmentView attachment={a} fromUs={fromUs} />
                      </div>
                    ))}

                    {missingMedia && (
                      <a
                        href={instagramDmLink(conversation.customer_username)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-2xl border border-dashed border-border-strong px-3.5 py-2 text-[13px] text-ink-muted hover:bg-surface-raised"
                      >
                        Photo or post, open in Instagram to view
                      </a>
                    )}

                    {showText && (
                      <div
                        className={clsx(
                          'max-w-[85%] md:max-w-[70%] whitespace-pre-wrap break-words px-3.5 py-2 text-[14px] leading-relaxed',
                          'rounded-[18px]',
                          fromUs && !isBot && 'bg-ink text-white',
                          isBot && 'bg-bot-light text-ink',
                          !fromUs && 'bg-surface-overlay text-ink',
                          lastInGroup && (fromUs ? 'rounded-br-md' : 'rounded-bl-md')
                        )}
                      >
                        {msg.content}
                      </div>
                    )}

                    {lastInGroup && (
                      <span className="mt-1 px-1 text-[11px] tabular-nums text-ink-faint">
                        {clockTime(msg.created_at)}
                      </span>
                    )}
                  </div>
                </Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* Composer, or a pointer to the Instagram app once the 24-hour window has closed */}
      <div className="shrink-0 border-t border-border bg-surface px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-5">
        <div className="mx-auto max-w-3xl">
          {replyWindow.closed ? (
            <div className="flex flex-col gap-3 rounded-xl bg-surface-raised px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13px] leading-relaxed text-ink-muted">
                It has been over 24 hours since their last message, so Instagram only allows a reply
                from the Instagram app. It will still show up here.
              </p>
              <a
                href={instagramDmLink(conversation.customer_username)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-ink px-3.5 py-2 text-[13px] font-medium text-white hover:bg-accent-hover transition-colors"
              >
                <Instagram className="h-4 w-4" />
                Reply in Instagram
              </a>
            </div>
          ) : (
            <>
              <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface px-3 py-2 focus-within:border-border-strong transition-colors">
                <label htmlFor="composer" className="sr-only">
                  Reply to {conversation.customer_name || conversation.customer_username}
                </label>
                <textarea
                  id="composer"
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    resizeInput();
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Write a reply"
                  rows={1}
                  className="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent py-1.5 text-base md:text-[14px] leading-relaxed outline-none focus-visible:outline-none placeholder:text-ink-faint"
                />
                <button
                  onClick={handleSend}
                  disabled={!draft.trim() || sending}
                  aria-label="Send reply"
                  className={clsx(
                    'mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
                    draft.trim() && !sending ? 'bg-ink text-white hover:bg-accent-hover' : 'bg-surface-overlay text-ink-faint'
                  )}
                >
                  <ArrowUp className="h-4 w-4" strokeWidth={2.4} />
                </button>
              </div>
              <div className="mt-1.5 flex items-center justify-between px-1 text-[11px]">
                {sendError ? (
                  <span className="text-danger">{sendError}</span>
                ) : (
                  <span className={clsx(replyWindow.tone === 'urgent' ? 'text-danger' : replyWindow.tone === 'soon' ? 'text-warning' : 'text-ink-faint')}>
                    {replyWindow.text}
                  </span>
                )}
                <span className="hidden text-ink-faint md:inline">Enter to send, Shift + Enter for a new line</span>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}