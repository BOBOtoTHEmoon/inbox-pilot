'use client';

// ============================================
// STOCK
// Every product's stock at a glance, and exact quantities at the shop
// location that the owner can correct. Changes go straight to Shopify.
// ============================================

import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { Search, Minus, Plus, ShoppingBag } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { authHeaders, type CatalogProduct } from '@/hooks/useCatalog';

type Filter = 'all' | 'low' | 'out';

function StockEditor({
  businessId,
  product,
  onClose,
  onSaved,
}: {
  businessId: string;
  product: CatalogProduct;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [levels, setLevels] = useState<Record<string, number | null> | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  const variants = product.variants.filter((v) => v.inventory_item_id);

  const load = async () => {
    setError(null);
    const res = await fetch('/api/stock', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ businessId, inventoryItemIds: variants.map((v) => v.inventory_item_id) }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setError(json.error || 'Could not load stock from Shopify.');
    setLevels(json.levels);
    setDrafts({});
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  const valueFor = (itemId: string) => drafts[itemId] ?? String(levels?.[itemId] ?? '');
  const changed = variants.filter((v) => {
    const id = v.inventory_item_id!;
    return drafts[id] !== undefined && drafts[id] !== String(levels?.[id] ?? '');
  });

  const nudge = (itemId: string, by: number) => {
    const current = Number(valueFor(itemId)) || 0;
    setDrafts((d) => ({ ...d, [itemId]: String(Math.max(0, current + by)) }));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    let done = 0;
    for (const v of changed) {
      const id = v.inventory_item_id!;
      const res = await fetch('/api/stock', {
        method: 'PUT',
        headers: await authHeaders(),
        body: JSON.stringify({ businessId, inventoryItemId: id, quantity: Number(drafts[id]), expected: levels?.[id] ?? 0 }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(`${v.label || product.title}: ${json.error || 'Could not save.'}`);
        break;
      }
      done++;
    }
    setSaving(false);
    setSavedCount(done);
    await load();
    if (done > 0) onSaved();
  };

  return (
    <Dialog
      title={product.title}
      onClose={onClose}
      footer={
        <button
          onClick={save}
          disabled={saving || changed.length === 0}
          className="h-12 w-full rounded-xl bg-ink text-[15px] font-semibold text-white hover:bg-accent-hover disabled:opacity-40"
        >
          {saving ? 'Saving to Shopify...' : changed.length ? `Save ${changed.length} ${changed.length === 1 ? 'change' : 'changes'}` : 'No changes'}
        </button>
      }
    >
      <div className="space-y-3">
        <p className="text-[13px] text-ink-muted">Stock at the shop location. Saving updates Shopify straight away.</p>
        {error && <p role="alert" className="rounded-lg bg-danger-light px-3 py-2 text-[13px] text-danger">{error}</p>}
        {savedCount > 0 && !error && <p className="text-[13px] text-success">Saved to Shopify.</p>}

        {!levels && !error ? (
          <div className="h-32 rounded-xl bg-surface-raised" />
        ) : (
          <ul>
            {variants.map((v) => {
              const id = v.inventory_item_id!;
              const level = levels?.[id];
              const notStocked = levels && level === null;
              const isChanged = drafts[id] !== undefined && drafts[id] !== String(level ?? '');
              return (
                <li key={v.id} className="flex items-center gap-3 border-t border-border py-3 first:border-t-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{v.label || 'Default'}</p>
                    <p className="truncate text-xs text-ink-muted">
                      {notStocked ? 'Not stocked at the shop location' : v.sku ? `SKU ${v.sku}` : ' '}
                    </p>
                  </div>
                  {!notStocked && (
                    <div className={clsx('flex items-center gap-1 rounded-full border p-0.5', isChanged ? 'border-ink' : 'border-border')}>
                      <button onClick={() => nudge(id, -1)} aria-label={`One less ${v.label}`} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-overlay">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        value={valueFor(id)}
                        onChange={(e) => setDrafts((d) => ({ ...d, [id]: e.target.value.replace(/[^\d]/g, '') }))}
                        inputMode="numeric"
                        aria-label={`Stock for ${v.label}`}
                        className="w-12 bg-transparent text-center text-base md:text-sm font-semibold tabular-nums outline-none focus-visible:outline-none"
                      />
                      <button onClick={() => nudge(id, 1)} aria-label={`One more ${v.label}`} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-overlay">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Dialog>
  );
}

export function StockView({
  businessId,
  products,
  onChanged,
}: {
  businessId: string;
  products: CatalogProduct[];
  onChanged: () => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<CatalogProduct | null>(null);

  const low = products.filter((p) => p.totalStock > 0 && p.totalStock <= 3);
  const out = products.filter((p) => p.totalStock <= 0 && !p.is_preorder);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = filter === 'low' ? low : filter === 'out' ? out : products;
    return base.filter((p) => !q || p.title.toLowerCase().includes(q) || p.variants.some((v) => v.sku?.toLowerCase().includes(q)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, filter, search]);

  const chips: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: products.length },
    { key: 'low', label: 'Running low', count: low.length },
    { key: 'out', label: 'Sold out', count: out.length },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <label className="flex h-11 items-center gap-2 rounded-xl border border-border px-3 focus-within:border-ink">
        <Search className="h-4 w-4 text-ink-muted" />
        <span className="sr-only">Search products</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or SKU"
          className="h-full w-full bg-transparent text-base md:text-sm outline-none focus-visible:outline-none placeholder:text-ink-faint"
        />
      </label>

      <div className="mt-3 flex gap-1.5 overflow-x-auto">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            aria-pressed={filter === c.key}
            className={clsx(
              'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors',
              filter === c.key ? 'bg-ink text-white' : 'border border-border text-ink-light hover:bg-surface-raised'
            )}
          >
            {c.label}
            <span className={clsx('tabular-nums', filter === c.key ? 'text-white/70' : 'text-ink-muted')}>{c.count}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="py-16 text-center text-[13px] text-ink-muted">
          {filter === 'low' ? 'Nothing is running low.' : filter === 'out' ? 'Nothing is sold out.' : 'No products match.'}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
          {visible.map((p) => {
            const tone = p.totalStock <= 0 ? 'text-danger' : p.totalStock <= 3 ? 'text-warning' : 'text-ink';
            return (
              <li key={p.id}>
                <button onClick={() => setOpen(p)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-raised">
                  {p.image_url ? (
                    <img src={p.image_url} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-lg border border-border object-cover" />
                  ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-raised text-border-strong">
                      <ShoppingBag className="h-4 w-4" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.title}</span>
                    <span className="block text-xs text-ink-muted">
                      {p.variants.length} {p.variants.length === 1 ? 'variant' : 'variants'}
                      {p.is_preorder ? ', pre-order' : ''}
                    </span>
                  </span>
                  <span className={clsx('text-right text-sm font-semibold tabular-nums', tone)}>
                    {p.totalStock}
                    <span className="block text-[11px] font-normal text-ink-muted">in stock</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {open && (
        <StockEditor businessId={businessId} product={open} onClose={() => setOpen(null)} onSaved={onChanged} />
      )}
    </div>
  );
}