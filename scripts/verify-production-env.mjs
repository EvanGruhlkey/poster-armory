/**
 * Verify production env vars before deploy. Exit 1 if any required value missing.
 * Usage: node --env-file=.env.production scripts/verify-production-env.mjs
 */
const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_PRICE_STARTER",
  "STRIPE_PRICE_PRO",
  "STRIPE_PRICE_SINGLE_DOWNLOAD",
  "NEXT_PUBLIC_APP_URL",
  "WORKER_CALLBACK_SECRET",
  "GELATO_API_KEY",
  "GELATO_WEBHOOK_SECRET",
];

const warnings = [];
const errors = [];

for (const key of required) {
  if (!process.env[key]) errors.push(`Missing ${key}`);
}

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
if (appUrl.includes("localhost")) {
  errors.push("NEXT_PUBLIC_APP_URL must not be localhost in production");
}

if (!(process.env.STRIPE_SECRET_KEY || "").startsWith("sk_live_")) {
  warnings.push("STRIPE_SECRET_KEY is not a live key (sk_live_...)");
}

if ((process.env.GELATO_ORDER_TYPE || "order").toLowerCase() === "draft") {
  errors.push('GELATO_ORDER_TYPE must be "order" for live fulfillment');
}

if (errors.length) {
  console.error("Production env check FAILED:\n" + errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}

if (warnings.length) {
  console.warn("Warnings:\n" + warnings.map((w) => `  - ${w}`).join("\n"));
}

console.log("Production env check passed.");
