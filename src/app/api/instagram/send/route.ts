// ============================================
// SEND INSTAGRAM MESSAGE API ROUTE
// POST /api/instagram/send
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendInstagramMessage } from '@/lib/instagram';
import { logAnalyticsEvent } from '@/lib/automation-engine';

export async function POST(request: NextRequest) {
  try {
    const { businessId, recipientId, message } = await request.json();

    if (!businessId || !recipientId || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get business credentials
    const { data: business } = await supabaseAdmin
      .from('businesses')
      .select('instagram_account_id, instagram_access_token')
      .eq('id', businessId)
      .single();

    if (!business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    // Send via Instagram
    const result = await sendInstagramMessage({
      recipientId,
      accessToken: business.instagram_access_token,
      igAccountId: business.instagram_account_id,
      message: { text: message },
    });

    // Log analytics
    await logAnalyticsEvent(businessId, 'human_reply_sent', {
      metadata: { recipient_id: recipientId },
    });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('[API] Send message error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send message' },
      { status: 500 }
    );
  }
}
