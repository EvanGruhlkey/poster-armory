"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Package, ArrowLeft, ExternalLink } from "lucide-react";
import type { OrderStatus } from "@/lib/types";

interface OrderRow {
  id: string;
  status: OrderStatus;
  size_key: string;
  quantity: number;
  currency: string;
  amount_total: number | null;
  country: string;
  tracking_url: string | null;
  created_at: string;
  config: { title?: string; city?: string } | null;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  created: "Awaiting payment",
  paid: "Paid",
  submitting: "Processing",
  submitted: "Sent to print",
  in_production: "In production",
  shipped: "Shipped",
  delivered: "Delivered",
  failed: "Failed",
  cancelled: "Cancelled",
};

function statusVariant(
  status: OrderStatus
): "default" | "secondary" | "destructive" {
  if (status === "delivered" || status === "shipped") return "default";
  if (status === "failed" || status === "cancelled") return "destructive";
  return "secondary";
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRow[] | null>(null);

  useEffect(() => {
    fetch("/api/orders")
      .then((r) => r.json())
      .then((d) => setOrders(d.orders ?? []))
      .catch(() => setOrders([]));
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/app"
        className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to App
      </Link>

      <div className="mb-6 flex items-center gap-2">
        <Package className="h-6 w-6" />
        <h1 className="text-2xl font-bold sm:text-3xl">Your orders</h1>
      </div>

      {orders === null ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Package className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              You haven&apos;t ordered any physical posters yet.
            </p>
            <Button asChild>
              <Link href="/app">Create a poster</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Card key={o.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {o.config?.title || o.config?.city || "Custom poster"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {o.size_key} &middot; Qty {o.quantity} &middot;{" "}
                    {new Date(o.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={statusVariant(o.status)}>
                    {STATUS_LABELS[o.status]}
                  </Badge>
                  {o.tracking_url && (
                    <a
                      href={o.tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs font-medium text-primary hover:underline"
                    >
                      Track <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  )}
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/order/${o.id}`}>View</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
