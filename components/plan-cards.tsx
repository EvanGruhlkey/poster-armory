"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  MEMBERSHIP_PRICE_ANNUAL_USD,
  MEMBERSHIP_PRICE_MONTHLY_USD,
  type BillingInterval,
} from "@/lib/plan-config";

const FREE_FEATURES = [
  "Design and preview",
  "Every theme",
  "No high-resolution downloads",
];

const MEMBERSHIP_FEATURES = [
  "Unlimited downloads",
  "PNG and PDF",
  "Cancel anytime",
];

interface PlanCardsProps {
  isLoggedIn: boolean;
  /** True when the viewer already has an active membership. */
  isMember?: boolean;
  /** Billing page: membership only, no free-plan comparison. */
  membershipOnly?: boolean;
}

export function PlanCards({
  isLoggedIn,
  isMember = false,
  membershipOnly = false,
}: PlanCardsProps) {
  const router = useRouter();
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [loading, setLoading] = useState(false);

  async function startCheckout() {
    if (!isLoggedIn) {
      router.push("/login?redirect=/app/billing");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start checkout");
      if (data.url) window.location.href = data.url;
      else throw new Error("No checkout URL returned");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div
          role="radiogroup"
          aria-label="Billing interval"
          className="inline-flex items-center rounded-full border bg-muted/40 p-1"
        >
          {(
            [
              { id: "monthly" as const, label: "Monthly" },
              { id: "annual" as const, label: "Yearly" },
            ]
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={interval === option.id}
              onClick={() => setInterval(option.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                interval === option.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {option.label}
              {option.id === "annual" && (
                <span className="ml-1.5 hidden text-xs font-normal text-primary sm:inline">
                  2 months free
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div
        className={`mx-auto grid gap-4 sm:gap-6 ${
          membershipOnly ? "max-w-md grid-cols-1" : "max-w-3xl sm:grid-cols-2"
        }`}
      >
        {!membershipOnly && (
          <Card className="flex flex-col">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Free</CardTitle>
              <div className="mt-2">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-muted-foreground">/forever</span>
              </div>
              <CardDescription className="mt-1">Design and preview</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <FeatureList features={FREE_FEATURES} mutedLast />
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" asChild>
                <a href="/app">Start</a>
              </Button>
            </CardFooter>
          </Card>
        )}

        <Card className="flex flex-col border-primary shadow-lg ring-1 ring-primary">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Membership</CardTitle>
            <div className="mt-2">
              <span className="text-4xl font-bold">
                ${interval === "annual" ? MEMBERSHIP_PRICE_ANNUAL_USD : MEMBERSHIP_PRICE_MONTHLY_USD}
              </span>
              <span className="text-muted-foreground">
                {interval === "annual" ? "/year" : "/month"}
              </span>
            </div>
            <CardDescription className="mt-1">
              {interval === "annual" ? "Two months free" : "Unlimited downloads"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <FeatureList features={MEMBERSHIP_FEATURES} />
          </CardContent>
          <CardFooter>
            {isMember ? (
              <Button variant="outline" className="w-full" disabled>
                Current plan
              </Button>
            ) : (
              <Button className="w-full" onClick={startCheckout} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Subscribe
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>

    </div>
  );
}

function FeatureList({
  features,
  mutedLast = false,
}: {
  features: string[];
  mutedLast?: boolean;
}) {
  return (
    <ul className="space-y-2 text-sm">
      {features.map((text, index) => {
        const muted = mutedLast && index === features.length - 1;
        return (
          <li
            key={text}
            className={`flex items-center gap-2 ${muted ? "text-muted-foreground" : ""}`}
          >
            {muted ? (
              <span className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <CheckCircle className="h-4 w-4 shrink-0 text-primary" />
            )}
            {text}
          </li>
        );
      })}
    </ul>
  );
}
