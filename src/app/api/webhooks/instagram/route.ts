// ============================================
// INSTAGRAM WEBHOOK HANDLER
// POST /api/webhooks/instagram
// GET  /api/webhooks/instagram (verification)
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getInstagramProfile, verifyWebhook } from '@/lib/instagram';
import { processIncomingMessage, logAnalyticsEvent } from '@/lib/automation-engine';
import type { IGWebhookEvent, IGMessagingEvent, IGChangeEvent } from '@/types';

// ── Webhook Verification (GET) ──
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (!mode || !token || !challenge) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const result = verifyWebhook(mode, token, challenge, process.env.INSTAGRAM_VERIFY_TOKEN!);

  if (result) {
    console.log('[Webhook] Verified successfully');
    return new NextResponse(result, { status: 200 });
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// ── Webhook Events (POST) ──
export async function POST(request: NextRequest) {
  try {
    const body: IGWebhookEvent = await request.json();

    // Always respond 200 quickly — Meta retries on failure
    // Process asynchronously
    handleWebhookEvent(body).catch((err) => {
      console.error('[Webhook] Processing error:', err);
    });

    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (error) {
    console.error('[Webhook] Parse error:', error);
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  }
}

// ── Process Webhook Events ──
async function handleWebhookEvent(event: IGWebhookEvent) {
  if (event.object !== 'instagram') return;

  for (const entry of event.entry) {
    // Handle DMs
    if (entry.messaging) {
      for (const messagingEvent of entry.messaging) {
        await handleMessagingEvent(messagingEvent, entry.id);
      }
    }

    // Handle comment events (for comment-to-DM)
    if (entry.changes) {
      for (const change of entry.changes) {
        if (change.field === 'comments') {
          await handleCommentEvent(change.value, entry.id);
        }
      }
    }
  }
}

// ── Handle Incoming DM ──
async function handleMessagingEvent(event: IGMessagingEvent, igAccountId: string) {
  // Skip if this is our own message (echo)
  if (event.sender.id === igAccountId) return;

  // Skip postbacks for now (handle quick_reply payloads)
  const messageText = event.message?.text
    || event.message?.quick_reply?.payload
    || '';

  if (!messageText && !event.message?.attachments) return;

  console.log(`[Webhook] DM from ${event.sender.id}: "${messageText}"`);

  // 1. Find the business by IG account ID
  const { data: business } = await supabaseAdmin
    .from('businesses')
    .select('*')
    .eq('instagram_account_id', igAccountId)
    .single();

  if (!business) {
    console.error(`[Webhook] No business found for IG account: ${igAccountId}`);
    return;
  }

  // 2. Find or create conversation
  const { conversation, isFirstMessage } = await findOrCreateConversation(
    business.id,
    event.sender.id,
    business.instagram_access_token
  );

  // 3. Save incoming message
  await supabaseAdmin.from('messages').insert({
    conversation_id: conversation.id,
    business_id: business.id,
    instagram_message_id: event.message?.mid || null,
    sender_type: 'customer',
    content: messageText || '[attachment]',
    message_type: event.message?.attachments ? 'image' : 'text',
    attachments: event.message?.attachments?.map((a) => ({
      type: a.type,
      url: a.payload.url,
    })) || [],
  });

  // 4. Log analytics
  await logAnalyticsEvent(business.id, 'message_received', {
    conversation_id: conversation.id,
    metadata: { sender_ig_id: event.sender.id, has_text: !!messageText },
  });

  // 5. Run automation engine
  if (conversation.assigned_to === 'bot') {
    const result = await processIncomingMessage(
      {
        senderIgId: event.sender.id,
        text: messageText,
        businessId: business.id,
        conversationId: conversation.id,
        isFirstMessage,
        timestamp: event.timestamp,
      },
      {
        id: business.id,
        instagram_account_id: business.instagram_account_id,
        instagram_access_token: business.instagram_access_token,
        timezone: business.timezone,
        business_hours_start: business.business_hours_start,
        business_hours_end: business.business_hours_end,
        away_message: business.away_message,
      }
    );

    if (!result.handled) {
      console.log(`[Webhook] No automation matched for: "${messageText}"`);
      // Message stays in inbox for Ebuka to handle manually
    }
  } else {
    console.log(`[Webhook] Conversation assigned to human, skipping automation`);
  }
}

// ── Handle Comment (for comment-to-DM) ──
async function handleCommentEvent(
  comment: IGChangeEvent['value'],
  igAccountId: string
) {
  console.log(`[Webhook] Comment from @${comment.from.username}: "${comment.text}"`);

  // 1. Find the business
  const { data: business } = await supabaseAdmin
    .from('businesses')
    .select('*')
    .eq('instagram_account_id', igAccountId)
    .single();

  if (!business) return;

  // 2. Find matching comment-to-DM rules
  const { data: rules } = await supabaseAdmin
    .from('automation_rules')
    .select('*')
    .eq('business_id', business.id)
    .eq('trigger_type', 'comment')
    .eq('is_active', true)
    .order('priority', { ascending: false });

  if (!rules || rules.length === 0) return;

  for (const rule of rules) {
    const config = rule.trigger_config;
    const keywords: string[] = config.keywords || [];

    // Check if comment matches keywords
    const commentLower = comment.text.toLowerCase();
    const matches = keywords.some((kw: string) =>
      commentLower.includes(kw.toLowerCase())
    );

    if (!matches) continue;

    // Check if rule is limited to specific posts
    if (config.post_ids && config.post_ids.length > 0) {
      if (!config.post_ids.includes(comment.media.id)) continue;
    }

    // Check cooldown
    const { data: existingCooldown } = await supabaseAdmin
      .from('automation_cooldowns')
      .select('triggered_at')
      .eq('automation_rule_id', rule.id)
      .eq('customer_instagram_id', comment.from.id)
      .single();

    if (existingCooldown) {
      const cooldownEnd = new Date(
        new Date(existingCooldown.triggered_at).getTime() + rule.cooldown_minutes * 60 * 1000
      );
      if (new Date() < cooldownEnd) continue;
    }

    // Send private reply (comment-to-DM)
    if (rule.response) {
      try {
        // Instagram Private Replies API sends a DM triggered by a comment
        const { sendPrivateReply } = await import('@/lib/instagram');
        await sendPrivateReply({
          commentId: comment.id,
          message: rule.response.content,
          accessToken: business.instagram_access_token,
        });

        // Set cooldown
        await supabaseAdmin.from('automation_cooldowns').upsert(
          {
            automation_rule_id: rule.id,
            customer_instagram_id: comment.from.id,
            business_id: business.id,
            triggered_at: new Date().toISOString(),
          },
          { onConflict: 'automation_rule_id,customer_instagram_id' }
        );

        // Log analytics
        await logAnalyticsEvent(business.id, 'comment_to_dm', {
          automation_rule_id: rule.id,
          metadata: {
            comment_text: comment.text,
            commenter: comment.from.username,
            post_id: comment.media.id,
          },
        });

        console.log(`[Webhook] Sent private reply to @${comment.from.username}`);
        break; // Only send one reply per comment
      } catch (err) {
        console.error('[Webhook] Private reply failed:', err);
      }
    }
  }
}

// ── Helpers ──

async function findOrCreateConversation(
  businessId: string,
  customerIgId: string,
  accessToken: string
): Promise<{ conversation: any; isFirstMessage: boolean }> {
  // Try to find existing conversation
  const { data: existing } = await supabaseAdmin
    .from('conversations')
    .select('*')
    .eq('business_id', businessId)
    .eq('customer_instagram_id', customerIgId)
    .single();

  if (existing) {
    // Reopen if closed
    if (existing.status === 'closed') {
      await supabaseAdmin
        .from('conversations')
        .update({ status: 'open', assigned_to: 'bot' })
        .eq('id', existing.id);
    }
    return { conversation: existing, isFirstMessage: false };
  }

  // Fetch customer profile from Instagram
  let profile = { id: customerIgId, username: 'unknown', name: null, profile_picture_url: null };
  try {
    profile = await getInstagramProfile(customerIgId, accessToken) as any;
  } catch (err) {
    console.error('[Webhook] Failed to fetch customer profile:', err);
  }

  // Create new conversation
  const { data: newConversation, error } = await supabaseAdmin
    .from('conversations')
    .insert({
      business_id: businessId,
      customer_instagram_id: customerIgId,
      customer_username: profile.username,
      customer_name: (profile as any).name || null,
      customer_profile_pic: (profile as any).profile_picture_url || null,
      status: 'open',
      assigned_to: 'bot',
    })
    .select()
    .single();

  if (error) {
    console.error('[Webhook] Failed to create conversation:', error);
    throw error;
  }

  // Log new conversation
  await logAnalyticsEvent(businessId, 'conversation_opened', {
    conversation_id: newConversation.id,
    metadata: { customer_username: profile.username },
  });

  return { conversation: newConversation, isFirstMessage: true };
}
