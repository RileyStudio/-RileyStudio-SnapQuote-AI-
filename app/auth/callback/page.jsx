'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Logo from '@/components/Logo';

// Exchanges the ?code=... Supabase puts on the magic-link redirect for a
// real session, using the same client-side `supabase` instance the rest
// of the app already uses (lib/supabaseClient.js) — this app has no
// server-side/SSR auth layer, so there's no separate server client to
// route this through. exchangeCodeForSession() works fine client-side;
// the resulting session is stored the same way signInWithOtp's eventual
// session would have been.
function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    async function exchange() {
      if (!supabase) {
        router.replace('/login');
        return;
      }

      const code = searchParams.get('code');
      if (!code) {
        setError('Missing login code — the link may have expired. Request a new one from the login page.');
        return;
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        setError(exchangeError.message);
        return;
      }

      router.replace('/dashboard');
    }
    exchange();
  }, [searchParams, router]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 text-center">
      <Logo size="lg" className="justify-center mb-6" />
      {error ? (
        <>
          <p className="text-sm text-orange-dark max-w-sm mb-4">{error}</p>
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
