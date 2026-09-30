'use client';
import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { Search, ScanLine, ShoppingBag, Plus, Minus, Bell } from 'lucide-react';
import { Avatar } from '@/components/inbox/Avatar';
import { ChannelIcon } from '@/components/ui/ChannelIcon';
import { Dialog } from '@/components/ui/Dialog';
import { PreviewBanner } from '@/components/ui/PreviewBanner';
import {
  SAMPLE_CUSTOMERS,
  SAMPLE_PRODUCTS,
  naira,
  totalSpent,
  type SampleProduct,
} from '@/lib/sample-data';

const CATEGORIES = ['All', 'Hoodies', 'Bottoms', 'Tees', 'Sets', 'Shoes', 'Accessories'];
const PAYMENT = ['Transfer', 'Card', 'Cash'];

function stockText(p: SampleProduct) {
  if (p.stock === 0) return { text: p.waiting ? `Sold out, ${p.waiting} waiting` : 'Sold out', tone: 'text-danger' };
  if (p.stock <= 3) return { text: `${p.stock} left`, tone: 'text-warning' };
  return { text: `${p.stock} in stock`, tone: 'text-ink-muted' };
}

function ProductImage({ className }: { className?: string }) {
  return (
    <div className={clsx('flex items-center justify-center bg-surface-raised text-border-strong', className)}>
      <ShoppingBag className="h-1/3 w-1/3" strokeWidth={1.4} />
    </div>
  );
}

export default function SalesPage() {
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({ p1: 1, p5: 2 });
  const [customerId, setCustomerId] = useState(SAMPLE_CUSTOMERS[0].id);
  const [payment, setPayment] = useState('Transfer');
  const [sendReceipt, setSendReceipt] = useState(true);
  const [cartOpen, setCartOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const customer = SAMPLE_CUSTOMERS.find((c) => c.id === customerId)!;

  const products = useMemo(() => {
    const q = search.trim().toLowerCase();
    return SAMPLE_PRODUCTS.filter(
      (p) =>
        (category === 'All' || p.category === category) &&
        (!q || `${p.name} ${p.variant}`.toLowerCase().includes(q))
    );
  }, [category, search]);

  const lines = Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({ product: SAMPLE_PRODUCTS.find((p) => p.id === id)!, qty }));
  const subtotal = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
  const discount = subtotal > 0 && totalSpent(customer) >= 100000 ? 5000 : 0;
  const total = subtotal - discount;
  const itemCount = lines.reduce((s, l) => s + l.qty, 0);

  const change = (id: string, delta: number) =>
    setCart((c) => {
      const p = SAMPLE_PRODUCTS.find((x) => x.id === id)!;
      const next = Math.max(0, Math.min(p.stock, (c[id] || 0) + delta));
      return { ...c, [id]: next };
    });

  const complete = () => {
    setCartOpen(false);
    setNotice('This is a preview, so nothing was recorded. Real sales still go through the AuraUp in-store app for now.');
    setTimeout(() => setNotice(null), 5000);
  };

  // The cart, used in the side panel on large screens and in a sheet on phones
  const cartBody = (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-xl border border-border p-3">
        <Avatar name={customer.name} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{customer.name}</p>
          <p className="flex items-center gap-1.5 text-xs text-ink-muted">
            {customer.whatsapp && <ChannelIcon channel="whatsapp" />}
            {customer.instagram && <ChannelIcon channel="instagram" />}
            {customer.email && <ChannelIcon channel="email" />}
            <span>
              {customer.orders.length} orders, {naira(totalSpent(customer))} spent
            </span>
          </p>
        </div>
        <label className="sr-only" htmlFor="customer">Customer</label>
        <select
          id="customer"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="max-w-[92px] rounded-lg border border-border bg-surface px-2 py-1.5 text-[13px] font-medium"
        >
          {SAMPLE_CUSTOMERS.map((c) => (
            <option key={c.id} value={c.id}>{c.name.split(' ')[0]}</option>
          ))}
        </select>
      </div>

      {customer.waitingFor && (
        <p className="flex items-start gap-2 rounded-lg bg-warning-light px-3 py-2 text-[13px] text-warning">
          <Bell className="mt-0.5 h-4 w-4 shrink-0" />
          {customer.name.split(' ')[0]} is waiting for the {customer.waitingFor}
        </p>
      )}

      {lines.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center text-[13px] text-ink-muted">
          Tap a product to add it to this sale.
        </p>
      ) : (
        <ul>
          {lines.map(({ product, qty }) => (
            <li key={product.id} className="flex items-center gap-3 border-t border-border py-3 first:border-t-0">
              <ProductImage className="h-11 w-11 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{product.name}</p>
                <p className="text-xs text-ink-muted">{product.variant}</p>
              </div>
              <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
                <button onClick={() => change(product.id, -1)} aria-label={`Remove one ${product.name}`} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-surface-overlay">
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-[1rem] text-center text-[13px] font-semibold tabular-nums">{qty}</span>
                <button onClick={() => change(product.id, 1)} aria-label={`Add one ${product.name}`} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-surface-overlay">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <span className="w-20 text-right text-sm font-semibold tabular-nums">{naira(product.price * qty)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-1.5 border-t border-border pt-3 text-sm">
        <div className="flex justify-between"><span className="text-ink-muted">Subtotal</span><span className="tabular-nums">{naira(subtotal)}</span></div>
        {discount > 0 && (
          <div className="flex justify-between"><span className="text-ink-muted">Loyal customer discount</span><span className="text-success tabular-nums">−{naira(discount)}</span></div>
        )}
        <div className="flex justify-between pt-1 text-xl font-bold"><span>Total</span><span className="tabular-nums">{naira(total)}</span></div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-ink-muted">Payment</p>
        <div className="grid grid-cols-3 gap-2">
          {PAYMENT.map((m) => (
            <button
              key={m}
              onClick={() => setPayment(m)}
              aria-pressed={payment === m}
              className={clsx(
                'h-10 rounded-lg border text-[13px] font-medium transition-colors',
                payment === m ? 'border-ink bg-surface-raised' : 'border-border hover:bg-surface-raised'
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {customer.whatsapp && (
        <label className="flex items-center gap-2.5 text-[13px]">
          <input type="checkbox" checked={sendReceipt} onChange={(e) => setSendReceipt(e.target.checked)} className="h-4 w-4 accent-[var(--color-ink)]" />
          Send the receipt to {customer.name.split(' ')[0]}&apos;s WhatsApp
        </label>
      )}

      <button
        onClick={complete}
        disabled={lines.length === 0}
        className="h-12 rounded-xl bg-ink text-[15px] font-semibold text-white hover:bg-accent-hover disabled:opacity-40"
      >
        Complete sale, {naira(total)}
      </button>
    </div>
  );

  return (
    <div className="flex h-full">
      {/* Products */}
      <section className="flex min-w-0 flex-1 flex-col" aria-label="Products">
        <div className="border-b border-border px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-3 md:flex md:h-16 md:items-center md:justify-between md:px-6 md:py-0">
          <div className="flex items-baseline gap-3">
            <h1 className="text-[17px] font-semibold tracking-[-0.01em]">New sale</h1>
            <span className="rounded-full bg-surface-overlay px-2 py-0.5 text-[11px] font-medium text-ink-muted">Preview</span>
          </div>
          <p className="mt-1 text-[13px] text-ink-muted md:mt-0">
            Today in store: <span className="font-semibold text-ink">7 sales, {naira(412000)}</span>
          </p>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-4 pt-4 pb-[calc(11rem+env(safe-area-inset-bottom))] md:px-6 md:pb-6">
          <PreviewBanner>
            A preview with sample products. When it is built, this sells from your Shopify stock and every sale
            lands on the customer&apos;s profile, next to their DMs.
          </PreviewBanner>

          <div className="mt-4 flex gap-2">
            <label className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-border px-3 focus-within:border-ink">
              <Search className="h-4 w-4 text-ink-muted" />
              <span className="sr-only">Search products</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products or scan a barcode"
                className="h-full w-full bg-transparent text-base md:text-sm outline-none focus-visible:outline-none placeholder:text-ink-faint"
              />
            </label>
            <button aria-label="Scan a barcode" className="flex h-11 items-center gap-2 rounded-xl border border-border px-3 text-[13px] font-medium hover:bg-surface-raised">
              <ScanLine className="h-4 w-4" />
              <span className="hidden sm:inline">Scan</span>
            </button>
          </div>

          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
                className={clsx(
                  'shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors',
                  category === c ? 'bg-ink text-white' : 'border border-border text-ink-light hover:bg-surface-raised'
                )}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Phones: a list */}
          <ul className="mt-2 md:hidden">
            {products.map((p) => {
              const s = stockText(p);
              const qty = cart[p.id] || 0;
              return (
                <li key={p.id} className="flex items-center gap-3 border-b border-border py-2.5">
                  <ProductImage className={clsx('h-14 w-14 shrink-0 rounded-xl', p.stock === 0 && 'opacity-50')} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold">{p.name}</p>
                    <p className="text-[13px] text-ink-muted">{p.variant}, {naira(p.price)}</p>
                    <p className={clsx('text-xs font-medium', s.tone)}>{s.text}</p>
                  </div>
                  {qty > 0 ? (
                    <button onClick={() => change(p.id, 1)} aria-label={`Add another ${p.name}`} className="flex h-9 min-w-9 items-center justify-center rounded-full bg-ink px-2 text-[13px] font-bold text-white">
                      {qty}
                    </button>
                  ) : (
                    <button onClick={() => change(p.id, 1)} disabled={p.stock === 0} aria-label={`Add ${p.name}`} className="flex h-9 w-9 items-center justify-center rounded-full border border-border disabled:opacity-40">
                      <Plus className="h-4 w-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Larger screens: a grid */}
          <div className="mt-4 hidden grid-cols-2 gap-3 md:grid lg:grid-cols-3 2xl:grid-cols-4">
            {products.map((p) => {
              const s = stockText(p);
              const qty = cart[p.id] || 0;
              return (
                <button
                  key={p.id}
                  onClick={() => change(p.id, 1)}
                  disabled={p.stock === 0}
                  className={clsx(
                    'relative overflow-hidden rounded-2xl border text-left transition-colors',
                    qty > 0 ? 'border-ink' : 'border-border hover:border-border-strong',
                    p.stock === 0 && 'cursor-not-allowed'
                  )}
                >
                  <ProductImage className={clsx('h-32', p.stock === 0 && 'opacity-50')} />
                  {qty > 0 && (
                    <span className="absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-ink px-1.5 text-xs font-bold text-white">{qty}</span>
                  )}
                  <div className="p-3">
                    <p className="text-sm font-semibold">{p.name}</p>
                    <p className="text-xs text-ink-muted">{p.variant}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-semibold tabular-nums">{naira(p.price)}</span>
                      <span className={clsx('text-[11px] font-medium', s.tone)}>{s.text}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {notice && (
            <p role="status" className="mt-4 rounded-lg bg-ink px-4 py-3 text-[13px] text-white">{notice}</p>
          )}
        </div>
      </section>

      {/* Current sale, beside the products on large screens */}
      <aside className="hidden w-[400px] shrink-0 flex-col border-l border-border lg:flex" aria-label="Current sale">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5">
          <h2 className="text-[15px] font-semibold">Current sale</h2>
          <span className="text-xs text-ink-muted">{itemCount} items</span>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin p-5">{cartBody}</div>
      </aside>

      {/* Phones and tablets: a charge bar that opens the sale */}
      {itemCount > 0 && (
        <div className="lg:hidden fixed inset-x-3.5 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-20 flex items-center gap-3 rounded-2xl bg-ink py-2.5 pl-4 pr-2.5 text-white shadow-[0_12px_32px_rgba(22,22,26,0.3)] md:bottom-4 md:left-auto md:right-4 md:w-[360px]">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-white/70">{itemCount} items for {customer.name}</p>
            <p className="text-[17px] font-bold tabular-nums">{naira(total)}</p>
          </div>
          <button onClick={() => setCartOpen(true)} className="h-11 rounded-xl bg-white px-5 text-sm font-semibold text-ink">
            Review
          </button>
        </div>
      )}

      {cartOpen && (
        <Dialog title="Current sale" onClose={() => setCartOpen(false)}>
          {cartBody}
        </Dialog>
      )}
    </div>
  );
}