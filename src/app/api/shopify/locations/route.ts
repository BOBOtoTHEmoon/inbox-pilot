// ============================================
// /api/shopify/locations
// GET  : the store's Shopify locations, and which one the shop sells from
// POST : { locationId } to choose where in-store sales take stock from
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireOwner } from '@/lib/owner';
import { shopForBusiness } from '@/lib/shopify-admin';
import { apiError } from '@/lib/api-errors';
import { ValidationError } from '@/lib/sales-server';

export async function GET(request: NextRequest) {
  try {
    const { businessId } = await requireOwner(request, request.nextUrl.searchParams.get('businessId'));
    const shop = await shopForBusiness(businessId);
    const data = await shop.graphql<{ locations: { nodes: { id: string; name: string; isActive: boolean }[] } }>(
      `query { locations(first: 25) { nodes { id name isActive } } }`
    );
    return NextResponse.json({
      locations: data.locations.nodes.filter((l) => l.isActive),
      selected: shop.connection.location_id,
    });
  } catch (err) {
    return apiError(err, 'shopify/locations');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { businessId } = await requireOwner(request, body.businessId);
    const locationId = String(body.locationId || '');
    if (!locationId.startsWith('gid://shopify/Location/')) throw new ValidationError('Pick a location.');
    const { error } = await supabaseAdmin
      .from('shop_connections')
      .update({ location_id: locationId })
      .eq('business_id', businessId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, 'shopify/locations');
  }
}