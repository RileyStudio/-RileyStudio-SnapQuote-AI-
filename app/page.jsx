import Link from 'next/link';
import Logo from '@/components/Logo';
import PricingTable from '@/components/PricingTable';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#fbfaf7] text-ink">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Logo />
        <nav className="flex items-center gap-3">
          <a href="#pricing" className="hidden text-sm font-semibold text-ink/70 hover:text-ink sm:inline-flex">
            Pricing
          </a>
          <Link
            href="/login"
            className="inline-flex min-h-12 items-center justify-center rounded-[18px] bg-orange px-6 font-display font-bold text-white shadow-soft transition hover:bg-orange-dark"
          >
            Log in
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 pb-16 pt-10 lg:grid-cols-[0.95fr_1.05fr] lg:px-10 lg:pb-20 lg:pt-14">
        <div>
          <p className="mb-5 inline-flex rounded-full border border-orange/20 bg-orange/10 px-4 py-2 font-display text-xs font-bold uppercase tracking-[0.18em] text-orange-dark">
            Built for contractors who quote on site
          </p>
          <h1 className="max-w-2xl font-display text-5xl font-extrabold leading-[0.98] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
            Quote the job <span className="text-orange">before</span> you leave the driveway.
          </h1>
          <p className="mt-7 max-w-xl text-xl leading-relaxed text-ink/72">
            Snap photos, talk through the details, and SnapQuote turns the job into a clean estimate your customer can open, approve, and save.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/demo"
              className="inline-flex min-h-14 items-center justify-center rounded-[18px] bg-site px-8 font-display text-base font-bold text-paper shadow-soft transition hover:brightness-110"
            >
              Try Limited Demo
            </Link>
            <Link
              href="/quote/demo-quote-001"
              className="inline-flex min-h-14 items-center justify-center rounded-[18px] border border-line bg-white px-8 font-display text-base font-bold text-ink shadow-sm transition hover:border-ink/30"
            >
              See Sample Quote
            </Link>
            <a
              href="#showcase"
              className="inline-flex min-h-14 items-center justify-center rounded-[18px] border border-line bg-white px-8 font-display text-base font-bold text-ink shadow-sm transition hover:border-ink/30"
            >
              Showcase
            </a>
          </div>

          <div className="mt-9 grid gap-4 text-sm font-medium text-ink/70 sm:grid-cols-3">
            <FeaturePill icon="⚡" text="Instant drafts" />
            <FeaturePill icon="◈" text="Branded quotes" />
            <FeaturePill icon="✓" text="One tap approval" />
          </div>
        </div>

        <div className="relative min-h-[620px] lg:min-h-[700px]">
          <div className="absolute left-[2%] top-4 w-[48%] max-w-[330px] rotate-[-1deg] lg:left-[6%] lg:top-0">
            <PhoneFrame label="Estimate builder" image="/screens/estimate-form.png" mode="cover" />
          </div>
          <div className="absolute right-[0%] top-16 w-[46%] max-w-[320px] rotate-[1deg] lg:right-[5%] lg:top-20">
            <PhoneFrame label="Customer quote" image="/screens/sample-pdf.png" mode="contain" />
          </div>
          <div className="absolute bottom-8 left-1/2 hidden w-[76%] -translate-x-1/2 rounded-[28px] border border-line bg-white/85 p-5 shadow-card backdrop-blur sm:block">
            <p className="font-display text-sm font-bold text-ink">The whole flow in one place</p>
            <p className="mt-1 text-sm leading-relaxed text-ink/65">
              Estimate, customer approval, branded PDF, and saved history are all part of the same job ticket.
            </p>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-white px-6 py-12 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-3">
          <HowStep
            number="1"
            title="Snap and talk"
            image="/screens/estimate-form.png"
            body="Capture the job site and talk through what needs to be done. SnapQuote turns that into structured job notes."
          />
          <HowStep
            number="2"
            title="Build the estimate"
            image="/screens/estimate-form.png"
            body="Review materials, labor, tax, terms, photos, and customer details before anything is shared."
          />
          <HowStep
            number="3"
            title="Customer approves"
            image="/screens/sample-pdf.png"
            body="Send a clean quote link. Your customer reviews the work and approves when they are ready."
          />
        </div>
      </section>

      <section className="bg-ink px-6 py-16 text-paper lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="mb-4 font-display text-xs font-bold uppercase tracking-[0.2em] text-orange">
              First 10 only
            </p>
            <h2 className="font-display text-4xl font-extrabold leading-tight tracking-[-0.03em] sm:text-5xl">
              Founding Contractor Program
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-paper/75">
              We are inviting 10 contractors to shape SnapQuote before public launch. Your feedback helps decide what gets built next. In return, you lock in the lowest subscription price we plan to offer.
            </p>
          </div>

          <div className="rounded-[30px] border border-paper/10 bg-paper/[0.04] p-6 shadow-card sm:p-8">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="font-display text-sm font-bold uppercase tracking-[0.14em] text-paper/55">Founder price</p>
                <p className="mt-2 font-display text-5xl font-extrabold text-white">$10<span className="text-lg text-paper/60">/mo</span></p>
              </div>
              <span className="rounded-full bg-orange px-4 py-2 font-display text-xs font-bold text-white">10 seats</span>
            </div>
            <ul className="space-y-4 text-paper/80">
              <FounderPoint>Locked pricing while your subscription stays active.</FounderPoint>
              <FounderPoint>Branding on quote pages and PDF exports.</FounderPoint>
              <FounderPoint>Direct feedback line while the product is still being shaped.</FounderPoint>
              <FounderPoint>Discounted access to future add-ons.</FounderPoint>
            </ul>
            <Link
              href="/login"
              className="mt-8 inline-flex min-h-14 w-full items-center justify-center rounded-[18px] bg-orange px-8 font-display text-base font-bold text-white shadow-soft transition hover:bg-orange-dark"
            >
              Become a Founding Contractor
            </Link>
            <p className="mt-3 text-center text-xs text-paper/45">
              No payment collected yet. Billing can be connected when the Founder seats are ready.
            </p>
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
        <div className="mb-8 max-w-2xl">
          <p className="font-display text-sm font-bold uppercase tracking-[0.16em] text-orange">Pricing</p>
          <h2 className="mt-3 font-display text-4xl font-extrabold tracking-[-0.03em]">Founder gets the early advantage.</h2>
          <p className="mt-4 text-lg leading-relaxed text-ink/65">
            Standard pricing is shown clearly so contractors can see why the first 10 seats matter.
          </p>
        </div>
        <PricingTable highlightPlan="founder" />
      </section>

      <section id="showcase" className="bg-white px-6 py-16 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 max-w-2xl">
            <p className="font-display text-sm font-bold uppercase tracking-[0.16em] text-orange">Showcase</p>
            <h2 className="mt-3 font-display text-4xl font-extrabold tracking-[-0.03em]">Real screens beat fake promises.</h2>
            <p className="mt-4 text-lg leading-relaxed text-ink/65">
              SnapQuote is built around the screens contractors use every day: estimate, quote, approval, and PDF.
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <ShowcaseCard title="Estimate builder" image="/screens/estimate-form.png" />
            <ShowcaseCard title="Branded PDF output" image="/screens/sample-pdf.png" />
          </div>
        </div>
      </section>

      <footer className="border-t border-line px-6 py-8 text-center text-sm text-ink/55">
        Built for faster quotes, cleaner approvals, and less chasing after the job is already done.
      </footer>
    </main>
  );
}

function FeaturePill({ icon, text }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-lg shadow-sm">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function PhoneFrame({ image, label, mode = 'cover' }) {
  return (
    <figure>
      <div className="relative rounded-[42px] border-[10px] border-[#121519] bg-[#121519] shadow-[0_30px_80px_rgba(0,0,0,0.24)]">
        <div className="absolute left-1/2 top-2 z-10 h-7 w-24 -translate-x-1/2 rounded-full bg-black" />
        <div className="overflow-hidden rounded-[30px] bg-white">
          <img
            src={image}
            alt={label}
            className={`h-[590px] w-full ${mode === 'contain' ? 'object-contain' : 'object-cover'} object-top`}
          />
        </div>
      </div>
      <figcaption className="mt-3 text-center font-display text-sm font-semibold text-ink/60">{label}</figcaption>
    </figure>
  );
}

function HowStep({ number, title, body, image }) {
  return (
    <article className="grid gap-5 sm:grid-cols-[110px_1fr] lg:grid-cols-[130px_1fr]">
      <div className="mx-auto w-28 sm:mx-0">
        <MiniPhone image={image} />
      </div>
      <div>
        <div className="font-display text-5xl font-extrabold text-orange">{number}</div>
        <h3 className="mt-2 font-display text-2xl font-extrabold tracking-[-0.02em]">{title}</h3>
        <p className="mt-3 text-base leading-relaxed text-ink/65">{body}</p>
      </div>
    </article>
  );
}

function MiniPhone({ image }) {
  return (
    <div className="rounded-[24px] border-[6px] border-[#121519] bg-[#121519] shadow-card">
      <div className="overflow-hidden rounded-[17px] bg-white">
        <img src={image} alt="SnapQuote screen" className="h-44 w-full object-cover object-top" />
      </div>
    </div>
  );
}

function FounderPoint({ children }) {
  return (
    <li className="flex gap-3 leading-relaxed">
      <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange text-xs font-bold text-white">✓</span>
      <span>{children}</span>
    </li>
  );
}

function ShowcaseCard({ title, image }) {
  return (
    <article className="overflow-hidden rounded-[30px] border border-line bg-[#fbfaf7] shadow-card">
      <div className="border-b border-line px-6 py-4">
        <h3 className="font-display text-xl font-bold">{title}</h3>
      </div>
      <div className="max-h-[520px] overflow-hidden bg-white">
        <img src={image} alt={title} className="w-full object-cover object-top" />
      </div>
    </article>
  );
}
