"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useSubscription } from "@/components/subscription-provider";
import { shouldShowSubscriptionBanner } from "@/components/subscription-banner-visibility";
import { MEMBERSHIP_PRICE_MONTHLY_USD } from "@/lib/plan-config";

/**
 * Membership state comes from the server-seeded context, so a reload never
 * shows a subscriber the "subscribe" prompt before the client catches up.
 * Members have unlimited downloads, so the banner is only for non-members.
 */
export function SubscriptionBanner() {
  const pathname = usePathname();
  const { subscription } = useSubscription();
  const [dismissed, setDismissed] = useState(false);

  const isMember = subscription.planTier === "membership";

  if (!shouldShowSubscriptionBanner(pathname) || dismissed || isMember) {
    return null;
  }

  return (
    <div className="border-b bg-amber-50">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        <p className="text-xs text-amber-900 sm:text-sm">
          <strong>Design for free.</strong> Subscribe for $
          {MEMBERSHIP_PRICE_MONTHLY_USD}/month for unlimited high-resolution
          downloads.
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button asChild size="sm" className="h-8 text-xs sm:text-sm">
            <Link href="/app/billing">Subscribe</Link>
          </Button>
          <button
            onClick={() => setDismissed(true)}
            className="rounded p-1 text-amber-600 hover:bg-amber-100"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
