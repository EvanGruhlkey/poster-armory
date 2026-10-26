# Poster Attribution Placement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep map attribution out of the live artwork preview while retaining linked website credit and a 1-point credit in every exported or printed poster.

**Architecture:** A small shared attribution module owns the exact credit text and print sizing math. The editor renders a linked attribution component outside the poster, while the export compositor draws the same credit inside the printable safe area at a true 1-point size based on output DPI.

**Tech Stack:** Next.js 14, React 18, TypeScript, Canvas 2D, Node test runner

**Spec:** `docs/superpowers/specs/2026-10-26-poster-attribution-placement-design.md`

## Global Constraints

- Remove attribution from the live poster preview.
- Show compact linked attribution outside the artwork in the editor.
- Keep attribution in PNG, PDF, and physical print artwork at 1 point.
- Keep the exported credit inside the printable safe area.
- Do not change poster layout, map framing, pricing, or fulfillment products.

## Review Focus

- Portrait and landscape exports must calculate 1-point text consistently from DPI.
- Invalid or missing DPI must fall back to the existing 300 DPI export convention.
- The website credit must remain outside the poster preview at desktop and mobile widths.
- Both data providers must have working, accessible links.
- The export compositor must restore canvas state after drawing the credit.

---

### Task 1: Shared attribution rules and website credit

**Files:**
- Create: `lib/map-attribution.ts`
- Create: `lib/map-attribution.test.ts`
- Create: `components/map-attribution.tsx`
- Create: `components/map-attribution.test.tsx`
- Modify: `components/live-poster-map.tsx`
- Modify: `app/app/design/[draftId]/page.tsx`

**Interfaces:**
- Produces: `MAP_ATTRIBUTION_TEXT`, `MAP_ATTRIBUTION_FONT_POINTS`, and `pointsToPixels(points: number, dpi?: number): number`.
- Produces: `MapAttribution` React component with linked OpenStreetMap and OpenFreeMap names.

- [ ] **Step 1: Write failing tests for the shared 1-point conversion and linked website credit**

Assert that 1 point equals `300 / 72` pixels at 300 DPI, invalid DPI falls back to 300, both provider links render, and `live-poster-map.tsx` no longer contains embedded attribution copy.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `pnpm exec tsx --test lib/map-attribution.test.ts components/map-attribution.test.tsx`

- [ ] **Step 3: Implement the shared attribution module and website component**

Use the exact visible copy `Map data © OpenStreetMap · OpenFreeMap`; link OpenStreetMap to `https://www.openstreetmap.org/copyright` and OpenFreeMap to `https://openfreemap.org/`.

- [ ] **Step 4: Remove the embedded preview credit and mount `MapAttribution` in the editor stage outside `data-testid="poster-preview"`**

Keep the line compact, muted, and readable without covering the poster or editor controls.

- [ ] **Step 5: Run focused tests and TypeScript**

Run: `pnpm exec tsx --test lib/map-attribution.test.ts components/map-attribution.test.tsx`
Run: `pnpm exec tsc --noEmit`

### Task 2: One-point export and print credit

**Files:**
- Modify: `lib/map-attribution.ts`
- Modify: `lib/map-attribution.test.ts`
- Modify: `lib/live-poster-export.ts`
- Modify: `lib/live-poster-export.test.ts`

**Interfaces:**
- Consumes: `MAP_ATTRIBUTION_TEXT`, `MAP_ATTRIBUTION_FONT_POINTS`, and `pointsToPixels` from Task 1.
- Produces: `getMapAttributionLayout(width: number, height: number, dpi?: number)` with a 1-point font size and safe-area coordinates.

- [ ] **Step 1: Write failing tests for export placement**

Assert the font size is `300 / 72` pixels at 300 DPI, coordinates are inside a 1% safe inset for portrait and landscape outputs, and small valid canvases never produce negative coordinates.

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `pnpm exec tsx --test lib/map-attribution.test.ts lib/live-poster-export.test.ts`

- [ ] **Step 3: Implement `getMapAttributionLayout` and use it in `drawPosterCopy`**

Draw the shared text at 1 point with `ctx.save()` and `ctx.restore()`, left aligned within the printable safe area and with unobtrusive opacity.

- [ ] **Step 4: Run the focused and full test suites**

Run: `pnpm exec tsx --test lib/map-attribution.test.ts lib/live-poster-export.test.ts`
Run: `pnpm exec tsx --test "**/*.test.ts" "**/*.test.tsx"`

- [ ] **Step 5: Run final static checks and inspect the live editor**

Run: `pnpm exec tsc --noEmit`
Verify at `http://localhost:3000/app/design/4628219c-7d77-4df8-875c-b3e81c956a2d?city=El%20Paso&country=United%20States&lat=31.7601&lon=-106.4870` that no credit appears within the poster and the linked credit appears outside it.
