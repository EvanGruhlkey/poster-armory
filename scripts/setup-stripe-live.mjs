/**
 * One-time (idempotent) live-mode Stripe setup for Poster Armory pricing v2.
 *
 * Run with your live secret key (never commit this key):
 *   node --env-file=.env.production scripts/setup-stripe-live.mjs
 *
 * Or pass inline:
 *   STRIPE_LIVE_SECRET_KEY=sk_live_... node scripts/setup-stripe-live.mjs
 *
 * Creates the single Membership product with monthly ($10) and annual ($100)
 * prices if missing, deactivates the legacy multi-tier catalog, and registers
 * the production webhook endpoint when NEXT_PUBLIC_APP_URL is set.
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

const PRODUCT_NAME = "Poster Armory Membership";

// One product, two prices. Both grant the same entitlement: 20 high-resolution
// downloads per billing month. The annual price bills 10 months for 12.
const V3_CATALOG = [
  {
    name: "Membership (monthly)",
    envKey: "STRIPE_PRICE_MEMBERSHIP_MONTHLY",
    interval: "monthly",
    lookupKey: "poster_armory_membership_monthly_v3",
    recurring: { interval: "month" },
    unitAmount: 1000,
  },
  {
    name: "Membership (annual)",
    envKey: "STRIPE_PRICE_MEMBERSHIP_ANNUAL",
    interval: "annual",
    lookupKey: "poster_armory_membership_annual_v3",
    recurring: { interval: "year" },
    unitAmount: 10000,
  },
];

const LEGACY_PRODUCT_NAMES = new Set([
  "Basic",
  "Pro +",
  "Pro",
  "Starter",
  "Single Download",
]);
const WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
];

async function findPriceByLookup(lookupKey) {
  const found = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  return found.data[0] || null;
}

async function ensureMembershipProduct() {
  const products = await stripe.products.list({ limit: 100, active: true });
  const existing = products.data.find(
    (p) => p.metadata?.pricing_version === "v3" || p.name === PRODUCT_NAME
  );
  if (existing) {
    console.log(`  Product: ${existing.id} (existing)`);
    return existing.id;
  }

  const product = await stripe.products.create({
    name: PRODUCT_NAME,
    description: "20 high-resolution poster downloads every billing month.",
    active: true,
    metadata: { plan_slug: "membership", pricing_version: "v3" },
  });
  console.log(`  Product: ${product.id} (created)`);
  return product.id;
}

async function ensureMembershipPrice(productId, spec) {
  const existing = await findPriceByLookup(spec.lookupKey);
  if (existing) {
    console.log(`  ${spec.name}: ${existing.id} (existing)`);
    return existing.id;
  }

  const price = await stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: spec.unitAmount,
    lookup_key: spec.lookupKey,
    transfer_lookup_key: true,
    recurring: spec.recurring,
    metadata: {
      plan_slug: "membership",
      billing_interval: spec.interval,
      pricing_version: "v3",
    },
  });

  console.log(`  ${spec.name}: ${price.id} (created)`);
  return price.id;
}

// Deactivating a price stops new checkouts but leaves existing subscriptions
// billing on it, so in-flight customers keep working until migration 014
// re-points them onto the membership plan.
async function deactivateLegacyCatalog(keepProductId) {
  const products = await stripe.products.list({ limit: 100, active: true });
  for (const p of products.data) {
    if (p.id === keepProductId) continue;
    if (p.metadata?.pricing_version === "v3") continue;
    if (!LEGACY_PRODUCT_NAMES.has(p.name)) continue;

    await stripe.products.update(p.id, { active: false });
    console.log(`  Deactivated legacy product: ${p.name} (${p.id})`);

    const prices = await stripe.prices.list({ product: p.id, limit: 100 });
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

console.log("Membership catalog (copy price IDs to production env):");
const productId = await ensureMembershipProduct();
const ids = {};
for (const spec of V3_CATALOG) {
  ids[spec.envKey] = await ensureMembershipPrice(productId, spec);
}

console.log("\nEnv vars:");
for (const [k, v] of Object.entries(ids)) {
  console.log(`  ${k}=${v}`);
}

console.log("\nDeactivating legacy catalog...");
await deactivateLegacyCatalog(productId);

console.log(`\nWebhook (${appUrl}):`);
await ensureWebhook();

console.log("\nDone. Set the price IDs and webhook secret in your hosting provider.");
