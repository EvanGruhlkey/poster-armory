"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { PlanCards } from "@/components/plan-cards";
import { useAuth } from "@/components/auth-provider";
import { useSubscription } from "@/components/subscription-provider";
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
      isLoggedIn={Boolean(user && !user.is_anonymous)}
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
          <h1 className="mb-8 text-center text-2xl font-bold sm:mb-10 sm:text-4xl">
            Pricing
          </h1>

          <Suspense
            fallback={
              <div className="py-12 text-center text-muted-foreground">
                Loading plans...
              </div>
            }
          >
            <PricingContent />
          </Suspense>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Prints sold separately.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
