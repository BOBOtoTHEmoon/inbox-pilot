import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const businessId = request.nextUrl.searchParams.get('businessId');
  if (!businessId) return new NextResponse(null, { status: 404 });

  const { data } = await supabaseAdmin
    .from('businesses')
    .select('receipt_logo_url')
    .eq('id', businessId)
    .maybeSingle();
  if (!data?.receipt_logo_url) return new NextResponse(null, { status: 404 });

  try {
    const res = await fetch(data.receipt_logo_url);
    if (!res.ok) return new NextResponse(null, { status: 404 });
    const type = res.headers.get('content-type') || 'image/png';
    if (!type.startsWith('image/')) return new NextResponse(null, { status: 404 });
    return new NextResponse(await res.arrayBuffer(), {
      headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=3600' },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}