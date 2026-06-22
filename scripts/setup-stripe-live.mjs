/**
 * One-time (idempotent) live-mode Stripe setup for Poster Armory pricing v2.
 *
 * Run with your live secret key (never commit this key):
 *   node --env-file=.env.production scripts/setup-stripe-live.mjs
 *
 * Or pass inline:
 *   STRIPE_LIVE_SECRET_KEY=sk_live_... node scripts/setup-stripe-live.mjs
 *
 * Creates Starter ($10/mo), Pro ($20/mo), Single Download ($9) if missing,
 * deactivates legacy Basic/Pro/Pro+ catalog, and registers the production
 * webhook endpoint when NEXT_PUBLIC_APP_URL is set.
 */
import Stripe from "stripe";

const key = process.env.STRIPE_LIVE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
if (!key || !key.startsWith("sk_live_")) {
  console.error(
    "Set STRIPE_LIVE_SECRET_KEY (sk_live_...) or STRIPE_SECRET_KEY to a live key."
  );
  process.exit(1);
}

const appUrl = (
  process.env.NEXT_PUBLIC_APP_URL || "https://posterarmory.com"
).replace(/\/$/, "");

const stripe = new Stripe(key);

const V2_CATALOG = [
  {
    name: "Starter",
    planSlug: "starter",
    lookupKey: "poster_armory_starter_v2",
    recurring: { interval: "month" },
    unitAmount: 1000,
  },
  {
    name: "Pro",
    planSlug: "pro",
    lookupKey: "poster_armory_pro_v2",
    recurring: { interval: "month" },
    unitAmount: 2000,
  },
  {
    name: "Single Download",
    planSlug: "single_download",
    lookupKey: "poster_armory_single_download_v2",
    unitAmount: 900,
  },
];

const LEGACY_PRODUCT_NAMES = new Set(["Basic", "Pro +"]);
const WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
];

async function findPriceByLookup(lookupKey) {
  try {
    return await stripe.prices.retrieve(lookupKey);
  } catch {
    return null;
  }
}

async function ensureV2Price(spec) {
  const existing = await findPriceByLookup(spec.lookupKey);
  if (existing?.active) {
    console.log(`  ${spec.name}: ${existing.id} (existing)`);
    return existing.id;
  }

  const product = await stripe.products.create({
    name: spec.name,
    active: true,
    metadata: { plan_slug: spec.planSlug, pricing_version: "v2" },
  });

  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: spec.unitAmount,
    lookup_key: spec.lookupKey,
    transfer_lookup_key: true,
    metadata: { plan_slug: spec.planSlug, pricing_version: "v2" },
    ...(spec.recurring ? { recurring: spec.recurring } : {}),
  });

  console.log(`  ${spec.name}: ${price.id} (created)`);
  return price.id;
}

async function deactivateLegacyCatalog() {
  const products = await stripe.products.list({ limit: 100, active: true });
  for (const p of products.data) {
    const isLegacyName =
      LEGACY_PRODUCT_NAMES.has(p.name) ||
      (p.name === "Pro" && p.metadata?.pricing_version !== "v2");
    if (!isLegacyName) continue;

    await stripe.products.update(p.id, { active: false });
    console.log(`  Deactivated legacy product: ${p.name} (${p.id})`);

    const prices = await stripe.prices.list({ product: p.id, limit: 20 });
    for (const pr of prices.data) {
      if (pr.active) {
        await stripe.prices.update(pr.id, { active: false });
        console.log(`    Deactivated price: ${pr.id}`);
      }
    }
  }
}

async function ensureWebhook() {
  const webhookUrl = `${appUrl}/api/stripe/webhook`;
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const existing = endpoints.data.find((ep) => ep.url === webhookUrl);

  if (existing) {
    console.log(`  Webhook already registered: ${existing.id}`);
    console.log(`  Signing secret: ${existing.secret || "(retrieve in Stripe Dashboard)"}`);
    return existing;
  }

  const endpoint = await stripe.webhookEndpoints.create({
    url: webhookUrl,
    enabled_events: WEBHOOK_EVENTS,
    description: "Poster Armory production",
  });

  console.log(`  Created webhook: ${endpoint.id}`);
  console.log(`  >>> STRIPE_WEBHOOK_SECRET=${endpoint.secret}`);
  return endpoint;
}

console.log("Poster Armory — live Stripe setup\n");

console.log("v2 price IDs (copy to production env):");
const ids = {};
for (const spec of V2_CATALOG) {
  const envKey =
    spec.planSlug === "single_download"
      ? "STRIPE_PRICE_SINGLE_DOWNLOAD"
      : spec.planSlug === "starter"
        ? "STRIPE_PRICE_STARTER"
        : "STRIPE_PRICE_PRO";
  ids[envKey] = await ensureV2Price(spec);
}

console.log("\nEnv vars:");
for (const [k, v] of Object.entries(ids)) {
  console.log(`  ${k}=${v}`);
}

console.log("\nDeactivating legacy catalog...");
await deactivateLegacyCatalog();

console.log(`\nWebhook (${appUrl}):`);
await ensureWebhook();

console.log("\nDone. Set the price IDs and webhook secret in your hosting provider.");
