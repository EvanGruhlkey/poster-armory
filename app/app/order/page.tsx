"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Package, Truck } from "lucide-react";
import { toast } from "sonner";
import { PosterWallMockup } from "@/components/poster-wall-mockup";
import { PHYSICAL_SIZES } from "@/lib/poster-products";

const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "IE", name: "Ireland" },
  { code: "NZ", name: "New Zealand" },
  { code: "JP", name: "Japan" },
];

interface OrderDraft {
  config: Record<string, unknown> & {
    orientation?: string;
    city?: string;
    country?: string;
    title?: string;
  };
  previewUrl?: string | null;
  style?: { bgColor: string; textColor: string };
  city?: string;
  country?: string;
}

interface Quote {
  currency: string;
  amount_product: number;
  amount_shipping: number;
  amount_total: number;
  min_delivery_days: number | null;
  max_delivery_days: number | null;
}

const emptyShipping = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  post_code: "",
};

export default function OrderPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<OrderDraft | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);

  const [sizeKey, setSizeKey] = useState("18x24");
  const [quantity, setQuantity] = useState(1);
  const [country, setCountry] = useState("US");
  const [shipping, setShipping] = useState(emptyShipping);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const quoteSeq = useRef(0);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("poster-order-draft");
      if (raw) setDraft(JSON.parse(raw));
    } catch {
      // ignore parse errors
    }
    setDraftLoaded(true);
  }, []);

  const orientation = useMemo(() => {
    const o = draft?.config?.orientation;
    return o === "landscape" ? "landscape" : o === "square" ? "square" : "portrait";
  }, [draft]);

  // Live quote, debounced, whenever size / quantity / destination change.
  // We pass any address fields the user has already filled in so Gelato can
  // refine taxes & shipping; missing fields are padded server-side.
  useEffect(() => {
    if (!draft) return;
    const seq = ++quoteSeq.current;
    setQuoteLoading(true);
    setQuoteError(null);

    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/orders/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            size_key: sizeKey,
            orientation,
            quantity,
            country,
            state: shipping.state || undefined,
            post_code: shipping.post_code || undefined,
            city: shipping.city || undefined,
          }),
        });
        const data = await res.json();
        if (seq !== quoteSeq.current) return; // stale
        if (!res.ok) {
          setQuote(null);
          setQuoteError(data.error || "Couldn't get a price for this option.");
        } else {
          setQuote(data);
        }
      } catch {
        if (seq !== quoteSeq.current) return;
        setQuote(null);
        setQuoteError("Couldn't reach the pricing service. Please try again.");
      } finally {
        if (seq === quoteSeq.current) setQuoteLoading(false);
      }
    }, 400);

    return () => clearTimeout(t);
  }, [
    draft,
    sizeKey,
    orientation,
    quantity,
    country,
    shipping.state,
    shipping.post_code,
    shipping.city,
  ]);

  function updateShipping(field: keyof typeof emptyShipping, value: string) {
    setShipping((prev) => ({ ...prev, [field]: value }));
  }

  function validate(): string | null {
    if (!shipping.first_name.trim()) return "First name is required.";
    if (!shipping.last_name.trim()) return "Last name is required.";
    if (!shipping.address_line1.trim()) return "Address is required.";
    if (!shipping.city.trim()) return "City is required.";
    if (!shipping.post_code.trim()) return "Postal code is required.";
    if (shipping.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(shipping.email))
      return "Please enter a valid email.";
    return null;
  }

  async function handleSubmit() {
    if (!draft) return;
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    if (!quote) {
      toast.error("Waiting for a price quote. Please try again in a moment.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: draft.config,
          size_key: sizeKey,
          orientation,
          quantity,
          shipping: { ...shipping, country },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start checkout.");
      }
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  if (!draftLoaded) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <Package className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-bold">No poster to order</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Start by customizing a poster, then choose &ldquo;Order Physical
          Poster.&rdquo;
        </p>
        <Button className="mt-6" onClick={() => router.push("/app")}>
          Create a poster
        </Button>
      </div>
    );
  }

  const style = draft.style;
  const fmt = (n: number) =>
    `${quote?.currency || "USD"} ${n.toFixed(2)}`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <button
        onClick={() => router.back()}
        className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to editor
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold sm:text-3xl">Order your poster</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Printed and shipped to your door.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Size & quantity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Size &amp; quantity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {PHYSICAL_SIZES.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setSizeKey(s.key)}
                    className={`rounded-md border-2 px-2 py-3 text-center text-sm transition-all ${
                      sizeKey === s.key
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-transparent bg-muted/40 hover:border-muted-foreground/20"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="qty" className="text-sm">
                  Quantity
                </Label>
                <Input
                  id="qty"
                  type="number"
                  min={1}
                  max={50}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(
                      Math.max(1, Math.min(50, parseInt(e.target.value) || 1))
                    )
                  }
                  className="w-24"
                />
                <span className="text-xs text-muted-foreground capitalize">
                  {orientation} orientation
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Shipping address */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Shipping address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="first_name">First name</Label>
                  <Input
                    id="first_name"
                    value={shipping.first_name}
                    onChange={(e) => updateShipping("first_name", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last_name">Last name</Label>
                  <Input
                    id="last_name"
                    value={shipping.last_name}
                    onChange={(e) => updateShipping("last_name", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address_line1">Address</Label>
                <Input
                  id="address_line1"
                  value={shipping.address_line1}
                  onChange={(e) => updateShipping("address_line1", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address_line2">
                  Apartment, suite, etc. (optional)
                </Label>
                <Input
                  id="address_line2"
                  value={shipping.address_line2}
                  onChange={(e) => updateShipping("address_line2", e.target.value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={shipping.city}
                    onChange={(e) => updateShipping("city", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="state">State / Province</Label>
                  <Input
                    id="state"
                    value={shipping.state}
                    onChange={(e) => updateShipping("state", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="post_code">Postal code</Label>
                  <Input
                    id="post_code"
                    value={shipping.post_code}
                    onChange={(e) => updateShipping("post_code", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Country</Label>
                  <Select value={country} onValueChange={setCountry}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email (optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={shipping.email}
                    onChange={(e) => updateShipping("email", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Order summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PosterWallMockup
                src={draft.previewUrl}
                alt="Poster preview"
                bgColor={style?.bgColor}
                textColor={style?.textColor}
                orientation={orientation}
              />

              <div className="text-sm">
                <p className="font-medium">
                  {draft.config.title || draft.city || "Custom poster"}
                </p>
                <p className="text-muted-foreground">
                  {PHYSICAL_SIZES.find((s) => s.key === sizeKey)?.label} &middot;{" "}
                  Qty {quantity}
                </p>
              </div>

              <Separator />

              {quoteLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Getting price...
                </div>
              ) : quoteError ? (
                <p className="text-sm text-destructive">{quoteError}</p>
              ) : quote ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Poster</span>
                    <span>{fmt(quote.amount_product)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping</span>
                    <span>{fmt(quote.amount_shipping)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span>{fmt(quote.amount_total)}</span>
                  </div>
                  {quote.max_delivery_days != null && (
                    <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                      <Truck className="h-3.5 w-3.5" />
                      Est. delivery {quote.min_delivery_days ?? "?"}–
                      {quote.max_delivery_days} days
                    </p>
                  )}
                </div>
              ) : null}

              <Button
                className="w-full"
                size="lg"
                disabled={submitting || quoteLoading || !quote}
                onClick={handleSubmit}
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Package className="mr-2 h-5 w-5" />
                )}
                {quote ? `Pay & Order ${fmt(quote.amount_total)}` : "Pay & Order"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Secure checkout via Stripe.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
