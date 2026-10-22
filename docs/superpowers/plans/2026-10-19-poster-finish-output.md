# Poster Finish and Output Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give customers clear size, border, mask and texture choices with faithful output.

**Architecture:** Save finish selections as optional config fields. Resolve dimensions and frame geometry once, then apply the geometry in both the live preview and browser/print export. Keep supported purchasable sizes distinct from digital-only aspect ratios.

**Tech Stack:** Next.js, React, TypeScript, Canvas 2D, Zod, node:test, Puppeteer.

**Spec:** `docs/superpowers/specs/2026-10-19-poster-first-customization-design.md`

## Global Constraints

- Depends on the sidebar from `2026-10-19-poster-first-map-colors.md`.
- Finish tab shows size and a few visual choices; fine controls live in More options.
- The selected finish must appear in preview, digital download and physical print.
- Only supported print sizes enter checkout. Existing saved designs retain their prior finish.

## Review Focus

- Landscape and square outputs preserve the selected crop; Task 1 tests this.
- A circular mask clips map and overlays consistently; Task 2 tests this.
- Texture strength zero produces no visible texture; Task 3 tests this.
- Old drafts with no finish fields keep their old frame; Task 1 tests this.
- Unsupported digital aspect ratios cannot enter physical checkout; Task 4 tests this.

---

### Task 1: Finish config and poster geometry

**Files:** Modify `lib/types.ts`, `lib/validations.ts`, `lib/poster-text-layout.ts`, `lib/poster-frame.ts`; create `lib/poster-finish.ts`, `lib/poster-finish.test.ts`.

**Interfaces:** Export `resolvePosterFinish(config: PosterConfig): ResolvedPosterFinish` and `getPosterFinishGeometry(config: PosterConfig, width: number, height: number): PosterFinishGeometry`. Add optional `poster_margin` (0–20%), `border_style` (none/thin/thick/double/inset), `mask_shape` (rectangular/circular), `compass_rose`, and `aspect_ratio` (2:3/3:4/4:5/1:1/ISO/16:9/16:10/9:16/9:19.5). Preserve current defaults for missing fields.

- [ ] Test old defaults and square/landscape geometry, range validation and aspect changes.
- [ ] Run finish tests; confirm failure.
- [ ] Implement optional fields, resolver and shared geometry.
- [ ] Rerun tests and TypeScript check.
- [ ] Commit finish model.

### Task 2: Border, mask and compass

**Files:** Create `components/poster-finish-controls.tsx`, `components/poster-finish-controls.test.tsx`; modify `components/live-poster-map.tsx`, `lib/live-poster-export.ts`, `lib/poster-renderer/export.ts`.

**Interfaces:** Finish controls consume config and `onChange(Partial<PosterConfig>)`; use Task 1 geometry for rectangular/circular masks, border variants and compass placement.

- [ ] Test option selection, mask clipping and compass visibility.
- [ ] Run targeted tests; confirm failure.
- [ ] Add compact frame choices and More options; draw the same border/mask/compass in preview and export.
- [ ] Rerun tests and compare representative portrait/square/landscape PNGs.
- [ ] Commit frame feature.

### Task 3: Texture

**Files:** Create `lib/poster-texture.ts`, `lib/poster-texture.test.ts`; modify `components/live-poster-map.tsx`, `lib/live-poster-export.ts`, `components/poster-finish-controls.tsx`.

**Interfaces:** Export `resolvePosterTexture(config: PosterConfig): { type: "none" | "paper" | "canvas" | "grain"; intensity: number }`; add optional `texture` and `texture_intensity` (0–100) config fields. Use deterministic pattern/seed shared by preview and export.

- [ ] Test none/zero strength and deterministic pattern parameters.
- [ ] Run texture tests; confirm failure.
- [ ] Add texture swatches and strength slider under More options; draw equivalent overlays in preview and export.
- [ ] Rerun tests and compare PNG crops at two strengths.
- [ ] Commit texture feature.

### Task 4: Size, save and checkout parity

**Files:** Modify `app/app/design/[draftId]/page.tsx`, `lib/poster-products.ts`, `app/api/stripe/checkout/route.ts`, `scripts/worker.ts`, `scripts/render-poster.ts`, `app/internal/render/page.tsx`; test `lib/live-poster-export.test.ts` and `scripts/render-poster.test.ts`.

**Interfaces:** Digital aspect choices map to output pixel dimensions; physical sizes map only to products in `lib/poster-products.ts`. Preserve selected `PosterConfig` finish fields through save, checkout and print.

- [ ] Test supported product mapping, digital-only ratio rejection in checkout, and finish round-trip.
- [ ] Run targeted tests; confirm failure.
- [ ] Add Finish tab size/orientation choices and update export/print paths.
- [ ] Rerun full tests, TypeScript, desktop/mobile browser and representative physical print checks.
- [ ] Commit output parity and final verification.
