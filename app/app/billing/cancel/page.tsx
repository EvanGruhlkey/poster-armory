"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Loader2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

interface SubscriptionPayload {
  active: boolean;
  cancelAtPeriodEnd?: boolean;
  subscription: {
    plan_slug: string;
    current_period_end: string | null;
    stripe_sub_id?: string | null;
  } | null;
  plan?: { name: string };
}

export default function CancelSubscriptionPage() {
  const router = useRouter();
  const [data, setData] = useState<SubscriptionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/subscription");
        if (!res.ok) {
          if (!cancelled) router.replace("/app/billing");
          return;
        }
        const json = (await res.json()) as SubscriptionPayload;
        if (!cancelled) {
          if (!json.active || !json.subscription) {
            toast.info("You don't have an active subscription to cancel.");
            router.replace("/app/billing");
            return;
          }
          if (json.cancelAtPeriodEnd) {
            toast.info("Your plan is already cancelled and will stay active through the end of the period you paid for.");
            router.replace("/app/billing");
            return;
          }
          setData(json);
        }
      } catch {
        if (!cancelled) {
          toast.error("Could not load your subscription.");
          router.replace("/app/billing");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function confirmCancel() {
    if (!data?.subscription) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/stripe/cancel", { method: "POST" });
      const result = await res.json();
      if (res.ok) {
        const recurring = Boolean(data.subscription.stripe_sub_id);
        toast.success(
          recurring
            ? "Subscription cancelled. You keep access until the end of your billing period."
            : "Your plan has been cancelled."
        );
        router.push("/app/billing");
        return;
      }
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Failed to cancel subscription."
      );
    } catch {
      toast.error("Failed to cancel subscription.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !data?.subscription || !data.plan) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const sub = data.subscription;
  const isRecurring = Boolean(sub.stripe_sub_id);
  const endDate =
    sub.current_period_end &&
    new Date(sub.current_period_end).toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/app/billing"
        className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to billing
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Cancel subscription</h1>
        <p className="mt-2 text-muted-foreground">
          Review what happens before you confirm. You can always subscribe again
          later.
        </p>
      </div>

      <Card className="border-amber-200 bg-amber-50/40">
        <CardHeader>
          <div className="flex items-center gap-2 text-amber-900">
            <CreditCard className="h-5 w-5" />
            <CardTitle className="text-lg">
              {data.plan.name}
            </CardTitle>
          </div>
          <CardDescription className="text-amber-900/80">
            {isRecurring
              ? "Recurring plan: cancel stops future charges; your current period stays active."
              : "This access isn't tied to a recurring Stripe subscription. Cancelling may end access immediately."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ul className="space-y-3 text-sm text-foreground">
            {isRecurring ? (
              <>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                  <span>
                    Your account will show as <strong>cancelled</strong>, with full access until{" "}
                    {endDate ? (
                      <strong>{endDate}</strong>
                    ) : (
                      "the end of the period you already paid for"
                    )}
                    .
                  </span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                  <span>
                    You won&apos;t be charged again unless you start a new subscription or
                    checkout.
                  </span>
                </li>
                <li className="flex gap-2">
                  <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>
                    Usage limits apply until that access date; they reset on your normal
                    billing renewal schedule until then.
                  </span>
                </li>
              </>
            ) : (
              <>
                <li className="flex gap-2">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <span>
                    Cancelling this plan may <strong>end access immediately</strong> (no
                    recurring billing on file).
                  </span>
                </li>
              </>
            )}
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              <span>
                You can resubscribe anytime from{" "}
                <Link href="/app/billing" className="font-medium underline underline-offset-4">
                  Billing & plans
                </Link>
                .
              </span>
            </li>
          </ul>

          <div className="flex flex-col-reverse gap-3 border-t border-amber-200/80 pt-6 sm:flex-row sm:justify-end">
            <Button variant="outline" asChild disabled={submitting}>
              <Link href="/app/billing">Keep my plan</Link>
            </Button>
            <Button
              variant="destructive"
              disabled={submitting}
              onClick={confirmCancel}
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Confirm cancellation
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
