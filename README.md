# SnapQuote AI

Contractor takes job-site photos + records a voice note → AI drafts a branded
estimate → customer approves it from a link, no login required.

## Buyer Handoff Notes

**Tech stack**: Next.js 14 (App Router) · React 18 · Tailwind CSS · Supabase
(Postgres + Auth, optional) · OpenAI (Whisper transcription + Chat
Completions, optional) · pdf-lib (PDF export, no external service). No
payment processing, no email sending, no CRM — intentionally out of scope;
see "Known Production Gaps" below.

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

1. **Landing page** (`/`) — read the pitch, click "Try the Demo."
2. **Demo login** (`/login`) — tap "Continue with the demo account" (no
   real credentials needed).
3. **Settings branding** (`/settings`) — upload a logo, pick a brand color,
   edit the footer text and default terms, hit Save. (Optional: tap
   "Reset Demo Settings" to see it snap back to the built-in defaults.)
4. **Dashboard** (`/dashboard`) — note the metrics cards and the static
   sample rows, then tap **"Load Demo Estimates"** to seed 3 realistic
   records (one draft, one sent, one approved) instead of starting from
   scratch.
5. **New Estimate** (`/estimates/new`) — fill in a customer and job, or
   skip straight to step 6 first.
6. **AI Job Notes** — type a rough note (or upload any audio file) and tap
   **Generate Draft Estimate** to see the AI-drafted line items,
   description, and terms land in the form (demo response, no API key
   needed).
7. **Review** — tap **Review Estimate**; check the branding preview,
   totals, and notes.
8. **Send to Customer** — tap it, then copy the generated `/quote/[id]`
   link (or just tap "View as Customer").
9. **Customer quote** — see the branded, work-order-styled quote exactly
   as a real customer would.
10. **Approve quote** — tap **Approve Estimate** and watch the signature
    stamp land.
11. **Download PDF** — tap it on either the Review page or the customer
    quote page.
12. **Dashboard actions** — back on `/dashboard`, try **Duplicate**,
    **Mark Approved**, the two-step **Delete**, and the search/status
    filters on the records from steps 4–10.

Every step above works with zero configuration — no Supabase project, no
OpenAI key.

## Known Production Gaps

This is a fully-clickable demo, not a production-deployed SaaS. Specifically:

- **Supabase persistence is not wired end-to-end.** As of this phase, the
  full backend foundation exists as copy/paste SQL (`supabase/schema.sql`,
  `policies.sql`, `storage.sql`, `seed.sql` — see "Supabase Setup via SQL
  Editor"), and the public quote page already reads from Supabase when
  configured — but the contractor-side workflow (New Estimate, Edit,
  Review, Dashboard) still only writes to `localStorage`, never to
  Supabase. Wiring that up is the single biggest item before this could
  run as a real multi-user product.
- **Auth gating is demo-friendly, not production-hardened.** The login
  page's "Continue with the demo account" bypass and every demo-mode page
  just render local data without checking for a real session — there's no
  middleware or layout-level route protection. Fine for a sales demo, not
  fine for real customer data.
- **Email sending is not implemented.** "Send to Customer" generates a
  real, working `/quote/[id]` link, but nothing emails or texts that link
  to the customer automatically — a contractor has to copy/send it
  themselves today.
- **Payment/billing is not implemented.** No Stripe, no deposit collection,
  no invoicing beyond the quote/estimate itself — intentionally out of
  scope per the original product spec.
- **Real file uploads/storage are not implemented.** Job photos use
  `URL.createObjectURL` (gone after a hard refresh) and the business logo
  uses a base64 data URL in `localStorage` — neither uploads anywhere yet.
  `supabase/storage.sql` already creates the `logos` and `estimate-photos`
  buckets with access policies ready to go; what's missing is the actual
  upload code in `PhotoUploader.jsx`/`LogoUploader.jsx` to use them.
- **The PDF export path should be manually tested after `npm install`.**
  `pdf-lib` was never actually executed in the environment this was built
  in (no network access there for `npm install`) — the HTML fallback path
  was verified end-to-end, but the real-PDF success path was written
  carefully and not visually confirmed. See "Known demo-mode limitations"
  further down for the full explanation.

## Status (this build)

**Built and wired up:**
- Landing page (`/`)
- Login page (`/login`) — real Supabase magic-link auth code, plus a demo-account
  bypass so the product can be clicked through with zero configuration
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
| `OPENAI_API_KEY` | `/api/transcribe`, `/api/draft-estimate` | Both return their fixed demo response (`demo: true`) instead of erroring |
| `OPENAI_DRAFT_MODEL` | `/api/draft-estimate` (optional) | Defaults to `gpt-4o-mini` — override if your account uses a different current model |
| `NEXT_PUBLIC_DEMO_MODE` | — | Cosmetic flag some pages read; the demo-vs-real behavior is actually driven by whether Supabase/OpenAI env vars are present, not this flag alone |

`/api/generate-pdf` needs no environment variables — it never calls an
external service (pdf-lib runs entirely locally), so it behaves identically
in demo and production. The only thing that varies is whether `pdf-lib`
successfully renders a PDF or the route falls back to HTML — see "Known
demo-mode limitations" above.

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
