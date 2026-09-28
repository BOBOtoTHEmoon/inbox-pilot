'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    window.location.href = '/inbox';
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-raised px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-white">
            <Send className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">InboxPilot</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Instagram DM Automation
          </p>
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-border bg-surface p-6">
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-muted">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-muted">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent transition-colors"
              />
            </div>
            {error && (
              <p className="text-xs text-red-600">{error}</p>
            )}
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
