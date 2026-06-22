/**
 * List poster productUids available in your Gelato account.
 *
 * Run with:  pnpm tsx scripts/list-gelato-posters.ts
 *
 * Reads GELATO_API_KEY from .env.local, queries the Gelato product catalog,
 * and prints the productUids grouped by size + orientation so you can paste
 * them into .env.local as GELATO_PRODUCT_UID_<SIZE>_<ORIENTATION>.
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

const API_KEY = process.env.GELATO_API_KEY;
if (!API_KEY) {
  console.error("GELATO_API_KEY is not set in .env.local");
  process.exit(1);
}

interface ProductAttributes {
  [key: string]: string | string[] | undefined;
  Orientation?: string;
  PaperFormat?: string;
  ProductMeasure?: string;
  PaperType?: string;
  CoatingType?: string;
}

interface Product {
  productUid: string;
  attributes: ProductAttributes;
}

async function searchPosters(offset = 0, limit = 100): Promise<Product[]> {
  const res = await fetch(
    "https://product.gelatoapis.com/v3/catalogs/posters/products:search",
    {
      method: "POST",
      headers: {
        "X-API-KEY": API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ limit, offset }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gelato search failed (${res.status}): ${text.slice(0, 400)}`);
  }
  const data = await res.json();
  return data.products ?? [];
}

function describe(p: Product): string {
  const attrs = p.attributes;
  const parts = [
    attrs.PaperFormat,
    attrs.ProductMeasure,
    attrs.PaperType,
    attrs.CoatingType,
    attrs.Orientation === "ver" ? "portrait" : attrs.Orientation === "hor" ? "landscape" : attrs.Orientation,
  ].filter(Boolean);
  return parts.join(" / ");
}

async function main() {
  console.log("Fetching poster products from Gelato...\n");

  const all: Product[] = [];
  let offset = 0;
  // Pull up to 500 products in pages of 100.
  for (let page = 0; page < 5; page++) {
    const batch = await searchPosters(offset, 100);
    all.push(...batch);
    if (batch.length < 100) break;
    offset += 100;
  }

  console.log(`Total posters returned: ${all.length}\n`);

  // Filter to inch-based sizes that match our app's size keys.
  const SIZE_KEYWORDS: Array<{ key: string; needles: string[] }> = [
    { key: "8X10", needles: ["8x10", "8-x-10", "200x250"] },
    { key: "12X16", needles: ["12x16", "12-x-16", "300x400"] },
    { key: "18X24", needles: ["18x24", "18-x-24", "450x600"] },
    { key: "24X36", needles: ["24x36", "24-x-36", "600x900"] },
  ];

  for (const { key, needles } of SIZE_KEYWORDS) {
    const matches = all.filter((p) => {
      const haystack = `${p.productUid} ${JSON.stringify(p.attributes)}`.toLowerCase();
      return needles.some((n) => haystack.includes(n));
    });

    const portrait = matches.filter((p) => p.attributes.Orientation === "ver");
    const landscape = matches.filter((p) => p.attributes.Orientation === "hor");

    console.log(`==== ${key} ====`);
    if (portrait.length === 0 && landscape.length === 0) {
      console.log("  (no matches — this size may not be in your catalog)\n");
      continue;
    }

    if (portrait.length > 0) {
      console.log(`  Portrait options (${portrait.length}):`);
      for (const p of portrait.slice(0, 6)) {
        console.log(`    ${p.productUid}`);
        console.log(`      ${describe(p)}`);
      }
      console.log(
        `  -> GELATO_PRODUCT_UID_${key}_PORTRAIT=${portrait[0].productUid}`
      );
    }
    if (landscape.length > 0) {
      console.log(`  Landscape options (${landscape.length}):`);
      for (const p of landscape.slice(0, 6)) {
        console.log(`    ${p.productUid}`);
      }
      console.log(
        `  -> GELATO_PRODUCT_UID_${key}_LANDSCAPE=${landscape[0].productUid}`
      );
    }
    console.log("");
  }

  console.log(
    "\nPick one productUid per size+orientation, paste into .env.local, then restart `pnpm dev`."
  );
  console.log(
    "Tip: pick the same paper type across sizes (e.g. all 'matt-200-gsm-uncoated')\n" +
      "for consistent look and predictable pricing."
  );
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
