// QA helper: create a confirmed Supabase user with a known password so the
// browser walkthrough can sign in without going through magic-link / OAuth.
// Run: node --env-file=.env.local scripts/qa-create-user.mjs <email> <password>
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error("Usage: qa-create-user.mjs <email> <password>");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Idempotent: if the user already exists, just update their password.
const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
const found = existing?.users?.find((u) => u.email === email);
if (found) {
  const { error } = await admin.auth.admin.updateUserById(found.id, {
    password,
    email_confirm: true,
  });
  if (error) {
    console.error("update failed:", error.message);
    process.exit(1);
  }
  console.log("Updated existing user:", found.id, email);
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    console.error("create failed:", error.message);
    process.exit(1);
  }
  console.log("Created user:", data.user.id, email);
}
