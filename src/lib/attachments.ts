// ============================================
// ATTACHMENTS
// Instagram describes photos, videos, shared posts, reels and story replies
// in different shapes depending on where they come from (live webhook or
// the conversations API). These helpers turn both into one simple list.
// ============================================

import type { MessageAttachment } from '@/types';

type AttachmentType = MessageAttachment['type'];

const WEBHOOK_TYPES: Record<string, AttachmentType> = {
  image: 'image',
  video: 'video',
  audio: 'audio',
  file: 'file',
  share: 'share',
  ig_reel: 'reel',
  reel: 'reel',
  story_mention: 'story_mention',
};

// From a live webhook message
export function attachmentsFromWebhook(message?: {
  attachments?: { type: string; payload: { url: string; title?: string } }[];
  reply_to?: { story?: { url: string } };
}): MessageAttachment[] {
  const list: MessageAttachment[] = [];

  for (const a of message?.attachments || []) {
    if (!a?.payload?.url) continue;
    list.push({
      type: WEBHOOK_TYPES[a.type] || 'file',
      url: a.payload.url,
      title: a.payload.title,
    });
  }

  if (message?.reply_to?.story?.url) {
    list.push({ type: 'story_reply', url: message.reply_to.story.url });
  }

  return list;
}

// From the conversations API (used by the import)
export function attachmentsFromApi(m: any): MessageAttachment[] {
  const list: MessageAttachment[] = [];

  for (const a of m?.attachments?.data || []) {
    if (a?.image_data?.url) {
      list.push({ type: 'image', url: a.image_data.url });
    } else if (a?.video_data?.url) {
      list.push({ type: 'video', url: a.video_data.url });
    } else if (a?.file_url) {
      const isAudio = String(a?.mime_type || '').startsWith('audio');
      list.push({ type: isAudio ? 'audio' : 'file', url: a.file_url, title: a?.name });
    }
  }

  for (const s of m?.shares?.data || []) {
    if (s?.link) list.push({ type: 'share', url: s.link, title: s?.name });
  }

  if (m?.story?.reply_to?.link) {
    list.push({ type: 'story_reply', url: m.story.reply_to.link });
  }
  if (m?.story?.mention?.link) {
    list.push({ type: 'story_mention', url: m.story.mention.link });
  }

  return list;
}

// Short text for list previews, e.g. "Photo" or "Shared a reel"
export function describeAttachments(list: MessageAttachment[]): string {
  const first = list[0];
  if (!first) return 'Attachment';
  switch (first.type) {
    case 'image':
      return list.length > 1 ? `${list.length} photos` : 'Photo';
    case 'video':
      return 'Video';
    case 'audio':
      return 'Voice message';
    case 'share':
      return 'Shared a post';
    case 'reel':
      return 'Shared a reel';
    case 'story_reply':
      return 'Replied to your story';
    case 'story_mention':
      return 'Mentioned you in their story';
    default:
      return 'Attachment';
  }
}