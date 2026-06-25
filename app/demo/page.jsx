'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// A second, independent entry point into demo mode (alongside the demo
// button on /login) — Landing's "Try the Demo" CTA points straight here.
// Sets the same flag the login page's demo button sets, then forwards to
// the dashboard. Kept as its own route rather than folded into the
// landing page so the redirect logic lives in exactly one place either
// way someone arrives at it.
export default function DemoLaunchPage() {
  const router = useRouter();

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('snapquote.demoSession', 'true');
      }
    } catch (e) {
      // Ignore — demo mode doesn't strictly require this flag to be set;
      // the dashboard itself never gates access on it.
    }
    router.replace('/dashboard');
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <p className="text-ink/50 font-display font-semibold">Launching demo...</p>
    </main>
  );
}
