import type { GelatoQuote } from "@/lib/gelato";

export interface OrderAmounts {
  currency: string;
  amount_product: number;
  amount_shipping: number;
  amount_total: number;
  markup: number;
  shipmentMethodUid: string | null;
  minDeliveryDays?: number;
  maxDeliveryDays?: number;
}

/** Configurable retail markup applied to the Gelato base product price. */
export function getMarkup(): number {
  const raw = parseFloat(process.env.GELATO_ORDER_MARKUP || "");
  if (Number.isFinite(raw) && raw >= 1) return raw;
  return 1.5;
}

export function getCurrency(): string {
  return (process.env.GELATO_CURRENCY || "USD").toUpperCase();
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Turn a raw Gelato quote into customer-facing amounts. Markup is applied to
 * the product price only; shipping is passed through at cost.
 */
export function computeAmounts(quote: GelatoQuote): OrderAmounts {
  const markup = getMarkup();
  const amount_product = round2(quote.productPrice * markup);
  const amount_shipping = round2(quote.shippingPrice);
  return {
    currency: quote.currency,
    amount_product,
    amount_shipping,
    amount_total: round2(amount_product + amount_shipping),
    markup,
    shipmentMethodUid: quote.shipmentMethodUid,
    minDeliveryDays: quote.minDeliveryDays,
    maxDeliveryDays: quote.maxDeliveryDays,
  };
}
