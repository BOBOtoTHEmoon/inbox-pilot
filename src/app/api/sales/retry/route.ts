// POST /api/sales/retry: push stock for sales Shopify missed (for example, a Wi-Fi drop)
import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner';
import { retryUnsynced } from '@/lib/sales-server';
import { apiError } from '@/lib/api-errors';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { businessId } = await requireOwner(request, body.businessId);
    return NextResponse.json(await retryUnsynced(businessId));
  } catch (err) {
    return apiError(err, 'sales/retry');
  }
}