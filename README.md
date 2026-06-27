# SnapQuote AI

Contractor takes job-site photos + notes → AI drafts a branded estimate →
customer approves it from a link, no login required. Currently positioned
around a Founding Contractor offer (first 10 contractors, $10/month
locked for life while subscribed) rather than a generic SaaS pitch — see
the landing page (`app/page.jsx`) and the Founder plan in `lib/plans.js`.

## Buyer Handoff Notes

**Tech stack**: Next.js 14 (App Router) · React 18 · Tailwind CSS · Supabase
(Postgres + Auth, optional) · OpenAI (Whisper transcription + Chat
Completions, optional) · pdf-lib (PDF export, no external service). No
payment processing, no CRM. Sharing a quote is `mailto:`/`sms:`/clipboard
(`components/ShareEstimateModal.jsx`) — there's a real, working email-send
API route too (`/api/send-email`), it's just not wired into any button
right now; see "Known Production Gaps" below.

**Demo mode behavior**: with zero environment variables configured, the
entire contractor workflow runs on browser `localStorage` — every estimate
record, Settings/branding, and both AI routes' demo responses. This is what
makes the product immediately clickable and demo-able without any setup
cost to a buyer evaluating it. See "Buyer Demo Checklist" right below for a
guided walkthrough.

**Environment variables**: full table further down under "Going to
production." Short version — `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_ANON_KEY` turn on real auth and data; `OPENAI_API_KEY`
turns on real transcription and AI drafting; `OPENAI_DRAFT_MODEL` is an
optional override. None are required to run the full demo.

**What works without any keys**: New Estimate → AI Job Notes (demo
transcript/draft) → Review → Send to Customer → public quote link → Approve
→ Download PDF (or its HTML fallback) — the entire loop, plus
Settings/branding and every Dashboard action (search, filter, metrics,
duplicate, delete, mark approved, load demo estimates).

**What needs API keys**: real voice transcription and real AI-drafted
estimates need `OPENAI_API_KEY`; real multi-device auth and persistent
production data need a configured Supabase project. Nothing else in the
product requires a paid API key.

**Suggested next production steps**, roughly in priority order:
1. Wire Supabase end-to-end. The full backend foundation now exists as
   copy/paste SQL — `supabase/schema.sql`, `policies.sql`, `storage.sql`,
   `seed.sql` (see "Supabase Setup via SQL Editor" below) — and the public
   quote page already reads from Supabase when configured, but the
   contractor-side workflow (New Estimate, Edit, Review, Dashboard) still
   only writes to `localStorage`. Replacing that with real Supabase
   reads/writes is the next step; the tables/policies/functions are ready
   for it.
2. Move job photos and the business logo to Supabase Storage (both are
   currently local blob/data URLs — see "Known Production Gaps").
3. Add real email sending for "Send to Customer" (today it generates a
   working link; nothing emails or texts it to the customer automatically).
4. Harden auth — gate the demo-login bypass behind an environment check,
   add real route protection (middleware or layout-level checks) instead
   of pages just rendering demo data whenever no session exists.
5. Run `npm install` and manually verify the `pdf-lib` PDF export (this
   specific path hasn't been visually verified in the environment this was
   built in — see "Known Production Gaps").

## Buyer Demo Checklist

A complete click-through, in order, to see the whole product in about five
minutes:

1. **Landing page** (`/`) — read the Founding Contractor pitch and the
   pricing comparison, click "Try Limited Demo." ("See Sample Quote" and
   the "Showcase" placeholder section are also worth a look.)
2. **Demo login** (`/login`) — tap "Launch limited demo" (no real
   credentials needed).
3. **Settings → Plan** (`/settings`) — switch to the **Founding Contractor**
   plan and note the locked-pricing banner, then upload a logo, pick a
   brand color, edit the footer text and default terms, hit Save.
   (Optional: tap "Reset Demo Settings" to see it snap back to the
   built-in defaults — this also resets the plan to Solo.)
4. **Dashboard** (`/dashboard`) — note the metrics cards and the static
   sample rows, then tap **"Load Demo Estimates"** to seed 3 realistic
   records (one draft, one sent, one approved) instead of starting from
   scratch. (This seeding is separate from, and doesn't count against,
   the demo estimate limit below — it's a one-time convenience and is
   itself idempotent, not something a click-spam could abuse.)
5. **New Estimate** (`/estimates/new`) — fill in a customer and job, or
   skip straight to step 6 first.
6. **AI Job Notes** — type a rough note (or upload any audio file) and tap
   **Generate Draft Estimate** to see the AI-drafted line items,
   description, and terms land in the form (demo response, no API key
   needed).
7. **Review** — tap **Review Estimate**; check the branding preview,
   totals, and notes.
8. **Send to Customer** — tap it, then tap **Share Estimate** to see the
   Email Link / Text Link / Copy Link popup (pre-filled from the
   customer's email/phone on the estimate).
9. **Customer quote** — tap "View as Customer" to see the branded,
   work-order-styled quote exactly as a real customer would (note the
   "EXAMPLE QUOTE — NOT A VALID CONTRACT" banner — only shows in
   demo/local mode, never on a real Supabase-backed quote).
10. **Approve quote** — tap **Approve Estimate** and watch the signature
    stamp land.
11. **Download PDF** — tap it on the Review page (note the large
    "EXAMPLE / VOID" watermark — demo/local only, never on a real
    Supabase-backed estimate). Demo mode caps PDF downloads at 2 and
    approvals at 3 — tap past either limit to see the Founder upgrade
    notice instead of a silent failure.
12. **Dashboard actions** — back on `/dashboard`, try **Duplicate**,
    **Mark Approved**, **Share Estimate**, the two-step **Delete**, and the
    search/status filters on the records from steps 4–10.

Every step above works with zero configuration — no Supabase project, no
OpenAI key. Steps 3 and 8 are gated behind the Founder/Pro/Team plans —
switch off the Founding Contractor plan back to Solo to see the upsell
states instead (Branding becomes a locked card; Share Estimate's button
becomes an upsell line; Dashboard history caps at 5 most-recent estimates).

## Known Production Gaps

This is a fully-clickable demo, not a production-deployed SaaS. Specifically:

- **Supabase persistence is now wired for estimates, settings, AND file
  storage.** The Dashboard, New/Edit Estimate, Review, and Settings all
  read/write real Supabase tables (`lib/supabaseEstimates.js`,
  `lib/supabaseSettings.js`) when a real session exists — demo mode is
  unaffected. As of this polish pass, job photos and the logo also upload
  to the real `estimate-photos`/`logos` Storage buckets in that case
  (`lib/supabaseStorage.js`) — local/demo mode still uses the original
  blob-URL/base64-data-URL preview behavior unchanged, since it never has
  a real session to upload through. `get_quote_by_token()` now joins
  `contractor_settings` too, so the public quote page's expiration date,
  footer text, license note, logo, and branding all reflect the real
  contractor's settings for Supabase-backed estimates, not a hardcoded
  14-day default.
- **Auth gating is demo-friendly, not production-hardened.** The login
  page's "Launch limited demo" bypass and every demo-mode page just
  render local data without checking for a real session — there's no
  middleware or layout-level route protection. Fine for a sales demo, not
  fine for real customer data. Real login is now email + password
  (`app/login/page.jsx`) and routes straight to `/dashboard` on success —
  see "Supabase Auth settings" below for the one Supabase-side setting
  this depends on.
- **"Email sending" is no longer presented as an app feature.** The old
  "Send Estimate Email"/"Resend Quote" buttons (which only ever sent a
  real email if `RESEND_API_KEY` was configured, and showed a demo
  placeholder otherwise) are gone, replaced by **Share Estimate** — a
  popup with Email Link (`mailto:`), Text Link (`sms:`), and Copy Link.
  None of those three claim to send anything; they hand off to the
  contractor's own apps or the clipboard, so there's nothing to falsely
  claim succeeded. `app/api/send-email/route.js` and
  `sendEstimateEmail()` in `lib/apiClient.js` still exist and still work
  if `RESEND_API_KEY` is configured, but nothing in the UI calls them
  anymore — they're unused-but-available infrastructure now, not deleted.
- **Payment/billing is not implemented.** No Stripe, no deposit collection,
  no invoicing beyond the quote/estimate itself. The Solo/Founder/Pro/Team
  plans in Settings are feature gates only (`lib/plans.js`) — switching
  plans is instant and free, by design; there's no checkout flow to gate
  behind it, and the Founding Contractor offer on the landing page is
  explicitly labeled "no payment collected yet."
- **The PDF export path should be manually tested after `npm install`.**
  `pdf-lib` was never actually executed in the environment this was built
  in (no network access there for `npm install`) — the HTML fallback path
  was verified end-to-end, but the real-PDF success path was written
  carefully and not visually confirmed. See "Known demo-mode limitations"
  further down for the full explanation.

## Status (this build)

**Dashboard estimate cards opening the wrong quote: real bug fix.**
`estimates.id` (the primary key) and `estimates.public_quote_token` (a
separate column — `supabase/schema.sql`) are two independently-generated
UUIDs for the same row, by design — `get_quote_by_token()` filters by the
token, never the id. Every `/quote/{...}` link in the app
(`app/dashboard/page.jsx`'s row click, "View Quote," Share Estimate;
`app/estimates/[id]/review/page.jsx`'s "Send to Customer"/"View as
Customer") was passing the primary key instead, so for any real
Supabase-backed estimate that lookup could never match — it fell through
to the static demo quote, which is exactly "opens a demo estimate instead
of the actual one." `lib/supabaseEstimates.js`'s `fromRow()` now exposes
`publicQuoteToken`, and every link-construction site uses it (falling
back to `id` for local-storage records and the static sample rows, which
have no separate token concept at all). Also tightened
`app/quote/[id]/page.jsx`: it previously fell back to the static demo
quote for *any* unmatched id, including a real one that simply failed to
match for the reason above — now only the one explicit, designated demo
route (`demo-quote-001`, linked from the landing page) does that; any
other unmatched id shows a real "Quote not found" instead of silently
substituting someone else's sample data.

**Authenticated estimate save/review: real bug fix.** `persist()` in
`components/EstimateForm.jsx` called `saveEstimateRemote()` with no
try/catch — when it threw (a real Supabase error, a missing contractor
row, a network failure), the rejection propagated uncaught out of the
click handler entirely: no error, no navigation, nothing visible at all.
This is what "Save Draft / Review Estimate do nothing" actually was.
Fixed by wrapping the call in try/catch and showing
`"Could not save estimate. {real message}"` above the buttons. Two
related gaps fixed in the same pass: `saveEstimateRemote()`'s own
read-back-after-write could return `null` even after a genuinely
successful save, which would have crashed the caller on `saved.id`
(`lib/supabaseEstimates.js` now falls back to constructing the same shape
from data already in hand rather than risking a null return); and
`estimate_line_items`/`estimate_photos` insert errors were never checked
at all, so a partial failure there could leave an estimate row with no
line items and no error to explain why. Added `ensureContractorRow()` as
the explicit fallback-protection requirement: if a real session's
`contractors` row is missing (normally created automatically by
`handle_new_user()` on signup — see `supabase/schema.sql` — this covers
accounts that predate that trigger), it's provisioned automatically; if
that also fails, the estimate falls back to `localStorage` with "Saved
locally because account setup is incomplete." instead of being lost. The
same silent-failure pattern existed in the Review page's "Send to
Customer" and three of the Dashboard's row actions (Mark Approved,
Duplicate, Delete) — all now show their real error via the existing
message mechanisms on each page instead of failing without a trace.

**Naming note**: this update was requested as "Phase 8–11," but those numbers
were already used earlier for Real PDF Rendering, Production Readiness, and
the Supabase SQL Setup Files. To avoid confusion, this update is referred to
below by content (Supabase persistence, branding, email, plans) rather than
by number.

**Demo Limits + Auth Polish + Pricing Clarity (this phase)**:
- **Login replaced: magic-link → email + password.** Multiple passes at
  getting magic-link auth working reliably (PKCE, hash tokens, redirect
  URL edge cases) kept hitting the same wall: it requires the contractor
  to leave the app to click an email link, and that hop is exactly where
  things kept breaking. `app/login/page.jsx` now has real email +
  password fields and two actions — **Create account**
  (`supabase.auth.signUp`) and **Log in** (`supabase.auth.signInWithPassword`)
  — both routing straight to `/dashboard` on success, no email step in
  the middle at all. This depends on one Supabase-side setting; see
  "Supabase Auth settings" below. `app/auth/callback/page.jsx` still
  exists, now purely as a fallback for a confirmation-link `?code=` on
  projects that leave that setting on — reads `window.location.search`
  directly (no `useSearchParams()`/Suspense needed), exchanges the code,
  and either lands on `/dashboard` or shows "This link expired or was
  already used. Please log in again." with a button back to `/login`.
- **Login page CTA overhauled.** Both auth buttons are plain, large,
  high-contrast native `<button>`s, not `BigButton` — Create account
  (orange, primary) and Log in (outlined, secondary) — plus a separate
  "Launch limited demo" `Link` to `/demo` itself, which already owns the
  entire "enter demo mode" sequence (one less place that logic has to live).
- **Demo usage limits** (`lib/demoLimits.js`) — 3 estimates, 5 AI draft
  generations, 2 PDF downloads, 3 approvals, all via localStorage
  counters, all checked *before* the action runs (a blocked attempt isn't
  charged, so retrying after upgrading works immediately). Every call
  site checks `dataSource === 'local'` / `isDemo` first — a real Supabase
  session is never touched by this module at all.
- **Demo/example outputs are now clearly marked.** `components/DemoBanner.jsx`'s
  text is now "EXAMPLE QUOTE — NOT A VALID CONTRACT." Generated PDFs (and
  the HTML fallback) now stamp a large diagonal "EXAMPLE / VOID" watermark
  — driven by an explicit `isDemo` flag the Review/Quote pages set
  themselves (since they already know their real data source), never
  guessed at inside the PDF route.
- **Founder plan now has real pricing data.** `lib/plans.js`'s `PLANS`
  entries gained `price`/`priceNote`/`featureList` fields (Founder $10/mo,
  Solo $29/mo, Pro $59/mo, Team $99/mo), and a new
  `components/PricingTable.jsx` renders the full 4-plan comparison —
  Founder shown first/highlighted regardless of `PLAN_ORDER`'s
  feature-gating order, since that's a display choice, not a gating one.
  Used on the landing page (`#pricing`) and linked to from Settings and
  every `DemoLimitNotice`.
- **Landing page**: "Log in" in the header is now a real styled button,
  not a text link; "Try Demo" relabeled to "Try Limited Demo"; added
  "Founder offer: first 10 contractors lock in $10/month" near the hero.

**Supabase persistence (real wiring, not just the SQL foundation)**:
`lib/supabaseEstimates.js` and `lib/supabaseSettings.js` are new async,
Supabase-backed equivalents of `lib/localEstimates.js`/`lib/settings.js`.
The Dashboard, `components/EstimateForm.jsx`, the Review page, the public
quote page, and the Settings page all now check for a real Supabase session
first and use these new modules when one exists — demo mode (no session)
falls through to the exact same local-storage behavior as before. A new
`customers` table was added (additive — estimates keep their own flattened
customer columns as the source of truth; `customer_id` is an optional link
for a future repeat-customer directory), and the public quote page now
calls the `get_quote_by_token()` RPC instead of the stale `jobs`-table join
left over from the original schema.

**File storage (polish pass)**: `lib/supabaseStorage.js` is new —
`uploadLogo`, `uploadEstimatePhoto`, `getEstimatePhotoUrl`. The logo
uploader and job-photo uploader keep their exact original instant-preview
behavior (base64 data URL / blob object URL) unchanged in both modes; in
remote mode only, `app/settings/page.jsx` and `components/EstimateForm.jsx`
additionally upload the real file to the matching Storage bucket and swap
in the real URL once that finishes. `get_quote_by_token()` now also joins
`contractor_settings`, so a real Supabase-backed quote's expiration date,
footer text, license note, logo, and branding all come from the
contractor's actual settings instead of hardcoded defaults.

**Founding Contractor launch (this update)**:
- **Landing page rewritten** (`app/page.jsx`) around the actual problem
  (the gap between "I'll send the quote" and sending it) and a Founding
  Contractor offer (first 10 contractors, $10/month locked for life while
  subscribed, direct input into what gets built next, their branding on
  every PDF/quote, future add-ons discounted while subscribed) — positioned
  as building *with* 10 contractors, not a discount code. "Try Demo," "See
  Sample Quote," and a new "Showcase" anchor section (same page, no new
  route yet — a placeholder for real contractor examples later) are all
  still there. The SnapQuote app logo itself (`components/Logo.jsx`) was
  intentionally left untouched per the request — customer-facing documents
  (PDF, quote page) carry the *contractor's* branding, not this one.
- **New `founder` plan** in `lib/plans.js` — unlocks branding, estimate
  history, and sharing (same as Pro), plus a `founderPricing` flag that
  turns on the "🎉 Founding Contractor" locked-pricing banner in Settings.
  `PLAN_ORDER` is now `['solo', 'founder', 'pro', 'team']`. The
  `notifications` feature flag from the previous build was renamed to
  `sharing` to match this update's terminology — same gate, new name, see
  "Share Estimate" below for why.
- **Share Estimate replaces the old email-sending UI.** New
  `components/ShareEstimateModal.jsx` — Email Link (`mailto:`), Text Link
  (`sms:`), Copy Link (clipboard), pre-filled from the estimate's
  customer email/phone and the real quote URL. None of the three claim to
  send anything from the app — they hand off to the contractor's own
  device — so there's no "email sent" wording left anywhere in this flow.
  Wired into both the Review page and Dashboard's per-row actions, gated
  behind the `sharing` feature (Founder/Pro/Team).

**Branding** (logo, accent color, warranty text, license number) already
existed end-to-end from earlier phases (Settings → quote page → PDF). The
actual gap was the Dashboard not visually applying it — fixed: the header
now shows the contractor's logo/initials badge in their brand color.

**Email notifications**: `app/api/send-email/route.js` (Resend as the
example provider — demo placeholder with no `RESEND_API_KEY` configured,
same pattern as `/api/transcribe`/`/api/draft-estimate`). "Send Estimate
Email" / "Resend Quote Email" on the Review page, "Resend Quote" as a
Dashboard row action.

**Plans and feature gates** (`lib/plans.js`) — Solo / Pro / Team, no Stripe,
no billing: a plan is just a stored value a contractor can switch instantly
in Settings. Branding is gated to Pro+ (a locked upsell card shows on
Solo); Dashboard history/search/filter is capped to the 5 most recent
estimates on Solo; email notifications (Resend Quote / Send Estimate Email)
are gated to Pro+; Team adds a placeholder "Invite Team Member" control
(disabled — real multi-user auth/roles is a future build, this is the gate
for it).

**Built and wired up:**
- Landing page (`/`)
- Login page (`/login`) — real Supabase email + password auth (Create
  account / Log in), plus a "Launch limited demo" link, so the product
  can be clicked through with zero configuration
- **Dashboard (`/dashboard`)** — reads from Supabase if configured;
  otherwise loads real local estimate records first (`lib/localEstimates.js`),
  falling back to the static `lib/mockData.js` sample rows only when no
  real records exist yet (with a "+ Create Your First Estimate" CTA, a
  **"Load Demo Estimates" button**, and a small note clarifying the rows
  below are samples).
  - **Load Demo Estimates** calls the new `seedDemoEstimates()` in
    `lib/localEstimates.js`: seeds exactly 3 realistic records — one draft
    (Lena Ortiz, HVAC), one sent (Dana Whitfield, Roofing), one approved
    (Marcus Webb, Painting) — reusing the same customer/job identities
    already established elsewhere in the app rather than inventing new
    sample names. Idempotent (does nothing if local records already
    exist), and the seeded records work with every Dashboard action below
    exactly like any contractor-created record, since they go through the
    same `saveEstimate()`/`normalizeEstimate()` pipeline.
  - **Metrics cards**: Total, Drafts, Sent, Approved, and Approved Value —
    computed from whichever rows are currently loaded (real records once
    they exist, demo samples until then), always reflecting the full set
    regardless of the active search/filter.
  - **Search**: matches customer name, job title, address, or ticket
    number, case-insensitive, against whichever rows are loaded.
  - **Status filter**: All / Draft / Sent / Approved pill buttons.
  - **Empty states**: no records at all → the original "No estimates yet"
    state; a search/filter with zero matches → "No estimates match this
    filter" with a Reset Filters button — these are deliberately different
    states for different problems.
  - **Per-row actions** — only shown for real local records (`isLocal:
    true`); static sample rows and Supabase-backed rows stay simple
    clickable links, same as Phase 6, since the actions below all operate
    on `lib/localEstimates.js`:
    - Draft: Edit, Review, Delete
    - Sent: View Quote, Mark Approved, Duplicate, Delete
    - Approved: View Quote, Duplicate, Delete
  - **Delete** uses an inline two-step confirm ("Delete this estimate? /
    Confirm Delete / Cancel") rather than the browser's native `confirm()`.
  - **Mark Approved** calls `markEstimateApproved(id)` directly — useful
    for a contractor who got verbal/phone approval and wants the record to
    reflect it without making the customer click through the quote link.
  - **Duplicate** calls the new `duplicateEstimate(id)` in
    `lib/localEstimates.js`: new id, new ticket number, status reset to
    `draft`, `sentAt`/`approvedAt` cleared, fresh `createdAt`/`updatedAt`,
    and "(Copy)" appended to the job title (the field that actually shows
    on the Dashboard list) when there is one.
  - Every action calls the same `refreshLocalData()` afterward, so the
    list, metrics, and filters all reflect the change immediately without
    a page reload.
- **New/Edit Estimate** (`/estimates/new` and `/estimates/[id]/edit`) —
  both routes render the same `components/EstimateForm.jsx`: customer
  info, job info, an **AI Job Notes** section, an editable line-item list
  (qty × unit price, material/labor toggle), drag-and-drop / tap-to-upload
  photos (with grayscale sample placeholders when nothing's uploaded yet),
  notes & terms, and a live summary (labor/materials subtotal, tax on
  materials, total). Sticky bottom action bar on mobile, sticky sidebar on
  desktop. Save Draft and Review Estimate both persist a real record via
  `lib/localEstimates.js`; on a brand-new estimate's first save, the URL
  is updated in place to `/estimates/[id]/edit` so a reload can't create a
  duplicate record.
  - **AI Job Notes**: a rough-notes textarea, an optional audio file
    upload, and two buttons — **Transcribe Audio** (posts the file to
    `/api/transcribe`, appends the returned transcript into the notes
    textarea rather than overwriting anything already typed) and
    **Generate Draft Estimate** (posts the notes + current customer/job
    state to `/api/draft-estimate`, then applies the response's job
    title, description, line items, and notes/terms onto the form —
    replacing the line-item list, but only touching customer fields that
    are still empty, never ones already filled in). Both buttons show
    inline loading and error states, and a small always-visible note
    confirms this works without an OpenAI key.
- **Estimate Review (`/estimates/[id]/review`)** — loads that specific
  record by id (a friendly "Estimate not found" state if it's missing —
  deleted, or a bad link), and displays it read-only (`JobTicketCard`,
  photos, line items, totals, notes/terms), with Edit Estimate, **Download
  PDF**, and Send to Customer. Sending marks only that record as sent
  and shows its real `/quote/[id]` link. The old non-dynamic
  `/estimates/review` now just redirects to the most recently updated
  record's review page (or to `/estimates/new` if nothing exists yet) —
  kept as a courtesy for any old bookmarks rather than 404ing.
- Public Customer Quote View (`/quote/[id]`) — checks Supabase, then the
  matching local estimate record by id, then falls back to the static
  demo quote. Approving a real local record persists `status: 'approved'`
  and `approvedAt` directly onto it (so the contractor's own Dashboard and
  Review page reflect it too); approving the static fallback sample is a
  one-time preview that doesn't persist anywhere, since there's no real
  record behind it. Includes contractor branding (sourced from Settings in
  demo mode — logo, brand color, business name, license/insurance note,
  footer text, and quote expiration period), the work-order-styled job
  ticket, photo strip, line items, total, a **Download PDF** button,
  Approve Estimate with the signature approval stamp, and the required
  trust notice.
- **Settings (`/settings`)** — Business Profile, Branding (logo upload as a
  base64 data URL, brand color presets + custom picker, quote footer text,
  license/insurance note), and Default Estimate Terms (payment terms,
  warranty language, deposit requirement, quote expiration in days). Saves
  to `localStorage`, reloads on refresh, and has a two-step confirm before
  "Reset Demo Settings" clears back to the built-in demo branding.
- **API routes** (`app/api/transcribe`, `app/api/draft-estimate`,
  `app/api/generate-pdf`) — production-shaped, all three work with zero
  configuration, and are now wired into the UI via `lib/apiClient.js`:
  - `POST /api/transcribe` — accepts `FormData` with an `audio` field. No
    `OPENAI_API_KEY` → returns a fixed demo transcript with `demo: true`.
    Key present → calls OpenAI's Whisper transcription endpoint and
    returns the real transcript with `demo: false`. A real-key failure
    (bad key, quota, network) returns a `502` with the upstream error
    rather than silently falling back to the demo transcript.
  - `POST /api/draft-estimate` — accepts `{ transcript?, notes?, customer?,
    job? }`, requires at least one of `transcript`/`notes`. No key → a
    demo estimate draft continuing the same bathroom-floor-repair scenario
    as the demo transcript above. Key present → calls Chat Completions
    with `response_format: json_object` and a schema-locked prompt, then
    defensively normalizes the model's JSON (coercing types, dropping
    unexpected fields) before returning it — never trusts model output
    blindly.
  - `POST /api/generate-pdf` — accepts `{ quote: object }`. **Generates a
    real PDF via `pdf-lib`** and returns it as a binary `application/pdf`
    response with `Content-Disposition: attachment; filename="quote-
    {ticketNumber}.pdf"`. If PDF rendering fails for any reason (the
    dependency isn't installed, a logo can't be embedded, anything else),
    the route falls back to its original Phase 4 behavior — a clean,
    standalone HTML document of the quote — returned as JSON:
    `{ html, demo: true, fallback: true, error: string }`. Accepts either
    of the app's two quote shapes (contractor-side `lineItems`, or
    customer-facing `materials`/`labor`) and normalizes both into one
    render shape, reusing `computeSubtotals`/`toLineItemsTableFormat` from
    `lib/estimateMath.js` for both the PDF and the HTML fallback.
    - **Why pdf-lib over `@react-pdf/renderer`**: pdf-lib is pure
      JavaScript with no native dependencies (no `yoga-layout`/`fontkit`
      native bindings to potentially fail to install on a given
      platform), which made it the more predictable, "simplest stable
      option" choice for a route that explicitly needs to degrade
      gracefully rather than crash. The tradeoff is manual layout —
      pdf-lib has no flexbox-like engine, so `route.js` positions text
      with explicit x/y coordinates and a small hand-rolled word-wrap
      helper, rather than declarative components.
    - **Lazy-loaded on purpose**: `pdf-lib` is dynamically imported
      (`await import('pdf-lib')`) inside the PDF-building function rather
      than imported at the top of the route file. A failed dynamic import
      is catchable from inside the request handler and triggers the HTML
      fallback; a failed top-level import would crash the entire route
      module, including the fallback path itself.
- **`lib/apiClient.js`** — shared fetch wrappers for the three routes above
  (`transcribeAudio`, `draftEstimateFromNotes`), each throwing a helpful
  `Error` using the route's own `{ error }` message when the response
  isn't OK. For PDFs specifically:
  - **`generateQuotePdf(quote)`** — posts to `/api/generate-pdf` and
    branches on the response's `Content-Type`: a real PDF response comes
    back as `{ type: 'pdf', blob, filename }` (the filename is read from
    the server's own `Content-Disposition` header, not reconstructed
    client-side); the fallback comes back as
    `{ type: 'html', html, filename }`.
  - **`generateQuoteHtml(quote)`** — the original Phase 4 helper, kept for
    any caller that explicitly wants the old always-JSON behavior. Not
    used by the UI anymore (it would fail to parse a successful PDF
    response as JSON) — `generateQuotePdf` is what Review and the quote
    page actually call now, since it already handles both outcomes.
  - **`downloadBlobFile(blob, filename)`** — the browser-only download
    primitive (a hidden `<a download>` click, not `window.open`, since a
    popup can get blocked once there's an `await` between the click and
    the open call). `downloadHtmlFile(html, filename)` is now just this
    function wrapping an HTML `Blob`.
  - **UI behavior** (Review and the public quote page, both labeled
    **"Download PDF"**): try the PDF first; if the result is the HTML
    fallback instead, download the `.html` file anyway and show a small
    notice — *"PDF generation was unavailable, so an HTML quote was
    downloaded instead."* — rather than failing silently or treating it
    as an error.
- Full design system (`tailwind.config.js`, `app/globals.css`)
- **Supabase SQL foundation** (`supabase/schema.sql`, `supabase/policies.sql`,
  `supabase/storage.sql`, `supabase/seed.sql`) — see "Supabase Setup via SQL
  Editor" below. **Not yet wired to the app** — see that section's scope note.
- Demo data (`lib/mockData.js`)
- Shared math/formatting helpers (`lib/estimateMath.js`)
- Settings persistence + shared branding helpers (`lib/settings.js`)
- **`lib/localEstimates.js`** — the persistent local estimate store (see
  "Local persistence model" below)

## Local persistence model

Every estimate is now its own record, not one shared "current draft" slot.

- **Storage key**: `snapquote.estimates` — a JSON array of records, newest-
  updated first.
- **Record shape**: `{ id, ticket_number, status, customer, job, lineItems,
  photos, notes, terms, totals, createdAt, updatedAt, sentAt, approvedAt }`.
  - `status` is `'draft' | 'sent' | 'approved'`.
  - `terms` is a denormalized copy of `notes.payment_terms`, kept in sync on
    every save — present as its own top-level field per the storage schema,
    but not hand-edited anywhere; edit Payment Terms in the form instead.
  - `totals` is recomputed from `lineItems` + `totals.taxRate` on every
    save via `computeSubtotals()`, so it can't silently drift from the line
    items. Pages that display totals (Review, Quote) still recompute live
    from `lineItems` rather than trusting even this stored snapshot — the
    same "never trust a cached total" approach used since Phase 2.
  - Field naming here is deliberately camelCase (`createdAt`, not
    `created_at`) — this is a JS-only local storage layer, not a SQL table.
    Contrast with `supabase/schema.sql`, which is snake_case throughout.
- **Functions** (`lib/localEstimates.js`): `getAllEstimates()`,
  `getEstimateById(id)`, `saveEstimate(estimate)`,
  `updateEstimate(id, patch)`, `deleteEstimate(id)`, `createEstimateId()`,
  `markEstimateSent(id)`, `markEstimateApproved(id)`,
  `duplicateEstimate(id)` (Phase 7 — see the Dashboard section above).
- **Delete is demo-local only**: `deleteEstimate(id)` removes a record from
  `localStorage` on this device/browser. It has no Supabase equivalent
  wired up — a production deployment would need a real "delete" RPC or
  policy on the `estimates` table, with whatever soft-delete/audit-trail
  behavior the business actually wants (immediate hard delete is rarely
  the right default for a financial document a customer may have already
  seen).
- **Migration**: the very first time `getAllEstimates()` runs in a browser
  that still has Phase 2–5's old single-slot key (`snapquote_draft_estimate`),
  that draft is migrated into the new store as a real record (and given a
  real id via `createEstimateId()` if it didn't already have one). After
  that one-time migration, the old key is simply never read again.
- **Not migrated**: the old per-id keys `snapquote_sent_estimate_<id>` and
  `snapquote_approved_<id>` from Phases 4–5. Any estimate that was sent or
  approved under the old system won't carry that status into the new
  store — only the single most-recent draft gets migrated. This is a
  one-time transition cost for a demo-only feature, not a real data-loss
  concern.
- **Dynamic routes**: `/estimates/[id]/edit`, `/estimates/[id]/review`, and
  `/quote/[id]` all use the same `id` — the estimate record's own id is the
  one identifier used everywhere, with no separate "public token" concept
  for local/demo records.
- **This remains demo-only, browser-local storage** until Supabase is
  wired up for real auth and data — exactly like Settings. A real
  production deployment should persist estimates in the `estimates` table
  in `supabase/schema.sql`, not localStorage.

**How Settings wires into the rest of the app:**
- `app/quote/[id]/page.jsx` — demo-rendered quotes (no matching Supabase row)
  pull contractor branding, footer text, and expiration days from
  `getSettings()`. A real Supabase row is unaffected — Settings is demo-mode
  only, by design, and never touches production data.
- `components/EstimateForm.jsx` (used by both `/estimates/new` and
  `/estimates/[id]/edit`) — a brand-new estimate (not editing an existing
  record) prefills Notes and Terms from `estimateTerms.payment_terms` /
  `warranty_language` / `deposit_requirement`.
- `app/estimates/[id]/review/page.jsx` — shows a small branding preview
  ("this is how your branding will appear to the customer") sourced from
  Settings, and uses `estimateTerms.expiration_days` instead of a hardcoded
  14 days.
- `app/dashboard/page.jsx` — the business name shown in the header reflects
  Settings in demo mode.
- Absent any saved settings, `getSettings()` returns `DEFAULT_SETTINGS`,
  which mirrors the original demo contractor — so "no settings saved" and
  "the original demo branding" are the same code path, not a special case.

**Not yet built (next implementation pass):**
- Real logo/branding upload to Supabase Storage in production mode (Settings
  is demo-mode only; production should read/write the `contractors` table)
- Dashboard search/filter/metrics only operate on whatever's currently
  loaded (Supabase rows, or local/demo rows) — there's no cross-source view
  combining both, which is fine since a contractor is only ever in one mode
  or the other

None of the above is started yet — don't assume partial files exist for them.

**Known demo-mode limitations:**
- Job photo previews use `URL.createObjectURL`, which only survives for the
  current tab/session. **Photos stored as object URLs still do not survive
  a hard refresh unless converted to data URLs** — the photo entry itself
  stays in the estimate record, just without a valid image afterward.
  Production should upload to Supabase Storage and store a stable URL
  instead (see the TODO in `app/quote/[id]/page.jsx`'s `mapSupabaseEstimate`).
- The business logo in Settings uses a base64 data URL instead (it's a
  single small image, so it survives a refresh, unlike job photos).
- **This remains demo-only, browser-local storage until Supabase is wired**
  — estimates, Settings, and approvals all live in `localStorage` on one
  device/browser. None of it syncs across devices, and clearing browser
  data clears all of it. That's the intended tradeoff for a zero-config
  demo, not an oversight.
- **PDF logo embedding only supports PNG/JPEG** data URLs — matches what
  `LogoUploader.jsx` actually produces, but a manually-edited Settings
  value with a different image format would just render without a logo
  rather than fail, per `buildQuotePdf`'s try/catch around image embedding.
- **Important transparency note**: this build environment has no network
  access, so `npm install` was never run here and `pdf-lib` was never
  actually executed. The fallback path (PDF generation failing) **was**
  exercised end-to-end and behaves correctly — that's effectively
  guaranteed in this environment, since the dependency genuinely isn't
  installed. The real-PDF success path (`buildQuotePdf` in
  `app/api/generate-pdf/route.js`) was written carefully against pdf-lib's
  documented API but has **not been visually verified**. After
  `npm install`, actually click Download PDF and check the output for
  layout issues (text overflow, awkward page breaks) before relying on it
  for a buyer demo.

## Running it

```bash
npm install
npm run dev
```

By default (`.env.local` not yet created), the app runs in **demo mode**:
no Supabase project, no OpenAI key, no real auth. The login page's demo
button drops you straight into the dashboard with sample jobs loaded.

## Going to production

Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
OPENAI_API_KEY=your-openai-key
OPENAI_DRAFT_MODEL=gpt-4o-mini
NEXT_PUBLIC_DEMO_MODE=false
```

1. Follow "Supabase Setup via SQL Editor" below.
2. Add the env vars above in Vercel project settings.
3. Deploy.

## Supabase Setup via SQL Editor

Four SQL files in `supabase/` give you the entire backend foundation —
tables, security policies, storage buckets, and optional demo data — all
copy/paste-able, with **no manual table creation in the Table Editor UI**.

**Scope note**: this phase builds the SQL foundation only. The Next.js app
itself does not call any of this yet — every page still reads/writes
`localStorage` in demo mode (see "Local persistence model" above). Wiring
the app to actually use these tables is future work; see "Buyer Handoff
Notes" → "Suggested next production steps."

**Concretely**: `app/quote/[id]/page.jsx` already has a Supabase-read code
path from an earlier phase, but it queries the *old*, now-superseded schema
shape (a `jobs` table joined to `job_photos`, filtered by a `public_token`
column) — none of which exist anymore after running the SQL below. That
query will simply error and the page will gracefully fall through to demo
data, exactly as it does today with no Supabase configured at all — it
won't crash, but it also won't show real data yet. So: running this SQL
and adding the env vars does **not** by itself make the app "go live" —
it only makes the backend ready for a future phase to query the new
tables (`estimates`, `estimate_line_items`, etc.) and the
`get_quote_by_token()` function instead.

1. **Create a new Supabase project** at [supabase.com](https://supabase.com)
   (or use an existing one — these scripts are additive and safe to run on
   a fresh project).
2. **Open the SQL Editor** (left sidebar in the Supabase dashboard).
3. **Run `supabase/schema.sql`** — paste the whole file, click Run. Creates
   `profiles`, `contractors`, `contractor_settings`, `estimates`,
   `estimate_line_items`, `estimate_photos`, `quote_approvals`, plus
   indexes, `updated_at` triggers, the new-user provisioning trigger, and
   the `get_quote_by_token()` / `approve_estimate()` functions.
4. **Run `supabase/policies.sql`** — enables Row Level Security and adds
   the ownership/public-access policies for every table above. Read the
   "SECURITY NOTE" comment inside it before relying on the public
   `estimates` SELECT policy in a real production deployment.
5. **Run `supabase/storage.sql`** — creates the `logos` and
   `estimate-photos` Storage buckets (both private) and their access
   policies. If the bucket-creation `INSERT` statements error in your
   project, create the two buckets manually instead (Dashboard → Storage →
   New Bucket, both private) — the policy statements in the same file work
   via SQL either way; see the comment at the top of that file.
6. **Optional: run `supabase/seed.sql`** — seeds one demo contractor
   (Riley Roofing Co.) and 3 realistic estimates (one draft, one sent, one
   approved), reusing the exact same data already established in
   `lib/localEstimates.js`'s "Load Demo Estimates" button. Skip this for a
   clean production project. If the `auth.users` insert at the top fails
   (auth internals can vary slightly by project/Postgres version), create
   that one user via Dashboard → Authentication → Users → Add User instead,
   using `demo@snapquoteai.app`, then substitute its real id for
   `11111111-1111-1111-1111-111111111111` before running the rest of the file.
7. **Copy your Project URL and anon key** (Dashboard → Project Settings →
   API) into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### Environment variables

| Variable | Required for | Behavior if missing |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Real auth, real data | App runs entirely on demo/localStorage data |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Real auth, real data | Same as above |
| `NEXT_PUBLIC_SITE_URL` | Confirmation-link fallback only (optional) | `app/login/page.jsx`'s `signUp()` call omits `emailRedirectTo` entirely if this isn't set — doesn't block account creation either way, since it's only consequential if "Confirm email" is left on (see "Supabase Auth settings" below) |
| `OPENAI_API_KEY` | `/api/transcribe`, `/api/draft-estimate` | Both return their fixed demo response (`demo: true`) instead of erroring |
| `OPENAI_DRAFT_MODEL` | `/api/draft-estimate` (optional) | Defaults to `gpt-4o-mini` — override if your account uses a different current model |
| `RESEND_API_KEY` | `/api/send-email` (no longer used by the UI — see "Known Production Gaps") | Returns a demo placeholder (`demo: true`, nothing actually sent) instead of erroring |
| `SEND_EMAIL_FROM` | `/api/send-email` (optional, same caveat) | Defaults to `estimates@snapquoteai.app` — must be a domain verified with your email provider in production |
| `NEXT_PUBLIC_DEMO_MODE` | — | Cosmetic flag some pages read; the demo-vs-real behavior is actually driven by whether Supabase/OpenAI env vars are present, not this flag alone |

`/api/generate-pdf` needs no environment variables — it never calls an
external service (pdf-lib runs entirely locally), so it behaves identically
in demo and production. The only thing that varies is whether `pdf-lib`
successfully renders a PDF or the route falls back to HTML — see "Known
demo-mode limitations" above.

### Supabase Auth settings

Two settings on Supabase's side matter for login to work the way this app
expects — neither is something this codebase can configure for you.

**1. Authentication → Providers → Email → "Confirm email" should be OFF.**
This is the important one. Login is real email + password
(`app/login/page.jsx`: `signUp()` / `signInWithPassword()`), and the goal
is that creating an account never requires leaving the app to click an
email link. With "Confirm email" **off**, `signUp()` returns a real
session immediately and the app routes straight to `/dashboard`. With it
**on**, Supabase withholds the session until the confirmation link is
clicked — `signUp()` returns no session, the login page shows "Account
created. Check your email to confirm, then log in," and the contractor
has to leave the app after all. The product is built around the former;
the latter still works, just not the way this was designed to feel.

**2. Authentication → URL Configuration** (only matters if you leave
"Confirm email" on, since that's the only case that sends a link
anywhere):

- **Site URL** = your production Netlify URL (e.g. `https://your-site.netlify.app`)
- **Redirect URLs** should include `https://YOUR-SITE.netlify.app/auth/callback`
  — and the same `/auth/callback` path for any custom domain too, e.g.:

```
https://your-site.netlify.app/auth/callback
https://yourdomain.com/auth/callback
```

`app/auth/callback/page.jsx` exists purely as a fallback for that
confirmation-link case: it reads `?code=` from `window.location.search`,
calls `exchangeCodeForSession`, and either lands on `/dashboard` or shows
"This link expired or was already used. Please log in again." with a
button back to `/login`. If "Confirm email" is off, a contractor never
lands on this page at all during normal signup/login.

## Notes for whoever continues this build

- Every screen follows the same pattern: try Supabase first, fall back to
  `lib/mockData.js`. Keep that pattern in any remaining pages so the demo
  never breaks even if Supabase isn't configured.
- `lib/mockAI.js` (Phase 1) has been removed — it was a client-side mock
  that was never wired into any page, and is now fully superseded by the
  real `/api/transcribe` and `/api/draft-estimate` routes, which include
  their own demo-mode fallback.
- All three API routes are intentionally side-effect-free without their
  respective API keys: no network calls happen, no files are written, and
  responses are always well-formed JSON — safe to hit repeatedly while
  wiring up the UI.
- `/api/draft-estimate` returns flat `{ notes, terms }` strings, but the
  app's own Notes and Terms shape is `{ warranty, payment_terms,
  additional }`. `applyDraftEstimate()` in `components/EstimateForm.jsx`
  maps `terms → payment_terms` (the demo response bundles deposit/payment/
  warranty language into one string, so this is the closest fit) and
  `notes → additional`, leaving any existing `warranty` text untouched
  rather than guessing at a split. Revisit this mapping if the route's
  response shape ever changes to return the three fields separately.
- This has not been run through `npm install` / `next build` in this
  environment — **this was actually attempted, not just assumed**: `npm
  install` returned a `403 Forbidden` from the registry, confirming this
  environment has no network access for it. Everything has been written
  to standard Next.js 14 App Router conventions and validated statically
  (see "Validation" notes at the bottom of each phase), but run a real
  build locally before showing this to a buyer.
- `next.config.js` now sets `eslint: { ignoreDuringBuilds: true }`. There's
  no `.eslintrc` in this project, and `next build` can behave
  unpredictably without one (prompting to set one up interactively on
  some versions) — this makes `npm run build` deterministic and
  non-interactive instead of leaving that to chance. Add a real ESLint
  config and remove this flag if you want lint-on-build back.
- `pdf-lib` (`^1.17.1`) is the one new dependency added in this pass —
  pure JS, no native bindings, MIT-licensed, and has been the stable major
  version for a long time. Run `npm install` and manually test Download
  PDF before relying on the real-PDF path (see "Known demo-mode
  limitations" above for why this specific path couldn't be verified here).
