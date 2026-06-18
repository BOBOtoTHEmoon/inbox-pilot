// ============================================
// SHOPIFY PRODUCT SYNC API
// POST /api/shopify/sync
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { syncShopifyProducts } from '@/lib/shopify';

export async function POST(request: NextRequest) {
  try {
    const { businessId } = await request.json();

    if (!businessId) {
      return NextResponse.json({ error: 'Missing businessId' }, { status: 400 });
    }

    // Get business Shopify credentials
    const { data: business } = await supabaseAdmin
      .from('businesses')
      .select('shopify_store_url, shopify_access_token')
      .eq('id', businessId)
      .single();

    if (!business?.shopify_store_url || !business?.shopify_access_token) {
      return NextResponse.json(
        { error: 'Shopify not configured for this business' },
        { status: 400 }
      );
    }

    const count = await syncShopifyProducts(businessId, {
      storeUrl: business.shopify_store_url,
      accessToken: business.shopify_access_token,
    });

    return NextResponse.json({ success: true, productssynced: count });
  } catch (error: any) {
    console.error('[API] Shopify sync error:', error);
    return NextResponse.json(
      { error: error.message || 'Sync failed' },
      { status: 500 }
    );
  }
}
