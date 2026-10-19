# Poster Renderer Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render Poster Armory preview, downloads, and physical prints with the user-provided poster renderer.

**Architecture:** Import the necessary style and export modules into an isolated renderer directory. Adapt saved `PosterConfig` to that renderer once, then use the adapter in the editor, download page, and a browser-based worker render. Existing checkout, jobs, and storage remain intact.

**Tech Stack:** Next.js 14, React 18, TypeScript, MapLibre GL JS 6, Supabase, Chromium in the worker.

**Spec:** `docs/superpowers/specs/2026-10-19-cartoart-renderer-design.md`

## Global Constraints

- Keep the editor compact; default rotation and pitch to 0 degrees.
- No external poster rendering API or storefront import.
- Retain `Copyright (c) 2026 Kyle Kingsberry` and the full user-supplied MIT permission notice for copied code.
- Record source version `326de71b5b956877781d72f8baa63effdd36a08d`; preserve separate third-party notices.
- Do not change checkout, memberships, job schema, or order fulfillment interfaces.

## Review Focus

- Old saved style IDs map to a valid new style without losing title, location, or camera framing; Task 1 test.
- Missing optional pitch or rotation starts at 0 degrees; Task 1 test.
- Map tile or terrain failure reports an export error rather than silently delivering a partial poster; Task 3 test.
- Largest physical print is rendered at its requested dimensions without a stretched preview; Task 4 test.
- Preview and exported files use the same style, title placement, and attribution; Task 3 visual comparison.

---

### Task 1: Import and adapt styles

**Files:** Create `lib/poster-renderer/` for selected upstream `styles/`, `types/`, and licensing files; create `lib/poster-renderer/adapter.ts`; modify `lib/live-poster-style.ts`; test `lib/poster-renderer/adapter.test.ts`.

**Interfaces:** `toRendererConfig(config: PosterConfig): RendererConfig`; `getPosterMapStyle(config: PosterConfig): StyleSpecification`; `getPosterPalette(config: PosterConfig): RendererPalette`.

- [ ] Write adapter tests for an old saved style, an unknown style, missing pitch/rotation, title, location, and layer visibility.
- [ ] Run `pnpm exec tsx --test lib/poster-renderer/adapter.test.ts` and confirm it fails for missing exports.
- [ ] Copy only the style, palette, layer, type, and licensing modules reachable from selected style constructors; adapt import paths and MapLibre 6 differences. Avoid copying unrelated app and server modules.
- [ ] Implement adapter mapping and point `lib/live-poster-style.ts` at imported styles.
- [ ] Run `pnpm exec tsx --test lib/poster-renderer/adapter.test.ts` and `pnpm exec tsc --noEmit`; commit this task.

### Task 2: Wire the live editor

**Files:** Modify `components/live-poster-map.tsx` and `app/app/design/[draftId]/page.tsx`; test adapter and editor behavior with a representative saved config.

**Interfaces:** Consumes `getPosterMapStyle` and `getPosterPalette` from Task 1; `LivePosterMapHandle` remains available to the download page.

- [ ] Add a failing adapter-level test that a saved config opens with the imported style and bearing/pitch 0 when unset.
- [ ] Replace the existing flat recoloring with the imported layered MapLibre style. Keep current control layout, existing camera updates, and error display.
- [ ] Check Chicago, El Paso, and a coastal city locally at 0 and 45 degrees; run `pnpm exec tsc --noEmit`; commit this task.

### Task 3: Replace download export

**Files:** Create `lib/poster-renderer/export.ts` from the necessary upstream export and text modules; modify `lib/live-poster-export.ts` and `app/download/[jobId]/page.tsx`; test export dimensions, error path, typography, and PDF wrapping.

**Interfaces:** `renderPosterPNG(config: PosterConfig, width: number, height: number): Promise<Blob>`; `composeLivePosterFiles` calls it, retaining its existing return shape.

- [ ] Add failing checks for exact PNG dimensions, saved title/subtitle, 0-degree camera, and incomplete tile/terrain rendering.
- [ ] Import the upstream hidden-map, high-resolution export and typography code; adapt it to Task 1's config and style, without importing unrelated UI or server helpers.
- [ ] Replace live-canvas enlargement with `renderPosterPNG`; keep PDF generation from the rendered PNG and existing download authorization.
- [ ] Run the new tests with `pnpm exec tsx --test`, run `pnpm exec tsc --noEmit`, and compare preview/PNG/PDF artwork at two cities and two sizes; commit this task.

### Task 4: Replace physical print renderer

**Files:** Create `app/api/internal/render-poster/route.ts` or an equivalent isolated browser entry, create `scripts/render-poster.ts`; modify `scripts/worker.ts`, `Dockerfile.worker`, and worker dependencies; test worker output dimensions and failure handling.

**Interfaces:** `renderPrintPoster(config: PosterConfig, outputFile: string, widthPx: number, heightPx: number): Promise<void>`; existing job output keys, Supabase uploads, and print order handoff remain unchanged.

- [ ] Add failing tests or a controlled worker fixture for largest size, tile failure, and retry behavior.
- [ ] Add Chromium to worker image and a protected render entry that calls Task 3's renderer at requested print dimensions; support tiled export when GPU size limits require it.
- [ ] Replace `runPythonCli` calls for physical poster outputs with `renderPrintPoster`, preserving current formats and job accounting.
- [ ] Render a local physical-order fixture; verify dimensions, artwork parity, output upload path, `pnpm exec tsc --noEmit`, and `pnpm build`; commit this task.

### Task 5: Final visual and license review

**Files:** Modify only defects found in the previous tasks; update README or existing attribution page with required notices if needed.

- [ ] Verify imported files are covered by the supplied MIT grant; list any third-party license notices separately.
- [ ] Compare editor preview, downloaded PNG/PDF, and worker PNG for the same saved design; check type placement, framing, attribution, and print resolution.
- [ ] Confirm old designs and checkout still work; run the required project checks and review the final diff.
- [ ] Commit any fixes and make the new renderer the default only after the parity checks pass.
