// ============================================
// UTILITY HELPERS
// ============================================

import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';

/**
 * Smart timestamp: "2m" / "5h" / "Yesterday" / "Jun 5"
 */
export function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);

  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  if (isYesterday(date)) return 'Yesterday';
  if (date.getFullYear() === now.getFullYear()) return format(date, 'MMM d');
  return format(date, 'MMM d, yyyy');
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + '...';
}

/**
 * Extract initials from a name
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Debounce helper
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Generate a random verify token
 */
export function generateVerifyToken(): string {
  return `inboxpilot_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

/**
 * Parse order number from customer message
 * Matches patterns like: #1001, 1001, order 1001, AUP-1001
 */
export function extractOrderNumber(text: string): string | null {
  const patterns = [
    /#(\d{3,})/,           // #1001
    /order\s*#?\s*(\d{3,})/i, // order 1001, order #1001
    /AUP-?(\d{3,})/i,     // AUP-1001, AUP1001
    /\b(\d{4,6})\b/,      // standalone 4-6 digit number
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Parse email from customer message
 */
export function extractEmail(text: string): string | null {
  const match = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  return match ? match[0].toLowerCase() : null;
}

/**
 * Parse phone number from customer message (Nigerian format)
 */
export function extractPhone(text: string): string | null {
  const match = text.match(/(?:\+234|0)[789]\d{9}/);
  return match ? match[0] : null;
}

/**
 * Format naira amount
 */
export function formatNaira(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `₦${num.toLocaleString('en-NG')}`;
}
