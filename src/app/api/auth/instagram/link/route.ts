// ============================================
// POST /api/auth/instagram/link
// Gives the logged-in owner a "Connect Instagram" link for their business.
// They can open it themselves or send it to the client to open on their phone.
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createState, getAppUrl } from '@/lib/instagram-connect';

export async function POST(request: NextRequest) {
  const accessToken = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!accessToken) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
  }

  const { businessId } = await request.json().catch(() => ({}));
  if (!businessId) {
    return NextResponse.json({ error: 'Missing businessId' }, { status: 400 });
  }

  const { data: business } = await supabaseAdmin
    .from('businesses')
    .select('id, owner_id')
    .eq('id', businessId)
    .maybeSingle();

  if (!business || business.owner_id !== userData.user.id) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  }

  if (!process.env.INSTAGRAM_APP_ID || !getAppUrl()) {
    return NextResponse.json(
      { error: 'INSTAGRAM_APP_ID or NEXT_PUBLIC_APP_URL is not set in Vercel' },
      { status: 500 }
    );
  }

  const state = createState(business.id);
  const url = `${getAppUrl()}/api/auth/instagram/start?s=${encodeURIComponent(state)}`;
  return NextResponse.json({ url });
}