import crypto from 'crypto';

// How long a connect link stays valid (so you can send it to a client)
const LINK_VALID_DAYS = 7;

export const INSTAGRAM_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
  'instagram_business_manage_comments',
].join(',');

export function getAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
}

export function getRedirectUri(): string {
  return `${getAppUrl()}/api/auth/instagram/callback`;
}

function sign(payload: string): string {
  const secret = process.env.INSTAGRAM_APP_SECRET;
  if (!secret) throw new Error('INSTAGRAM_APP_SECRET is not set');
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

// state = base64url({ b: businessId, t: createdAt }) + "." + signature
export function createState(businessId: string): string {
  const payload = Buffer.from(JSON.stringify({ b: businessId, t: Date.now() })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function readState(state: string | null): { businessId: string } | null {
  if (!state || !state.includes('.')) return null;
  const [payload, signature] = state.split('.');
  const expected = sign(payload);
  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    const ageMs = Date.now() - Number(data.t);
    if (!data.b || ageMs > LINK_VALID_DAYS * 24 * 60 * 60 * 1000) return null;
    return { businessId: String(data.b) };
  } catch {
    return null;
  }
}

// The Instagram login page the user is sent to
export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID || '',
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: INSTAGRAM_SCOPES,
    state,
    // Always ask which account to use, so a browser already logged in
    // to a different Instagram doesn't connect the wrong one
    force_reauth: 'true',
  });
  return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
}