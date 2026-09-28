'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { Film, Image as ImageIcon, Link2, CircleDashed, FileText } from 'lucide-react';
import type { MessageAttachment } from '@/types';

const CARD_COPY: Partial<Record<MessageAttachment['type'], { label: string; icon: typeof Film }>> = {
  share: { label: 'Shared a post', icon: Link2 },
  reel: { label: 'Shared a reel', icon: Film },
  story_reply: { label: 'Replied to your story', icon: CircleDashed },
  story_mention: { label: 'Mentioned you in their story', icon: CircleDashed },
  file: { label: 'Sent a file', icon: FileText },
};

// Shows one photo, video, voice note, shared post, reel or story reply
export function AttachmentView({
  attachment,
  fromUs,
}: {
  attachment: MessageAttachment;
  fromUs: boolean;
}) {
  const [broken, setBroken] = useState(false);

  if (attachment.type === 'image' && !broken) {
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={attachment.url}
          alt="Photo sent in the chat"
          onError={() => setBroken(true)}
          className="max-h-80 w-auto max-w-[min(260px,100%)] rounded-2xl border border-border object-cover"
        />
      </a>
    );
  }

  if (attachment.type === 'video' && !broken) {
    return (
      <video
        src={attachment.url}
        controls
        preload="metadata"
        onError={() => setBroken(true)}
        className="max-h-80 max-w-[min(260px,100%)] rounded-2xl border border-border bg-ink"
      />
    );
  }

  if (attachment.type === 'audio' && !broken) {
    return <audio src={attachment.url} controls onError={() => setBroken(true)} className="h-10 max-w-[260px]" />;
  }

  // Everything else, and media whose link has expired, shows as a small card
  const copy =
    broken || attachment.type === 'image' || attachment.type === 'video' || attachment.type === 'audio'
      ? { label: 'Media no longer available here', icon: ImageIcon }
      : CARD_COPY[attachment.type] || { label: 'Attachment', icon: FileText };
  const Icon = copy.icon;

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className={clsx(
        'flex w-60 max-w-full items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors',
        fromUs
          ? 'border-ink bg-ink text-white hover:bg-accent-hover'
          : 'border-border bg-surface text-ink hover:bg-surface-raised'
      )}
    >
      <span
        className={clsx(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
          fromUs ? 'bg-white/10' : 'bg-surface-overlay'
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium">{attachment.title || copy.label}</span>
        <span className={clsx('block text-xs', fromUs ? 'text-white/60' : 'text-ink-muted')}>
          Open in Instagram
        </span>
      </span>
    </a>
  );
}