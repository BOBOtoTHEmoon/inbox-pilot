import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner';
import { readLocationStock, setLocationStock } from '@/lib/sales-server';
import { apiError } from '@/lib/api-errors';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { businessId } = await requireOwner(request, body.businessId);
    const ids = Array.isArray(body.inventoryItemIds) ? body.inventoryItemIds.map(String) : [];
    return NextResponse.json({ levels: await readLocationStock(businessId, ids) });
  } catch (err) {
    return apiError(err, 'stock');
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { businessId } = await requireOwner(request, body.businessId);
    const result = await setLocationStock(
      businessId,
      String(body.inventoryItemId || ''),
      Number(body.quantity),
      Number(body.expected)
    );
    return NextResponse.json(result);
  } catch (err) {
    return apiError(err, 'stock');
  }
}