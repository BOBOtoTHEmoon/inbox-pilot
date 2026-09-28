// Shown after someone connects (or fails to connect) their Instagram.
// Works without logging in, so a client can use a connect link on their own phone.

import Link from 'next/link';
import { Check, X } from 'lucide-react';

export default async function ConnectedPage({
  searchParams,
}: {
  searchParams: Promise<{ username?: string; error?: string; imported?: string }>;
}) {
  const { username, error, imported } = await searchParams;
  const ok = !!username && !error;
  const importedCount = Number(imported || 0);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-raised px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 text-center">
        <div
          className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
            ok ? 'bg-success-light text-success' : 'bg-danger-light text-danger'
          }`}
        >
          {ok ? <Check className="h-6 w-6" /> : <X className="h-6 w-6" />}
        </div>
        <h1 className="text-lg font-semibold">
          {ok ? 'Instagram connected' : 'Could not connect'}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          {ok
            ? `@${username} is now connected.${
                importedCount > 0 ? ` ${importedCount} recent conversations were imported.` : ''
              } New DMs will appear in the inbox.`
            : error || 'Something went wrong. Please try again.'}
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <Link
            href="/inbox"
            className="rounded-lg bg-accent py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
          >
            Go to inbox
          </Link>
          {!ok && (
            <Link
              href="/settings"
              className="rounded-lg border border-border py-2.5 text-sm font-medium text-ink-muted hover:bg-surface-overlay transition-colors"
            >
              Back to settings
            </Link>
          )}
        </div>
        {ok && (
          <p className="mt-3 text-[11px] text-ink-muted">
            If someone sent you this link, you are done and can close this page.
          </p>
        )}
      </div>
    </div>
  );
}