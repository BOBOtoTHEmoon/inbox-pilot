// ============================================
// SEND INSTAGRAM MESSAGE API ROUTE
// POST /api/instagram/send
// Only the logged-in owner of the business can send.
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendInstagramMessage } from '@/lib/instagram';
import { logAnalyticsEvent } from '@/lib/automation-engine';

export async function POST(request: NextRequest) {
  try {
    // 1. Check who is sending (Supabase login token from the dashboard)
    const authHeader = request.headers.get('authorization') || '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!accessToken) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    }

    const { businessId, conversationId, recipientId, message } = await request.json();

    if (!businessId || !conversationId || !recipientId || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 2. Make sure this user owns the business
    const { data: business } = await supabaseAdmin
      .from('businesses')
      .select('id, owner_id, instagram_account_id, instagram_access_token')
      .eq('id', businessId)
      .maybeSingle();

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }
    if (business.owner_id !== userData.user.id) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    // 3. Send via Instagram
    const result = await sendInstagramMessage({
      recipientId,
      accessToken: business.instagram_access_token,
      igAccountId: business.instagram_account_id,
      message: { text: message },
    });

    // 4. Save it with Instagram's message ID, so the echo webhook doesn't duplicate it
    const { data: saved } = await supabaseAdmin
      .from('messages')
      .upsert(
        {
          conversation_id: conversationId,
          business_id: businessId,
          instagram_message_id: result?.message_id || null,
          sender_type: 'human',
          content: message,
          message_type: 'text',
        },
        { onConflict: 'instagram_message_id' }
      )
      .select()
      .single();

    await logAnalyticsEvent(businessId, 'human_reply_sent', {
      conversation_id: conversationId,
      metadata: { recipient_id: recipientId },
    });

    return NextResponse.json({ success: true, message: saved });
  } catch (error: any) {
    console.error('[API] Send message error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send message' },
      { status: 500 }
    );
  }
}
