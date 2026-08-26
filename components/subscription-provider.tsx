"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  SIGNED_OUT_SUMMARY,
  type SubscriptionSummary,
} from "@/lib/subscription-summary";
import { useAuth } from "@/components/auth-provider";

interface SubscriptionContextValue {
  subscription: SubscriptionSummary;
  /** False only while a background refresh is in flight after a mutation. */
  refreshing: boolean;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  subscription: SIGNED_OUT_SUMMARY,
  refreshing: false,
  refresh: async () => {},
});

/**
 * Seeded on the server so the first paint already knows whether the visitor
 * is a member. Without this, every page briefly rendered the signed-out
 * pricing state before the client fetch resolved.
 */
export function SubscriptionProvider({
  initialSubscription,
  children,
}: {
  initialSubscription: SubscriptionSummary;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [subscription, setSubscription] =
    useState<SubscriptionSummary>(initialSubscription);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setSubscription(SIGNED_OUT_SUMMARY);
      return;
    }
    setRefreshing(true);
    try {
      const res = await fetch("/api/subscription");
      if (res.ok) {
        setSubscription((await res.json()) as SubscriptionSummary);
      } else if (res.status === 401) {
        setSubscription(SIGNED_OUT_SUMMARY);
      }
    } catch {
      // Keep the server-resolved value rather than flashing a wrong state.
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  // Reconcile with Stripe-backed fields (cancellation, billing interval) that
  // the server render deliberately skips, and react to sign-in/sign-out.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ subscription, refreshing, refresh }),
    [subscription, refreshing, refresh]
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
