// One-off: introspect test mode Stripe config used by the app.
// Run with: node --env-file=.env.local scripts/check-stripe-test.mjs
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const priceIds = {
  STRIPE_PRICE_MEMBERSHIP_MONTHLY: process.env.STRIPE_PRICE_MEMBERSHIP_MONTHLY,
  STRIPE_PRICE_MEMBERSHIP_ANNUAL: process.env.STRIPE_PRICE_MEMBERSHIP_ANNUAL,
};

const acct = await stripe.accounts.retrieve();
console.log("Stripe account:", {
  id: acct.id,
  livemode: stripe.LATEST_API_VERSION,
  apiVersion: stripe.getApiField?.("version") || "",
  email: acct.email,
  charges_enabled: acct.charges_enabled,
  payouts_enabled: acct.payouts_enabled,
  default_currency: acct.default_currency,
  country: acct.country,
});

console.log("\nEnv price IDs:", priceIds);

for (const [name, id] of Object.entries(priceIds)) {
  if (!id) {
    console.log(`\n${name}: NOT SET`);
    continue;
  }
  try {
    const price = await stripe.prices.retrieve(id, { expand: ["product"] });
    const product = price.product;
    console.log(`\n${name} (${id})`);
    console.log("  product:", product.name, `(${product.id}) active=${product.active}`);
    console.log(
      "  amount:",
      price.unit_amount,
      price.currency,
      `type=${price.type}`,
      price.recurring ? `interval=${price.recurring.interval}` : "one-time"
    );
    console.log("  livemode:", price.livemode, "active:", price.active);
  } catch (e) {
    console.log(`\n${name} (${id}): ERROR — ${e.message}`);
  }
}

console.log("\nWebhook endpoints:");
const endpoints = await stripe.webhookEndpoints.list({ limit: 20 });
for (const ep of endpoints.data) {
  console.log(`  ${ep.id} → ${ep.url}`);
  console.log(`    status=${ep.status} api_version=${ep.api_version}`);
  console.log(`    events=${ep.enabled_events.length === 1 && ep.enabled_events[0] === "*" ? "ALL" : ep.enabled_events.join(", ")}`);
}
