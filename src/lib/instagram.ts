// ============================================
// INSTAGRAM GRAPH API CLIENT
// ============================================

const GRAPH_API_BASE = 'https://graph.instagram.com/v21.0';

interface SendMessageOptions {
  recipientId: string;
  accessToken: string;
  igAccountId: string;
  message: {
    text?: string;
    attachment?: {
      type: 'image' | 'video' | 'file';
      payload: { url: string };
    };
    quick_replies?: {
      content_type: 'text';
      title: string;
      payload: string;
    }[];
  };
}

interface IGProfile {
  id: string;
  username: string;
  name?: string;
  profile_picture_url?: string;
}

// ── Send a DM ──
export async function sendInstagramMessage(options: SendMessageOptions) {
  const { recipientId, accessToken, igAccountId, message } = options;

  const body: Record<string, any> = {
    recipient: { id: recipientId },
    message: {},
  };

  if (message.text) {
    body.message.text = message.text;
  }

  if (message.attachment) {
    body.message.attachment = message.attachment;
  }

  if (message.quick_replies) {
    body.message.quick_replies = message.quick_replies;
  }

  const response = await fetch(
    `${GRAPH_API_BASE}/${igAccountId}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    console.error('[IG API] Send message failed:', error);
    throw new Error(`Instagram API error: ${error.error?.message || 'Unknown error'}`);
  }

  return response.json();
}

// ── Send a Private Reply to a Comment (comment-to-DM) ──
export async function sendPrivateReply(options: {
  commentId: string;
  message: string;
  accessToken: string;
}) {
  const { commentId, message, accessToken } = options;

  const response = await fetch(
    `${GRAPH_API_BASE}/${commentId}/private_replies`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ message }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    console.error('[IG API] Private reply failed:', error);
    throw new Error(`Instagram API error: ${error.error?.message || 'Unknown error'}`);
  }

  return response.json();
}

// ── Get User Profile ──
export async function getInstagramProfile(
  userId: string,
  accessToken: string
): Promise<IGProfile> {
  const response = await fetch(
    `${GRAPH_API_BASE}/${userId}?fields=id,username,name,profile_picture_url`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    console.error('[IG API] Get profile failed:', error);
    // Return minimal info if profile fetch fails
    return { id: userId, username: 'unknown' };
  }

  return response.json();
}

// ── Verify Webhook (for initial setup) ──
export function verifyWebhook(
  mode: string,
  token: string,
  challenge: string,
  verifyToken: string
): string | null {
  if (mode === 'subscribe' && token === verifyToken) {
    return challenge;
  }
  return null;
}

// ── Exchange short-lived token for long-lived token ──
export async function getLongLivedToken(shortToken: string): Promise<{
  access_token: string;
  token_type: string;
  expires_in: number;
}> {
  const response = await fetch(
    `https://graph.instagram.com/access_token` +
      `?grant_type=ig_exchange_token` +
      `&client_secret=${process.env.INSTAGRAM_APP_SECRET}` +
      `&access_token=${shortToken}`
  );

  if (!response.ok) {
    throw new Error('Failed to exchange token');
  }

  return response.json();
}

// ── Refresh long-lived token (do this every 50 days) ──
export async function refreshLongLivedToken(token: string): Promise<{
  access_token: string;
  token_type: string;
  expires_in: number;
}> {
  const response = await fetch(
    `https://graph.instagram.com/refresh_access_token` +
      `?grant_type=ig_refresh_token` +
      `&access_token=${token}`
  );

  if (!response.ok) {
    throw new Error('Failed to refresh token');
  }

  return response.json();
}
