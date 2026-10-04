'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { Download, Receipt as ReceiptIcon, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { authHeaders } from '@/hooks/useCatalog';
import { Dialog } from '@/components/ui/Dialog';
import { Receipt, type ReceiptData } from './Receipt';
import { naira } from '@/lib/sample-data';
import { displayPhone } from '@/lib/phone';
import { clockTime } from '@/lib/time';

type Range = 'today' | 'yesterday' | '7d' | '30d';

const RANGES: { key: Range; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
];

const PAYMENT_NAMES: Record<string, string> = { transfer: 'Transfer', card: 'Card', cash: 'Cash' };

interface SaleRow {
  id: string;
  sale_number: number;
  created_at: string;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: string;
  status: 'completed' | 'voided';
  inventory_synced: boolean;
  inventory_error: string | null;
  note: string | null;
  void_reason: string | null;
  customer: { name: string; phone: string | null } | null;
  staff: { name: string } | null;
  items: { title: string; variant_label: string | null; quantity: number; unit_price: number; line_total: number }[];
}

function rangeDates(range: Range) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = 24 * 60 * 60 * 1000;
  if (range === 'today') return { from: startOfToday, to: new Date(startOfToday.getTime() + day) };
  if (range === 'yesterday') return { from: new Date(startOfToday.getTime() - day), to: startOfToday };
  const days = range === '7d' ? 6 : 29;
  return { from: new Date(startOfToday.getTime() - days * day), to: new Date(startOfToday.getTime() + day) };
}

function toReceipt(s: SaleRow): ReceiptData {
  return {
    saleNumber: s.sale_number,
    createdAt: s.created_at,
    items: s.items.map((i) => ({ ...i, unit_price: Number(i.unit_price), line_total: Number(i.line_total) })),
    subtotal: Number(s.subtotal),
    discount: Number(s.discount),
    total: Number(s.total),
    paymentMethod: s.payment_method,
    customerName: s.customer?.name && s.customer.name !== 'Walk-in customer' ? s.customer.name : null,
    staffName: s.staff?.name || null,
    voided: s.status === 'voided',
  };
}

function exportCsv(sales: SaleRow[], range: Range) {
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['Sale', 'Date', 'Time', 'Customer', 'Phone', 'Sold by', 'Items', 'Payment', 'Subtotal', 'Discount', 'Total', 'Status'];
  const rows = sales.map((s) => {
    const d = new Date(s.created_at);
    return [
      s.sale_number,
      d.toLocaleDateString('en-GB'),
      d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      s.customer?.name || '',
      s.customer?.phone || '',
      s.staff?.name || '',
      s.items.map((i) => `${i.quantity} x ${i.title}${i.variant_label ? ` (${i.variant_label})` : ''}`).join('; '),
      PAYMENT_NAMES[s.payment_method] || s.payment_method,
      Number(s.subtotal),
      Number(s.discount),
      Number(s.total),
      s.status === 'voided' ? 'Voided' : 'Completed',
    ]
      .map(escape)
      .join(',');
  });
  const blob = new Blob([[header.map(escape).join(','), ...rows].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sales-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function SaleDetail({
  businessId,
  shopName,
  sale,
  onClose,
  onChanged,
}: {
  businessId: string;
  shopName: string;
  sale: SaleRow;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [showReceipt, setShowReceipt] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmVoid = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/sales/void', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ businessId, saleId: sale.id, reason: reason.trim() || null }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(json.error || 'Could not void the sale. Try again.');
    onChanged();
    onClose();
  };

  if (showReceipt) {
    return <Receipt businessId={businessId} shopName={shopName} data={toReceipt(sale)} onClose={() => setShowReceipt(false)} />;
  }

  const voided = sale.status === 'voided';

  return (
    <Dialog
      title={`Sale #${sale.sale_number}`}
      onClose={onClose}
      footer={
        voiding ? (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setVoiding(false)} className="h-11 rounded-xl border border-border text-sm font-medium hover:bg-surface-raised">
              Keep sale
            </button>
            <button onClick={confirmVoid} disabled={busy} className="h-11 rounded-xl bg-danger text-sm font-semibold text-white disabled:opacity-60">
              {busy ? 'Voiding...' : 'Void and restock'}
            </button>
          </div>
        ) : (
          <div className={clsx('grid gap-2', voided ? 'grid-cols-1' : 'grid-cols-2')}>
            {!voided && (
              <button onClick={() => setVoiding(true)} className="h-11 rounded-xl border border-border text-sm font-medium text-danger hover:bg-danger-light">
                Void sale
              </button>
            )}
            <button onClick={() => setShowReceipt(true)} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-ink text-sm font-semibold text-white hover:bg-accent-hover">
              <ReceiptIcon className="h-4 w-4" />
              Receipt
            </button>
          </div>
        )
      }
    >
      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <p className={clsx('text-[26px] font-bold tabular-nums', voided && 'text-ink-muted line-through')}>{naira(Number(sale.total))}</p>
          <p className="text-[13px] text-ink-muted">
            {new Date(sale.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        {voided && (
          <p className="rounded-lg bg-danger-light px-3 py-2 text-[13px] text-danger">
            Voided{sale.void_reason ? `: ${sale.void_reason}` : ''}. The stock was put back.
          </p>
        )}
        {!voided && !sale.inventory_synced && (
          <p className="flex items-start gap-2 rounded-lg bg-warning-light px-3 py-2 text-[13px] text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Shopify stock was not updated for this sale yet. Use "Try again" on the Sell screen.
          </p>
        )}

        <ul>
          {sale.items.map((i, idx) => (
            <li key={idx} className="flex justify-between gap-3 border-t border-border py-2.5 text-sm first:border-t-0">
              <span className="min-w-0">
                <span className="block truncate font-medium">{i.title}</span>
                <span className="block text-xs text-ink-muted">
                  {i.variant_label ? `${i.variant_label}, ` : ''}
                  {i.quantity} x {naira(Number(i.unit_price))}
                </span>
              </span>
              <span className="font-semibold tabular-nums">{naira(Number(i.line_total))}</span>
            </li>
          ))}
        </ul>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-border pt-3 text-[13px]">
          {Number(sale.discount) > 0 && (
            <>
              <dt className="text-ink-muted">Discount</dt>
              <dd className="text-right tabular-nums">-{naira(Number(sale.discount))}</dd>
            </>
          )}
          <dt className="text-ink-muted">Payment</dt>
          <dd className="text-right">{PAYMENT_NAMES[sale.payment_method] || sale.payment_method}</dd>
          <dt className="text-ink-muted">Customer</dt>
          <dd className="text-right">
            {sale.customer ? `${sale.customer.name}${sale.customer.phone ? `, ${displayPhone(sale.customer.phone)}` : ''}` : 'Walk-in'}
          </dd>
          <dt className="text-ink-muted">Sold by</dt>
          <dd className="text-right">{sale.staff?.name || 'Not recorded'}</dd>
          {sale.note && (
            <>
              <dt className="text-ink-muted">Note</dt>
              <dd className="text-right">{sale.note}</dd>
            </>
          )}
        </dl>

        {voiding && (
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink-light">Why is it being voided? (optional)</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="For example, customer changed their mind"
              className="h-10 w-full rounded-lg border border-border px-3 text-base md:text-sm outline-none focus-visible:outline-none focus:border-ink placeholder:text-ink-faint"
            />
            <span className="mt-1.5 block text-xs text-ink-muted">The items go back into Shopify stock.</span>
          </label>
        )}

        {error && <p role="alert" className="rounded-lg bg-danger-light px-3 py-2 text-[13px] text-danger">{error}</p>}
      </div>
    </Dialog>
  );
}

export function SalesHistory({ businessId, shopName }: { businessId: string; shopName: string }) {
  const [range, setRange] = useState<Range>('today');
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<SaleRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = rangeDates(range);
    const { data } = await supabase
      .from('sales')
      .select(
        'id, sale_number, created_at, subtotal, discount, total, payment_method, status, inventory_synced, inventory_error, note, void_reason, customer:customers(name, phone), staff:staff(name), items:sale_items(title, variant_label, quantity, unit_price, line_total)'
      )
      .eq('business_id', businessId)
      .gte('created_at', from.toISOString())
      .lt('created_at', to.toISOString())
      .order('created_at', { ascending: false })
      .limit(500);
    setSales((data as unknown as SaleRow[]) || []);
    setLoading(false);
  }, [businessId, range]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => {
    const done = sales.filter((s) => s.status === 'completed');
    const revenue = done.reduce((sum, s) => sum + Number(s.total), 0);
    const items = done.reduce((sum, s) => sum + s.items.reduce((n, i) => n + i.quantity, 0), 0);
    const byPayment = ['transfer', 'card', 'cash'].map((m) => ({
      method: m,
      total: done.filter((s) => s.payment_method === m).reduce((sum, s) => sum + Number(s.total), 0),
    }));
    const counts = new Map<string, number>();
    done.forEach((s) => s.items.forEach((i) => counts.set(i.title, (counts.get(i.title) || 0) + i.quantity)));
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { count: done.length, revenue, items, average: done.length ? revenue / done.length : 0, byPayment, top };
  }, [sales]);

  const maxTop = Math.max(1, ...summary.top.map((t) => t[1]));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-surface-raised p-1" role="tablist" aria-label="Period">
          {RANGES.map((r) => (
            <button
              key={r.key}
              role="tab"
              aria-selected={range === r.key}
              onClick={() => setRange(r.key)}
              className={clsx(
                'rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
                range === r.key ? 'bg-surface text-ink shadow-[0_1px_3px_rgba(22,22,26,0.10)]' : 'text-ink-muted hover:text-ink'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => exportCsv(sales, range)}
          disabled={sales.length === 0}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] font-medium hover:bg-surface-raised disabled:opacity-40"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border lg:grid-cols-4">
        {[
          { label: 'Sales', value: String(summary.count) },
          { label: 'Revenue', value: naira(summary.revenue) },
          { label: 'Items sold', value: String(summary.items) },
          { label: 'Average sale', value: naira(Math.round(summary.average)) },
        ].map((s) => (
          <div key={s.label} className="bg-surface p-4">
            <p className="text-[13px] text-ink-muted">{s.label}</p>
            <p className="mt-1.5 text-[22px] font-semibold tabular-nums tracking-[-0.01em]">{s.value}</p>
          </div>
        ))}
      </div>

      {summary.count > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          <section>
            <h3 className="text-sm font-semibold">What&apos;s selling</h3>
            <ul className="mt-3 space-y-2.5">
              {summary.top.map(([title, qty]) => (
                <li key={title}>
                  <div className="flex justify-between gap-3 text-[13px]">
                    <span className="truncate">{title}</span>
                    <span className="shrink-0 tabular-nums text-ink-muted">{qty} sold</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-overlay">
                    <div className="h-full rounded-full bg-ink" style={{ width: `${(qty / maxTop) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="text-sm font-semibold">How customers paid</h3>
            <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
              {summary.byPayment.map((p) => (
                <li key={p.method} className="flex justify-between px-3 py-2.5 text-[13px]">
                  <span>{PAYMENT_NAMES[p.method]}</span>
                  <span className="font-semibold tabular-nums">{naira(p.total)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {/* Every sale */}
      <section>
        <h3 className="text-sm font-semibold">Sales</h3>
        {loading ? (
          <div className="mt-3 h-24 rounded-xl bg-surface-raised" />
        ) : sales.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border-strong px-4 py-8 text-center text-[13px] text-ink-muted">
            No sales in this period.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
            {sales.map((s) => {
              const voided = s.status === 'voided';
              const itemCount = s.items.reduce((n, i) => n + i.quantity, 0);
              return (
                <li key={s.id}>
                  <button onClick={() => setOpen(s)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-raised">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <span className="tabular-nums">#{s.sale_number}</span>
                        <span className="truncate text-ink-light">{s.customer?.name || 'Walk-in'}</span>
                        {voided && <span className="rounded bg-danger-light px-1.5 py-0.5 text-[10px] font-semibold text-danger">Voided</span>}
                        {!voided && !s.inventory_synced && (
                          <span className="rounded bg-warning-light px-1.5 py-0.5 text-[10px] font-semibold text-warning">Stock pending</span>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-ink-muted">
                        {range === 'today' || range === 'yesterday'
                          ? clockTime(s.created_at)
                          : new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        , {itemCount} {itemCount === 1 ? 'item' : 'items'}, {PAYMENT_NAMES[s.payment_method]}
                        {s.staff ? `, ${s.staff.name}` : ''}
                      </p>
                    </div>
                    <span className={clsx('text-sm font-semibold tabular-nums', voided && 'text-ink-muted line-through')}>
                      {naira(Number(s.total))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {open && (
        <SaleDetail
          businessId={businessId}
          shopName={shopName}
          sale={open}
          onClose={() => setOpen(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}