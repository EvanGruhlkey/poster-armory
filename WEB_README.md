# Poster Armory Web App

A production-ready SaaS web application that lets users generate customizable city map posters and download print-ready files.

## Tech Stack

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Auth & Database:** Supabase (Auth + Postgres + Storage)
- **Payments:** Stripe (subscriptions + one-time day pass)
- **Poster Generation:** Python CLI (`create_map_poster.py`)
- **Validation:** Zod

## Architecture

```
User → Next.js App → Supabase Auth
                   → API Routes (create job) → poster_jobs table
                                                   ↓
                   Worker (polls) ← poster_jobs (queued)
                       ↓
                   Python CLI (create_map_poster.py)
                       ↓
                   Upload to Supabase Storage
                       ↓
                   Update poster_jobs (done) + create poster record
                       ↓
User ← Download page ← Signed URLs from Supabase Storage
```

## Setup

### 1. Prerequisites

- Node.js 18+
- Python 3.10+ (with dependencies from `requirements.txt`)
- pnpm
- Supabase CLI (optional, for local dev)
- Stripe CLI (optional, for webhook testing)

### 2. Install Dependencies

```bash
pnpm install
pip install -r requirements.txt  # or: uv sync --locked
```

### 3. Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-only)
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- `STRIPE_PRICE_MEMBERSHIP_MONTHLY` - Stripe Price ID for the membership at $10/month
- `STRIPE_PRICE_MEMBERSHIP_ANNUAL` - Stripe Price ID for the membership at $100/year

Physical fulfillment (Gelato):
- `GELATO_API_KEY` - Gelato API key (server-only)
- `GELATO_WEBHOOK_SECRET` - Token appended to the Gelato webhook URL to authenticate status callbacks
- `GELATO_ORDER_MARKUP` - Retail multiplier on the Gelato base product price (default `1.5`)
- `GELATO_CURRENCY` - ISO 4217 currency to quote/charge in (default `USD`)
- `GELATO_PRODUCT_UID_<SIZE>_<ORIENTATION>` - Optional per-size product UID overrides (e.g. `GELATO_PRODUCT_UID_18X24_PORTRAIT`)
- `WORKER_CALLBACK_SECRET` - Shared secret so the worker can notify the web app when a print render finishes (must match in web + worker env)

### 4. Database Setup

Run the SQL migration against your Supabase project:

```bash
# Option A: Using Supabase CLI
supabase db push

# Option B: Manual
# Copy contents of supabase/migrations/001_initial.sql
# and run it in the Supabase SQL Editor
```

### 5. Supabase Auth Configuration

In your Supabase dashboard:

1. **Email Auth:** Enable email magic link in Authentication → Providers → Email
2. **Google OAuth:** Enable Google provider with your OAuth credentials
3. **Redirect URLs:** Add `http://localhost:3000/auth/callback` to allowed redirect URLs

### 6. Stripe Configuration

1. Create one product with two recurring prices (or run
   `node --env-file=.env.local scripts/setup-stripe-live.mjs` against a test key):
   - Membership monthly: $10/month
   - Membership annual: $100/year
2. Copy the Price IDs to `STRIPE_PRICE_MEMBERSHIP_MONTHLY` and
   `STRIPE_PRICE_MEMBERSHIP_ANNUAL` in `.env.local`
3. For local webhook testing:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

### 6b. Physical Fulfillment (Gelato)

Physical poster ordering is offered alongside digital downloads. Any logged-in
user can order a print (pay-per-order via Stripe); subscriptions still gate
digital downloads.

1. Generate an API key in the Gelato dashboard (API Portal) and set `GELATO_API_KEY`.
2. Find the product UIDs for the poster line you want to sell in the
   [Gelato catalog](https://dashboard.gelato.com/catalogue/categories). The
   defaults in `lib/poster-products.ts` are placeholders — override them with
   the real UIDs via `GELATO_PRODUCT_UID_<SIZE>_<ORIENTATION>` env vars
   (e.g. `GELATO_PRODUCT_UID_18X24_PORTRAIT`).
3. Set `GELATO_ORDER_MARKUP` (retail multiplier) and `GELATO_CURRENCY`.
4. Configure a Gelato order-status webhook pointing at
   `https://<your-app>/api/gelato/webhook?token=<GELATO_WEBHOOK_SECRET>` and set
   `GELATO_WEBHOOK_SECRET` to the same token.
5. Set `WORKER_CALLBACK_SECRET` (same value in the web app and the worker) and
   ensure the worker has `NEXT_PUBLIC_APP_URL` pointing at the web app so it can
   POST `/api/internal/job-complete` when a print render finishes.

Order flow: customize a poster -> "Order Physical Poster" -> pick size, quantity,
and shipping address (live Gelato quote + markup) -> pay via Stripe. On payment,
a 300 DPI print PNG is rendered by the worker and the order is submitted to
Gelato. Status updates (in production, shipped, delivered) arrive via the Gelato
webhook and are shown on `/app/orders` and `/order/[id]`.

> Run migration `008_physical_orders.sql` before using this feature.

### 7. Run Development

```bash
# Start both web server and worker
pnpm dev

# Or run separately:
pnpm dev:web    # Next.js dev server only
pnpm worker     # Worker process only
```

The app will be available at `http://localhost:3000`.

## Project Structure

```
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Landing page (/)
│   ├── layout.tsx                # Root layout
│   ├── pricing/page.tsx          # Pricing page
│   ├── login/page.tsx            # Auth page
│   ├── app/                      # Protected routes (/app/*)
│   │   ├── page.tsx              # Pick Location
│   │   ├── design/[draftId]/     # Customize Poster
│   │   └── library/page.tsx      # My Library
│   ├── download/[jobId]/         # Download page
│   └── api/
│       ├── auth/callback/        # Supabase auth callback
│       ├── jobs/                 # POST (create) + GET (status)
│       └── stripe/               # Checkout + webhook
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── navbar.tsx
│   ├── footer.tsx
│   └── poster-card.tsx
├── lib/
│   ├── supabase/                 # Client, server, admin clients
│   ├── stripe.ts
│   ├── types.ts
│   ├── validations.ts
│   ├── utils.ts
│   └── config-hash.ts
├── scripts/
│   └── worker.ts                 # Background job worker
├── supabase/
│   └── migrations/
│       └── 001_initial.sql       # Database schema + RLS
├── middleware.ts                  # Auth middleware
├── create_map_poster.py          # Python poster CLI (existing)
└── themes/                       # Theme JSON files (existing)
```

## Data Flow

1. **User signs in** via magic link or Google OAuth
2. **Pick Location:** Enter city/country, geocode via Nominatim
3. **Customize:** Choose style, tweak settings, preview
4. **Generate:** POST to `/api/jobs` creates a `poster_jobs` row
5. **Worker** polls for queued jobs, runs Python CLI, uploads to Storage
6. **Download:** Signed URLs served from Supabase Storage

## Plans & Quotas

Pricing v3 — one free tier and one paid membership
(see `supabase/migrations/014_single_membership_plan.sql`):

| Tier            | Price                    | Designing  | High-res downloads       |
|-----------------|--------------------------|------------|--------------------------|
| Free            | $0                       | Unlimited  | None                     |
| Membership      | $10/month or $100/year   | Unlimited  | 20 per billing month     |
| Physical poster | Live-quoted per order    | n/a        | Never uses the allowance |

The full editor, every theme and every preview are free for everyone, signed in
or not. Only high-resolution renders are metered.

### How the allowance is enforced

`public.download_ledger` is the source of truth — one row per reserved or
consumed download. The previous release counted `poster_jobs` rows, which
conflated physical print renders, failed jobs and re-renders with paid
downloads.

- **Reserving** happens inside `create_download_job`, which takes a per-user
  advisory lock before counting, so concurrent requests cannot both slip past
  the 20th download.
- **Settling** happens from the worker via `settle_download_reservation`:
  `consumed` on success, `released` on failure. Users never pay for a render
  the platform lost.
- **Free by design:** previews, physical print renders, failed jobs, duplicate
  in-flight clicks (deduplicated by `config_hash`) and re-downloading a file
  that already rendered.
- **Self-healing:** `release_stale_download_reservations` hands back holds for
  jobs that failed or stalled, and runs on the worker's recovery sweep as well
  as before each new reservation.

The billing window comes from Stripe's `current_period_start` /
`current_period_end`, not a calendar month. Annual members get 20 downloads per
*monthly sub-window* inside their yearly period rather than 240 up front.

The `$9` single-download credit is retired. Existing `download_credits` rows are
preserved and marked with `retired_at`; nothing is deleted.

## Caching

Poster configurations are hashed (SHA-256). If a job with the same `config_hash` already exists with outputs, new requests reuse existing storage paths instead of regenerating.
