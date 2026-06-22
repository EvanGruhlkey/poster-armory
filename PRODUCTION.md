# Production launch guide

## What was fixed in-repo

- **Live Stripe v2 catalog** — Starter ($10), Pro ($20), Single Download ($9) created in live mode; legacy Basic/Pro/Pro+ deactivated
- **DB security** — migration `013_rpc_execute_hardening.sql` restricts `create_job_with_quota_or_credit` to `service_role` only
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

## Deploy checklist

### 1. Supabase

- [ ] All migrations applied (`pnpm db:push` or Supabase dashboard)
- [ ] Auth redirect URLs include `https://posterarmory.com/auth/callback`
- [ ] Enable **Leaked password protection** (Auth → Settings → Security)

### 2. Stripe (live mode)

- [ ] Live keys in hosting env (`sk_live_...`, `pk_live_...`)
- [ ] Price IDs from `.env.production.example` (or `scripts/stripe-live-config.json`)
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

- [ ] Sign up → free preview works
- [ ] Buy Starter with real card → billing shows plan + quota
- [ ] Download completes → PDF/PNG in library
- [ ] Cancel subscription → falls back to free
- [ ] Physical order (optional) → `submitted` in Gelato dashboard

## Local dev vs production

| Variable | Local (`.env.local`) | Production |
|----------|----------------------|------------|
| `STRIPE_SECRET_KEY` | `sk_test_...` | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | from `stripe listen` | from live webhook endpoint |
| `GELATO_ORDER_TYPE` | `draft` | `order` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | `https://posterarmory.com` |
