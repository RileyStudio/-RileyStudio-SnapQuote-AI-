'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAllEstimates } from '@/lib/localEstimates';

// Legacy route from Phases 2–5, when there was only ever one "current
// draft." Now that every estimate has its own persistent record and URL,
// this just forwards to the most recently updated one — or to a blank
// New Estimate if nothing exists yet — rather than 404ing on old links.
export default function LegacyReviewRedirect() {
  const router = useRouter();

  useEffect(() => {
    const all = getAllEstimates();
    if (all.length > 0) {
      router.replace(`/estimates/${all[0].id}/review`);
    } else {
      router.replace('/estimates/new');
    }
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <p className="text-ink/50">Redirecting…</p>
    </main>
  );
}
