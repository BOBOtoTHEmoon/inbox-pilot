'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { Instagram, Link as LinkIcon, RefreshCw, Check, LogOut, ShoppingBag, Mail, MessageCircle, Store } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const BUSINESS_ID = process.env.NEXT_PUBLIC_BUSINESS_ID || 'demo';

// One settings group: title and explanation on the left, controls on the right
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border py-8 first:pt-2 last:border-0">
      <div className="md:grid md:grid-cols-[220px_1fr] md:gap-10">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{description}</p>
        </div>
        <div className="mt-4 md:mt-0">{children}</div>
      </div>
    </section>
  );
}

const buttonSecondary =
  'flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] font-medium text-ink hover:bg-surface-raised transition-colors disabled:opacity-60';
const buttonPrimary =
  'flex items-center justify-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-[13px] font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-60';

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [igUsername, setIgUsername] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  // Instagram
  const [connecting, setConnecting] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  // Business hours
  const [opens, setOpens] = useState('09:00');
  const [closes, setCloses] = useState('18:00');
  const [savedHours, setSavedHours] = useState({ opens: '09:00', closes: '18:00' });
  const [savingHours, setSavingHours] = useState(false);
  const [hoursMessage, setHoursMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    Promise.all([
      supabase
        .from('businesses')
        .select('instagram_username, business_hours_start, business_hours_end')
        .eq('id', BUSINESS_ID)
        .maybeSingle(),
      supabase.auth.getUser(),
    ]).then(([{ data }, { data: userData }]) => {
      setIgUsername(data?.instagram_username || null);
      const o = (data?.business_hours_start || '09:00').slice(0, 5);
      const c = (data?.business_hours_end || '18:00').slice(0, 5);
      setOpens(o);
      setCloses(c);
      setSavedHours({ opens: o, closes: c });
      setEmail(userData.user?.email || null);
      setLoading(false);
    });
  }, []);

  const authHeaders = async () => {
    const { data } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session?.access_token || ''}`,
    };
  };

  // A signed "Connect Instagram" link for this business
  const getConnectLink = async (): Promise<string | null> => {
    const res = await fetch('/api/auth/instagram/link', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ businessId: BUSINESS_ID }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(json.error || 'Could not create a connect link');
      return null;
    }
    return json.url as string;
  };

  const handleConnect = async () => {
    setConnecting(true);
    const url = await getConnectLink();
    if (url) window.location.href = url;
    else setConnecting(false);
  };

  const handleCopyLink = async () => {
    const url = await getConnectLink();
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 3000);
  };

  const handleImport = async () => {
    setImporting(true);
    setImportMessage(null);
    const res = await fetch('/api/instagram/import', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ businessId: BUSINESS_ID }),
    });
    const json = await res.json().catch(() => ({}));
    setImporting(false);
    if (!res.ok) {
      setImportMessage(
        res.status === 504
          ? 'The import took too long, but everything it finished was saved. Click again to continue.'
          : json.error || 'Import failed. Try again in a minute.'
      );
      return;
    }
    setImportMessage(
      `Imported ${json.conversations} conversations.` +
        (json.errors?.length ? ` ${json.errors.length} could not be read.` : '')
    );
  };

  const hoursChanged = opens !== savedHours.opens || closes !== savedHours.closes;

  const handleSaveHours = async () => {
    setSavingHours(true);
    setHoursMessage(null);
    const { error } = await supabase
      .from('businesses')
      .update({ business_hours_start: opens, business_hours_end: closes })
      .eq('id', BUSINESS_ID);
    setSavingHours(false);
    if (error) {
      setHoursMessage('Could not save. Check your connection and try again.');
      return;
    }
    setSavedHours({ opens, closes });
    setHoursMessage('Saved');
    setTimeout(() => setHoursMessage(null), 2000);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  const timeInput =
    'h-10 w-full rounded-lg border border-border bg-surface px-3 text-base md:text-sm outline-none focus-visible:outline-none focus:border-ink tabular-nums';

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center border-b border-border px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-3 md:h-16 md:px-6 md:py-0">
        <h1 className="text-[17px] font-semibold tracking-[-0.01em]">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 pt-6 pb-tabbar md:px-6">
        <div className="mx-auto max-w-3xl">
          {/* Instagram */}
          <Section
            title="Instagram"
            description="The account whose DMs come into this inbox."
          >
            {loading ? (
              <div className="h-12 rounded-lg bg-surface-raised" />
            ) : igUsername ? (
              <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-overlay">
                  <Instagram className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">@{igUsername}</p>
                  <p className="flex items-center gap-1 text-xs text-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    Connected
                  </p>
                </div>
              </div>
            ) : (
              <p className="rounded-lg bg-surface-raised px-3 py-2.5 text-[13px] text-ink-muted">
                No Instagram account connected yet.
              </p>
            )}

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button onClick={handleConnect} disabled={connecting} className={buttonPrimary}>
                <Instagram className="h-4 w-4" />
                {connecting ? 'Opening Instagram...' : igUsername ? 'Connect a different account' : 'Connect Instagram'}
              </button>
              <button onClick={handleCopyLink} className={buttonSecondary}>
                {linkCopied ? <Check className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
                {linkCopied ? 'Link copied' : 'Copy link for someone else'}
              </button>
              {igUsername && (
                <button onClick={handleImport} disabled={importing} className={buttonSecondary}>
                  <RefreshCw className={clsx('h-4 w-4', importing && 'animate-spin')} />
                  {importing ? 'Importing...' : 'Import recent DMs'}
                </button>
              )}
            </div>
            {importMessage && <p className="mt-2 text-[13px] text-ink-light">{importMessage}</p>}
            <p className="mt-3 text-xs leading-relaxed text-ink-faint">
              The link works for 7 days. Whoever opens it logs in to Instagram on their own phone, so no
              passwords are shared.
            </p>
          </Section>

          {/* Business hours */}
          <Section
            title="Business hours"
            description="Outside these hours, your 'Outside business hours' auto-reply answers for you. Times are Lagos time."
          >
            <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
              <label className="block">
                <span className="mb-1.5 block text-[13px] text-ink-muted">Opens</span>
                <input type="time" value={opens} onChange={(e) => setOpens(e.target.value)} className={timeInput} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[13px] text-ink-muted">Closes</span>
                <input type="time" value={closes} onChange={(e) => setCloses(e.target.value)} className={timeInput} />
              </label>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button onClick={handleSaveHours} disabled={!hoursChanged || savingHours} className={buttonPrimary}>
                {savingHours ? 'Saving...' : 'Save hours'}
              </button>
              {hoursMessage && (
                <span className={clsx('text-[13px]', hoursMessage === 'Saved' ? 'text-success' : 'text-danger')}>
                  {hoursMessage}
                </span>
              )}
            </div>
            <p className="mt-3 text-xs text-ink-faint">
              Edit the message itself in{' '}
              <Link href="/automations" className="text-ink-light underline underline-offset-2 hover:text-ink">
                Automations
              </Link>
              .
            </p>
          </Section>

          {/* Coming soon */}
                    <Section
            title="Connections"
            description="Everywhere you talk to customers and sell, brought into one place."
          >
            <ul className="divide-y divide-border rounded-lg border border-border">
              {[
                { icon: MessageCircle, name: 'WhatsApp', text: 'WhatsApp chats in the same inbox' },
                { icon: Mail, name: 'Email', text: 'Send and receive customer emails from the inbox' },
                { icon: ShoppingBag, name: 'Shopify', text: 'Products, orders and payment links from a chat' },
                { icon: Store, name: 'Point of sale', text: 'In-store sales on each customer’s history' },
              ].map((item) => (
                <li key={item.name} className="flex items-center gap-3 px-3 py-3">
                  <item.icon className="h-4 w-4 shrink-0 text-ink-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-ink-muted">{item.text}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-surface-overlay px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                    Coming soon
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          {/* Account */}
          <Section title="Your account" description="The login you use for InboxPilot.">
            <div className="flex flex-col gap-3 rounded-lg border border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs text-ink-muted">Signed in as</p>
                <p className="truncate text-sm font-medium">{email || '...'}</p>
              </div>
              <button onClick={handleSignOut} className={buttonSecondary}>
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}