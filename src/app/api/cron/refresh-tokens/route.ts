// ============================================
// INSTAGRAM TOKEN REFRESH (runs weekly via Vercel Cron, see vercel.json)
// Long-lived Instagram tokens last 60 days. Refreshing them weekly
// keeps them alive indefinitely, as long as the account stays connected.
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { refreshLongLivedToken } from '@/lib/instagram';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Vercel sends "Authorization: Bearer <CRON_SECRET>" on cron runs
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: businesses, error } = await supabaseAdmin
    .from('businesses')
    .select('id, instagram_username, instagram_access_token')
    .not('instagram_access_token', 'is', null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: { business: string; ok: boolean; error?: string }[] = [];

  for (const business of businesses || []) {
    try {
      const refreshed = await refreshLongLivedToken(business.instagram_access_token);
      const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

      await supabaseAdmin
        .from('businesses')
        .update({
          instagram_access_token: refreshed.access_token,
          instagram_token_expires_at: expiresAt,
        })
        .eq('id', business.id);

      results.push({ business: business.instagram_username || business.id, ok: true });
    } catch (err: any) {
      const message = String(err?.message || err);
      await supabaseAdmin
        .from('webhook_logs')
        .insert({ body: null, error: `Token refresh failed for ${business.id}: ${message}` });
      results.push({ business: business.instagram_username || business.id, ok: false, error: message });
    }
  }

  return NextResponse.json({ refreshed: results });
}
