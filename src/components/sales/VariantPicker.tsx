'use client';

// ============================================
// Pick a product's options (colour, size, style...) and see the exact
// variant's price and stock. Works for any option names Shopify uses.
// ============================================

import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { ShoppingBag } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import type { CatalogProduct, CatalogVariant } from '@/hooks/useCatalog';
import { naira } from '@/lib/sample-data';

export function stockLabel(v: Pick<CatalogVariant, 'stock' | 'is_preorder' | 'available'>) {
  if (v.is_preorder) return { text: 'Pre-order', tone: 'text-bot' };
  if (!v.available || v.stock <= 0) return { text: 'Sold out', tone: 'text-danger' };
  if (v.stock <= 2) return { text: `${v.stock} left`, tone: 'text-warning' };
  return { text: `${v.stock} in stock`, tone: 'text-ink-muted' };
}

const sellable = (v: CatalogVariant) => v.is_preorder || (v.available && v.stock > 0);

function optionValue(v: CatalogVariant, name: string) {
  return v.options.find((o) => o.name === name)?.value;
}

export function VariantPicker({
  product,
  onClose,
  onAdd,
}: {
  product: CatalogProduct;
  onClose: () => void;
  onAdd?: (variant: CatalogVariant) => void;
}) {
  const names = product.option_names;
  const firstSellable = product.variants.find(sellable) || product.variants[0];

  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const start: Record<string, string> = {};
    for (const n of names) {
      const v = firstSellable && optionValue(firstSellable, n);
      if (v) start[n] = v;
    }
    return start;
  });

  const valuesFor = (name: string) => {
    const seen: string[] = [];
    for (const v of product.variants) {
      const value = optionValue(v, name);
      if (value && !seen.includes(value)) seen.push(value);
    }
    return seen;
  };

  // A value is available if some variant with it (and the other current choices) can be sold
  const isAvailable = (name: string, value: string) =>
    product.variants.some(
      (v) =>
        optionValue(v, name) === value &&
        names.every((n) => n === name || !selected[n] || optionValue(v, n) === selected[n]) &&
        sellable(v)
    );

  const variant = useMemo(
    () =>
      names.length === 0
        ? product.variants[0]
        : product.variants.find((v) => names.every((n) => optionValue(v, n) === selected[n])),
    [names, product.variants, selected]
  );

  const image = variant?.image_url || product.image_url;
  const label = variant ? stockLabel(variant) : null;

  return (
    <Dialog
      title={product.title}
      onClose={onClose}
      footer={
        onAdd ? (
          <button
            onClick={() => variant && onAdd(variant)}
            disabled={!variant || !sellable(variant)}
            className="h-12 w-full rounded-xl bg-ink text-[15px] font-semibold text-white hover:bg-accent-hover disabled:opacity-40"
          >
            {variant && sellable(variant) ? `Add to sale, ${naira(variant.price)}` : 'Not available'}
          </button>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <div className="flex gap-4">
          {image ? (
            <img src={image} alt="" className="h-24 w-24 shrink-0 rounded-xl border border-border object-cover" />
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-surface-raised text-border-strong">
              <ShoppingBag className="h-8 w-8" strokeWidth={1.4} />
            </div>
          )}
          <div className="min-w-0">
            {product.category && <p className="text-xs text-ink-muted">{product.category}</p>}
            <p className="mt-0.5 text-[15px] font-semibold">{product.title}</p>
            {variant && (
              <>
                <p className="mt-2 text-lg font-bold tabular-nums">{naira(variant.price)}</p>
                {label && <p className={clsx('text-[13px] font-medium', label.tone)}>{label.text}</p>}
              </>
            )}
          </div>
        </div>

        {names.map((name) => (
          <fieldset key={name}>
            <legend className="mb-2 text-[13px] font-medium text-ink-light">{name}</legend>
            <div className="flex flex-wrap gap-2">
              {valuesFor(name).map((value) => {
                const on = selected[name] === value;
                const available = isAvailable(name, value);
                return (
                  <button
                    key={value}
                    onClick={() => setSelected((s) => ({ ...s, [name]: value }))}
                    aria-pressed={on}
                    className={clsx(
                      'min-h-[40px] min-w-[44px] rounded-lg border px-3 text-[13px] font-medium transition-colors',
                      on ? 'border-ink bg-ink text-white' : 'border-border hover:border-border-strong',
                      !available && !on && 'text-ink-faint line-through decoration-ink-faint'
                    )}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        {variant && (variant.sku || variant.barcode) && (
          <p className="text-xs text-ink-muted">
            {variant.sku && <>SKU {variant.sku}</>}
            {variant.sku && variant.barcode && ', '}
            {variant.barcode && <>barcode {variant.barcode}</>}
          </p>
        )}

        {!variant && <p className="text-[13px] text-ink-muted">That combination does not exist for this product.</p>}

        {!onAdd && (
          <p className="rounded-lg bg-surface-raised px-3 py-2 text-[13px] text-ink-muted">
            Selling from this screen comes in the next update. Keep using the in-store app until then.
          </p>
        )}
      </div>
    </Dialog>
  );
}