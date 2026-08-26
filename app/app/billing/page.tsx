"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PlanCards } from "@/components/plan-cards";
import { useSubscription } from "@/components/subscription-provider";
import {
  MEMBERSHIP_DOWNLOADS_PER_MONTH,
  MEMBERSHIP_PRICE_ANNUAL_USD,
  MEMBERSHIP_PRICE_MONTHLY_USD,
} from "@/lib/plan-config";
import {
  CreditCard,
  ArrowLeft,
  Clock,
  Download,
  CheckCircle,
  AlertTriangle,
  Package,
} from "lucide-react";
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

export default function BillingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { subscription, refresh } = useSubscription();
  const [showPlans, setShowPlans] = useState(false);
  const handledCheckoutRef = useRef(false);

  const isMember = subscription.planTier === "membership";

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
            toast.success("You're a member. Your downloads are ready to use.");
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

  const allowanceResetsOn = formatDate(subscription.periodEnd);
  const accessEndsOn = formatDate(subscription.renewsAt);
  const remaining = subscription.downloadsRemaining;
  const quota = subscription.downloadQuota ?? MEMBERSHIP_DOWNLOADS_PER_MONTH;
  const usedPercent =
    quota > 0 ? Math.min((subscription.downloadsUsed / quota) * 100, 100) : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/app"
        className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to app
      </Link>

      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <CreditCard className="h-6 w-6 shrink-0 sm:h-7 sm:w-7" />
          Billing
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          {isMember
            ? "Track your downloads and manage your membership."
            : `Designing is free. Subscribe for $${MEMBERSHIP_PRICE_MONTHLY_USD}/month to download high-resolution files.`}
        </p>
      </div>

      {isMember ? (
        <Card className="mb-8">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">Membership</CardTitle>
              {subscription.cancelAtPeriodEnd ? (
                <Badge
                  variant="secondary"
                  className="gap-1 border-muted-foreground/30 bg-muted text-foreground"
                >
                  <Clock className="h-3 w-3" />
                  Cancels at period end
                </Badge>
              ) : (
                <Badge variant="default" className="gap-1 bg-green-600">
                  <CheckCircle className="h-3 w-3" />
                  Active
                </Badge>
              )}
            </div>
            <CardDescription>
              {subscription.interval === "annual"
                ? `$${MEMBERSHIP_PRICE_ANNUAL_USD}/year · ${MEMBERSHIP_DOWNLOADS_PER_MONTH} high-resolution downloads per month`
                : `$${MEMBERSHIP_PRICE_MONTHLY_USD}/month · ${MEMBERSHIP_DOWNLOADS_PER_MONTH} high-resolution downloads per month`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <Download className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Downloads remaining</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {remaining === null ? "Unlimited" : remaining}
                    {remaining !== null && (
                      <span className="text-base font-normal text-muted-foreground">
                        {" "}
                        of {quota}
                      </span>
                    )}
                  </p>
                  {remaining !== null && (
                    <div
                      className="mt-2 h-2 w-full max-w-[200px] overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuenow={subscription.downloadsUsed}
                      aria-valuemin={0}
                      aria-valuemax={quota}
                      aria-label="Downloads used this billing period"
                    >
                      <div
                        className={`h-full rounded-full transition-all ${
                          remaining === 0 ? "bg-amber-500" : "bg-green-600"
                        }`}
                        style={{ width: `${usedPercent}%` }}
                      />
                    </div>
                  )}
                  {allowanceResetsOn && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Resets {allowanceResetsOn}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {subscription.cancelAtPeriodEnd ? "Access until" : "Renews"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {accessEndsOn ?? "—"}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Cancel anytime. You keep access through the period you paid
                    for.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="outline" asChild>
                <Link href="/app">Start a poster</Link>
              </Button>
              {!subscription.cancelAtPeriodEnd && (
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  asChild
                >
                  <Link href="/app/billing/cancel">Cancel membership</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-8 border-blue-200 bg-blue-50">
          <CardContent className="flex items-start gap-3 py-4">
            <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <div>
              <p className="font-medium text-blue-900">
                {subscription.expired
                  ? "Your membership has ended"
                  : "Design for free"}
              </p>
              <p className="text-sm text-blue-700">
                Keep designing as many posters as you like at no cost. Subscribe
                for ${MEMBERSHIP_PRICE_MONTHLY_USD}/month to unlock{" "}
                {MEMBERSHIP_DOWNLOADS_PER_MONTH} high-resolution downloads per
                month.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {subscription.expired && isMember === false && (
        <Card className="mb-8 border-amber-300 bg-amber-50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-900">
              Your designs and past downloads are safe. Resubscribe whenever you
              need new high-resolution files.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="mb-8">
        <CardContent className="flex items-start gap-3 py-4">
          <Package className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Physical prints sold separately</p>
            <p className="text-sm text-muted-foreground">
              Printed posters are priced per order with shipping at checkout and
              are not included in the membership.
            </p>
          </div>
        </CardContent>
      </Card>

      {(!isMember || showPlans) && (
        <>
          <Separator className="my-8" />
          <div className="mb-8 text-center">
            <h2 className="text-xl font-bold sm:text-2xl">
              {isMember ? "Your plan" : "Add high-resolution downloads"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              One membership. {MEMBERSHIP_DOWNLOADS_PER_MONTH} downloads per
              month. Cancel anytime.
            </p>
          </div>
          <PlanCards isLoggedIn isMember={isMember} />
        </>
      )}

      {isMember && !showPlans && (
        <div className="text-center">
          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => setShowPlans(true)}
          >
            View plan details
          </Button>
        </div>
      )}
    </div>
  );
}
