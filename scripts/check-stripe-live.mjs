// Introspect LIVE mode Stripe state to gauge production readiness.
// Requires STRIPE_LIVE_SECRET_KEY in the environment. We do not commit it.
import Stripe from "stripe";

const key = process.env.STRIPE_LIVE_SECRET_KEY;
if (!key) {
  console.error(
    "STRIPE_LIVE_SECRET_KEY not set — cannot inspect live mode. Skipping."
  );
  process.exit(0);
}

const stripe = new Stripe(key);

const EXPECTED = {
  STRIPE_PRICE_MEMBERSHIP_MONTHLY: process.env.STRIPE_PRICE_MEMBERSHIP_MONTHLY,
  STRIPE_PRICE_MEMBERSHIP_ANNUAL: process.env.STRIPE_PRICE_MEMBERSHIP_ANNUAL,
};

try {
  const acct = await stripe.accounts.retrieve();
  console.log("Live account:", {
    id: acct.id,
    charges_enabled: acct.charges_enabled,
    payouts_enabled: acct.payouts_enabled,
    default_currency: acct.default_currency,
    country: acct.country,
  });
} catch (e) {
  console.log("accounts.retrieve failed:", e.message);
}

console.log("\nExpected membership price IDs:");
for (const [envKey, priceId] of Object.entries(EXPECTED)) {
  if (!priceId) {
    console.log(`  ${envKey}: NOT SET — run: node scripts/setup-stripe-live.mjs`);
    continue;
  }
  try {
    const price = await stripe.prices.retrieve(priceId);
    const product =
      typeof price.product === "string"
        ? await stripe.products.retrieve(price.product)
        : price.product;
    console.log(
      `  ${envKey}: ${price.id} — ${price.unit_amount} ${price.currency} ${price.type}${price.recurring ? `/${price.recurring.interval}` : ""} product=${product?.name} active=${price.active}`
    );
  } catch (e) {
    console.log(`  ${envKey}: MISSING or invalid (${priceId}) — ${e.message}`);
  }
}

console.log("\nLive webhook endpoints:");
const endpoints = await stripe.webhookEndpoints.list({ limit: 20 });
if (endpoints.data.length === 0) {
  console.log("  NONE — run: node scripts/setup-stripe-live.mjs");
} else {
  for (const ep of endpoints.data) {
    console.log(`  ${ep.id}  ${ep.url}  status=${ep.status}`);
    console.log(
      `    events: ${ep.enabled_events.length === 1 && ep.enabled_events[0] === "*" ? "ALL" : ep.enabled_events.join(", ")}`
    );
  }
}

console.log("\nActive legacy products (should be empty):");
const products = await stripe.products.list({ limit: 50, active: true });
const legacy = products.data.filter(
  (p) =>
    p.metadata?.pricing_version !== "v3" &&
    ["Basic", "Pro +", "Pro", "Starter", "Single Download"].includes(p.name)
);
for (const p of legacy) {
  console.log(`  WARNING: legacy product still active: ${p.name} (${p.id})`);
}
if (legacy.length === 0) {
  console.log("  None — legacy catalog deactivated.");
}
