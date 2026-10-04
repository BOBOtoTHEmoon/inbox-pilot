import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireOwner } from '@/lib/owner';
import { linkAll, linkConversation } from '@/lib/customers';
import { apiError } from '@/lib/api-errors';
import { ValidationError } from '@/lib/sales-server';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { businessId } = await requireOwner(request, body.businessId);

    if (body.conversationId) {
      const { data: conv } = await supabaseAdmin
        .from('conversations')
        .select('business_id')
        .eq('id', body.conversationId)
        .maybeSingle();
      if (!conv || conv.business_id !== businessId) throw new ValidationError('Conversation not found.');
      return NextResponse.json({ customerId: await linkConversation(body.conversationId) });
    }
    return NextResponse.json(await linkAll(businessId));
  } catch (err) {
    return apiError(err, 'customers/link');
  }
}