import Image from 'next/image';
import Link from 'next/link';
import PricingTable from '@/components/PricingTable';
import landingImage from './_assets/snapquote-landing.png';

export default function LandingPage() {
  return (
    <main className="bg-[#faf8f4] text-ink">
      {/* Desktop/tablet image landing. Button overlays are disabled on mobile so nothing covers the artwork. */}
      <section className="relative mx-auto hidden w-full max-w-[1536px] overflow-hidden bg-[#faf8f4] md:block">
        <Image
          src={landingImage}
          alt="SnapQuote AI landing page preview showing estimate creation, customer quote approval, and the three-step workflow."
          className="block h-auto w-full select-none"
          priority
          draggable={false}
        />

        <a
          href="#pricing"
          aria-label="View pricing"
          className="absolute left-[85.3%] top-[2.4%] h-[3.6%] w-[5.6%] rounded-lg focus:outline-none focus:ring-2 focus:ring-orange focus:ring-offset-2"
        />
        <Link
          href="/login"
          aria-label="Log in"
          className="absolute left-[90.1%] top-[1.8%] h-[4.8%] w-[6.2%] rounded-xl focus:outline-none focus:ring-2 focus:ring-orange focus:ring-offset-2"
        />

        <div className="absolute left-[5.8%] top-[64.2%] flex gap-[1.2vw]">
          <Link
            href="/demo"
            className="inline-flex h-[52px] min-w-[168px] items-center justify-center rounded-[16px] bg-orange px-6 font-display text-[15px] font-bold text-white shadow-soft transition hover:bg-orange-dark focus:outline-none focus:ring-2 focus:ring-orange focus:ring-offset-2"
          >
            Try Limited Demo
          </Link>
          <Link
            href="/quote/demo-quote-001"
            className="inline-flex h-[52px] min-w-[180px] items-center justify-center rounded-[16px] border border-line bg-white/90 px-6 font-display text-[15px] font-bold text-ink shadow-sm backdrop-blur transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-orange focus:ring-offset-2"
          >
            See Sample Quote
          </Link>
          <a
            href="#showcase"
            className="inline-flex h-[52px] min-w-[148px] items-center justify-center rounded-[16px] border border-line bg-white/90 px-6 font-display text-[15px] font-bold text-ink shadow-sm backdrop-blur transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-orange focus:ring-offset-2"
          >
            Showcase
          </a>
        </div>
      </section>

      {/* Mobile layout: artwork first, real buttons below it. No overlays, no crowding. */}
      <section className="md:hidden">
        <div className="px-4 pt-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-display text-xl font-extrabold tracking-tight">
              Snap<span className="text-orange">Quote</span> <span className="rounded bg-ink px-1.5 py-1 text-xs text-white">AI</span>
            </span>
            <div className="flex items-center gap-3 font-display text-sm font-bold">
              <a href="#pricing" className="text-ink/75">Pricing</a>
              <Link href="/login" className="rounded-xl bg-orange px-4 py-2 text-white shadow-sm">Log in</Link>
            </div>
          </div>
        </div>

        <Image
          src={landingImage}
          alt="SnapQuote AI preview."
          className="block h-auto w-full select-none"
          priority
          draggable={false}
        />

        <div className="mx-auto grid max-w-sm gap-3 px-5 py-6">
          <Link
            href="/demo"
            className="inline-flex h-14 items-center justify-center rounded-2xl bg-orange px-6 font-display text-base font-bold text-white shadow-soft"
          >
            Try Limited Demo
          </Link>
          <Link
            href="/quote/demo-quote-001"
            className="inline-flex h-14 items-center justify-center rounded-2xl border border-line bg-white px-6 font-display text-base font-bold text-ink shadow-sm"
          >
            See Sample Quote
          </Link>
          <a
            href="#showcase"
            className="inline-flex h-14 items-center justify-center rounded-2xl border border-line bg-white px-6 font-display text-base font-bold text-ink shadow-sm"
          >
            Showcase
          </a>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-5xl px-5 py-10 md:py-14">
        <h2 className="font-display text-3xl font-extrabold md:text-4xl">Pricing</h2>
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-ink/65 md:text-lg">
          Founder gives early contractors Pro-level value for $10/month while the product is shaped with real job-site feedback.
        </p>
        <div className="mt-8">
          <PricingTable highlightPlan="founder" />
        </div>
      </section>

      <section id="showcase" className="mx-auto max-w-5xl px-5 pb-16">
        <h2 className="font-display text-3xl font-extrabold md:text-4xl">Showcase</h2>
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-ink/65 md:text-lg">
          Real contractor examples will live here as the first founding accounts come on board.
        </p>
      </section>
    </main>
  );
}
