"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { PlanCards } from "@/components/plan-cards";
import { useAuth } from "@/components/auth-provider";
import { useSubscription } from "@/components/subscription-provider";
import { MEMBERSHIP_DOWNLOADS_PER_MONTH } from "@/lib/plan-config";
import { toast } from "sonner";
import { PRINT_DETAILS } from "@/lib/print-details";

function PricingContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { subscription } = useSubscription();

  useEffect(() => {
    if (searchParams.get("checkout") === "cancelled") {
      toast.info("Checkout was cancelled. You can subscribe anytime.");
    }
  }, [searchParams]);

  return (
    <PlanCards
      isLoggedIn={Boolean(user)}
      isMember={subscription.planTier === "membership"}
    />
  );
}

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1 py-10 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 text-center sm:mb-12">
            <h1 className="text-2xl font-bold sm:text-4xl">
              Design for free. Download when you&apos;re ready.
            </h1>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground sm:mt-3 sm:text-lg">
              Creating and customizing posters costs nothing. The $10/month
              membership adds {MEMBERSHIP_DOWNLOADS_PER_MONTH} high-resolution
              downloads per month.
            </p>
          </div>

          <Suspense
            fallback={
              <div className="py-12 text-center text-muted-foreground">
                Loading plans...
              </div>
            }
          >
            <PricingContent />
          </Suspense>

          <section className="mx-auto mt-12 max-w-3xl rounded-xl border bg-card p-5 sm:p-7">
            <h2 className="text-xl font-semibold">Physical prints</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Prints are purchased separately from downloads. Choose from {PRINT_DETAILS.sizes.join(", ")} on {PRINT_DETAILS.paper}. Each file is {PRINT_DETAILS.resolution.toLowerCase()}.
            </p>
            <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-lg bg-muted/50 p-3"><span className="font-medium">1.</span> Design free</div>
              <div className="rounded-lg bg-muted/50 p-3"><span className="font-medium">2.</span> Enter delivery details</div>
              <div className="rounded-lg bg-muted/50 p-3"><span className="font-medium">3.</span> See print and shipping total</div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">{PRINT_DETAILS.payment}. Shipping varies by destination.</p>
          </section>

          <div className="mx-auto mt-12 max-w-2xl space-y-2 text-center">
            <p className="text-sm text-muted-foreground">
              Cancel anytime. No contracts. Physical prints sold separately.
            </p>
            <p className="text-xs text-muted-foreground">
              Map data &copy; OpenStreetMap contributors.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
