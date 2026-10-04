'use client';

// ============================================
// The business's product catalogue (copied from Shopify), plus the
// connection status. Refreshes from Shopify automatically when the copy
// is more than 15 minutes old.
// ============================================

import { useCallback, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface CatalogVariant {
  id: string;
  external_id: string;
  inventory_item_id: string | null;
  sku: string | null;
  barcode: string | null;
  title: string | null;
  label: string | null;
  options: { name: string; value: string }[];
  position: number;
  price: number;
  stock: number;
  is_preorder: boolean;
  available: boolean;
  image_url: string | null;
}

export interface CatalogProduct {
  id: string;
  external_id: string;
  title: string;
  category: string | null;
  collections: string[];
  image_url: string | null;
  option_names: string[];
  is_preorder: boolean;
  variants: CatalogVariant[];
  totalStock: number;
  fromPrice: number;
}

export interface ShopConnection {
  shop_domain: string;
  shop_name: string | null;
  connected_at: string;
  last_synced_at: string | null;
  last_sync_error: string | null;
}

const STALE_AFTER_MS = 15 * 60 * 1000;

export async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.session?.access_token || ''}`,
  };
}

export function useCatalog(businessId: string) {
  const [connection, setConnection] = useState<ShopConnection | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    const { data, error: readError } = await supabase
      .from('products')
      .select('id, external_id, title, category, collections, image_url, option_names, is_preorder, product_variants(*)')
      .eq('business_id', businessId)
      .eq('status', 'active')
      .order('title');
    if (readError) {
      setError('Could not load products.');
      return;
    }
    setProducts(
      (data || []).map((p: any) => {
        const variants = ((p.product_variants || []) as CatalogVariant[])
          .map((v) => ({ ...v, price: Number(v.price) }))
          .sort((a, b) => a.position - b.position);
        return {
          ...p,
          variants,
          totalStock: variants.reduce((s, v) => s + Math.max(0, v.stock), 0),
          fromPrice: variants.length ? Math.min(...variants.map((v) => v.price)) : 0,
        };
      })
    );
  }, [businessId]);

  const refresh = useCallback(async () => {
    setSyncing(true);
    setError(null);
    const res = await fetch('/api/shopify/sync', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ businessId }),
    });
    const json = await res.json().catch(() => ({}));
    setSyncing(false);
    if (!res.ok) {
      setError(json.error || 'Could not refresh from Shopify.');
      return;
    }
    setConnection((c) => (c ? { ...c, last_synced_at: json.syncedAt, last_sync_error: null } : c));
    await loadProducts();
  }, [businessId, loadProducts]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    (async () => {
      const res = await fetch(`/api/shopify/connect?businessId=${businessId}`, { headers: await authHeaders() });
      const json = await res.json().catch(() => ({}));
      const conn: ShopConnection | null = json.connection || null;
      setConnection(conn);
      if (conn) {
        await loadProducts();
        const last = conn.last_synced_at ? new Date(conn.last_synced_at).getTime() : 0;
        if (Date.now() - last > STALE_AFTER_MS) refresh();
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  return { connection, products, loading, syncing, error, refresh, reload: loadProducts };
}