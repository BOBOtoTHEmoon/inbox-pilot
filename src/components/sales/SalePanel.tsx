'use client';

// ============================================
// The current sale: who's selling, the customer, items, discount,
// payment, and the button that records it.
// ============================================

import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Minus, Plus, ShoppingBag, UserRound, Check, ChevronDown } from 'lucide-react';
import { authHeaders } from '@/hooks/useCatalog';
import type { useCart } from '@/hooks/useCart';
import { naira } from '@/lib/sample-data';
import { displayPhone, normalizePhone } from '@/lib/phone';

type Cart = ReturnType<typeof useCart>;

interface Staff {
  id: string;
  name: string;
  is_active: boolean;
}

interface FoundCustomer {
  id: string;
  name: string;
  phone: string;
   instagram_username: string | null;
  visits: number;
  spent: number;
  lastVisit: string | null;
  favourite: string | null;
  
}

export interface SaleResult {
  sale: {
    id: string;
    sale_number: number;
    total: number;
    subtotal: number;
    discount: number;
    payment_method: string;
    inventory_synced: boolean;
    inventory_error: string | null;
    created_at: string;
  };
  items: { title: string; variant_label: string | null; quantity: number; unit_price: number; line_total: number }[];
  customer: { name: string; phone: string } | null;
  staffName: string | null;
}

const PAYMENTS = [
  { key: 'transfer', label: 'Transfer' },
  { key: 'card', label: 'Card' },
  { key: 'cash', label: 'Cash' },
];

const field =
  'h-10 w-full rounded-lg border border-border bg-surface px-3 text-base md:text-sm outline-none focus-visible:outline-none focus:border-ink placeholder:text-ink-faint';

function StaffPicker({
  businessId,
  value,
  onChange,
}: {
  businessId: string;
  value: string | null;
  onChange: (staff: Staff | null) => void;
}) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState('');

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/staff?businessId=${businessId}`, { headers: await authHeaders() });
      const json = await res.json().catch(() => ({}));
      const active = ((json.staff || []) as Staff[]).filter((s) => s.is_active);
      setStaff(active);
      if (value && !active.some((s) => s.id === value)) onChange(null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const add = async () => {
    const name = adding.trim();
    if (!name) return;
    const res = await fetch('/api/staff', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ businessId, name }),
    });
    const json = await res.json().catch(() => ({}));
    if (json.staff) {
      setStaff((s) => [...s, json.staff].sort((a, b) => a.name.localeCompare(b.name)));
      onChange(json.staff);
      setAdding('');
      setOpen(false);
    }
  };

  const current = staff.find((s) => s.id === value);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-10 w-full items-center gap-2 rounded-lg border border-border px-3 text-left text-sm hover:bg-surface-raised"
      >
        <UserRound className="h-4 w-4 text-ink-muted" />
        <span className={clsx('flex-1 truncate', !current && 'text-ink-muted')}>
          {current ? `Sold by ${current.name}` : "Who's selling?"}
        </span>
        <ChevronDown className="h-4 w-4 text-ink-muted" />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-border bg-surface shadow-[0_12px_32px_rgba(22,22,26,0.14)]">
          <ul className="max-h-56 overflow-y-auto py-1">
            {staff.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => {
                    onChange(s);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-surface-raised"
                >
                  {s.name}
                  {s.id === value && <Check className="h-4 w-4" />}
                </button>
              </li>
            ))}
            {staff.length === 0 && <li className="px-3 py-2.5 text-[13px] text-ink-muted">No staff added yet.</li>}
          </ul>
          <div className="flex gap-2 border-t border-border p-2">
            <input
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="Add a person"
              className={clsx(field, 'h-9')}
            />
            <button onClick={add} className="shrink-0 rounded-lg bg-ink px-3 text-[13px] font-medium text-white">
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SalePanel({
  businessId,
  cart,
  onComplete,
}: {
  businessId: string;
  cart: Cart;
  onComplete: (result: SaleResult) => void;
}) {
  const [staffId, setStaffId] = useState<string | null>(null);
  const [staffName, setStaffName] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [found, setFound] = useState<FoundCustomer | null>(null);
  const [discount, setDiscount] = useState('');
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [payment, setPayment] = useState('transfer');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Remember who was selling last on this device
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('inboxpilot.staff') || 'null');
      if (saved?.id) {
        setStaffId(saved.id);
        setStaffName(saved.name);
      }
    } catch {}
  }, []);

  // Look up returning customers as the phone number is typed
  useEffect(() => {
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    const normalized = normalizePhone(phone);
    if (!normalized || normalized.replace(/\D/g, '').length < 10) {
      setFound(null);
      return;
    }
    lookupTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/customers/lookup?businessId=${businessId}&phone=${encodeURIComponent(phone)}`, {
        headers: await authHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      setFound(json.customer || null);
      if (json.customer && !name) setName(json.customer.name);
    }, 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, businessId]);

  const discountValue = Math.max(0, Math.round(Number(discount.replace(/[^\d]/g, '')) || 0));
  const total = Math.max(0, cart.subtotal - discountValue);

  const complete = async () => {
    setError(null);
    if (cart.lines.length === 0) return setError('Add at least one item.');
    if (phone.trim() && !normalizePhone(phone)) return setError('That phone number does not look right.');
    if (discountValue > cart.subtotal) return setError('The discount cannot be more than the total.');

    setSaving(true);
    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        businessId,
        items: cart.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        customer: phone.trim() ? { name: name.trim(), phone } : null,
        staffId,
        paymentMethod: payment,
        discount: discountValue,
        note: note.trim() || null,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(json.error || 'The sale was not recorded. Try again.');

    const customer = phone.trim() ? { name: name.trim() || 'Walk-in customer', phone: normalizePhone(phone)! } : null;
    onComplete({ ...json, customer, staffName });
    cart.clear();
    setPhone('');
    setName('');
    setFound(null);
    setDiscount('');
    setNote('');
    setShowNote(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <StaffPicker
        businessId={businessId}
        value={staffId}
        onChange={(s) => {
          setStaffId(s?.id || null);
          setStaffName(s?.name || null);
          try {
            localStorage.setItem('inboxpilot.staff', JSON.stringify(s ? { id: s.id, name: s.name } : null));
          } catch {}
        }}
      />

      {/* Customer */}
      <div className="rounded-xl border border-border p-3">
        <p className="mb-2 text-xs font-medium text-ink-muted">Customer (optional)</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="sr-only">Phone number</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Phone" className={field} />
          </label>
          <label className="block">
            <span className="sr-only">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className={field} />
          </label>
        </div>
        {found && (
          <div className="mt-2 rounded-lg bg-success-light px-3 py-2 text-[13px] text-success">
            <p className="font-medium">
              Returning customer: {found.visits} {found.visits === 1 ? 'visit' : 'visits'}, {naira(found.spent)} spent
            </p>
            {found.favourite && <p className="text-xs">Usually buys {found.favourite}</p>}
                        {found.instagram_username && <p className="text-xs">On Instagram as @{found.instagram_username}</p>}
          </div>
        )}
      </div>

      {/* Items */}
      {cart.lines.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center text-[13px] text-ink-muted">
          Tap a product to add it to this sale.
        </p>
      ) : (
        <ul>
          {cart.lines.map((l) => (
            <li key={l.variantId} className="flex items-center gap-3 border-t border-border py-3 first:border-t-0">
              {l.image ? (
                <img src={l.image} alt="" className="h-11 w-11 shrink-0 rounded-lg border border-border object-cover" />
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-raised text-border-strong">
                  <ShoppingBag className="h-4 w-4" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{l.productTitle}</p>
                <p className="truncate text-xs text-ink-muted">
                  {l.label}
                  {l.isPreorder && <span className="text-bot"> Pre-order</span>}
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
                <button onClick={() => cart.setQuantity(l.variantId, l.quantity - 1)} aria-label={`Remove one ${l.productTitle}`} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-surface-overlay">
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-[1rem] text-center text-[13px] font-semibold tabular-nums">{l.quantity}</span>
                <button
                  onClick={() => cart.setQuantity(l.variantId, l.quantity + 1)}
                  disabled={l.quantity >= l.max}
                  aria-label={`Add one ${l.productTitle}`}
                  className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-surface-overlay disabled:opacity-30"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <span className="w-20 text-right text-sm font-semibold tabular-nums">{naira(l.price * l.quantity)}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Totals */}
      <div className="space-y-2 border-t border-border pt-3 text-sm">
        <div className="flex justify-between">
          <span className="text-ink-muted">Subtotal</span>
          <span className="tabular-nums">{naira(cart.subtotal)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="discount" className="text-ink-muted">Discount</label>
          <span className="flex h-9 w-32 items-center rounded-lg border border-border px-2.5 focus-within:border-ink">
            <span className="text-ink-muted">₦</span>
            <input
              id="discount"
              value={discount}
              onChange={(e) => setDiscount(e.target.value.replace(/[^\d]/g, ''))}
              inputMode="numeric"
              placeholder="0"
              className="h-full w-full bg-transparent pl-1 text-right text-base md:text-sm tabular-nums outline-none focus-visible:outline-none"
            />
          </span>
        </div>
        <div className="flex justify-between pt-1 text-xl font-bold">
          <span>Total</span>
          <span className="tabular-nums">{naira(total)}</span>
        </div>
      </div>

      {/* Payment */}
      <div>
        <p className="mb-2 text-xs font-medium text-ink-muted">Payment</p>
        <div className="grid grid-cols-3 gap-2">
          {PAYMENTS.map((m) => (
            <button
              key={m.key}
              onClick={() => setPayment(m.key)}
              aria-pressed={payment === m.key}
              className={clsx(
                'h-10 rounded-lg border text-[13px] font-medium transition-colors',
                payment === m.key ? 'border-ink bg-surface-raised' : 'border-border hover:bg-surface-raised'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {showNote ? (
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-muted">Note</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="For example, collecting the other size on Saturday"
            className="w-full resize-none rounded-lg border border-border px-3 py-2 text-base md:text-sm outline-none focus-visible:outline-none focus:border-ink placeholder:text-ink-faint"
          />
        </label>
      ) : (
        <button onClick={() => setShowNote(true)} className="self-start text-[13px] font-medium text-ink-light underline underline-offset-2">
          Add a note
        </button>
      )}

      {error && <p role="alert" className="rounded-lg bg-danger-light px-3 py-2 text-[13px] text-danger">{error}</p>}

      <button
        onClick={complete}
        disabled={saving || cart.lines.length === 0}
        className="h-12 rounded-xl bg-ink text-[15px] font-semibold text-white hover:bg-accent-hover disabled:opacity-40"
      >
        {saving ? 'Recording sale...' : `Complete sale, ${naira(total)}`}
      </button>
      {phone && found === null && normalizePhone(phone) && (
        <p className="-mt-2 text-center text-xs text-ink-muted">New customer {displayPhone(normalizePhone(phone))} will be saved</p>
      )}
    </div>
  );
}