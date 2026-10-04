// POST /api/sales/void: cancel a sale and put its stock back in Shopify
import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner';
import { voidSale } from '@/lib/sales-server';
import { apiError } from '@/lib/api-errors';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { businessId } = await requireOwner(request, body.businessId);
    return NextResponse.json(await voidSale(businessId, String(body.saleId || ''), body.reason || null));
  } catch (err) {
    return apiError(err, 'sales/void');
  }
}