/**
 * Minimal Gelato v4 client. Auth is via the X-API-KEY header.
 * Docs: https://dashboard.gelato.com/docs/
 */

const GELATO_API_KEY = process.env.GELATO_API_KEY;
const ORDER_BASE = "https://order.gelatoapis.com/v4";

export function gelatoConfigured(): boolean {
  return !!(GELATO_API_KEY && GELATO_API_KEY.trim());
}

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-API-KEY": GELATO_API_KEY || "",
  };
}

export interface GelatoAddress {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state?: string | null;
  postCode: string;
  country: string; // ISO 3166-1 alpha-2
  email?: string | null;
  phone?: string | null;
}

export interface GelatoQuote {
  /** Base product price for the requested quantity, before markup. */
  productPrice: number;
  /** Cheapest available shipping price. */
  shippingPrice: number;
  currency: string;
  shipmentMethodUid: string | null;
  minDeliveryDays?: number;
  maxDeliveryDays?: number;
}

interface QuoteParams {
  productUid: string;
  quantity: number;
  currency: string;
  customerReferenceId?: string;
  /**
   * Partial shipping recipient. `country` is the only one that strongly affects
   * pricing; we fill safe placeholders for any other "required" v4 fields the
   * caller hasn't collected yet so users see a live quote before completing the
   * full address form.
   */
  recipient: Partial<GelatoAddress> & { country: string };
}

/** Default that meets Gelato's v4 validation when callers haven't supplied a value yet. */
function recipientWithDefaults(
  partial: Partial<GelatoAddress> & { country: string }
): Record<string, unknown> {
  const r: Record<string, unknown> = {
    country: partial.country,
    firstName: partial.firstName?.trim() || "Quote",
    lastName: partial.lastName?.trim() || "Customer",
    addressLine1: partial.addressLine1?.trim() || "1 Example Street",
    city: partial.city?.trim() || "Quote City",
    postCode: partial.postCode?.trim() || defaultPostCodeFor(partial.country),
    email: partial.email?.trim() || "quote@example.com",
  };
  if (partial.addressLine2?.trim()) r.addressLine2 = partial.addressLine2.trim();
  if (partial.state?.trim()) r.state = partial.state.trim();
  else if (requiresState(partial.country)) r.state = defaultStateFor(partial.country);
  if (partial.phone?.trim()) r.phone = partial.phone.trim();
  return r;
}

/** v4 requires `state` for US, CA, AU. */
function requiresState(country: string): boolean {
  return ["US", "CA", "AU"].includes(country.toUpperCase());
}

function defaultStateFor(country: string): string {
  switch (country.toUpperCase()) {
    case "US":
      return "NY";
    case "CA":
      return "ON";
    case "AU":
      return "NSW";
    default:
      return "";
  }
}

function defaultPostCodeFor(country: string): string {
  switch (country.toUpperCase()) {
    case "US":
      return "10001";
    case "CA":
      return "M5V 2T6";
    case "GB":
      return "SW1A 1AA";
    case "AU":
      return "2000";
    case "DE":
      return "10115";
    case "FR":
      return "75001";
    default:
      return "00000";
  }
}

/**
 * POST /v4/orders:quote — returns product price + available shipment methods
 * (with prices and delivery estimates) for a destination.
 */
export async function getQuote(params: QuoteParams): Promise<GelatoQuote> {
  if (!gelatoConfigured()) {
    throw new Error("Gelato is not configured (missing GELATO_API_KEY).");
  }

  const body = {
    orderReferenceId: `quote-${Date.now()}`,
    customerReferenceId: params.customerReferenceId || "quote-customer",
    currency: params.currency,
    recipient: recipientWithDefaults(params.recipient),
    products: [
      {
        itemReferenceId: "1",
        productUid: params.productUid,
        quantity: params.quantity,
      },
    ],
  };

  console.log(
    `[gelato.getQuote] productUid=${params.productUid} country=${params.recipient.country} qty=${params.quantity} currency=${params.currency}`
  );

  const res = await fetch(`${ORDER_BASE}/orders:quote`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Gelato quote failed (${res.status}): ${text.slice(0, 300)}`
    );
  }

  const data = await res.json();
  // v4 wraps quotes in `quotes[]` per the docs example.
  const quote = Array.isArray(data?.quotes) ? data.quotes[0] : data;

  const products: Array<{ price?: number; currency?: string }> =
    quote?.products ?? [];
  const shipmentMethods: Array<{
    shipmentMethodUid?: string;
    price?: number;
    currency?: string;
    minDeliveryDays?: number;
    maxDeliveryDays?: number;
  }> = quote?.shipmentMethods ?? [];

  if (products.length === 0) {
    throw new Error("Gelato quote returned no product pricing.");
  }
  if (shipmentMethods.length === 0) {
    throw new Error("Gelato quote returned no shipping options for this destination.");
  }

  const productPrice = products.reduce((sum, p) => sum + (p.price || 0), 0);
  const cheapest = shipmentMethods.reduce((min, m) =>
    (m.price ?? Infinity) < (min.price ?? Infinity) ? m : min
  );

  return {
    productPrice,
    shippingPrice: cheapest.price ?? 0,
    currency: products[0]?.currency || params.currency,
    shipmentMethodUid: cheapest.shipmentMethodUid ?? null,
    minDeliveryDays: cheapest.minDeliveryDays,
    maxDeliveryDays: cheapest.maxDeliveryDays,
  };
}

export interface CreateOrderParams {
  orderReferenceId: string;
  customerReferenceId: string;
  currency: string;
  productUid: string;
  fileUrl: string;
  quantity: number;
  shippingAddress: GelatoAddress;
  shipmentMethodUid?: string | null;
}

export interface GelatoOrderResult {
  id: string;
  fulfillmentStatus?: string;
  [key: string]: unknown;
}

/** POST /v4/orders — places a real production order for a single poster item. */
export async function createOrder(
  params: CreateOrderParams
): Promise<GelatoOrderResult> {
  if (!gelatoConfigured()) {
    throw new Error("Gelato is not configured (missing GELATO_API_KEY).");
  }

  // Set GELATO_ORDER_TYPE=draft during testing so orders stay in the Gelato
  // dashboard and never go to production. Default "order" goes straight to
  // fulfillment.
  const orderType =
    (process.env.GELATO_ORDER_TYPE || "order").toLowerCase() === "draft"
      ? "draft"
      : "order";

  const body: Record<string, unknown> = {
    orderType,
    orderReferenceId: params.orderReferenceId,
    customerReferenceId: params.customerReferenceId,
    currency: params.currency,
    // Create-order uses `items` + `shippingAddress` (quote uses `products` + `recipient`).
    items: [
      {
        itemReferenceId: params.orderReferenceId,
        productUid: params.productUid,
        files: [{ type: "default", url: params.fileUrl }],
        quantity: params.quantity,
      },
    ],
    shippingAddress: params.shippingAddress,
  };

  if (params.shipmentMethodUid) {
    body.shipmentMethodUid = params.shipmentMethodUid;
  }

  const res = await fetch(`${ORDER_BASE}/orders`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Gelato create order failed (${res.status}): ${text.slice(0, 300)}`
    );
  }

  return (await res.json()) as GelatoOrderResult;
}
