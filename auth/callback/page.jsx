'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Logo from '@/components/Logo';

// Supabase can land a finished login back on this page in more than one
// shape depending on which flow actually fired:
//   1. An expired/already-used link: Supabase appends
//      #error=...&error_code=otp_expired&error_description=... instead of
//      a token — checked first, with its own friendly message.
//   2. Magic-link/implicit flow: #access_token=...&refresh_token=... in
//      the URL hash. Read and applied EXPLICITLY here via setSession() —
//      not left to the SDK's own detectSessionInUrl auto-parsing, which
//      depends on internal timing this page can't fully control or
//      verify across every deployment. This is the main fix in this pass:
//      the previous version only ever checked whether a session already
//      existed, never actually read access_token/refresh_token itself.
//   3. PKCE flow: a real ?code=... query param, exchanged explicitly via
//      exchangeCodeForSession().
//   4. A session that already exists by the time this runs (rare, but
//      cheap to check) — and, failing all of the above, a brief listener
//      in case something is still resolving asynchronously.
function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('loading'); // 'loading' | 'expired'

  useEffect(() => {
    if (!supabase) {
      router.replace('/login');
      return;
    }

    let cancelled = false;
    let unsubscribe = () => {};

    async function run() {
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);

      // Case 1: explicit expired/used-link error in the hash.
      if (hashParams.get('error')) {
        if (!cancelled) setStatus('expired');
        return;
      }

      // Case 2: explicit hash tokens — set the session directly.
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          if (!cancelled) setStatus('expired');
          return;
        }
        router.replace('/dashboard');
        return;
      }

      // Case 3: PKCE — an explicit ?code= to exchange.
      const code = searchParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (!cancelled) setStatus('expired');
          return;
        }
        router.replace('/dashboard');
        return;
      }

      // Case 4a: a session may already exist.
      const { data: existing } = await supabase.auth.getSession();
      if (existing?.session) {
        router.replace('/dashboard');
        return;
      }

      // Case 4b: give the SDK a brief window to fire onAuthStateChange
      // before giving up — covers any shape not explicitly handled above.
      const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
          router.replace('/dashboard');
        }
      });
      unsubscribe = () => listener.subscription.unsubscribe();

      setTimeout(() => {
        if (!cancelled) setStatus('expired');
      }, 3000);
    }

    run();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [searchParams, router]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 text-center">
      <Logo size="lg" className="justify-center mb-6" />
      {status === 'expired' ? (
        <>
          <p className="text-sm text-orange-dark max-w-sm mb-4">
            This login link expired or was already used. Request a new link.
          </p>
          <a
            href="/login"
            className="tap-target inline-flex items-center justify-center rounded-card bg-orange
              text-white font-display font-bold text-base px-6 hover:bg-orange-dark transition-colors"
          >
            Back to login
          </a>
        </>
      ) : (
        <p className="text-ink/50 font-display font-semibold">Signing you in…</p>
      )}
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center">
          <p className="text-ink/50">Loading…</p>
        </main>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
