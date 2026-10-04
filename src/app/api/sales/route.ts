import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner';
import { createSale, validateSale } from '@/lib/sales-server';
import { apiError } from '@/lib/api-errors';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { businessId, userId } = await requireOwner(request, body.businessId);
    const input = validateSale(body);
    const result = await createSale(businessId, userId, input);
    return NextResponse.json(result);
  } catch (err) {
    return apiError(err, 'sales');
  }
}