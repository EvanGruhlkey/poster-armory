import Stripe from "stripe";
import "./env-check";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover" as any,
  typescript: true,
});

// Recurring subscription plans available for checkout. Legacy slugs
// ("basic", "pro_plus") are not listed here — existing subscribers
// grandfather in via the DB, but no new checkouts use those slugs.
export const PLAN_PRICE_MAP: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER || "",
  pro: process.env.STRIPE_PRICE_PRO || "",
};

/**
 * One-time purchase: $9 single download credit. Sold via the same
 * checkout endpoint but with `kind: "single_download"` metadata so the
 * Stripe webhook routes it to the download_credits ledger instead of the
 * subscriptions table.
 */
export const SINGLE_DOWNLOAD_PRICE_ID =
  process.env.STRIPE_PRICE_SINGLE_DOWNLOAD || "";
