import { createHash } from "crypto";
import type { PosterConfig } from "./types";

/**
 * Deterministically serialize a value with keys sorted at every level.
 *
 * The previous implementation used `JSON.stringify(config, sortedKeys)`, whose
 * array replacer is applied recursively and therefore drops any nested object
 * keys not present in the top-level key list (e.g. a marker's `label`). For
 * flat configs this produces output identical to the old approach, so existing
 * hashes stay stable, while nested structures (markers) now hash correctly.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

export function computeConfigHash(config: PosterConfig): string {
  const normalized = stableStringify(config);
  return createHash("sha256").update(normalized).digest("hex");
}
