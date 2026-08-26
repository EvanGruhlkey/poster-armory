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
