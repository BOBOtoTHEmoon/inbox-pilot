// ============================================
// GET /api/auth/instagram/start?s=<signed state>
// Opens Instagram's login page. This is the link that gets shared.
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { buildAuthorizeUrl, getAppUrl, readState } from '@/lib/instagram-connect';

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get('s');

  if (!readState(state)) {
    return NextResponse.redirect(
      `${getAppUrl()}/connected?error=${encodeURIComponent('This connect link is invalid or has expired. Ask for a new one.')}`
    );
  }

  return NextResponse.redirect(buildAuthorizeUrl(state!));
}