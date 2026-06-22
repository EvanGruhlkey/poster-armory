/**
 * Production environment checks. Logs warnings at startup when misconfigured.
 * Does not throw — hosting platforms still need the app to boot for health checks.
 */
const LIVE_KEY_PREFIX = "sk_live_";
const TEST_KEY_PREFIX = "sk_test_";

export function assertProductionEnv(): void {
  if (process.env.NODE_ENV !== "production") return;
  // `next build` also sets NODE_ENV=production — skip validation during build.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const issues: string[] = [];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const stripeKey = process.env.STRIPE_SECRET_KEY || "";
  const gelatoType = (process.env.GELATO_ORDER_TYPE || "order").toLowerCase();

  if (!appUrl || appUrl.includes("localhost")) {
    issues.push(
      "NEXT_PUBLIC_APP_URL must be your public HTTPS domain (not localhost)."
    );
  }

  if (!stripeKey.startsWith(LIVE_KEY_PREFIX)) {
    issues.push(
      "STRIPE_SECRET_KEY should be a live key (sk_live_...) in production."
    );
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_")) {
    issues.push(
      "STRIPE_WEBHOOK_SECRET must be set to your live webhook signing secret."
    );
  }

  for (const [name, value] of [
    ["STRIPE_PRICE_STARTER", process.env.STRIPE_PRICE_STARTER],
    ["STRIPE_PRICE_PRO", process.env.STRIPE_PRICE_PRO],
    ["STRIPE_PRICE_SINGLE_DOWNLOAD", process.env.STRIPE_PRICE_SINGLE_DOWNLOAD],
  ] as const) {
    if (!value) issues.push(`${name} is not set.`);
  }

  if (!process.env.WORKER_CALLBACK_SECRET) {
    issues.push(
      "WORKER_CALLBACK_SECRET must match the value on your render worker."
    );
  }

  if (!process.env.GELATO_API_KEY) {
    issues.push("GELATO_API_KEY is required for physical poster orders.");
  }

  if (gelatoType === "draft") {
    issues.push(
      'GELATO_ORDER_TYPE is "draft" — physical orders will NOT ship. Set to "order" for live fulfillment.'
    );
  }

  if (issues.length > 0) {
    console.error(
      "[Poster Armory] Production environment misconfiguration:\n" +
        issues.map((i) => `  - ${i}`).join("\n")
    );
  }
}

/** True when Stripe is configured for live charges. */
export function isLiveStripe(): boolean {
  return (process.env.STRIPE_SECRET_KEY || "").startsWith(LIVE_KEY_PREFIX);
}

/** True when Stripe test keys are in use (local/staging). */
export function isTestStripe(): boolean {
  return (process.env.STRIPE_SECRET_KEY || "").startsWith(TEST_KEY_PREFIX);
}

assertProductionEnv();
