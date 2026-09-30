import { clsx } from 'clsx';
import { Instagram, Mail, Store, Globe } from 'lucide-react';

export type Channel = 'instagram' | 'whatsapp' | 'email' | 'store' | 'website';

export const CHANNEL_NAMES: Record<Channel, string> = {
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  email: 'Email',
  store: 'In store',
  website: 'Website',
};

// Small channel marks. Instagram and WhatsApp keep a hint of their own colour
// so they can be told apart at a glance; the rest stay neutral.
export function ChannelIcon({ channel, className }: { channel: Channel; className?: string }) {
  const size = clsx('h-3.5 w-3.5 shrink-0', className);
  if (channel === 'instagram') return <Instagram className={clsx(size, 'text-[#b1307a]')} aria-hidden="true" />;
  if (channel === 'email') return <Mail className={clsx(size, 'text-ink-muted')} aria-hidden="true" />;
  if (channel === 'store') return <Store className={clsx(size, 'text-ink-muted')} aria-hidden="true" />;
  if (channel === 'website') return <Globe className={clsx(size, 'text-ink-muted')} aria-hidden="true" />;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={clsx(size, 'text-[#1f8f4e]')} aria-hidden="true">
      <path d="M3 21l1.65-4.8A8.5 8.5 0 1 1 7.9 19.5z" />
      <path d="M9 9.5c.3 2.2 2.3 4.3 4.5 4.8l1-1.1 1.8.8-.3 1.5c-3.6.3-7.3-3.3-7.1-6.9l1.5-.3.8 1.8z" />
    </svg>
  );
}