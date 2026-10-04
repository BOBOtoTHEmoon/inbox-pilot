'use client';
import { useState } from 'react';
import { Check, AlertTriangle, RefreshCw, Receipt as ReceiptIcon } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { authHeaders } from '@/hooks/useCatalog';
import { naira } from '@/lib/sample-data';
import type { SaleResult } from './SalePanel';
import { Receipt } from './Receipt';

const PAYMENT_NAMES: Record<string, string> = { transfer: 'transfer', card: 'card', cash: 'cash' };

function receiptText(result: SaleResult, shopName: string) {
  const { sale, items, customer } = result;
  const lines = items.map(
    (i) => `${i.quantity} x ${i.title}${i.variant_label ? ` (${i.variant_label})` : ''}: ${naira(i.line_total)}`
  );
  return [
    `${shopName} receipt #${sale.sale_number}`,
    new Date(sale.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }),
    '',
    ...lines,
    '',
    sale.discount > 0 ? `Discount: -${naira(sale.discount)}` : null,
    `Total: ${naira(sale.total)}`,
    `Paid by ${PAYMENT_NAMES[sale.payment_method] || sale.payment_method}`,
    '',
    customer?.name && customer.name !== 'Walk-in customer' ? `Thank you, ${customer.name.split(' ')[0]}!` : 'Thank you!',
  ]
    .filter((l) => l !== null)
    .join('\n');
}

export function SaleDone({
  businessId,
  result,
  shopName,
  onClose,
}: {
  businessId: string;
  result: SaleResult;
  shopName: string;
  onClose: () => void;
}) {
  const [synced, setSynced] = useState(result.sale.inventory_synced);
  const [stockError, setStockError] = useState(result.sale.inventory_error);
  const [retrying, setRetrying] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);

  const retry = async () => {
    setRetrying(true);
    const res = await fetch('/api/sales/retry', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ businessId }),
    });
    const json = await res.json().catch(() => ({}));
    setRetrying(false);
    if (res.ok && json.fixed > 0) {
      setSynced(true);
      setStockError(null);
    }
  };

    if (showReceipt) {
    return (
      <Receipt
        businessId={businessId}
        shopName={shopName}
        onClose={() => setShowReceipt(false)}
        data={{
          saleNumber: result.sale.sale_number,
          createdAt: result.sale.created_at,
          items: result.items,
          subtotal: Number(result.sale.subtotal),
          discount: Number(result.sale.discount),
          total: Number(result.sale.total),
          paymentMethod: result.sale.payment_method,
          customerName:
            result.customer?.name && result.customer.name !== 'Walk-in customer' ? result.customer.name : null,
          staffName: result.staffName,
        }}
      />
    );
  }

  const phoneDigits = result.customer?.phone.replace(/\D/g, '');
  const whatsappLink = phoneDigits
    ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(receiptText(result, shopName))}`
    : null;

  return (
    <Dialog
      title={`Sale #${result.sale.sale_number}`}
      onClose={onClose}
      footer={
        <button onClick={onClose} className="h-12 w-full rounded-xl bg-ink text-[15px] font-semibold text-white hover:bg-accent-hover">
          New sale
        </button>
      }
    >
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-light text-success">
          <Check className="h-6 w-6" />
        </div>
        <div>
          <p className="text-[28px] font-bold tabular-nums">{naira(result.sale.total)}</p>
          <p className="text-[13px] text-ink-muted">
            Paid by {PAYMENT_NAMES[result.sale.payment_method]}
            {result.customer ? `, ${result.customer.name}` : ''}
            {result.staffName ? `, sold by ${result.staffName}` : ''}
          </p>
        </div>

        {synced ? (
          <p className="text-[13px] text-success">Stock updated in Shopify.</p>
        ) : (
          <div className="rounded-lg bg-warning-light px-3 py-3 text-left text-[13px] text-warning">
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              The sale is saved, but Shopify stock was not updated yet.
            </p>
            {stockError && <p className="mt-1 text-xs">{stockError}</p>}
            <button onClick={retry} disabled={retrying} className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold underline underline-offset-2">
              <RefreshCw className={retrying ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
              {retrying ? 'Trying again...' : 'Try again'}
            </button>
          </div>
        )}

        <div className="grid gap-2">
          <button
            onClick={() => setShowReceipt(true)}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border text-sm font-medium hover:bg-surface-raised"
          >
            <ReceiptIcon className="h-4 w-4" />
            PDF receipt
          </button>
          {whatsappLink && (
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center justify-center rounded-xl border border-border text-sm font-medium hover:bg-surface-raised">
              Text receipt on WhatsApp
            </a>
          )}
        </div>
      </div>
    </Dialog>
  );
}