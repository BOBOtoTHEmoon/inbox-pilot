// ============================================
// Checks that a request comes from the logged-in owner of a business.
// Used by every API route that changes a business's data.
// ============================================

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export class AuthError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function requireOwner(request: NextRequest, businessId: string | undefined | null) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new AuthError('Not logged in', 401);

  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!userData?.user) throw new AuthError('Not logged in', 401);
  if (!businessId) throw new AuthError('Missing businessId', 400);

  const { data: business } = await supabaseAdmin
    .from('businesses')
    .select('id, owner_id')
    .eq('id', businessId)
    .maybeSingle();

  if (!business || business.owner_id !== userData.user.id) {
    throw new AuthError('Not allowed', 403);
  }
  return { userId: userData.user.id, businessId: business.id as string };
}