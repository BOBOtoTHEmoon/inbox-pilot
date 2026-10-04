// Short, scannable times for the inbox: "4m", "3h", "Mon", "Sep 26"
export function shortTime(date: string | number | Date, now: number = Date.now()): string {
  const t = new Date(date).getTime();
  const diff = Math.max(0, now - t);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return 'now';
  if (diff < hour) return `${Math.floor(diff / minute)}m`;
  if (diff < day) return `${Math.floor(diff / hour)}h`;
  if (diff < 7 * day) return new Date(t).toLocaleDateString('en-GB', { weekday: 'short' });
  return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// "for 2 days", "for 5 hours"
export function quietFor(date: string | number | Date, now: number = Date.now()): string {
  const hours = Math.floor((now - new Date(date).getTime()) / (60 * 60 * 1000));
  if (hours < 48) return `${Math.max(1, hours)} hours`;
  return `${Math.floor(hours / 24)} days`;
}

// Separators inside a chat: "Today", "Yesterday", "Friday 26 September"
export function dayLabel(date: string | number | Date, now: number = Date.now()): string {
  const d = new Date(date);
  const today = new Date(now);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(today) - startOf(d)) / (24 * 60 * 60 * 1000));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
  });
}

export function clockTime(date: string | number | Date): string {
  return new Date(date).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
}
// "just now", "5m ago", "3h ago"
export function timeAgo(date: string | number | Date, now: number = Date.now()): string {
  const short = shortTime(date, now);
  return short === 'now' ? 'just now' : `${short} ago`;
}