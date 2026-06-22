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
import { CheckCircle, XCircle, Loader2, Zap, Sparkles } from "lucide-react";
import { toast } from "sonner";

type CheckoutSlug = "free" | "single_download" | "starter" | "pro";

interface Feature {
  text: string;
  included: boolean;
}

interface PlanCard {
  slug: CheckoutSlug;
  name: string;
  price: string;
  period: string;
  tagline: string;
  features: Feature[];
  highlight: boolean;
  /** "Pay once" / "Most popular" pill above the title. */
  badge?: string;
  /** Override "Get started" CTA copy for the single-download tier. */
  ctaLabel?: string;
}

// Pricing v2 — Free / Single Download / Starter / Pro.
// See lib/plan-config.ts for the entitlements these cards describe.
const PLANS: PlanCard[] = [
  {
    slug: "free",
    name: "Free Preview",
    price: "$0",
    period: "/forever",
    tagline: "Try every design before you commit.",
    features: [
      { text: "Unlimited poster previews", included: true },
      { text: "Standard themes", included: true },
      { text: "Order physical prints", included: true },
      { text: "High-resolution downloads", included: false },
      { text: "Zoom & rotation controls", included: false },
      { text: "Poster library", included: false },
    ],
    highlight: false,
  },
  {
    slug: "single_download",
    name: "Single Download",
    price: "$9",
    period: "one-time",
    tagline: "Grab one high-res file. No subscription.",
    badge: "Pay once",
    ctaLabel: "Buy 1 Download",
    features: [
      { text: "1 high-resolution PNG or PDF", included: true },
      { text: "Credit never expires", included: true },
      { text: "All themes unlocked for that design", included: true },
      { text: "Personal use license", included: true },
      { text: "Monthly downloads or library", included: false },
      { text: "Commercial use rights", included: false },
    ],
    highlight: false,
  },
  {
    slug: "starter",
    name: "Starter",
    price: "$10",
    period: "/month",
    tagline: "For casual repeat creators.",
    badge: "Most popular",
    highlight: true,
    features: [
      { text: "Unlimited poster previews", included: true },
      { text: "5 high-resolution downloads / month", included: true },
      { text: "All themes unlocked", included: true },
      { text: "Multiple print sizes", included: true },
      { text: "Zoom, rotation & fine positioning", included: true },
      { text: "Poster library: save your designs", included: true },
    ],
  },
  {
    slug: "pro",
    name: "Pro",
    price: "$20",
    period: "/month",
    tagline: "For creators and businesses.",
    badge: "Commercial use",
    features: [
      { text: "Unlimited downloads (fair use)", included: true },
      { text: "Commercial use license", included: true },
      { text: "Everything in Starter", included: true },
      { text: "SVG export", included: true },
      { text: "Priority rendering", included: true },
      { text: "Email support", included: true },
    ],
    highlight: false,
  },
];

interface PlanCardsProps {
  isLoggedIn: boolean;
  currentPlanSlug?: string | null;
}

export function PlanCards({ isLoggedIn, currentPlanSlug }: PlanCardsProps) {
  const router = useRouter();
  const [loadingSlug, setLoadingSlug] = useState<CheckoutSlug | null>(null);

  async function handleCheckout(planSlug: CheckoutSlug) {
    // Free is auto-granted on signup, so the button just routes them
    // into the app (or to signup if they're not logged in yet).
    if (planSlug === "free") {
      router.push(isLoggedIn ? "/app" : "/login?redirect=/app");
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
      if (!res.ok) throw new Error(data.error || "Failed to start checkout");
      if (data.url) window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed");
      setLoadingSlug(null);
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
      {PLANS.map((plan) => {
        const isCurrent = currentPlanSlug === plan.slug;
        const isLoading = loadingSlug === plan.slug;
        const isFreePlan = plan.slug === "free";
        const isOneTime = plan.slug === "single_download";
        // For paid users browsing pricing, the free card represents the
        // permanent fallback they already have. Don't offer it as an
        // actionable "switch" target.
        const isFreeAlreadyIncluded =
          isFreePlan &&
          isLoggedIn &&
          currentPlanSlug &&
          currentPlanSlug !== "free";

        return (
          <Card
            key={plan.slug}
            className={`flex flex-col ${
              plan.highlight ? "border-primary shadow-lg ring-1 ring-primary" : ""
            } ${isCurrent ? "ring-2 ring-green-500 border-green-500" : ""}`}
          >
            <CardHeader className="text-center">
              {isCurrent && (
                <div className="mx-auto mb-2 inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                  <CheckCircle className="h-3 w-3" />
                  Current Plan
                </div>
              )}
              {plan.badge && !isCurrent && (
                <div
                  className={`mx-auto mb-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                    plan.highlight
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {plan.highlight ? (
                    <Zap className="h-3 w-3" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  {plan.badge}
                </div>
              )}
              <CardTitle className="text-xl">{plan.name}</CardTitle>
              <div className="mt-2">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground">
                  {plan.period.startsWith("/") ? plan.period : ` ${plan.period}`}
                </span>
              </div>
              <CardDescription className="mt-1">{plan.tagline}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-3">
                {plan.features.map((feature, i) => (
                  <li
                    key={i}
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
                  {plan.ctaLabel
                    ? plan.ctaLabel
                    : isFreePlan
                      ? isLoggedIn
                        ? "Start Creating"
                        : "Sign Up Free"
                      : isOneTime
                        ? "Buy Now"
                        : currentPlanSlug && currentPlanSlug !== "free"
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
