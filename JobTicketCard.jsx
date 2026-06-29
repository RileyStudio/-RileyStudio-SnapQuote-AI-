'use client';

import Link from 'next/link';

export default function DemoLimitNotice({ label, max }) {
  return (
    <div className="rounded-card bg-orange/10 border border-orange/30 p-4 text-center">
      <p className="font-display font-semibold text-sm text-ink">
        You&apos;ve used all {max} {label} in this demo.
      </p>
      <p className="text-xs text-ink/60 mt-1 mb-3">
        Become a Founding Contractor to keep going — no limits, your own branding, real history.
      </p>
      <Link
        href="/plans"
        className="inline-flex items-center justify-center rounded-card bg-orange text-white
          font-display font-semibold text-sm px-5 py-2.5 hover:bg-orange-dark transition-colors"
      >
        See Founder Pricing
      </Link>
    </div>
  );
}
