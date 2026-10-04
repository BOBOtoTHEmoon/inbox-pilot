'use client';

// ============================================
// Settings: connect a Shopify store, see its status, refresh products
// ============================================

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { ShoppingBag, RefreshCw } from 'lucide-react';
import { authHeaders, type ShopConnection } from '@/hooks/useCatalog';
import { isSupabaseConfigured } from '@/lib/supabase';
import { timeAgo } from '@/lib/time';

const buttonSecondary =
  'flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] font-medium text-ink hover:bg-surface-raised transition-colors disabled:opacity-60';
const buttonPrimary =
  'flex items-center justify-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-[13px] font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-60';
const field =
  'h-10 w-full rounded-lg border border-border bg-surface px-3 text-base md:text-sm outline-none focus-visible:outline-none focus:border-ink placeholder:text-ink-faint';

export function ShopifySection({ businessId }: { businessId: string }) {
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<ShopConnection | null>(null);
  const [productCount, setProductCount] = useState(0);
  const [domain, setDomain] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [busy, setBusy] = useState<'connect' | 'sync' | 'disconnect' | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
    const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [locationSaved, setLocationSaved] = useState(false);

  // Which Shopify location in-store sales take stock from
  const loadLocations = async () => {
    const res = await fetch(`/api/shopify/locations?businessId=${businessId}`, { headers: await authHeaders() });
    const json = await res.json().catch(() => ({}));
    setLocations(json.locations || []);
    setLocationId(json.selected || null);
  };

  const chooseLocation = async (id: string) => {
    setLocationId(id);
    setLocationSaved(false);
    const res = await fetch('/api/shopify/locations', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ businessId, locationId: id }),
    });
    if (res.ok) {
      setLocationSaved(true);
      setTimeout(() => setLocationSaved(false), 2000);
    }
  };

  const load = async () => {
    const res = await fetch(`/api/shopify/connect?businessId=${businessId}`, { headers: await authHeaders() });
    const json = await res.json().catch(() => ({}));
    setConnection(json.connection || null);
    setProductCount(json.productCount || 0);
    setLoading(false);
    if (json.connection) loadLocations();
  };
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const connect = async () => {
    if (!domain.trim() || !clientId.trim() || !clientSecret.trim()) {
      setMessage({ text: 'Fill in all three fields.', ok: false });
      return;
    }
    setBusy('connect');
    setMessage(null);
    const res = await fetch('/api/shopify/connect', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ businessId, shopDomain: domain, clientId, clientSecret }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setMessage({ text: json.error || 'Could not connect.', ok: false });
      return;
    }
    setClientSecret('');
    setMessage({
      text: json.synced
        ? `Connected to ${json.shopName}. ${json.synced.products} products imported.`
        : `Connected to ${json.shopName}, but products could not be imported yet: ${json.syncError}`,
      ok: !!json.synced,
    });
    load();
  };

  const sync = async () => {
    setBusy('sync');
    setMessage(null);
    const res = await fetch('/api/shopify/sync', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ businessId }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    setMessage(
      res.ok
        ? { text: `${json.products} products and ${json.variants} variants refreshed.`, ok: true }
        : { text: json.error || 'Could not refresh.', ok: false }
    );
    load();
  };

  const disconnect = async () => {
    if (!confirm('Disconnect Shopify? The Sales screen will go back to the preview.')) return;
    setBusy('disconnect');
    await fetch(`/api/shopify/connect?businessId=${businessId}`, { method: 'DELETE', headers: await authHeaders() });
    setBusy(null);
    setMessage(null);
    load();
  };

  if (loading) return <div className="h-12 rounded-lg bg-surface-raised" />;

  if (connection) {
    return (
      <div>
        <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-overlay">
            <ShoppingBag className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{connection.shop_name || connection.shop_domain}</p>
            <p className="truncate text-xs text-ink-muted">
              {productCount} products
                         {connection.last_synced_at ? `, updated ${timeAgo(connection.last_synced_at)}` : ''}
            </p>
          </div>
          <span className="flex items-center gap-1 text-xs text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Connected
          </span>
        </div>
                <label className="mt-3 block">
          <span className="mb-1.5 flex items-center justify-between text-[13px] text-ink-muted">
            Shop location
            {locationSaved && <span className="text-success">Saved</span>}
          </span>
          <select
            value={locationId || ''}
            onChange={(e) => chooseLocation(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-surface px-2.5 text-base md:text-sm outline-none focus:border-ink"
          >
            {!locationId && <option value="">Choose a location</option>}
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-ink-faint">In-store sales take stock from this location in Shopify.</span>
        </label>
        {connection.last_sync_error && (
          <p className="mt-2 rounded-lg bg-danger-light px-3 py-2 text-[13px] text-danger">
            Last refresh failed: {connection.last_sync_error}
          </p>
        )}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button onClick={sync} disabled={!!busy} className={buttonSecondary}>
            <RefreshCw className={clsx('h-4 w-4', busy === 'sync' && 'animate-spin')} />
            {busy === 'sync' ? 'Refreshing...' : 'Refresh products'}
          </button>
          <button onClick={disconnect} disabled={!!busy} className={clsx(buttonSecondary, 'text-danger')}>
            Disconnect
          </button>
        </div>
        {message && (
          <p className={clsx('mt-2 text-[13px]', message.ok ? 'text-success' : 'text-danger')}>{message.text}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-[13px] text-ink-muted">Store</span>
        <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="yourstore.myshopify.com" className={field} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[13px] text-ink-muted">Client ID</span>
          <input value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" className={field} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] text-ink-muted">Client secret</span>
          <input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            autoComplete="off"
            className={field}
          />
        </label>
      </div>
      <button onClick={connect} disabled={!!busy} className={buttonPrimary}>
        <ShoppingBag className="h-4 w-4" />
        {busy === 'connect' ? 'Connecting and importing products...' : 'Connect Shopify'}
      </button>
      {message && <p className={clsx('text-[13px]', message.ok ? 'text-success' : 'text-danger')}>{message.text}</p>}
      <p className="text-xs leading-relaxed text-ink-faint">
        Use the client ID and secret from your Shopify Dev Dashboard app. The secret is stored where only the server can
        read it.
      </p>
    </div>
  );
}