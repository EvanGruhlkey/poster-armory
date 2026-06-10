"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { PlanCards } from "@/components/plan-cards";
import { toast } from "sonner";

function PricingContent() {
  const searchParams = useSearchParams();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentPlanSlug, setCurrentPlanSlug] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("checkout") === "cancelled") {
      toast.info("Checkout was cancelled. You can try again anytime.");
    }

    async function checkAuth() {
      try {
        const res = await fetch("/api/subscription");
        if (res.ok) {
          const data = await res.json();
          setIsLoggedIn(true);
          if (data.active && data.subscription?.plan_slug) {
            setCurrentPlanSlug(data.subscription.plan_slug);
          }
        }
      } catch {
        // not logged in
      }
    }
    checkAuth();
  }, [searchParams]);

  return <PlanCards isLoggedIn={isLoggedIn} currentPlanSlug={currentPlanSlug} />;
}

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1 py-10 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 text-center sm:mb-12">
            <h1 className="text-2xl font-bold sm:text-4xl">Pricing</h1>
            <p className="mt-2 text-sm text-muted-foreground sm:mt-3 sm:text-lg">
              Start free. Upgrade when you&apos;re ready to download.
            </p>
          </div>

          <Suspense fallback={<div className="text-center py-12 text-muted-foreground">Loading plans...</div>}>
            <PricingContent />
          </Suspense>

          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground">
              Cancel anytime. No contracts. Map data &copy; OpenStreetMap contributors.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
