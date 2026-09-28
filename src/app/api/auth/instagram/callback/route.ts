import { NextRequest, NextResponse, after } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getLongLivedToken } from '@/lib/instagram';
import { getAppUrl, getRedirectUri, readState } from '@/lib/instagram-connect';
import { importRecentConversations } from '@/lib/instagram-import';

// Connecting also imports recent DMs, which can take a little while
export const maxDuration = 60;
const GRAPH = 'https://graph.instagram.com/v21.0';

function finish(params: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  return NextResponse.redirect(`${getAppUrl()}/connected?${query}`);
}

async function logError(message: string) {
  try {
    await supabaseAdmin.from('webhook_logs').insert({ body: null, error: `Instagram connect: ${message}` });
  } catch {}
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  // The user tapped "Cancel" on Instagram
  if (params.get('error')) {
    return finish({ error: 'Instagram connection was cancelled.' });
  }

  const state = readState(params.get('state'));
  if (!state) {
    return finish({ error: 'This connect link is invalid or has expired. Ask for a new one.' });
  }

  // Instagram sometimes adds "#_" to the end of the code
  const code = (params.get('code') || '').replace(/#_$/, '');
  if (!code) {
    return finish({ error: 'Instagram did not return a login code. Please try again.' });
  }

  try {
    // 1. Swap the code for a short-lived token
    const form = new URLSearchParams({
      client_id: process.env.INSTAGRAM_APP_ID || '',
      client_secret: process.env.INSTAGRAM_APP_SECRET || '',
      grant_type: 'authorization_code',
      redirect_uri: getRedirectUri(),
      code,
    });
    const shortRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      body: form,
    });
    const shortJson = await shortRes.json();
    if (!shortRes.ok) {
      throw new Error(`Code exchange failed: ${JSON.stringify(shortJson)}`);
    }
    // Instagram returns either { access_token } or { data: [{ access_token }] }
    const shortToken: string = shortJson.access_token || shortJson.data?.[0]?.access_token;
    if (!shortToken) throw new Error(`No token in response: ${JSON.stringify(shortJson)}`);

    // 2. Swap for a 60-day token
    const longLived = await getLongLivedToken(shortToken);
    const token = longLived.access_token;
    const expiresAt = new Date(Date.now() + longLived.expires_in * 1000).toISOString();

    // 3. Get the account ID that webhooks use, plus the username
    const meRes = await fetch(`${GRAPH}/me?fields=user_id,username&access_token=${token}`);
    const me = await meRes.json();
    if (!meRes.ok || !me.user_id) {
      throw new Error(`Could not read account: ${JSON.stringify(me)}`);
    }

    // 4. Turn on DM and comment webhooks for this account
    const subRes = await fetch(
      `${GRAPH}/me/subscribed_apps?subscribed_fields=messages,comments&access_token=${token}`,
      { method: 'POST' }
    );
    const subJson = await subRes.json();
    if (!subRes.ok || !subJson.success) {
      throw new Error(`Webhook subscription failed: ${JSON.stringify(subJson)}`);
    }

    // 5. Stop if this Instagram is already connected to a different business
    const { data: other } = await supabaseAdmin
      .from('businesses')
      .select('id')
      .eq('instagram_account_id', String(me.user_id))
      .neq('id', state.businessId)
      .maybeSingle();
    if (other) {
      return finish({ error: `@${me.username} is already connected to another business.` });
    }

    // 6. Save it on the business
    const { error: saveError } = await supabaseAdmin
      .from('businesses')
      .update({
        instagram_account_id: String(me.user_id),
        instagram_username: me.username,
        instagram_access_token: token,
        instagram_token_expires_at: expiresAt,
      })
      .eq('id', state.businessId);
        if (saveError) throw new Error(`Saving failed: ${saveError.message}`);

        // 7. Bring in recent DMs in the background, so the person sees
    //    "connected" straight away instead of waiting for the import.
    //    If it fails, the account is still connected; it can be re-run from Settings.
    const businessId = state.businessId;
    after(async () => {
      try {
        await importRecentConversations(businessId);
      } catch (importErr: any) {
        await logError(`Import after connect failed: ${String(importErr?.message || importErr)}`);
      }
    });

    return finish({ username: me.username, importing: '1' });
  } catch (err: any) {
    const message = String(err?.message || err);
    console.error('[Instagram connect]', message);
    await logError(message);
    return finish({ error: 'Something went wrong connecting Instagram. Please try again.' });
  }
}