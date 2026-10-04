// ============================================
// GET /api/customers/lookup?businessId=...&phone=...
// Finds a returning customer by phone, with what they have bought before
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireOwner } from '@/lib/owner';
import { normalizePhone } from '@/lib/phone';
import { apiError } from '@/lib/api-errors';

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const { businessId } = await requireOwner(request, params.get('businessId'));
    const phone = normalizePhone(params.get('phone'));
    if (!phone) return NextResponse.json({ customer: null });

    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('id, name, phone, email, instagram_username, notes')
      .eq('business_id', businessId)
      .eq('phone', phone)
      .maybeSingle();
    if (!customer) return NextResponse.json({ customer: null });

    const { data: sales } = await supabaseAdmin
      .from('sales')
      .select('total, created_at, sale_items(title, quantity)')
      .eq('customer_id', customer.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    const counts = new Map<string, number>();
    for (const s of sales || []) {
      for (const item of (s as any).sale_items || []) {
        counts.set(item.title, (counts.get(item.title) || 0) + item.quantity);
      }
    }
    const favourite = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    return NextResponse.json({
      customer: {
        ...customer,
        visits: sales?.length || 0,
        spent: (sales || []).reduce((sum, s: any) => sum + Number(s.total), 0),
        lastVisit: sales?.[0]?.created_at || null,
        favourite,
      },
    });
  } catch (err) {
    return apiError(err, 'customers/lookup');
  }
}