/**
 * Create (or upgrade) an admin test account with Pro+ entitlements.
 *
 * Usage:
 *   pnpm admin:create
 *   pnpm admin:create -- --email you@example.com --password "YourPass123!"
 *
 * Env (optional):
 *   ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME
 */
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function parseArgs() {
  const args = process.argv.slice(2);
  const out: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--email" && args[i + 1]) out.email = args[++i];
    else if (args[i] === "--password" && args[i + 1]) out.password = args[++i];
    else if (args[i] === "--name" && args[i + 1]) out.name = args[++i];
  }
  return out;
}

function defaultPassword() {
  // Stable local-dev default so you can always sign in after `pnpm admin:create`.
  return process.env.ADMIN_PASSWORD || "PosterForge!Admin123";
}

async function findUserByEmail(
  admin: ReturnType<typeof createClient>,
  email: string
) {
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (match) return match;
    if (data.users.length < perPage) break;
    page++;
  }
  return null;
}

async function grantProPlus(
  admin: ReturnType<typeof createClient>,
  userId: string
) {
  const { data: existing } = await admin
    .from("subscriptions")
    .select("id, plan_slug, status, created_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.plan_slug === "pro_plus") {
    console.log("  Already on Pro+ — no subscription change needed.");
    return;
  }

  const periodStart = new Date();
  const periodEnd = new Date();
  periodEnd.setFullYear(periodEnd.getFullYear() + 10);

  const { error } = await admin.from("subscriptions").insert({
    user_id: userId,
    plan_slug: "pro_plus",
    status: "active",
    current_period_start: periodStart.toISOString(),
    current_period_end: periodEnd.toISOString(),
    stripe_customer_id: null,
    stripe_sub_id: null,
  });

  if (error) {
    throw new Error(`Failed to grant Pro+: ${error.message}`);
  }

  console.log("  Granted Pro+ subscription (10-year dev period).");
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
    process.exit(1);
  }

  const cli = parseArgs();
  const email =
    cli.email || process.env.ADMIN_EMAIL || "admin@posterforge.local";
  const password =
    cli.password || process.env.ADMIN_PASSWORD || defaultPassword();
  const name = cli.name || process.env.ADMIN_NAME || "Admin";

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("Creating admin account with Pro+...\n");

  let userId: string;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (createErr) {
    const msg = createErr.message.toLowerCase();
    if (
      msg.includes("already") ||
      msg.includes("registered") ||
      msg.includes("exists")
    ) {
      console.log(`  User ${email} already exists — upgrading to Pro+.`);
      const existing = await findUserByEmail(admin, email);
      if (!existing) {
        throw new Error(`Could not find existing user: ${email}`);
      }
      userId = existing.id;
      // Always refresh password so local admin login stays predictable.
      const { error: pwdErr } = await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
      });
      if (pwdErr) {
        throw new Error(`Failed to update password: ${pwdErr.message}`);
      }
      console.log("  Password reset for existing user.");
    } else {
      throw createErr;
    }
  } else {
    userId = created.user!.id;
    console.log(`  Created user ${email}`);
  }

  await grantProPlus(admin, userId);

  console.log("\nAdmin account ready:\n");
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`  Plan:     Pro+ (unlimited designs & downloads)`);
  console.log(`\n  Sign in at: ${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login`);
}

main().catch((err) => {
  console.error("\nFailed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
