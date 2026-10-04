// ============================================
// /api/shopify/connect
// GET    : is Shopify connected, and to which store (no secrets returned)
// POST   : connect with a Dev Dashboard app's details, then sync products
// DELETE : disconnect (products stay until the next connection)
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { AuthError, requireOwner } from '@/lib/owner';
import { normalizeShopDomain, testShopify, ShopifyError } from '@/lib/shopify-admin';
import { syncCatalog } from '@/lib/shopify-catalog';

export const maxDuration = 60;

function fail(err: any) {
  if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof ShopifyError) return NextResponse.json({ error: err.message }, { status: 400 });
  console.error('[shopify/connect]', err);
  return NextResponse.json({ error: 'Something went wrong. Try again.' }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const { businessId } = await requireOwner(request, request.nextUrl.searchParams.get('businessId'));
    const { data } = await supabaseAdmin
      .from('shop_connections')
      .select('shop_domain, shop_name, connected_at, last_synced_at, last_sync_error')
      .eq('business_id', businessId)
      .maybeSingle();
    const { count } = await supabaseAdmin
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('status', 'active');
    return NextResponse.json({ connection: data || null, productCount: count || 0 });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { businessId } = await requireOwner(request, body.businessId);

    const domain = normalizeShopDomain(String(body.shopDomain || ''));
    const clientId = String(body.clientId || '').trim();
    const clientSecret = String(body.clientSecret || '').trim();
    if (!domain || !clientId || !clientSecret) {
      return NextResponse.json({ error: 'Fill in the store, client ID and client secret.' }, { status: 400 });
    }

    // Check the details actually work before saving them
    const test = await testShopify(domain, clientId, clientSecret);

    const { error } = await supabaseAdmin.from('shop_connections').upsert({
      business_id: businessId,
      provider: 'shopify',
      shop_domain: domain,
      shop_name: test.shopName,
      auth_mode: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      access_token: test.token,
      token_expires_at: test.expiresAt.toISOString(),
      location_id: test.locationId,
      connected_at: new Date().toISOString(),
      last_sync_error: null,
    });
    if (error) throw error;

    // Keep the old Settings field in step, so the rest of the app knows
    await supabaseAdmin.from('businesses').update({ shopify_store_url: domain }).eq('id', businessId);

    let synced = null;
    let syncError = null;
    try {
      synced = await syncCatalog(businessId);
    } catch (err: any) {
      syncError = String(err?.message || err);
    }

    return NextResponse.json({ shopName: test.shopName, location: test.locationName, synced, syncError });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { businessId } = await requireOwner(request, request.nextUrl.searchParams.get('businessId'));
    await supabaseAdmin.from('shop_connections').delete().eq('business_id', businessId);
    await supabaseAdmin.from('businesses').update({ shopify_store_url: null }).eq('id', businessId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}