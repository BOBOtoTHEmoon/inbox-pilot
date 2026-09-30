'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { LogoMark } from '@/components/ui/LogoMark';

// Supabase's error messages, reworded for people
function friendlyError(message: string) {
  if (/invalid login credentials/i.test(message)) return 'That email and password do not match. Check both and try again.';
  if (/email not confirmed/i.test(message)) return 'This account has not been confirmed yet. Ask the person who set it up.';
  if (/network|fetch/i.test(message)) return 'Could not reach the server. Check your connection and try again.';
  return message;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signInError) {
      setError(friendlyError(signInError.message));
      return;
    }
    window.location.href = '/inbox';
  };

  const inputClass =
    'h-11 w-full rounded-lg border border-border bg-surface px-3 text-base md:text-sm outline-none focus-visible:outline-none focus:border-ink transition-colors placeholder:text-ink-faint';

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface px-5 py-10">
      <div className="w-full max-w-[360px]">
        <LogoMark className="h-10 w-10 text-ink" />
        <h1 className="mt-6 text-[22px] font-semibold tracking-[-0.02em]">Sign in to InboxPilot</h1>
               <p className="mt-1.5 text-sm text-ink-muted">One place for every customer, conversation and sale.</p>
        <form onSubmit={handleLogin} className="mt-8 space-y-4" noValidate>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink-light">Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@business.com"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink-light">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </label>

          {error && (
            <p role="alert" className="rounded-lg bg-danger-light px-3 py-2 text-[13px] text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-11 w-full rounded-lg bg-ink text-sm font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-8 text-xs leading-relaxed text-ink-faint">
          Forgot your password? Ask the person who set up your account to reset it.
        </p>
      </div>
    </div>
  );
}