// ============================================
// /api/staff: the people who sell in the shop
// GET list, POST { name } to add, PATCH { id, is_active } to hide or bring back
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireOwner } from '@/lib/owner';
import { apiError } from '@/lib/api-errors';
import { ValidationError } from '@/lib/sales-server';

export async function GET(request: NextRequest) {
  try {
    const { businessId } = await requireOwner(request, request.nextUrl.searchParams.get('businessId'));
    const { data } = await supabaseAdmin
      .from('staff')
      .select('id, name, is_active')
      .eq('business_id', businessId)
      .order('name');
    return NextResponse.json({ staff: data || [] });
  } catch (err) {
    return apiError(err, 'staff');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { businessId } = await requireOwner(request, body.businessId);
    const name = String(body.name || '').trim().slice(0, 80);
    if (!name) throw new ValidationError('Type a name.');
    const { data, error } = await supabaseAdmin
      .from('staff')
      .insert({ business_id: businessId, name })
      .select('id, name, is_active')
      .single();
    if (error) throw error;
    return NextResponse.json({ staff: data });
  } catch (err) {
    return apiError(err, 'staff');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { businessId } = await requireOwner(request, body.businessId);
    const { error } = await supabaseAdmin
      .from('staff')
      .update({ is_active: !!body.is_active })
      .eq('id', body.id)
      .eq('business_id', businessId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, 'staff');
  }
}