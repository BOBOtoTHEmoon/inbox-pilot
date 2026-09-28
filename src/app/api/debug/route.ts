// TEMPORARY DEBUG ROUTE: delete this file once the webhook works.
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const info: Record<string, any> = {
    supabaseUrl: url || 'MISSING',
    serviceKeySet: !!key,
    // Only the first 10 characters, safe to share
    serviceKeyStart: key ? key.slice(0, 10) : null,
    verifyTokenSet: !!process.env.INSTAGRAM_VERIFY_TOKEN,
  };

  if (!url || !key) return NextResponse.json(info);

  const supabase = createClient(url, key);

  const { error: insertError } = await supabase
    .from('webhook_logs')
    .insert({ body: { object: 'debug_route' } });
  info.insertError = insertError ? insertError.message : null;

  const { data: businesses, error: bizError } = await supabase
    .from('businesses')
    .select('id, instagram_account_id, instagram_username');
  info.businesses = businesses;
  info.businessesError = bizError ? bizError.message : null;

  return NextResponse.json(info);
}