// ============================================
// POST /api/instagram/import
// Lets the logged-in owner re-import recent DMs from Settings.
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { importRecentConversations } from '@/lib/instagram-import';

// Importing can take a while (one request per conversation)
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const accessToken = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: userData } = await supabaseAdmin.auth.getUser(accessToken);
  if (!userData?.user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
  }

  const { businessId } = await request.json().catch(() => ({}));
  const { data: business } = await supabaseAdmin
    .from('businesses')
    .select('id, owner_id')
    .eq('id', businessId)
    .maybeSingle();

  if (!business || business.owner_id !== userData.user.id) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  }

  try {
    const result = await importRecentConversations(business.id);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}