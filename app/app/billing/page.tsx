"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlanCards } from "@/components/plan-cards";
import { useSubscription } from "@/components/subscription-provider";
import {
  MEMBERSHIP_PRICE_ANNUAL_USD,
  MEMBERSHIP_PRICE_MONTHLY_USD,
} from "@/lib/plan-config";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium">{value}</dd>
    </div>
  );
}

export default function BillingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { subscription, refresh } = useSubscription();
  const handledCheckoutRef = useRef(false);

  const isMember = subscription.planTier === "membership";
  const cancelling = subscription.cancelAtPeriodEnd;

  useEffect(() => {
    if (handledCheckoutRef.current) return;

    const checkout = searchParams.get("checkout");
    const sessionId = searchParams.get("session_id");
    if (!checkout) return;

    handledCheckoutRef.current = true;

    async function handleCheckout() {
      if (checkout === "success" && sessionId) {
        try {
          const res = await fetch("/api/stripe/fulfill", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          });
          const result = await res.json();
          if (res.ok) {
            toast.success("You're a member. Downloads are unlimited.");
          } else {
            toast.error(result.error || "We couldn't activate your membership.");
          }
        } catch {
          toast.error("Failed to verify payment. Please refresh the page.");
        }
        await refresh();
      } else if (checkout === "cancelled") {
        toast.info("Checkout was cancelled. Designing stays free.");
      }

      router.replace("/app/billing", { scroll: false });
    }

    void handleCheckout();
  }, [searchParams, router, refresh]);

  const nextDate = formatDate(subscription.renewsAt);
  const price =
    subscription.interval === "annual"
      ? `$${MEMBERSHIP_PRICE_ANNUAL_USD} per year`
      : `$${MEMBERSHIP_PRICE_MONTHLY_USD} per month`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link
        href="/app"
        className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to app
      </Link>

      <h1 className="text-2xl font-bold sm:text-3xl">Billing</h1>
      <p className="mt-2 text-sm text-muted-foreground sm:text-base">
        {isMember
          ? cancelling
            ? "Your membership stays active until the date below. After that, designing is still free."
            : "You're a member. Downloads are unlimited for as long as this stays active."
          : subscription.expired
            ? "Your membership has ended. Your designs and past downloads are still safe."
            : "Designing is free. Subscribe only if you want high-resolution files."}
      </p>

      {isMember ? (
        <Card className="mt-6">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Membership</h2>
              <Badge
                variant={cancelling ? "secondary" : "default"}
                className={cancelling ? undefined : "bg-green-600"}
              >
                {cancelling ? "Ending soon" : "Active"}
              </Badge>
            </div>

            <dl className="mt-3 divide-y">
              <Row label="Price" value={price} />
              <Row label="High-resolution downloads" value="Unlimited" />
              <Row
                label={cancelling ? "Access until" : "Next payment"}
                value={nextDate ?? "—"}
              />
            </dl>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button asChild>
                <Link href="/app">Start a poster</Link>
              </Button>
              {!cancelling && (
                <Button
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  asChild
                >
                  <Link href="/app/billing/cancel">Cancel membership</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6">
          <PlanCards isLoggedIn isMember={false} membershipOnly />
        </div>
      )}

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Physical prints are priced per order at checkout and are not part of the
        membership.
      </p>
    </div>
  );
}
