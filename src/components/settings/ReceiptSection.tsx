'use client';

// Settings: the logo and footer printed on customers' receipts

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const field =
  'w-full rounded-lg border border-border bg-surface px-3 text-base md:text-sm outline-none focus-visible:outline-none focus:border-ink placeholder:text-ink-faint';

export function ReceiptSection({ businessId }: { businessId: string }) {
  const [logo, setLogo] = useState('');
  const [footer, setFooter] = useState('');
  const [saved, setSaved] = useState({ logo: '', footer: '' });
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase
      .from('businesses')
      .select('receipt_logo_url, receipt_footer')
      .eq('id', businessId)
      .maybeSingle()
      .then(({ data }) => {
        const l = data?.receipt_logo_url || '';
        const f = data?.receipt_footer || '';
        setLogo(l);
        setFooter(f);
        setSaved({ logo: l, footer: f });
      });
  }, [businessId]);

  const changed = logo !== saved.logo || footer !== saved.footer;

  const save = async () => {
    setSaving(true);
    setMessage(null);
    const { error } = await supabase
      .from('businesses')
      .update({ receipt_logo_url: logo.trim() || null, receipt_footer: footer.trim() || null })
      .eq('id', businessId);
    setSaving(false);
    if (error) return setMessage({ text: 'Could not save. Try again.', ok: false });
    setSaved({ logo, footer });
    setMessage({ text: 'Saved', ok: true });
    setTimeout(() => setMessage(null), 2000);
  };

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-[13px] text-ink-muted">Logo image link</span>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-raised">
            {logo ? <img src={logo} alt="" className="max-h-10 max-w-[70px] object-contain" /> : <span className="text-[11px] text-ink-faint">No logo</span>}
          </div>
          <input value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://..." className={clsx(field, 'h-10')} />
        </div>
        <span className="mt-1 block text-xs text-ink-faint">Filled in from Shopify (Settings, then Brand) when there is one. Paste a different link to change it.</span>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[13px] text-ink-muted">Footer</span>
        <textarea
          value={footer}
          onChange={(e) => setFooter(e.target.value)}
          rows={2}
          placeholder="For example: Exchanges within 7 days with this receipt. Instagram @yourstore"
          className={clsx(field, 'resize-none py-2')}
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={!changed || saving}
          className="rounded-lg bg-ink px-3 py-2 text-[13px] font-medium text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save receipt details'}
        </button>
        {message && <span className={clsx('text-[13px]', message.ok ? 'text-success' : 'text-danger')}>{message.text}</span>}
      </div>
    </div>
  );
}