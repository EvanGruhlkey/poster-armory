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
  planTier: "free" | "membership" | "none";
  planName: string | null;
  cancelAtPeriodEnd?: boolean;
  renewsAt: string | null;
  subscription: { stripe_sub_id?: string | null } | null;
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
          if (!json.active || json.planTier !== "membership") {
            toast.info("You don't have a membership to cancel.");
            router.replace("/app/billing");
            return;
          }
          if (json.cancelAtPeriodEnd) {
            toast.info(
              "Your membership is already cancelled and stays active through the period you paid for."
            );
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
            ? "Membership cancelled. You keep your downloads until the end of the billing period."
            : "Your membership has been cancelled."
        );
        router.push("/app/billing");
        return;
      }
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Failed to cancel membership."
      );
    } catch {
      toast.error("Failed to cancel membership.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !data?.subscription) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isRecurring = Boolean(data.subscription.stripe_sub_id);
  const endDate =
    data.renewsAt &&
    new Date(data.renewsAt).toLocaleDateString(undefined, {
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
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Cancel membership
        </h1>
        <p className="mt-2 text-muted-foreground">
          Designing stays free either way. Review what changes before you
          confirm — you can resubscribe anytime.
        </p>
      </div>

      <Card className="border-amber-200 bg-amber-50/40">
        <CardHeader>
          <div className="flex items-center gap-2 text-amber-900">
            <CreditCard className="h-5 w-5 shrink-0" />
            <CardTitle className="text-lg">
              {data.planName || "Membership"}
            </CardTitle>
          </div>
          <CardDescription className="text-amber-900/80">
            {isRecurring
              ? "Cancelling stops future charges. Your current billing period stays active."
              : "This membership isn't tied to a recurring Stripe subscription. Cancelling may end access immediately."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ul className="space-y-3 text-sm text-foreground">
            {isRecurring ? (
              <>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                  <span>
                    You keep your remaining downloads until{" "}
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
                  <span>You won&apos;t be charged again.</span>
                </li>
                <li className="flex gap-2">
                  <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>
                    After that date the monthly download allowance stops
                    refilling. Files you already downloaded stay in your library.
                  </span>
                </li>
              </>
            ) : (
              <li className="flex gap-2">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <span>
                  Cancelling may <strong>end downloads immediately</strong> (no
                  recurring billing on file).
                </span>
              </li>
            )}
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              <span>
                Designing stays free, and physical prints can still be ordered
                separately.
              </span>
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              <span>
                Resubscribe anytime from{" "}
                <Link href="/app/billing" className="font-medium underline underline-offset-4">
                  Billing
                </Link>
                .
              </span>
            </li>
          </ul>

          <div className="flex flex-col-reverse gap-3 border-t border-amber-200/80 pt-6 sm:flex-row sm:justify-end">
            <Button variant="outline" asChild disabled={submitting}>
              <Link href="/app/billing">Keep my membership</Link>
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
