# Production launch guide

## What was fixed in-repo

- **Pricing v3 (single membership)** — one product at $10/month or $100/year including 20 high-resolution downloads per billing month; designing is free and physical prints stay pay-per-order
- **Atomic quota** — migration `014_single_membership_plan.sql` adds `public.download_ledger` plus the `create_download_job` / `settle_download_reservation` / `release_stale_download_reservations` RPCs
- **DB security** — migration `013_rpc_execute_hardening.sql` restricts `create_job_with_quota_or_credit` to `service_role` only; the new 014 RPCs are `service_role`-only too
- **Checkout fulfilment** — shared `lib/stripe-fulfill.ts`; physical orders now use `/api/stripe/fulfill` fallback on the order success page
- **Deployment** — `Dockerfile` (Next.js standalone) + existing `Dockerfile.worker`
- **Env templates** — `.env.production.example`, `scripts/stripe-live-config.json`, `scripts/verify-production-env.mjs`

## One command still required (Stripe webhook)

The Stripe MCP cannot register webhook endpoints. Run **once** with your live secret key:

```powershell
$env:STRIPE_LIVE_SECRET_KEY="sk_live_..."
$env:NEXT_PUBLIC_APP_URL="https://posterarmory.com"
node scripts/setup-stripe-live.mjs
```

Copy the printed `STRIPE_WEBHOOK_SECRET=whsec_...` into your hosting dashboard.

The same script creates the membership prices and prints
`STRIPE_PRICE_MEMBERSHIP_MONTHLY` / `STRIPE_PRICE_MEMBERSHIP_ANNUAL`. It is
idempotent: prices are looked up by `lookup_key`, so re-running it will not
create duplicates.

## Migrating to pricing v3

Deactivating a Stripe price stops **new** checkouts on it. It does **not**
change what existing subscriptions bill. Migration 014 only re-points
`subscriptions.plan_slug` in Supabase, so after deploying, a legacy subscriber
keeps their old Stripe price while receiving the membership entitlement.

Read the current spread before deciding what to do about that:

```sql
select from_plan_slug, count(*)
from public.subscription_plan_migrations
where migration = '014_single_membership_plan'
group by 1 order by 2 desc;
```

Then pick one, deliberately:

| Legacy tier | Bills today | Gets after 014 | Decision needed |
|-------------|-------------|----------------|-----------------|
| `starter` | $10/mo | 20 downloads/mo (was 5) | None — same price, strictly more value |
| `pro`, `pro_plus`, `basic` | $20/mo (or legacy amount) | 20 downloads/mo (was unlimited) | **Choose below** |

For the above-$10 tiers you are choosing between revenue and goodwill:

1. **Leave them on the old price.** MRR is unchanged, but they now pay $20 for
   the $10 product. This is the churn-and-chargeback risk; only defensible if
   you email them first and offer the $10 price on request.
2. **Move them to the $10 price** (`stripe.subscriptions.update` with
   `proration_behavior: 'none'`, applied at period end). Honest, and the
   downgrade is visible in MRR immediately.
3. **Grandfather the entitlement instead of the price.** Keep them at $20 and
   raise only their allowance, by setting a per-subscription override rather
   than reading `plans.monthly_download_quota`. This preserves MRR without
   overcharging, at the cost of a second quota code path.

Nothing in this release picks for you — pick before announcing the new pricing.

### Rollout order

1. Apply migration 014 (additive; the previous release keeps working because
   `create_job_with_quota_or_credit` is left in place).
2. Set `STRIPE_PRICE_MEMBERSHIP_MONTHLY` / `STRIPE_PRICE_MEMBERSHIP_ANNUAL`.
3. Deploy the web app, then the worker. Deploying the worker first is also safe;
   `settle_download_reservation` is a no-op for jobs with no reservation.
4. Remove `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO` and
   `STRIPE_PRICE_SINGLE_DOWNLOAD` from the hosting env once the deploy is green.

### Rollback

Run `supabase/migrations/014_single_membership_plan.down.sql` **before**
redeploying the previous release, so the old code never sees a `membership`
slug it cannot resolve. Post-014 usage recorded in `download_ledger` is dropped
by the rollback; payment, order, poster and subscription history is untouched.

## Deploy checklist

### 1. Supabase

- [ ] All migrations applied (`pnpm db:push` or Supabase dashboard)
- [ ] Auth redirect URLs include `https://posterarmory.com/auth/callback`
- [ ] Enable **Leaked password protection** (Auth → Settings → Security)

### 2. Stripe (live mode)

- [ ] Live keys in hosting env (`sk_live_...`, `pk_live_...`)
- [ ] `STRIPE_PRICE_MEMBERSHIP_MONTHLY` + `STRIPE_PRICE_MEMBERSHIP_ANNUAL` set from the setup script output
- [ ] Legacy `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_PRO` / `STRIPE_PRICE_SINGLE_DOWNLOAD` removed
- [ ] Legacy products deactivated (`node scripts/check-stripe-live.mjs` reports none active)
- [ ] Webhook registered at `https://posterarmory.com/api/stripe/webhook` (run setup script above)
- [ ] `STRIPE_WEBHOOK_SECRET` set to the **live** endpoint secret (not `stripe listen`)

### 3. Web app (Vercel / Railway / Docker)

- [ ] Copy `.env.production.example` → hosting env vars
- [ ] `NEXT_PUBLIC_APP_URL=https://posterarmory.com`
- [ ] `node --env-file=.env.production scripts/verify-production-env.mjs` passes
- [ ] Build: `pnpm build` (or deploy via `Dockerfile`)

### 4. Worker (Railway recommended)

- [ ] Deploy `Dockerfile.worker` as a **separate service**
- [ ] Same Supabase keys + `WORKER_CALLBACK_SECRET` + `NEXT_PUBLIC_APP_URL`
- [ ] Mount volume at `/app/cache` for OSM tile cache (optional but recommended)

### 5. Gelato

- [ ] `GELATO_ORDER_TYPE=order` in production (keep `draft` locally only)
- [ ] Product UIDs match your Gelato catalog
- [ ] Webhook: `https://posterarmory.com/api/gelato/webhook?token=<GELATO_WEBHOOK_SECRET>`

### 6. Smoke test (live)

- [ ] Signed out → search, design and preview all work with no paywall
- [ ] Sign up → editor still free; Download prompts for the membership
- [ ] Buy the membership with a real card → billing shows 20 remaining + reset date
- [ ] Download completes → PDF/PNG in library, remaining drops to 19
- [ ] Re-download the same design → remaining stays at 19
- [ ] Cancel membership → keeps downloads until period end, designing stays free
- [ ] Physical order → charged separately, remaining downloads unchanged
- [ ] `select * from public.download_ledger order by created_at desc limit 5;`
      shows `consumed` rows and no orphaned `reserved` rows

## Local dev vs production

| Variable | Local (`.env.local`) | Production |
|----------|----------------------|------------|
| `STRIPE_SECRET_KEY` | `sk_test_...` | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | from `stripe listen` | from live webhook endpoint |
| `GELATO_ORDER_TYPE` | `draft` | `order` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | `https://posterarmory.com` |
