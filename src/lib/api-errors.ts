// One place that turns errors into friendly API responses
import { NextResponse } from 'next/server';
import { AuthError } from '@/lib/owner';
import { ShopifyError } from '@/lib/shopify-admin';
import { ValidationError } from '@/lib/sales-server';

export function apiError(err: any, where: string) {
  if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
  if (err instanceof ShopifyError) return NextResponse.json({ error: err.message }, { status: 502 });
  console.error(`[${where}]`, err);
  return NextResponse.json({ error: 'Something went wrong. Try again.' }, { status: 500 });
}