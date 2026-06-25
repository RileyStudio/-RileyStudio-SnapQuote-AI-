'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Logo from '@/components/Logo';

// Supabase can land a finished login back on this page in more than one
// shape depending on the flow that actually fired:
//   1. PKCE: a real ?code=... query param to exchange for a session.
//   2. Implicit/magic-link: #access_token=...&refresh_token=... in the
//      URL hash — supabase-js's own client (detectSessionInUrl: true by
//      default in lib/supabaseClient.js) usually parses this itself
//      before this component even mounts, but not always synchronously,
//      so this still checks for an existing session AND listens briefly
//      for one to appear.
//   3. An expired/already-used link: Supabase appends
//      #error=...&error_code=otp_expired&error_description=... instead of
//      a token — this needs its own friendly message, not a generic one.
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
      // Case 3 first: an explicit expired/used-link error in the hash.
      if (typeof window !== 'undefined' && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.slice(1));
        if (hashParams.get('error')) {
          if (!cancelled) setStatus('expired');
          return;
        }
      }

      // Case 2a: a session may already exist — either detectSessionInUrl
      // already parsed a hash-fragment session before this effect ran, or
      // (in demo testing) a session from earlier in this browser is still
      // valid.
      const { data: existing } = await supabase.auth.getSession();
      if (existing?.session) {
        router.replace('/dashboard');
        return;
      }

      // Case 1: PKCE — an explicit ?code= to exchange.
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

      // Case 2b: the hash session hasn't finished parsing yet — give the
      // SDK a brief window to fire onAuthStateChange before giving up.
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
          <a href="/login" className="text-sm font-display font-semibold text-site underline">
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
