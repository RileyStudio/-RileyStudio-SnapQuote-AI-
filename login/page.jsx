'use client';

import { useState } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');

    if (!supabase) {
      // No Supabase project configured yet — this is expected in demo mode.
      setError(
        'This is a demo build with no live login configured. Use "Launch limited demo" below.'
      );
      return;
    }

    setSending(true);

    // NEXT_PUBLIC_SITE_URL should be set to the canonical production URL
    // (and that exact /auth/callback path added to Supabase's Auth ->
    // URL Configuration -> Redirect URLs allow-list, alongside any
    // Netlify preview URL and custom domain) — falling back to the
    // current origin keeps this working in local dev without it.
    //
    // signInWithOtp's actual API parameter is `emailRedirectTo`, not
    // `redirectTo` (that name is for signInWithOAuth) — using the
    // correct one is what makes this option take effect at all.
    const rawSiteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (typeof window !== 'undefined' ? window.location.origin : '');
    // Defensive: a trailing slash on NEXT_PUBLIC_SITE_URL (e.g.
    // "https://example.com/") would otherwise silently produce
    // "https://example.com//auth/callback" — a malformed double-slash
    // URL that can fail in ways that look exactly like "couldn't connect."
    const siteUrl = rawSiteUrl.replace(/\/+$/, '');

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${siteUrl}/auth/callback` },
    });

    setSending(false);

    if (authError) {
      setError(authError.message);
    } else {
      setSent(true);
    }
  }

  return (
    <main className="min-h-screen flex flex-col justify-center px-5 py-10">
      <div className="max-w-sm w-full mx-auto">
        <div className="mb-8 text-center">
          <Logo size="lg" className="justify-center" />
        </div>

        {sent ? (
          <p className="text-center text-ink/80">
            Check your email for a login link.
          </p>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <label className="block">
              <span className="font-display font-semibold text-sm uppercase tracking-wide text-ink/70">
                Email
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourcompany.com"
                className="tap-target mt-1 w-full rounded-card border border-line bg-white px-4 text-lg
                  focus-visible:outline focus-visible:outline-3 focus-visible:outline-site"
              />
            </label>

            {error && <p className="text-sm text-orange-dark">{error}</p>}

            {/* Plain native <button>, not BigButton — large, orange,
                high-contrast, unambiguously the primary action on this
                page, full-width on mobile by default (no fullWidth prop
                to second-guess). */}
            <button
              type="submit"
              disabled={sending}
              className="tap-target w-full rounded-card bg-orange text-white font-display font-bold
                text-lg px-6 shadow-soft hover:bg-orange-dark active:bg-orange-dark transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? 'Sending…' : 'Send secure login link'}
            </button>
          </form>
        )}

        {/* Always visible — a clear secondary path below the real login
            form, not gated behind any Supabase/error state. A plain Link
            to /demo, which already owns the entire "enter demo mode"
            sequence (sets the flag, redirects to /dashboard) — no
            duplicate logic here. */}
        <div className="mt-6 pt-6 border-t border-line">
          <Link
            href="/demo"
            className="tap-target w-full flex items-center justify-center rounded-card border-2
              border-site font-display font-semibold text-lg px-6 text-site hover:bg-site/5 transition-colors"
          >
            Launch limited demo
          </Link>
          <p className="mt-3 text-center text-xs text-ink/50">
            Demo mode is for testing only. Example quotes are watermarked and limited.
          </p>
        </div>
      </div>
    </main>
  );
}
