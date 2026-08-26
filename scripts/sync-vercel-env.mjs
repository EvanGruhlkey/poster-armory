/**
 * Upsert production/preview env vars to Vercel via REST API.
 *
 * Usage:
 *   VERCEL_TOKEN=... node scripts/sync-vercel-env.mjs
 *   VERCEL_TOKEN=... node --env-file=.env.local scripts/sync-vercel-env.mjs
 *
 * Optional overrides (live Stripe, etc.):
 *   STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_... ...
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function loadVercelToken() {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN;
  const candidates = [
    resolve(homedir(), ".vercel", "auth.json"),
    resolve(homedir(), "AppData", "Roaming", "com.vercel.cli", "Data", "auth.json"),
  ];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    try {
      const { token } = JSON.parse(readFileSync(p, "utf8"));
      if (token) return token;
    } catch {
      /* try next */
    }
  }
  return null;
}

const VERCEL_TOKEN = loadVercelToken();
const PROJECT = process.env.VERCEL_PROJECT || "poster-forge";
const TEAM_ID = process.env.VERCEL_TEAM_ID || "team_S9rOk0tnDbhFpQcXEQ0KXGNJ";

if (!VERCEL_TOKEN) {
  console.error(
    "No Vercel token — run `vercel login` or set VERCEL_TOKEN (https://vercel.com/account/tokens)"
  );
  process.exit(1);
}

/** Load KEY=VALUE from a dotenv file (no expansion). */
function loadDotenv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

const local = loadDotenv(resolve(ROOT, ".env.local"));
const prodLocal = loadDotenv(resolve(ROOT, ".env.production.local"));
const prodExample = loadDotenv(resolve(ROOT, ".env.production.example"));
const liveConfig = existsSync(resolve(ROOT, "scripts/stripe-live-config.json"))
  ? JSON.parse(readFileSync(resolve(ROOT, "scripts/stripe-live-config.json"), "utf8"))
  : {};

// process.env wins, then prod-local overrides, then example, then local dev values.
// Treat empty strings as unset (`.env.production.example` uses blank placeholders).
function pickEnvValue(v) {
  return v !== undefined && v !== null && v !== "" ? v : undefined;
}

function val(key, fallback = "") {
  return (
    pickEnvValue(process.env[key]) ??
    pickEnvValue(prodLocal[key]) ??
    pickEnvValue(prodExample[key]) ??
    pickEnvValue(liveConfig[key]) ??
    pickEnvValue(local[key]) ??
    fallback
  );
}

/** Legacy env vars to remove from Vercel (pricing v1 and v2 multi-tier). */
const LEGACY_REMOVE = [
  "STRIPE_PRICE_BASIC",
  "STRIPE_PRICE_PRO_PLUS",
  "STRIPE_PRICE_STARTER",
  "STRIPE_PRICE_PRO",
  "STRIPE_PRICE_SINGLE_DOWNLOAD",
];

/** Vars the Next.js web app needs on Vercel (not worker-only). */
const VARS = {
  NEXT_PUBLIC_SUPABASE_URL: val("NEXT_PUBLIC_SUPABASE_URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: val("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  SUPABASE_SERVICE_ROLE_KEY: val("SUPABASE_SERVICE_ROLE_KEY"),
  STRIPE_SECRET_KEY: val("STRIPE_SECRET_KEY"),
  STRIPE_WEBHOOK_SECRET: val("STRIPE_WEBHOOK_SECRET"),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: val("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"),
  STRIPE_PRICE_MEMBERSHIP_MONTHLY: val("STRIPE_PRICE_MEMBERSHIP_MONTHLY"),
  STRIPE_PRICE_MEMBERSHIP_ANNUAL: val("STRIPE_PRICE_MEMBERSHIP_ANNUAL"),
  NEXT_PUBLIC_APP_URL: val("NEXT_PUBLIC_APP_URL", "https://posterarmory.com"),
  WORKER_CALLBACK_SECRET: val("WORKER_CALLBACK_SECRET"),
  GELATO_API_KEY: val("GELATO_API_KEY"),
  GELATO_WEBHOOK_SECRET: val("GELATO_WEBHOOK_SECRET"),
  GELATO_ORDER_MARKUP: val("GELATO_ORDER_MARKUP", "1.5"),
  GELATO_CURRENCY: val("GELATO_CURRENCY", "USD"),
  GELATO_ORDER_TYPE: "order",
  GELATO_PRODUCT_UID_8X10_PORTRAIT: val("GELATO_PRODUCT_UID_8X10_PORTRAIT"),
  GELATO_PRODUCT_UID_8X10_LANDSCAPE: val("GELATO_PRODUCT_UID_8X10_LANDSCAPE"),
  GELATO_PRODUCT_UID_12X16_PORTRAIT: val("GELATO_PRODUCT_UID_12X16_PORTRAIT"),
  GELATO_PRODUCT_UID_12X16_LANDSCAPE: val("GELATO_PRODUCT_UID_12X16_LANDSCAPE"),
  GELATO_PRODUCT_UID_18X24_PORTRAIT: val("GELATO_PRODUCT_UID_18X24_PORTRAIT"),
  GELATO_PRODUCT_UID_18X24_LANDSCAPE: val("GELATO_PRODUCT_UID_18X24_LANDSCAPE"),
};

const PRODUCTION_ONLY = new Set(["GELATO_ORDER_TYPE"]);
const TARGETS_DEFAULT = ["production", "preview"];

async function upsertEnv(key, value, targets) {
  const url = new URL(
    `https://api.vercel.com/v10/projects/${PROJECT}/env`
  );
  url.searchParams.set("upsert", "true");
  url.searchParams.set("teamId", TEAM_ID);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key,
      value,
      type: "encrypted",
      target: targets,
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`${res.status} ${body}`);
  }
  return body;
}

async function removeEnv(key) {
  const listUrl = new URL(
    `https://api.vercel.com/v9/projects/${PROJECT}/env`
  );
  listUrl.searchParams.set("teamId", TEAM_ID);
  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
  });
  if (!listRes.ok) return;
  const { envs } = await listRes.json();
  const matches = (envs || []).filter((e) => e.key === key);
  for (const env of matches) {
    const delUrl = new URL(
      `https://api.vercel.com/v9/projects/${PROJECT}/env/${env.id}`
    );
    delUrl.searchParams.set("teamId", TEAM_ID);
    await fetch(delUrl, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
    });
  }
}

const missing = [];
for (const [key, value] of Object.entries(VARS)) {
  if (!value) missing.push(key);
}

if (missing.length) {
  console.error("Missing values for:\n  " + missing.join("\n  "));
  console.error(
    "\nAdd missing values to .env.production.local (gitignored) or pass as env overrides."
  );
  process.exit(1);
}

if (VARS.STRIPE_SECRET_KEY.startsWith("sk_test_")) {
  console.warn(
    "WARNING: STRIPE_SECRET_KEY is a TEST key — production will not charge real cards."
  );
}

console.log(`Upserting ${Object.keys(VARS).length} vars to ${PROJECT}...\n`);

let ok = 0;
let fail = 0;
for (const [key, value] of Object.entries(VARS)) {
  const targets = PRODUCTION_ONLY.has(key) ? ["production"] : TARGETS_DEFAULT;
  try {
    await upsertEnv(key, value, targets);
    console.log(`  ✓ ${key} → ${targets.join(", ")}`);
    ok++;
  } catch (e) {
    console.error(`  ✗ ${key}: ${e.message}`);
    fail++;
  }
}

console.log("\nRemoving legacy env vars...");
for (const key of LEGACY_REMOVE) {
  try {
    await removeEnv(key);
    console.log(`  ✓ removed ${key}`);
  } catch (e) {
    console.error(`  ✗ remove ${key}: ${e.message}`);
  }
}

console.log(`\nDone: ${ok} ok, ${fail} failed.`);
if (fail === 0) {
  console.log(
    "Redeploy production on Vercel so NEXT_PUBLIC_* vars are baked into the build."
  );
}
process.exit(fail ? 1 : 0);
