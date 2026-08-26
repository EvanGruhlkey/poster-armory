import Stripe from "stripe";
import "./env-check";
import {
  MEMBERSHIP_SLUG,
  type BillingInterval,
} from "./plan-config";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover" as any,
  typescript: true,
});

/**
 * The single paid plan, sold on two cadences. Annual is the same membership
 * with the same 20 downloads per billing month — not a separate tier.
 */
export const MEMBERSHIP_PRICE_IDS: Record<BillingInterval, string> = {
  monthly: process.env.STRIPE_PRICE_MEMBERSHIP_MONTHLY || "",
  annual: process.env.STRIPE_PRICE_MEMBERSHIP_ANNUAL || "",
};

export function membershipPriceId(interval: BillingInterval): string {
  return MEMBERSHIP_PRICE_IDS[interval];
}

/** Every recurring price that maps onto the membership plan. */
export function planSlugForPriceId(priceId: string | null | undefined): string | null {
  if (!priceId) return null;
  return Object.values(MEMBERSHIP_PRICE_IDS).includes(priceId)
    ? MEMBERSHIP_SLUG
    : null;
}
