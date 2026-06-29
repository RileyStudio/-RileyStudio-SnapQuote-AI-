'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { supabase } from '@/lib/supabaseClient';

// Email + password auth, replacing the old magic-link-only flow — the
// goal is that a contractor never has to leave the app to verify email
// before getting into the dashboard. This works best with Supabase's
// "Confirm email" setting turned OFF (see README → "Supabase Auth
// settings"); with it off, signUp() returns a real session immediately
// and this page routes straight to /dashboard. With it on, Supabase
// withholds the session until the link is clicked, so this page falls
// back to a clear in-app message instead of a session it doesn't have —
// app/auth/callback/page.jsx exists for that fallback case.
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loadingAction, setLoadingAction] = useState(null); // 'signup' | 'login' | null

  function validateFields() {
    if (!email || !password) {
      setError('Enter both an email and a password.');
      return false;
    }
    return true;
  }

  function clearDemoSessionFlag() {
    // A real login/signup must never leave a stale demo flag behind —
    // this is what previously let a real account show a "Demo Mode"
    // badge if the same browser had earlier clicked "Launch limited
    // demo." Dashboard's own check is now also defended independently
    // (see app/dashboard/page.jsx), but clearing it here at the source is
    // the more correct fix.
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('snapquote.demoSession');
      }
    } catch (e) {
      // Ignore — worst case the defense-in-depth check elsewhere still holds.
    }
  }

  async function handleCreateAccount() {
    setError('');
    setInfo('');

    if (!supabase) {
      setError(
        'This is a demo build with no live login configured. Use "Launch limited demo" below.'
      );
      return;
    }
    if (!validateFields()) return;

    setLoadingAction('signup');
    // Only relevant if Supabase's "Confirm email" is left on — with it
    // off (the recommended setting), no confirmation email is sent at
    // all, so this option is simply unused. Omitted rather than blocking
    // account creation if NEXT_PUBLIC_SITE_URL isn't set, since it's only
    // a fallback for a fallback path.
    const signUpOptions = process.env.NEXT_PUBLIC_SITE_URL
      ? { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` }
      : undefined;
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: signUpOptions,
    });
    setLoadingAction(null);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data?.session) {
      // "Confirm email" is off — a real session comes back immediately,
      // so there's nothing to leave the app for.
      clearDemoSessionFlag();
      router.push('/dashboard');
    } else {
      // Supabase still requires email confirmation for this project.
      setInfo('Account created. Check your email to confirm, then log in.');
    }
  }

  async function handleLogIn() {
    setError('');
    setInfo('');

    if (!supabase) {
      setError(
        'This is a demo build with no live login configured. Use "Launch limited demo" below.'
      );
      return;
    }
    if (!validateFields()) return;

    setLoadingAction('login');
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoadingAction(null);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    clearDemoSessionFlag();
    router.push('/dashboard');
  }

  return (
    <main className="min-h-screen flex flex-col justify-center px-5 py-10">
      <div className="max-w-sm w-full mx-auto">
        <div className="mb-8 text-center">
          <Logo size="lg" className="justify-center" />
        </div>

        {/* type="button" on both actions, not type="submit" — there are
            two distinct actions sharing one set of fields, and a plain
            <form onSubmit> would have to guess which one the Enter key
            meant. preventDefault here just stops a stray page reload. */}
        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
          <label className="block">
            <span className="font-display font-semibold text-sm uppercase tracking-wide text-ink/70">
              Email
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourcompany.com"
              className="tap-target mt-1 w-full rounded-card border border-line bg-white px-4 text-lg
                focus-visible:outline focus-visible:outline-3 focus-visible:outline-site"
            />
          </label>

          <label className="block">
            <span className="font-display font-semibold text-sm uppercase tracking-wide text-ink/70">
              Password
            </span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="tap-target mt-1 w-full rounded-card border border-line bg-white px-4 text-lg
                focus-visible:outline focus-visible:outline-3 focus-visible:outline-site"
            />
          </label>

          {error && <p className="text-sm text-orange-dark">{error}</p>}
          {info && <p className="text-sm text-approved">{info}</p>}

          {/* Plain native <button>s, not BigButton — large, high-contrast,
              unambiguous about which action each one performs. */}
          <button
            type="button"
            onClick={handleCreateAccount}
            disabled={loadingAction !== null}
            className="tap-target w-full rounded-card bg-orange text-white font-display font-bold
              text-lg px-6 shadow-soft hover:bg-orange-dark active:bg-orange-dark transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingAction === 'signup' ? 'Creating account…' : 'Create account'}
          </button>

          <button
            type="button"
            onClick={handleLogIn}
            disabled={loadingAction !== null}
            className="tap-target w-full rounded-card border-2 border-site text-site font-display
              font-bold text-lg px-6 hover:bg-site/5 transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingAction === 'login' ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        {/* Always visible — a clear secondary path below the real login
            form, not gated behind any Supabase/error state. A plain Link
            to /demo, which already owns the entire "enter demo mode"
            sequence (sets the flag, redirects to /dashboard) — no
            duplicate logic here, and /demo itself is untouched. */}
        <div className="mt-6 pt-6 border-t border-line">
          <Link
            href="/demo"
            className="tap-target w-full flex items-center justify-center rounded-card border-2
              border-line font-display font-semibold text-lg px-6 text-ink/70 hover:bg-line/20 transition-colors"
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
