// ============================================
// INBOX LABELS
// Works out what each conversation needs, from who sent the last message
// and how long ago. No AI involved: these rules are always accurate.
// ============================================

import type { Conversation } from '@/types';

// A conversation needs a follow-up when the business replied last
// and the customer has gone quiet for this many hours
export const FOLLOW_UP_AFTER_HOURS = 24;

// Instagram only lets a business reply within 24 hours of the customer's last message
const INSTAGRAM_WINDOW_HOURS = 24;

export type InboxFilter = 'needs_reply' | 'follow_up' | 'all_open' | 'closed';

export interface ConversationLabel {
  key: 'needs_reply' | 'follow_up' | 'waiting';
  text: string;
  className: string;
}

const HOUR = 60 * 60 * 1000;

export function getConversationLabel(
  conv: Conversation,
  now: number = Date.now()
): ConversationLabel | null {
  if (conv.status === 'closed') return null;

  if (conv.last_sender_type === 'customer') {
    return {
      key: 'needs_reply',
      text: 'Needs reply',
      className: 'bg-red-50 text-red-700',
    };
  }

  if (conv.last_sender_type === 'human' || conv.last_sender_type === 'bot') {
    const quietFor = now - new Date(conv.last_message_at).getTime();
    if (quietFor >= FOLLOW_UP_AFTER_HOURS * HOUR) {
      return {
        key: 'follow_up',
        text: 'Follow up',
        className: 'bg-amber-50 text-amber-700',
      };
    }
    return {
      key: 'waiting',
      text: 'Replied',
      className: 'bg-surface-overlay text-ink-muted',
    };
  }

  return null;
}

// How long is left to reply on Instagram, e.g. "5h left to reply" or "Reply window closed"
export function getReplyWindowText(
  conv: Conversation,
  now: number = Date.now()
): string | null {
  if (!conv.last_customer_message_at) return null;

  const closesAt =
    new Date(conv.last_customer_message_at).getTime() + INSTAGRAM_WINDOW_HOURS * HOUR;
  const left = closesAt - now;

  if (left <= 0) return 'Reply window closed';
  const hours = Math.floor(left / HOUR);
  if (hours >= 1) return `${hours}h left to reply`;
  return `${Math.max(1, Math.floor(left / 60000))}m left to reply`;
}

export function matchesFilter(conv: Conversation, filter: InboxFilter, now: number): boolean {
  if (filter === 'closed') return conv.status === 'closed';
  if (conv.status === 'closed') return false;
  if (filter === 'all_open') return true;
  return getConversationLabel(conv, now)?.key === filter;
}