// Shown after someone connects (or fails to connect) their Instagram.
// Works without logging in, so a client can use a connect link on their own phone.

import { Check, X } from 'lucide-react';

export default async function ConnectedPage({
  searchParams,
}: {
  searchParams: Promise<{ username?: string; error?: string }>;
}) {
  const { username, error } = await searchParams;
  const ok = !!username && !error;

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
            ? `@${username} is now connected. New DMs will appear in the inbox. You can close this page.`
            : error || 'Something went wrong. Please try again.'}
        </p>
      </div>
    </div>
  );
}