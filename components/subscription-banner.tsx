"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export function SubscriptionBanner() {
  const pathname = usePathname();
  const [hasSub, setHasSub] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setHasSub(null);
    async function check() {
      if (
        !process.env.NEXT_PUBLIC_SUPABASE_URL ||
        !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ) {
        return;
      }
      try {
        const res = await fetch("/api/subscription");
        if (res.ok) {
          const data = await res.json();
          setHasSub(data.active);
        }
      } catch {
        // ignore
      }
    }
    check();
  }, [pathname]);

  if (
    pathname === "/app/billing" ||
    hasSub === null ||
    hasSub === true ||
    dismissed
  ) {
    return null;
  }

  return (
    <div className="border-b bg-amber-50">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        <p className="text-xs text-amber-900 sm:text-sm">
          <strong>Design for free.</strong> Choose a plan when you&apos;re ready
          to download.
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button asChild size="sm" className="h-8 text-xs sm:text-sm">
            <Link href="/app/billing">View Plans</Link>
          </Button>
          <button
            onClick={() => setDismissed(true)}
            className="rounded p-1 text-amber-600 hover:bg-amber-100"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
