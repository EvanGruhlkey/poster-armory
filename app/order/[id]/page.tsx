"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Package,
  Truck,
  ExternalLink,
  ArrowLeft,
} from "lucide-react";
import { ProtectedImage } from "@/components/protected-image";
import type { OrderStatus } from "@/lib/types";

interface OrderData {
  id: string;
  status: OrderStatus;
  size_label: string;
  quantity: number;
  currency: string;
  amount_total: number | null;
  amount_product: number | null;
  amount_shipping: number | null;
  country: string;
  tracking_url: string | null;
  error: string | null;
  preview_url: string | null;
}

const STEPS: { key: OrderStatus; label: string }[] = [
  { key: "paid", label: "Payment confirmed" },
  { key: "submitted", label: "Sent to print partner" },
  { key: "in_production", label: "In production" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
];

const STEP_ORDER: OrderStatus[] = [
  "created",
  "paid",
  "submitting",
  "submitted",
  "in_production",
  "shipped",
  "delivered",
];

function OrderConfirmationInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const cancelled = searchParams.get("checkout") === "cancelled";

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const fulfilledRef = useRef(false);

  useEffect(() => {
    if (fulfilledRef.current) return;

    const checkout = searchParams.get("checkout");
    const sessionId = searchParams.get("session_id");

    if (checkout === "success" && sessionId) {
      fulfilledRef.current = true;
      fetch("/api/stripe/fulfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {
        // Webhook may still fulfil; polling below will pick up status.
      });
      router.replace(`/order/${id}`, { scroll: false });
    }
  }, [searchParams, id, router]);

  useEffect(() => {
    if (!id) return;
    let interval: NodeJS.Timeout;

    async function fetchOrder() {
      try {
        const res = await fetch(`/api/orders/${id}`);
        if (res.ok) {
          const data: OrderData = await res.json();
          setOrder(data);
          // Stop polling at terminal states.
          if (
            data.status === "delivered" ||
            data.status === "failed" ||
            data.status === "cancelled"
          ) {
            clearInterval(interval);
          }
        }
      } catch {
        // keep polling
      } finally {
        setLoading(false);
      }
    }

    fetchOrder();
    interval = setInterval(fetchOrder, 8000);
    return () => clearInterval(interval);
  }, [id]);

  const currentIndex = order ? STEP_ORDER.indexOf(order.status) : -1;
  const isFailed = order?.status === "failed" || order?.status === "cancelled";

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
        <Link
          href="/app/orders"
          className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          All orders
        </Link>

        {cancelled && (
          <Card className="mb-6 border-amber-300 bg-amber-50">
            <CardContent className="py-4 text-sm text-amber-900">
              Checkout was cancelled. Your order has not been placed.
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !order ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                We couldn&apos;t find that order.
              </p>
              <Button className="mt-4" onClick={() => router.push("/app/orders")}>
                View your orders
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-2">
                {isFailed ? (
                  <XCircle className="h-9 w-9 text-destructive" />
                ) : order.status === "delivered" ? (
                  <CheckCircle className="h-9 w-9 text-green-600" />
                ) : order.status === "shipped" ? (
                  <Truck className="h-9 w-9 text-primary" />
                ) : (
                  <Package className="h-9 w-9 text-primary" />
                )}
              </div>
              <CardTitle className="text-2xl">
                {isFailed
                  ? "Order problem"
                  : order.status === "created"
                    ? "Finishing up..."
                    : "Order confirmed"}
              </CardTitle>
              <CardDescription>
                {order.size_label} &middot; Qty {order.quantity}
                {order.amount_total != null &&
                  ` \u00b7 ${order.currency} ${order.amount_total.toFixed(2)}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {order.preview_url && (
                <div className="flex justify-center">
                  <ProtectedImage
                    src={order.preview_url}
                    alt="Your poster"
                    className="max-h-72 w-auto rounded-lg border shadow-sm"
                    containerClassName="max-h-72"
                  />
                </div>
              )}

              {isFailed ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center text-sm">
                  <p className="font-medium text-destructive">
                    {order.status === "cancelled"
                      ? "This order was cancelled."
                      : "We hit a problem fulfilling this order."}
                  </p>
                  {order.error && (
                    <p className="mt-1 text-muted-foreground">{order.error}</p>
                  )}
                </div>
              ) : (
                <ol className="space-y-3">
                  {STEPS.map((step) => {
                    const stepIndex = STEP_ORDER.indexOf(step.key);
                    const reached = currentIndex >= stepIndex;
                    return (
                      <li key={step.key} className="flex items-center gap-3">
                        {reached ? (
                          <CheckCircle className="h-5 w-5 shrink-0 text-green-600" />
                        ) : (
                          <div className="h-5 w-5 shrink-0 rounded-full border-2 border-muted" />
                        )}
                        <span
                          className={`text-sm ${
                            reached ? "font-medium" : "text-muted-foreground"
                          }`}
                        >
                          {step.label}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}

              {order.tracking_url && (
                <Button asChild variant="outline" className="w-full">
                  <a
                    href={order.tracking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Track your shipment
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              )}

              <Button asChild variant="ghost" className="w-full">
                <Link href="/app">Create another poster</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col">
          <Navbar />
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      }
    >
      <OrderConfirmationInner />
    </Suspense>
  );
}
