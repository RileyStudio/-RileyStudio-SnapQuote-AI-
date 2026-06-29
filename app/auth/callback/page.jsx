'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Logo from '@/components/Logo';

// Login itself is email + password now (app/login/page.jsx) — this page
// is only a fallback for a Supabase EMAIL CONFIRMATION link, for projects
// where "Confirm email" is left on (see README). If it's off, as
// recommended, a contractor never lands here at all: signUp() returns a
// session immediately and app/login/page.jsx routes straight to
// /dashboard itself. Deliberately simple either way: reads ?code= from
// window.location.search (not useSearchParams(), so no Suspense boundary
// needed), exchanges it, and either lands on /dashboard or shows a
// friendly expired/used message with a way back to /login.
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState(false);

  useEffect(() => {
    async function run() {
      if (!supabase) {
        router.replace('/login');
        return;
      }

      const code = new URLSearchParams(window.location.search).get('code');

      if (!code) {
        setError(true);
        return;
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        setError(true);
        return;
      }

      try {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('snapquote.demoSession');
        }
      } catch (e) {
        // Ignore — Dashboard's own check is defended independently too.
      }

      router.replace('/dashboard');
    }

    run();
  }, [router]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 text-center">
      <Logo size="lg" className="justify-center mb-6" />
      {error ? (
        <>
          <p className="text-sm text-orange-dark max-w-sm mb-4">
            This link expired or was already used. Please log in again.
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
