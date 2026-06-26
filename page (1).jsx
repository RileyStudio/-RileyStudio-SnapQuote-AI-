import Link from 'next/link';
import Logo from '@/components/Logo';
import PricingTable from '@/components/PricingTable';

export default function LandingPage() {
  return (
    <main>
      <header className="flex items-center justify-between px-5 py-4 max-w-5xl mx-auto">
        <Logo />
        <Link
          href="/login"
          className="tap-target inline-flex items-center justify-center rounded-card bg-orange
            text-white font-display font-bold text-sm px-5 hover:bg-orange-dark transition-colors"
        >
          Log in
        </Link>
      </header>

      {/* Hero — problem, then promise. No "AI-powered" framing up top;
          the framing is the actual gap that loses contractors real jobs. */}
      <section className="px-5 pt-8 pb-10 max-w-5xl mx-auto">
        <h1 className="font-display font-extrabold text-4xl sm:text-5xl leading-[1.05] max-w-xl">
          You lose more jobs to slow quotes than bad ones.
        </h1>
        <p className="mt-4 text-lg text-ink/80 max-w-md">
          The gap between &quot;I&apos;ll send the quote&quot; and actually sending it is where
          the next guy gets the job. SnapQuote turns your job-site photos, notes, materials,
          and labor into a clean, branded estimate your customer can open and approve —
          before you&apos;re back in the truck.
        </p>
        <p className="mt-3 text-sm font-display font-semibold text-orange-dark">
          Founder offer: first 10 contractors lock in $10/month.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 max-w-md">
          <Link
            href="/demo"
            className="tap-target inline-flex items-center justify-center rounded-card bg-site px-8 py-3 font-display font-bold text-paper shadow-soft"
          >
            Try Limited Demo
          </Link>
          <Link
            href="/quote/demo-quote-001"
            className="tap-target inline-flex items-center justify-center rounded-card border border-line bg-transparent px-8 py-3 font-display font-bold text-ink"
          >
            See Sample Quote
          </Link>
          <a
            href="#showcase"
            className="tap-target inline-flex items-center justify-center rounded-card border border-dashed border-line bg-transparent px-8 py-3 font-display font-bold text-ink/70"
          >
            Showcase
          </a>
        </div>

        {/* Transformation visual: phone-in-truck → branded quote */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
          <PhoneMock label="Photos + job notes" tone="raw" />
          <ArrowDivider />
          <PhoneMock label="Branded PDF quote" tone="polished" />
        </div>
      </section>

      {/* How it works */}
      <section className="bg-surface text-paper px-5 py-12">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-3 gap-8">
          <Step n="1" title="Photos" body="Snap the job site, right from your truck." />
          <Step n="2" title="Notes" body="Talk through the scope like you would to a foreman, or just type it." />
          <Step n="3" title="Branded quote" body="You check it, your customer approves it with one tap." />
        </div>
      </section>

      {/* Founding Contractor offer — the centerpiece of this page. This is
          a builder-with-contractors offer, not a discount: the deal is
          access to the person building this and influence over what gets
          built next, priced like an early hire, not a coupon. */}
      <section className="px-5 py-14 bg-ink text-paper">
        <div className="max-w-3xl mx-auto">
          <p className="font-display font-semibold text-xs uppercase tracking-widest text-orange mb-3">
            First 10 only
          </p>
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl leading-tight mb-4">
            We&apos;re building this with 10 contractors first.
          </h2>
          <p className="text-paper/80 max-w-xl mb-3">
            SnapQuote is opening early access to 10 contractors who want faster estimates,
            branded quotes, customer approval links, and a say in what gets built next.
          </p>
          <p className="text-paper/60 text-sm max-w-xl mb-8">
            After the first 10 seats are filled, pricing and access will move to the standard
            public plans.
          </p>

          <ul className="space-y-4 mb-10">
            <FounderPoint>
              <strong className="text-paper">$10/month, locked in for life</strong> as long as
              you stay subscribed. Not a teaser rate. Not a 90-day discount.
            </FounderPoint>
            <FounderPoint>
              <strong className="text-paper">A direct line to the builder.</strong> Tell us what
              slows you down on real jobs, and we use that feedback to shape the product.
            </FounderPoint>
            <FounderPoint>
              <strong className="text-paper">Your logo and branding on every PDF and quote
              page</strong> your customers see. It looks like it came from your business because
              it did.
            </FounderPoint>
            <FounderPoint>
              <strong className="text-paper">Discounted access to future add-ons</strong> for as
              long as you stay subscribed.
            </FounderPoint>
          </ul>

          <Link
            href="/login"
            className="tap-target inline-flex items-center justify-center rounded-card bg-orange
              px-8 py-3 font-display font-bold text-white shadow-soft"
          >
            Become a Founding Contractor
          </Link>
          <p className="text-paper/50 text-xs mt-3">
            No payment collected yet. Early access pricing locks in when billing goes live.
          </p>
        </div>
      </section>

      {/* Pricing comparison — the actual numbers, for anyone comparing
          rather than just reading the pitch above. */}
      <section id="pricing" className="px-5 py-14 max-w-5xl mx-auto">
        <h2 className="font-display font-bold text-2xl mb-2">Pricing</h2>
        <p className="text-ink/60 max-w-2xl mb-8">
          Founder gives early contractors Pro-level value for $10/month while the product is
          being shaped with real feedback.
        </p>
        <PricingTable highlightPlan="founder" />
      </section>

      {/* Showcase — placeholder section, same page, no new route yet */}
      <section id="showcase" className="px-5 py-14 max-w-5xl mx-auto">
        <h2 className="font-display font-bold text-2xl mb-2">Showcase</h2>
        <p className="text-ink/60 max-w-xl mb-8">
          Real contractors, real estimates — coming soon as the first 10 come on board.
        </p>
        <div className="grid sm:grid-cols-3 gap-4">
          <ShowcasePlaceholder />
          <ShowcasePlaceholder />
          <ShowcasePlaceholder />
        </div>
      </section>

      <footer className="px-5 py-8 text-center text-sm text-ink/60 border-t border-line">
        No big team. No corporate roadmap. Just the next fix you actually need, shipped by the
        person who built this.
      </footer>
    </main>
  );
}

function Step({ n, title, body }) {
  return (
    <div>
      <div className="font-display font-extrabold text-orange text-3xl mb-1">{n}</div>
      <h3 className="font-display font-semibold text-xl mb-1">{title}</h3>
      <p className="text-paper/75 text-sm">{body}</p>
    </div>
  );
}

function FounderPoint({ children }) {
  return (
    <li className="flex gap-3 text-paper/85 leading-relaxed">
      <span className="text-orange font-bold shrink-0">—</span>
      <span>{children}</span>
    </li>
  );
}

function ShowcasePlaceholder() {
  return (
    <div className="rounded-card border-2 border-dashed border-line p-6 text-center text-ink/40">
      <p className="font-display font-semibold text-sm">Coming soon</p>
      <p className="text-xs mt-1">A Founding Contractor&apos;s estimate could be here.</p>
    </div>
  );
}

function PhoneMock({ label, tone }) {
  const isRaw = tone === 'raw';
  return (
    <div className="flex flex-col items-center">
      <div
        className={`w-32 h-56 rounded-2xl border-2 ${
          isRaw ? 'border-line bg-white' : 'border-ink bg-ink'
        } shadow-card flex flex-col items-center justify-center p-3 gap-2`}
      >
        {isRaw ? (
          <>
            <div className="w-full h-14 bg-line rounded" />
            <div className="w-full h-3 bg-line/70 rounded" />
            <div className="w-10 h-10 rounded-full bg-orange/70" />
          </>
        ) : (
          <>
            <div className="w-full h-3 bg-orange rounded" />
            <div className="w-full h-3 bg-paper/80 rounded" />
            <div className="w-full h-3 bg-paper/80 rounded" />
            <div className="w-full h-8 bg-paper/30 rounded mt-2" />
          </>
        )}
      </div>
      <span className="mt-2 text-sm font-display font-semibold text-ink/70">{label}</span>
    </div>
  );
}

function ArrowDivider() {
  return (
    <div className="flex sm:flex-col items-center justify-center text-orange text-3xl font-display">
      →
    </div>
  );
}
