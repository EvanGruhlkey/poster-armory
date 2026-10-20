# Poster Labels and Markers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the reference poster's label, marker and route controls within the compact sidebar.

**Architecture:** Extend optional saved config fields. Draw labels and markers from one resolved geometry model in preview and output. Keep common switches visible, and put style and size controls behind More options.

**Tech Stack:** Next.js, React, TypeScript, MapLibre GL, Canvas 2D, Zod, node:test, Puppeteer.

**Spec:** `docs/superpowers/specs/2026-10-19-poster-first-customization-design.md`

## Global Constraints

- Depends on the sidebar and config resolver from `2026-10-19-poster-first-map-colors.md`.
- Poster stays dominant; controls live in the Map and Text tabs.
- Preview, digital and physical outputs show the same labels, markers and routes.
- Existing saved drafts and the current typography presets keep their appearance.

## Review Focus

- A marker near the map edge remains inside the print-safe area; Task 2 tests this.
- A route crossing the antimeridian does not draw across the whole poster; Task 2 tests this.
- Turning off a label group affects preview and export; Task 1 tests this.
- Empty marker labels do not create blank badges; Task 2 tests this.
- Existing text placement and font settings survive marker changes; Task 3 tests this.

---

### Task 1: Map label groups and scale/grid

**Files:** Modify `lib/types.ts`, `lib/validations.ts`, `lib/live-poster-style.ts`, `components/poster-map-controls.tsx`; create `lib/poster-labels.ts`, `lib/poster-labels.test.ts`.

**Interfaces:** Export `resolvePosterLabels(config: PosterConfig): ResolvedPosterLabels`; add optional `label_admin`, `label_cities`, `label_streets`, `label_size` (8–32), `label_style` (standard/elevated/glass/vintage), `show_scale`, `show_grid`, `grid_density` (1/2/5/10/15/20/30), and `grid_weight` (0.1–3). Preserve `show_labels` as master switch.

- [ ] Test independent label groups, old defaults, scale/grid bounds and export style IDs.
- [ ] Run `pnpm exec tsx --test lib/poster-labels.test.ts`; confirm failure.
- [ ] Add validated fields, Map controls and shared label style resolution.
- [ ] Rerun test and compare a label-heavy city in preview and PNG.
- [ ] Commit labels and overlays.

### Task 2: Custom markers and connected route

**Files:** Modify `lib/types.ts`, `lib/validations.ts`, `components/live-poster-map.tsx`, `lib/live-poster-export.ts`; create `lib/poster-markers.ts`, `lib/poster-markers.test.ts`, `components/poster-marker-controls.tsx`.

**Interfaces:** Export `resolvePosterMarkers(config: PosterConfig): ResolvedPosterMarkers`. Extend `PosterMarker` with optional `id`, `type` (pin/crosshair/dot/ring/heart/home), `color`, `size`, `label_style`, `label_color`, and `label_size`; add optional `center_marker`, `connect_markers`, `marker_path_color`, `marker_path_width`, `marker_path_style`, `show_segment_lengths`, and `marker_fill_color`. Use map projection for placement, not poster percentage guesses.

- [ ] Test marker validation, empty labels, map-edge clipping and antimeridian route segmentation.
- [ ] Run marker tests; confirm failure.
- [ ] Add center marker and add/remove custom marker UI, then draw matching markers/routes in preview and Canvas export.
- [ ] Rerun tests and compare an example with three markers in preview/PNG.
- [ ] Commit marker feature.

### Task 3: Text display and backing detail

**Files:** Modify `lib/types.ts`, `lib/validations.ts`, `lib/poster-typography.ts`, `lib/poster-text-layout.ts`, `components/live-poster-map.tsx`, `lib/live-poster-export.ts`, `app/app/design/[draftId]/page.tsx`; test `lib/poster-typography.test.ts` and `lib/poster-text-layout.test.ts`.

**Interfaces:** Extend `ResolvedPosterTypography` with optional config fields `show_title`, `show_subtitle`, `backdrop_height` (0–100), `backdrop_alpha` (0–1), `backdrop_width` (0–100), `backdrop_sharpness` (0–100), and `text_offset_y` (-50–50). Preserve preset defaults.

- [ ] Test old presets, independent visibility, backdrop bounds and text geometry.
- [ ] Run typography/layout tests; confirm failure.
- [ ] Put new detail controls in Text More options; use shared layout/backdrop values in preview and export.
- [ ] Rerun tests and visually compare top, center, bottom and below placements with long titles.
- [ ] Commit typography detail and output parity.

### Task 4: Saved draft and print parity

**Files:** Modify `app/api/jobs/route.ts`, `app/api/stripe/checkout/route.ts`, `scripts/worker.ts`, `scripts/render-poster.ts`, `app/internal/render/page.tsx`; test `scripts/render-poster.test.ts` and `lib/live-poster-export.test.ts`.

**Interfaces:** Every new label, marker, route and text field remains in `PosterConfig` from editor save to final print.

- [ ] Test round-trip persistence and worker input for all new fields.
- [ ] Run targeted tests; confirm failure.
- [ ] Update digital/physical rendering and saved draft paths.
- [ ] Rerun full tests, TypeScript, browser and representative print checks.
- [ ] Commit parity changes.
