"use client";

import { useEffect, useState, useRef } from "react";
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
import {
  CreditCard,
  ArrowLeft,
  Clock,
  BarChart3,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

interface SubscriptionData {
  active: boolean;
  expired?: boolean;
  cancelAtPeriodEnd?: boolean;
  subscription: {
    id: string;
    plan_slug: string;
    status: string;
    current_period_end: string | null;
    created_at: string;
    stripe_sub_id?: string | null;
  } | null;
  plan?: {
    name: string;
    monthly_quota: number | null;
    monthly_download_quota: number | null;
  };
  designUsage?: number;
  downloadUsage?: number;
  designQuota?: number | null;
  downloadQuota?: number | null;
}

export default function BillingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPlans, setShowPlans] = useState(false);
  const fulfilledRef = useRef(false);

  useEffect(() => {
    if (fulfilledRef.current) return;

    const checkout = searchParams.get("checkout");
    const sessionId = searchParams.get("session_id");

    async function load() {
      if (checkout === "success" && sessionId) {
        fulfilledRef.current = true;
        try {
          const fulfillRes = await fetch("/api/stripe/fulfill", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          });
          const result = await fulfillRes.json();

          if (fulfillRes.ok) {
            toast.success("Payment successful! Your plan is now active.");
          } else {
            toast.error(result.error || "Failed to activate plan.");
          }
        } catch {
          toast.error("Failed to verify payment. Please refresh the page.");
        }
        // Clean checkout params from URL to prevent re-firing
        router.replace("/app/billing", { scroll: false });
      } else if (checkout === "cancelled") {
        fulfilledRef.current = true;
        toast.info("Checkout was cancelled.");
        router.replace("/app/billing", { scroll: false });
      }

      try {
        const res = await fetch("/api/subscription");
        if (res.ok) {
          const subData = await res.json();
          setData(subData);
          // Auto-expand the paid plans for users who haven't paid yet —
          // both "no plan at all" and "on the free plan" — so the upgrade
          // path is one scroll away instead of one click away.
          if (
            !subData.active ||
            subData.subscription?.plan_slug === "free"
          ) {
            setShowPlans(true);
          }
        }
      } catch {
        toast.error("Failed to load subscription data.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [searchParams, router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasActiveSub = data?.active;
  const sub = data?.subscription;
  const plan = data?.plan;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/app"
        className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to App
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <CreditCard className="h-7 w-7" />
          Billing & Plans
        </h1>
        <p className="mt-2 text-muted-foreground">
          {hasActiveSub
            ? "Manage your subscription and track usage."
            : "Choose a plan to start creating beautiful map posters."}
        </p>
      </div>

      {/* Current Plan Summary */}
      {hasActiveSub && sub && plan && (
        <Card className="mb-8 border-green-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Current Plan</CardTitle>
              {data?.cancelAtPeriodEnd ? (
                <Badge variant="secondary" className="gap-1 border-muted-foreground/30 bg-muted text-foreground">
                  <Clock className="h-3 w-3" />
                  Cancelled
                </Badge>
              ) : (
                <Badge variant="default" className="gap-1 bg-green-600">
                  <CheckCircle className="h-3 w-3" />
                  Active
                </Badge>
              )}
            </div>
            <CardDescription>{plan.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-3">
              <div className="flex items-start gap-3">
                <CreditCard className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Plan</p>
                  <p className="text-sm text-muted-foreground">{plan.name}</p>
                </div>
              </div>

              {sub.current_period_end && (
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {data?.cancelAtPeriodEnd ? "Access until" : "Renews"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(sub.current_period_end).toLocaleDateString(
                        undefined,
                        { month: "long", day: "numeric", year: "numeric" }
                      )}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <BarChart3 className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div className="space-y-2">
                  {data?.designQuota === null && data?.downloadQuota === null ? (
                    <div>
                      <p className="text-sm font-medium">Usage</p>
                      <p className="text-sm text-muted-foreground">Unlimited</p>
                    </div>
                  ) : (
                    <>
                      {typeof data?.designQuota === "number" && (
                        <div>
                          <p className="text-sm font-medium">Designs</p>
                          <p className="text-sm text-muted-foreground">
                            {data.designUsage || 0} / {data.designQuota} this month
                          </p>
                          <div className="mt-1 h-2 w-32 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-blue-600 transition-all"
                              style={{
                                width: `${
                                  data.designQuota === 0
                                    ? 0
                                    : Math.min(
                                        ((data.designUsage || 0) /
                                          data.designQuota) *
                                          100,
                                        100
                                      )
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                      {data?.downloadQuota === 0 ? (
                        <div>
                          <p className="text-sm font-medium">Downloads</p>
                          <p className="text-sm text-muted-foreground">
                            Not included on this plan
                          </p>
                        </div>
                      ) : typeof data?.downloadQuota === "number" ? (
                        <div>
                          <p className="text-sm font-medium">Downloads</p>
                          <p className="text-sm text-muted-foreground">
                            {data.downloadUsage || 0} / {data.downloadQuota} this month
                          </p>
                          <div className="mt-1 h-2 w-32 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-green-600 transition-all"
                              style={{
                                width: `${Math.min(
                                  ((data.downloadUsage || 0) /
                                    data.downloadQuota) *
                                    100,
                                  100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button variant="outline" asChild>
                <Link href="/app">Start Creating</Link>
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowPlans(!showPlans)}
                className="text-muted-foreground"
              >
                {showPlans ? "Hide Plans" : "Change Plan"}
                <ChevronDown
                  className={`ml-1 h-4 w-4 transition-transform ${showPlans ? "rotate-180" : ""}`}
                />
              </Button>
              {!data?.cancelAtPeriodEnd && sub?.plan_slug !== "free" && (
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  asChild
                >
                  <Link href="/app/billing/cancel">Cancel Plan</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expired Banner */}
      {data?.expired && (
        <Card className="mb-8 border-amber-300 bg-amber-50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium text-amber-900">
                Your {data.plan?.name || "plan"} has expired
              </p>
              <p className="text-sm text-amber-700">
                Choose a new plan below to continue generating posters.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Plan Banner */}
      {!hasActiveSub && !data?.expired && (
        <Card className="mb-8 border-blue-200 bg-blue-50">
          <CardContent className="flex items-center gap-3 py-4">
            <CreditCard className="h-5 w-5 shrink-0 text-blue-600" />
            <div>
              <p className="font-medium text-blue-900">
                No active plan
              </p>
              <p className="text-sm text-blue-700">
                Choose a plan below to start creating map posters.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plan Cards — always visible when no plan, toggled when active */}
      {showPlans && (
        <>
          <Separator className="my-8" />
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-center mb-2">
              {hasActiveSub ? "Change Your Plan" : "Choose Your Plan"}
            </h2>
            <p className="text-center text-muted-foreground mb-8">
              {hasActiveSub
                ? "Switch to a different plan anytime."
                : "Pick the plan that works best for you."}
            </p>
          </div>
          <PlanCards isLoggedIn={true} currentPlanSlug={sub?.plan_slug || null} />
        </>
      )}
    </div>
  );
}
