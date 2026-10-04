import { NextRequest, NextResponse } from 'next/server';
import { AuthError, requireOwner } from '@/lib/owner';
import { ShopifyError } from '@/lib/shopify-admin';
import { syncCatalog } from '@/lib/shopify-catalog';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { businessId } = await requireOwner(request, body.businessId);
    const result = await syncCatalog(businessId);
    return NextResponse.json(result);
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof ShopifyError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error('[shopify/sync]', err);
    return NextResponse.json({ error: 'Could not refresh products. Try again.' }, { status: 500 });
  }
}