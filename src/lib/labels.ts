// ============================================
// INBOX LABELS
// Works out what each conversation needs, from who sent the last message
// and how long ago. No AI involved: these rules are always accurate.
// ============================================

import type { Conversation } from '@/types';

// A conversation needs a follow-up when the business replied last
// and the customer has gone quiet for this many hours
export const FOLLOW_UP_AFTER_HOURS = 24;

// Instagram only lets apps reply within 24 hours of the customer's last message
export const INSTAGRAM_WINDOW_HOURS = 24;

export type InboxFilter = 'needs_reply' | 'follow_up' | 'all_open' | 'closed';

export type LabelKey = 'needs_reply' | 'follow_up' | 'waiting';

export interface ConversationLabel {
  key: LabelKey;
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
    return { key: 'needs_reply', text: 'Needs reply', className: 'bg-danger-light text-danger' };
  }

  if (conv.last_sender_type === 'human' || conv.last_sender_type === 'bot') {
    const quietFor = now - new Date(conv.last_message_at).getTime();
    if (quietFor >= FOLLOW_UP_AFTER_HOURS * HOUR) {
      return { key: 'follow_up', text: 'Follow up', className: 'bg-warning-light text-warning' };
    }
    return { key: 'waiting', text: 'Replied', className: 'bg-surface-overlay text-ink-muted' };
  }

  return null;
}

export interface ReplyWindow {
  closed: boolean;
  // 1 = the full 24 hours left, 0 = no time left
  fraction: number;
  text: string;
  tone: 'calm' | 'soon' | 'urgent' | 'closed';
}

// How much of Instagram's 24-hour reply window is left
export function getReplyWindow(conv: Conversation, now: number = Date.now()): ReplyWindow {
  if (!conv.last_customer_message_at) {
    return { closed: true, fraction: 0, text: 'Reply in the Instagram app', tone: 'closed' };
  }

  const windowMs = INSTAGRAM_WINDOW_HOURS * HOUR;
  const left = new Date(conv.last_customer_message_at).getTime() + windowMs - now;

  if (left <= 0) {
    return { closed: true, fraction: 0, text: 'Reply in the Instagram app', tone: 'closed' };
  }

  const hours = Math.floor(left / HOUR);
  const text = hours >= 1 ? `${hours}h left to reply` : `${Math.max(1, Math.floor(left / 60000))}m left to reply`;
  const tone = left < HOUR ? 'urgent' : left < 6 * HOUR ? 'soon' : 'calm';

  return { closed: false, fraction: Math.min(1, left / windowMs), text, tone };
}

// Kept for older code: the same information as plain text
export function getReplyWindowText(conv: Conversation, now: number = Date.now()): string | null {
  if (!conv.last_customer_message_at) return null;
  const w = getReplyWindow(conv, now);
  return w.closed ? 'Reply window closed' : w.text;
}

export function matchesFilter(conv: Conversation, filter: InboxFilter, now: number): boolean {
  if (filter === 'closed') return conv.status === 'closed';
  if (conv.status === 'closed') return false;
  if (filter === 'all_open') return true;
  return getConversationLabel(conv, now)?.key === filter;
}


// AI buyer labels: what the person seems to want, read by Claude
export const AI_LABELS: Record<
  NonNullable<Conversation['ai_label']>,
  { text: string; className: string; strip: string }
> = {
  ready_to_buy: { text: 'Ready to buy', className: 'bg-success-light text-success', strip: 'bg-success-light text-success' },
  interested: { text: 'Interested', className: 'bg-[#eef2fd] text-[#2b4fc7]', strip: 'bg-[#eef2fd] text-[#2b4fc7]' },
  support: { text: 'Support', className: 'bg-surface-overlay text-ink-light', strip: 'bg-surface-raised text-ink-light' },
  browsing: { text: 'Just browsing', className: 'bg-surface-overlay text-ink-muted', strip: 'bg-surface-raised text-ink-muted' },
};