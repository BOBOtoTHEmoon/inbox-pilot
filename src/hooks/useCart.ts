'use client';

// The sale being rung up. Kept in the browser's storage so a refresh or a
// dropped connection never loses what the customer is buying.

import { useEffect, useState } from 'react';
import type { CatalogProduct, CatalogVariant } from '@/hooks/useCatalog';

export interface CartLine {
  variantId: string; // Shopify variant ID
  productTitle: string;
  label: string | null;
  image: string | null;
  price: number;
  quantity: number;
  max: number;
  isPreorder: boolean;
}

export function useCart(businessId: string) {
  const key = `inboxpilot.cart.${businessId}`;
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) setLines(JSON.parse(saved));
    } catch {}
    setReady(true);
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(key, JSON.stringify(lines));
    } catch {}
  }, [key, lines, ready]);

  const add = (product: CatalogProduct, variant: CatalogVariant) =>
    setLines((prev) => {
      const max = variant.is_preorder ? 99 : Math.max(0, variant.stock);
      const existing = prev.find((l) => l.variantId === variant.external_id);
      if (existing) {
        return prev.map((l) =>
          l.variantId === variant.external_id ? { ...l, quantity: Math.min(l.max, l.quantity + 1) } : l
        );
      }
      return [
        ...prev,
        {
          variantId: variant.external_id,
          productTitle: product.title,
          label: variant.label || null,
          image: variant.image_url || product.image_url,
          price: variant.price,
          quantity: 1,
          max,
          isPreorder: variant.is_preorder,
        },
      ];
    });

  const setQuantity = (variantId: string, quantity: number) =>
    setLines((prev) =>
      prev
        .map((l) => (l.variantId === variantId ? { ...l, quantity: Math.min(l.max, quantity) } : l))
        .filter((l) => l.quantity > 0)
    );

  const clear = () => setLines([]);

  const count = lines.reduce((s, l) => s + l.quantity, 0);
  const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);

  return { lines, add, setQuantity, clear, count, subtotal };
}