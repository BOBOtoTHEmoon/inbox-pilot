// ============================================
// SHOPIFY ADMIN CONNECTION (one per business)
// Server only: never import this into a page or component.
//
// Each business stores its own Shopify details in shop_connections.
// Today they connect with the client ID and secret from a Shopify Dev
// Dashboard app (24-hour tokens, refreshed automatically). An OAuth
// "Connect Shopify" button for other stores can be added later without
// changing anything that uses this file.
// ============================================

import { supabaseAdmin } from '@/lib/supabase';

export const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2026-07';
const TIMEOUT_MS = 8000;

export class ShopifyError extends Error {
  constructor(message: string, public detail?: unknown) {
    super(message);
    this.name = 'ShopifyError';
  }
}

// Accepts "auraup", "auraup.myshopify.com", "https://auraup.myshopify.com/"
// or an admin link like "admin.shopify.com/store/auraup"
export function normalizeShopDomain(input: string): string {
  let d = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const adminMatch = d.match(/admin\.shopify\.com\/store\/([a-z0-9-]+)/);
  if (adminMatch) d = adminMatch[1];
  d = d.split('/')[0];
  if (!d.includes('.')) d = `${d}.myshopify.com`;
  return d;
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new ShopifyError('Shopify took too long to answer. Try again.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Swap a Dev Dashboard app's client ID and secret for a 24-hour token
export async function requestClientCredentialsToken(domain: string, clientId: string, clientSecret: string) {
  const res = await fetchWithTimeout(`https://${domain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const raw = await res.text();

  if (!res.ok) {
    if (raw.includes('shop_not_permitted')) {
      throw new ShopifyError(
        'Shopify refused: the app and the store must be in the same Dev Dashboard organisation, and the app must be installed on this store.'
      );
    }
    if (raw.includes('invalid_client')) {
      throw new ShopifyError('Shopify rejected the client ID or secret. Copy both again from the app settings.');
    }
    if (res.status === 404) {
      throw new ShopifyError('No Shopify store found at that address. Check the store domain.');
    }
    throw new ShopifyError(`Shopify token request failed (${res.status})`, raw);
  }

  const parsed = JSON.parse(raw) as { access_token?: string; expires_in?: number };
  if (!parsed.access_token) throw new ShopifyError('Shopify did not return an access token', parsed);
  return {
    token: parsed.access_token,
    expiresAt: new Date(Date.now() + (parsed.expires_in ?? 86399) * 1000),
  };
}

async function graphqlRequest<T>(domain: string, token: string, query: string, variables: Record<string, unknown>) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetchWithTimeout(`https://${domain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
      body: JSON.stringify({ query, variables }),
    });

    if (res.status === 401) throw new ShopifyError('UNAUTHORIZED');
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      continue;
    }

    const json = (await res.json()) as { data?: T; errors?: { message: string; extensions?: any }[] };
    const throttled = json.errors?.some((e) => e.extensions?.code === 'THROTTLED');
    if (throttled) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      continue;
    }
    if (json.errors?.length) {
      const message = json.errors.map((e) => e.message).join('; ');
      if (/access denied|scope/i.test(message)) {
        throw new ShopifyError(
          'The Shopify app is missing a permission. It needs read_products, read_inventory, write_inventory, read_locations and read_orders.',
          json.errors
        );
      }
      throw new ShopifyError(message, json.errors);
    }
    return json.data as T;
  }
  throw new ShopifyError('Shopify is busy right now. Try again in a moment.');
}

// Tokens kept in memory between requests on the same server instance
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

interface Connection {
  business_id: string;
  shop_domain: string;
  shop_name: string | null;
  auth_mode: 'client_credentials' | 'oauth';
  client_id: string | null;
  client_secret: string | null;
  access_token: string | null;
  token_expires_at: string | null;
  location_id: string | null;
  preorder_tags: string[];
}

export async function getConnection(businessId: string): Promise<Connection | null> {
  const { data } = await supabaseAdmin
    .from('shop_connections')
    .select('*')
    .eq('business_id', businessId)
    .maybeSingle();
  return (data as Connection) || null;
}

async function tokenFor(conn: Connection, forceRefresh = false): Promise<string> {
  const cached = tokenCache.get(conn.business_id);
  if (!forceRefresh && cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;

  if (!forceRefresh && conn.access_token && conn.token_expires_at) {
    const expiresAt = new Date(conn.token_expires_at).getTime();
    if (expiresAt - 60_000 > Date.now()) {
      tokenCache.set(conn.business_id, { token: conn.access_token, expiresAt });
      return conn.access_token;
    }
  }

  if (conn.auth_mode === 'oauth') {
    if (!conn.access_token) throw new ShopifyError('Shopify needs to be connected again.');
    return conn.access_token;
  }

  const { token, expiresAt } = await requestClientCredentialsToken(
    conn.shop_domain,
    conn.client_id || '',
    conn.client_secret || ''
  );
  tokenCache.set(conn.business_id, { token, expiresAt: expiresAt.getTime() });
  await supabaseAdmin
    .from('shop_connections')
    .update({ access_token: token, token_expires_at: expiresAt.toISOString() })
    .eq('business_id', conn.business_id);
  return token;
}

// A GraphQL client for one business's store
export async function shopForBusiness(businessId: string) {
  const conn = await getConnection(businessId);
  if (!conn) throw new ShopifyError('Shopify is not connected for this business.');

  return {
    connection: conn,
    graphql: async <T>(query: string, variables: Record<string, unknown> = {}): Promise<T> => {
      try {
        return await graphqlRequest<T>(conn.shop_domain, await tokenFor(conn), query, variables);
      } catch (err: any) {
        if (err?.message === 'UNAUTHORIZED') {
          // Token went stale early: get a fresh one and try once more
          return graphqlRequest<T>(conn.shop_domain, await tokenFor(conn, true), query, variables);
        }
        throw err;
      }
    },
  };
}

// Used when connecting: checks the details work and finds the shop's name and location
export async function testShopify(domain: string, clientId: string, clientSecret: string) {
  const { token, expiresAt } = await requestClientCredentialsToken(domain, clientId, clientSecret);
  const data = await graphqlRequest<{
    shop: { name: string };
    locations: { nodes: { id: string; name: string; isActive: boolean }[] };
  }>(
    domain,
    token,
    `query { shop { name } locations(first: 10) { nodes { id name isActive } } }`,
    {}
  );
  const location = data.locations.nodes.find((l) => l.isActive) || data.locations.nodes[0];
  return {
    token,
    expiresAt,
    shopName: data.shop.name,
    locationId: location?.id || null,
    locationName: location?.name || null,
  };
}