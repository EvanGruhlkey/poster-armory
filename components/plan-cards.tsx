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
import { CheckCircle, XCircle, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  MEMBERSHIP_DOWNLOADS_PER_MONTH,
  MEMBERSHIP_PRICE_ANNUAL_USD,
  MEMBERSHIP_PRICE_MONTHLY_USD,
  type BillingInterval,
} from "@/lib/plan-config";

const ANNUAL_MONTHLY_EQUIVALENT = (MEMBERSHIP_PRICE_ANNUAL_USD / 12).toFixed(2);

const FREE_FEATURES = [
  { text: "Design unlimited posters for free", included: true },
  { text: "Every theme, layer and map framing", included: true },
  { text: "Live preview that updates as you edit", included: true },
  { text: "Order physical prints (sold separately)", included: true },
  { text: "High-resolution downloads", included: false },
];

const MEMBERSHIP_FEATURES = [
  {
    text: `${MEMBERSHIP_DOWNLOADS_PER_MONTH} high-resolution downloads per month`,
    included: true,
  },
  { text: "PNG, PDF and SVG exports", included: true },
  { text: "Everything in the free designer", included: true },
  { text: "Poster library with every download saved", included: true },
  { text: "Cancel anytime", included: true },
];

interface PlanCardsProps {
  isLoggedIn: boolean;
  /** True when the viewer already has an active membership. */
  isMember?: boolean;
}

export function PlanCards({ isLoggedIn, isMember = false }: PlanCardsProps) {
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

      <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2 sm:gap-6">
        <Card className="flex flex-col">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Free</CardTitle>
            <div className="mt-2">
              <span className="text-4xl font-bold">$0</span>
              <span className="text-muted-foreground">/forever</span>
            </div>
            <CardDescription className="mt-1">
              Design for free. No card required.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <FeatureList features={FREE_FEATURES} />
          </CardContent>
          <CardFooter>
            {isLoggedIn ? (
              <Button variant="outline" className="w-full" asChild>
                <a href="/app">Start designing</a>
              </Button>
            ) : (
              <Button variant="outline" className="w-full" asChild>
                <a href="/app">Start designing free</a>
              </Button>
            )}
          </CardFooter>
        </Card>

        <Card className="flex flex-col border-primary shadow-lg ring-1 ring-primary">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3 w-3" />
              {isMember ? "Your membership" : "For downloads"}
            </div>
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
              {interval === "annual"
                ? `Just $${ANNUAL_MONTHLY_EQUIVALENT}/month, billed yearly.`
                : `$${MEMBERSHIP_PRICE_MONTHLY_USD}/month. Cancel anytime.`}
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
                {isLoggedIn ? "Subscribe" : "Get the membership"}
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Physical prints are sold separately and priced per order at checkout.
      </p>
    </div>
  );
}

function FeatureList({
  features,
}: {
  features: { text: string; included: boolean }[];
}) {
  return (
    <ul className="space-y-3">
      {features.map((feature) => (
        <li
          key={feature.text}
          className={`flex items-start gap-3 text-sm ${
            feature.included ? "" : "text-muted-foreground"
          }`}
        >
          {feature.included ? (
            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
          )}
          {feature.text}
        </li>
      ))}
    </ul>
  );
}
