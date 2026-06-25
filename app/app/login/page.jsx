'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import BigButton from '@/components/BigButton';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setError('');

    if (!supabase) {
      // No Supabase project configured yet — this is expected in demo mode.
      setError(
        'This is a demo build with no live login configured. Use "Continue with the demo account" below.'
      );
      return;
    }

    // NEXT_PUBLIC_SITE_URL should be set to the canonical production URL
    // (and that exact /auth/callback path added to Supabase's Auth ->
    // URL Configuration -> Redirect URLs allow-list, alongside any
    // Netlify preview URL and custom domain) — falling back to the
    // current origin keeps this working in local dev without it.
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (typeof window !== 'undefined' ? window.location.origin : '');

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${siteUrl}/auth/callback` },
    });
    if (authError) {
      setError(authError.message);
    } else {
      setSent(true);
    }
  }

  function handleDemoLogin() {
    // Demo mode must work even if Supabase is misconfigured or storage is
    // blocked (e.g. private browsing) — the localStorage write is best-
    // effort, but navigation to the dashboard always happens regardless.
    // Does not call Supabase auth at all.
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('snapquote.demoSession', 'true');
      }
    } catch (e) {
      // Ignore — demo mode doesn't strictly require this flag to be set;
      // the dashboard itself never gates access on it.
    }
    router.push('/dashboard');
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

            <BigButton type="submit" variant="primary">
              Send Login Link
            </BigButton>
          </form>
        )}

        {/* Always visible — a secondary demo option below the real login
            form, not gated behind any Supabase/error state. Plain native
            <button>, not BigButton: no component prop/event-handling
            surface between this click and the navigation it triggers. */}
        <div className="mt-6 pt-6 border-t border-line">
          <button
            type="button"
            onClick={handleDemoLogin}
            className="tap-target w-full rounded-card font-display font-semibold text-lg tracking-wide
              px-6 transition-colors bg-site text-white hover:bg-site-dark active:bg-site-dark"
          >
            Continue with the demo account
          </button>
          <p className="mt-2 text-center text-xs text-ink/50">
            Riley Roofing Co. — sample jobs and an approved quote already loaded.
          </p>
        </div>
      </div>
    </main>
  );
}
