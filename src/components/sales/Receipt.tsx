'use client';
import { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { Share2, Printer } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { naira } from '@/lib/sample-data';

export interface ReceiptData {
  saleNumber: number;
  createdAt: string;
  items: { title: string; variant_label: string | null; quantity: number; unit_price: number; line_total: number }[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  customerName?: string | null;
  staffName?: string | null;
  voided?: boolean;
}

const PAYMENT_NAMES: Record<string, string> = { transfer: 'Transfer', card: 'Card', cash: 'Cash' };

// The business's receipt branding, loaded once
export function useReceiptBranding(businessId: string) {
  const [logo, setLogo] = useState<string | null>(null);
  const [footer, setFooter] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    // The logo comes through our own address and is turned into data, so it
    // always appears in the PDF (including on phones)
    fetch(`/api/receipt-logo?businessId=${businessId}`)
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject();
            reader.readAsDataURL(blob);
          })
      )
      .then((url) => live && setLogo(url))
      .catch(() => {});

    if (isSupabaseConfigured) {
      supabase
        .from('businesses')
        .select('receipt_footer')
        .eq('id', businessId)
        .maybeSingle()
        .then(({ data }) => live && setFooter(data?.receipt_footer || null));
    }
    return () => {
      live = false;
    };
  }, [businessId]);

  return { logo, footer };
}

export function Receipt({
  businessId,
  shopName,
  data,
  onClose,
}: {
  businessId: string;
  shopName: string;
  data: ReceiptData;
  onClose: () => void;
}) {
  const paper = useRef<HTMLDivElement>(null);
  const { logo, footer } = useReceiptBranding(businessId);
  const [busy, setBusy] = useState<'share' | 'print' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileStem = `${shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-receipt-${String(data.saleNumber).padStart(4, '0')}`;

  const renderImage = async () => {
    const node = paper.current!;
    // Drawn twice: the first pass makes sure images (the logo) are ready on phones
    await toPng(node, { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true });
    return toPng(node, { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true });
  };

  const buildPdf = async () => {
    const dataUrl = await renderImage();
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('image failed'));
      img.src = dataUrl;
    });
    const mmW = 80; // standard receipt width
    const mmH = (mmW * img.height) / img.width;
    const pdf = new jsPDF({ unit: 'mm', format: [mmW, mmH] });
    pdf.addImage(dataUrl, 'PNG', 0, 0, mmW, mmH);
    return pdf.output('blob');
  };

  const share = async () => {
    setBusy('share');
    setError(null);
    try {
      const blob = await buildPdf();
      const file = new File([blob], `${fileStem}.pdf`, { type: 'application/pdf' });
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        // No title or text, so WhatsApp attaches the PDF without a caption
        await navigator.share({ files: [file] });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') setError('Could not make the PDF. Try Print instead.');
    }
    setBusy(null);
  };

  const print = async () => {
    setBusy('print');
    setError(null);
    try {
      const dataUrl = await renderImage();
      const win = window.open('', '_blank');
      if (!win) throw new Error('blocked');
      win.document.write(
        `<html><head><title>${fileStem}</title><style>@page{margin:0}body{margin:0;display:flex;justify-content:center}img{width:80mm}</style></head><body><img src="${dataUrl}" onload="window.print()"></body></html>`
      );
      win.document.close();
    } catch {
      setError('Could not open the print window. Allow pop-ups for this site and try again.');
    }
    setBusy(null);
  };

  const when = new Date(data.createdAt).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Dialog
      title={`Receipt #${data.saleNumber}`}
      onClose={onClose}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button onClick={print} disabled={!!busy} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border text-sm font-medium hover:bg-surface-raised disabled:opacity-60">
            <Printer className="h-4 w-4" />
            {busy === 'print' ? 'Preparing...' : 'Print'}
          </button>
          <button onClick={share} disabled={!!busy} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-ink text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60">
            <Share2 className="h-4 w-4" />
            {busy === 'share' ? 'Preparing...' : 'Share PDF'}
          </button>
        </div>
      }
    >
      {error && <p className="mb-3 rounded-lg bg-danger-light px-3 py-2 text-[13px] text-danger">{error}</p>}

      <div className="flex justify-center rounded-xl bg-surface-raised p-4">
        {/* The receipt itself: plain colours and fixed sizes so it draws the same everywhere */}
        <div
          ref={paper}
          style={{ width: 300, background: '#ffffff', color: '#16161a', padding: '24px 20px', fontFamily: 'inherit' }}
        >
          <div style={{ textAlign: 'center' }}>
            {logo ? (
              <img src={logo} alt="" style={{ maxHeight: 56, maxWidth: 180, margin: '0 auto 8px', display: 'block', objectFit: 'contain' }} />
            ) : null}
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '0.02em' }}>{shopName}</div>
            <div style={{ fontSize: 12, color: '#6e6e78', marginTop: 4 }}>
              Receipt #{String(data.saleNumber).padStart(4, '0')}
            </div>
            <div style={{ fontSize: 12, color: '#6e6e78' }}>{when}</div>
            {data.voided && (
              <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: '#d93036', letterSpacing: '0.08em' }}>VOIDED</div>
            )}
          </div>

          <div style={{ borderTop: '1px dashed #d4d4da', margin: '16px 0' }} />

          {data.items.map((item, i) => (
            <div key={i} style={{ marginBottom: 10, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontWeight: 600 }}>{item.title}</span>
                <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{naira(item.line_total)}</span>
              </div>
              <div style={{ color: '#6e6e78', fontSize: 12 }}>
                {item.variant_label ? `${item.variant_label}, ` : ''}
                {item.quantity} x {naira(item.unit_price)}
              </div>
            </div>
          ))}

          <div style={{ borderTop: '1px dashed #d4d4da', margin: '16px 0 12px' }} />

          <div style={{ fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6e6e78' }}>Subtotal</span>
              <span>{naira(data.subtotal)}</span>
            </div>
            {data.discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6e6e78' }}>Discount</span>
                <span>-{naira(data.discount)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700, marginTop: 6 }}>
              <span>Total</span>
              <span>{naira(data.total)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, color: '#6e6e78' }}>
              <span>Paid by</span>
              <span>{PAYMENT_NAMES[data.paymentMethod] || data.paymentMethod}</span>
            </div>
            {data.customerName && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6e6e78' }}>
                <span>Customer</span>
                <span>{data.customerName}</span>
              </div>
            )}
            {data.staffName && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6e6e78' }}>
                <span>Served by</span>
                <span>{data.staffName}</span>
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px dashed #d4d4da', margin: '16px 0 12px' }} />
          <div style={{ textAlign: 'center', fontSize: 12, color: '#6e6e78', lineHeight: 1.5 }}>
            {footer ? <div style={{ whiteSpace: 'pre-line', marginBottom: 6 }}>{footer}</div> : null}
            <div style={{ fontWeight: 600, color: '#16161a' }}>Thank you for shopping with us</div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}