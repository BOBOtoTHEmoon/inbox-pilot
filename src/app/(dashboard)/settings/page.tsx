'use client';

import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  Instagram,
  ShoppingBag,
  Clock,
  Shield,
  RefreshCw,
  Check,
  ExternalLink,
    Mail,
  Link as LinkIcon,
} from 'lucide-react';

const BUSINESS_ID = process.env.NEXT_PUBLIC_BUSINESS_ID || 'demo';

export default function SettingsPage() {
  const [syncing, setSyncing] = useState(false);
  const [igUsername, setIgUsername] = useState<string | null>(null);
  const [shopifyStore, setShopifyStore] = useState<string | null>(null);
  const [loadingBusiness, setLoadingBusiness] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  // Pull in recent DMs from Instagram (safe to run again; duplicates are skipped)
  const handleImport = async () => {
    setImporting(true);
    setImportMessage(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const res = await fetch('/api/instagram/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionData.session?.access_token || ''}`,
      },
      body: JSON.stringify({ businessId: BUSINESS_ID }),
    });
    const json = await res.json().catch(() => ({}));
    setImporting(false);
        if (!res.ok) {
      setImportMessage(
        res.status === 504
          ? 'The import took too long, but everything it finished was saved. Click again to continue.'
          : json.error || 'Import failed'
      );
      return;
    }
    setImportMessage(
      `Imported ${json.conversations} conversations (${json.messages} new messages)` +
        (json.errors?.length ? `, ${json.errors.length} could not be read` : '')
    );
  };
  // Ask the server for a signed "Connect Instagram" link for this business
  const getConnectLink = async (): Promise<string | null> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const res = await fetch('/api/auth/instagram/link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionData.session?.access_token || ''}`,
      },
      body: JSON.stringify({ businessId: BUSINESS_ID }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(json.error || 'Could not create a connect link');
      return null;
    }
    return json.url as string;
  };

  // Connect from this device
  const handleConnect = async () => {
    setConnecting(true);
    const url = await getConnectLink();
    if (url) {
      window.location.href = url;
    } else {
      setConnecting(false);
    }
  };

  // Copy a link to send to someone else (for example, the client on their phone)
  const handleCopyLink = async () => {
    const url = await getConnectLink();
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 3000);
  };

  // Load the real connected accounts for this business
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoadingBusiness(false);
      return;
    }
    supabase
      .from('businesses')
      .select('instagram_username, shopify_store_url')
      .eq('id', BUSINESS_ID)
      .maybeSingle()
      .then(({ data }) => {
        setIgUsername(data?.instagram_username || null);
        setShopifyStore(data?.shopify_store_url || null);
        setLoadingBusiness(false);
      });
  }, []);
  const [businessHoursStart, setBusinessHoursStart] = useState('09:00');
  const [businessHoursEnd, setBusinessHoursEnd] = useState('18:00');
  const [awayMessage, setAwayMessage] = useState(
    "Thanks for reaching out! We'll get back to you during business hours."
  );

  const handleShopifySync = async () => {
    setSyncing(true);
    try {
      await fetch('/api/shopify/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: BUSINESS_ID }),
      });
    } catch (err) {
      console.error('Sync failed:', err);
    }
    setSyncing(false);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-14 items-center border-b border-border px-6">
        <h1 className="text-sm font-semibold">Settings</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6 max-w-2xl">
        {/* Instagram Connection */}
        <section className="rounded-xl border border-border p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 p-2">
              <Instagram className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-medium">Instagram Connection</h2>
              <p className="text-xs text-ink-muted">
                Connect your Instagram Business account to receive and send DMs
              </p>
            </div>
          </div>

          {loadingBusiness ? (
            <div className="rounded-lg bg-surface-overlay px-4 py-3 text-sm text-ink-muted">
              Checking connection...
            </div>
          ) : igUsername ? (
            <div className="rounded-lg bg-success-light border border-success/20 px-4 py-3 flex items-center gap-2">
              <Check className="h-4 w-4 text-success" />
              <span className="text-sm text-success">Connected as @{igUsername}</span>
            </div>
          ) : (
            <div className="rounded-lg bg-surface-overlay px-4 py-3 text-sm text-ink-muted">
              No Instagram account connected
            </div>
          )}

                    <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-60"
            >
              <Instagram className="h-3.5 w-3.5" />
              {connecting
                ? 'Opening Instagram...'
                : igUsername
                ? 'Connect a different account'
                : 'Connect Instagram'}
            </button>
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-ink-muted hover:bg-surface-overlay transition-colors"
            >
              {linkCopied ? <Check className="h-3.5 w-3.5" /> : <LinkIcon className="h-3.5 w-3.5" />}
                            {linkCopied ? 'Link copied' : 'Copy link to send to someone'}
            </button>
            {igUsername && (
              <button
                onClick={handleImport}
                disabled={importing}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-ink-muted hover:bg-surface-overlay transition-colors disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${importing ? 'animate-spin' : ''}`} />
                {importing ? 'Importing...' : 'Import recent DMs'}
              </button>
            )}
          </div>
          {importMessage && (
            <p className="mt-2 text-xs text-ink">{importMessage}</p>
          )}
          <p className="mt-2 text-[11px] text-ink-muted">
            The link works for 7 days. Whoever opens it logs in to Instagram on their own device.
          </p>
        </section>

        {/* Shopify Integration */}
        <section className="rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-success-light p-2">
                <ShoppingBag className="h-4 w-4 text-success" />
              </div>
              <div>
                <h2 className="text-sm font-medium">Shopify Integration</h2>
                <p className="text-xs text-ink-muted">
                  Sync products for product cards in DMs and order lookup
                </p>
              </div>
            </div>
            <button
              onClick={handleShopifySync}
              disabled={syncing}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-overlay transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`}
              />
              {syncing ? 'Syncing...' : 'Sync Products'}
            </button>
          </div>

          <div className="rounded-lg bg-surface-overlay px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-muted">Store</span>
              <span className="font-medium">
                {loadingBusiness ? '...' : shopifyStore || 'Not connected'}
              </span>
            </div>
          </div>
        </section>

        {/* Business Hours */}
        <section className="rounded-xl border border-border p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-lg bg-warning-light p-2">
              <Clock className="h-4 w-4 text-warning" />
            </div>
            <div>
              <h2 className="text-sm font-medium">Business Hours</h2>
              <p className="text-xs text-ink-muted">
                Messages outside these hours trigger the after-hours auto-reply
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-muted">
                Opens at
              </label>
              <input
                type="time"
                value={businessHoursStart}
                onChange={(e) => setBusinessHoursStart(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-muted">
                Closes at
              </label>
              <input
                type="time"
                value={businessHoursEnd}
                onChange={(e) => setBusinessHoursEnd(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">
              After-Hours Message
            </label>
            <textarea
              value={awayMessage}
              onChange={(e) => setAwayMessage(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent transition-colors resize-none"
            />
          </div>

          <button className="mt-3 rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-accent-hover transition-colors">
            Save Hours
          </button>
        </section>

        {/* Klaviyo */}
        <section className="rounded-xl border border-border p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-lg bg-bot-light p-2">
              <Mail className="h-4 w-4 text-bot" />
            </div>
            <div>
              <h2 className="text-sm font-medium">Klaviyo Integration</h2>
              <p className="text-xs text-ink-muted">
                Collected emails are automatically added to your Klaviyo lists
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-surface-overlay px-4 py-3 text-sm text-ink-muted">
            Configure your Klaviyo API key in environment variables to enable
            email sync.
          </div>
        </section>

        {/* Webhook Info */}
        <section className="rounded-xl border border-border p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-lg bg-surface-overlay p-2">
              <Shield className="h-4 w-4 text-ink-muted" />
            </div>
            <div>
              <h2 className="text-sm font-medium">Webhook Configuration</h2>
              <p className="text-xs text-ink-muted">
                Set this URL in your Meta App&apos;s webhook settings
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-ink px-4 py-3 font-mono text-xs text-green-400">
            {process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.vercel.app'}
            /api/webhooks/instagram
          </div>
          <p className="mt-2 text-[11px] text-ink-muted">
            Verify token:{' '}
            <code className="rounded bg-surface-overlay px-1.5 py-0.5">
              inboxpilot_verify_2024
            </code>
          </p>
        </section>
      </div>
    </div>
  );
}
