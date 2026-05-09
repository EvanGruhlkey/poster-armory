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
import { CheckCircle, XCircle, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";

interface Feature {
  text: string;
  included: boolean;
}

const PLANS = [
  {
    slug: "free",
    name: "Free",
    price: "$0",
    period: "/month",
    tagline: "Try it before you buy.",
    features: [
      { text: "5 poster designs (previews) per month", included: true },
      { text: "High-resolution downloads", included: false },
      { text: "Standard themes only", included: true },
      { text: "One print size", included: true },
      { text: "Zoom & rotation controls", included: false },
      { text: "Poster library", included: false },
    ] as Feature[],
    highlight: false,
    color: "gray",
  },
  {
    slug: "basic",
    name: "Basic",
    price: "$5",
    period: "/month",
    tagline: "Make a meaningful gift.",
    features: [
      { text: "10 poster designs (previews) per month", included: true },
      { text: "2 high-resolution downloads per month", included: true },
      { text: "Standard themes only", included: true },
      { text: "One print size", included: true },
      { text: "Zoom & rotation controls", included: false },
      { text: "Poster library", included: false },
    ] as Feature[],
    highlight: false,
    color: "green",
  },
  {
    slug: "pro",
    name: "Pro",
    price: "$15",
    period: "/month",
    tagline: "Full creative freedom.",
    features: [
      { text: "25 poster designs per month", included: true },
      { text: "10 high-resolution downloads per month", included: true },
      { text: "All themes unlocked", included: true },
      { text: "Multiple print sizes", included: true },
      { text: "Zoom, rotation & fine positioning", included: true },
      { text: "Poster library — save your designs", included: true },
    ] as Feature[],
    highlight: true,
    color: "blue",
  },
  {
    slug: "pro_plus",
    name: "Pro+",
    price: "$25",
    period: "/month",
    tagline: "Never think about limits.",
    features: [
      { text: "Unlimited poster designs (fair use)", included: true },
      { text: "Unlimited high-resolution downloads", included: true },
      { text: "All themes unlocked", included: true },
      { text: "Multiple print sizes", included: true },
      { text: "Zoom, rotation & fine positioning", included: true },
      { text: "Poster library — save your designs", included: true },
    ] as Feature[],
    highlight: false,
    color: "purple",
  },
];

interface PlanCardsProps {
  isLoggedIn: boolean;
  currentPlanSlug?: string | null;
}

export function PlanCards({ isLoggedIn, currentPlanSlug }: PlanCardsProps) {
  const router = useRouter();
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);

  async function handleCheckout(planSlug: string) {
    // Free is auto-granted on signup, so the "checkout" button just routes
    // to the signup form (or no-ops if they're already logged in, since
    // every signed-in user already has a free sub from the trigger).
    if (planSlug === "free") {
      if (!isLoggedIn) {
        router.push("/login?redirect=/app");
      } else {
        router.push("/app");
      }
      return;
    }

    if (!isLoggedIn) {
      router.push(`/login?redirect=/app/billing&plan=${planSlug}`);
      return;
    }

    setLoadingSlug(planSlug);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to start checkout");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Checkout failed";
      toast.error(msg);
      setLoadingSlug(null);
    }
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {PLANS.map((plan) => {
        const isCurrent = currentPlanSlug === plan.slug;
        const isLoading = loadingSlug === plan.slug;
        const isFreePlan = plan.slug === "free";
        // For paid users browsing pricing, the free card represents the
        // permanent fallback they already have. Don't offer it as an
        // actionable "switch" target.
        const isFreeAlreadyIncluded =
          isFreePlan && isLoggedIn && currentPlanSlug && currentPlanSlug !== "free";

        return (
          <Card
            key={plan.slug}
            className={`flex flex-col ${
              plan.highlight
                ? "border-primary shadow-lg ring-1 ring-primary"
                : ""
            } ${isCurrent ? "ring-2 ring-green-500 border-green-500" : ""}`}
          >
            <CardHeader className="text-center">
              {isCurrent && (
                <div className="mx-auto mb-2 inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                  <CheckCircle className="h-3 w-3" />
                  Current Plan
                </div>
              )}
              {plan.highlight && !isCurrent && (
                <div className="mx-auto mb-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <Zap className="h-3 w-3" />
                  Most Popular
                </div>
              )}
              <CardTitle className="text-xl">{plan.name}</CardTitle>
              <div className="mt-2">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>
              <CardDescription className="mt-1">{plan.tagline}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-3">
                {plan.features.map((feature, i) => (
                  <li
                    key={i}
                    className={`flex items-center gap-2 text-sm ${
                      feature.included ? "" : "text-muted-foreground"
                    }`}
                  >
                    {feature.included ? (
                      <CheckCircle className="h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                    )}
                    {feature.text}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              {isCurrent ? (
                <Button variant="outline" className="w-full" disabled>
                  Current Plan
                </Button>
              ) : isFreeAlreadyIncluded ? (
                <Button variant="outline" className="w-full" disabled>
                  Included with every account
                </Button>
              ) : (
                <Button
                  className="w-full"
                  variant={plan.highlight ? "default" : "outline"}
                  onClick={() => handleCheckout(plan.slug)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {isFreePlan
                    ? isLoggedIn
                      ? "Start Creating"
                      : "Sign Up Free"
                    : currentPlanSlug
                      ? "Switch Plan"
                      : "Get Started"}
                </Button>
              )}
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
