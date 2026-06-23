'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import BigButton from '@/components/BigButton';
import { supabase, DEMO_MODE } from '@/lib/supabaseClient';

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

    const { error: authError } = await supabase.auth.signInWithOtp({ email });
    if (authError) {
      setError(authError.message);
    } else {
      setSent(true);
    }
  }

  function continueAsDemo() {
    // Sets a lightweight client-side flag the dashboard checks for in demo mode.
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('snapquote_demo_session', 'true');
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

        {(DEMO_MODE || !supabase) && (
          <div className="mt-6 pt-6 border-t border-line">
            <BigButton variant="secondary" onClick={continueAsDemo}>
              Continue with the demo account
            </BigButton>
            <p className="mt-2 text-center text-xs text-ink/50">
              Riley Roofing Co. — sample jobs and an approved quote already loaded.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
