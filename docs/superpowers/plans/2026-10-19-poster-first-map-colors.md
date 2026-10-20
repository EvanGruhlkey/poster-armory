# Poster-first Map and Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the poster the largest editor element and add the reference poster's map and color choices without clutter.

**Architecture:** Keep `PosterConfig` as the saved source of truth. Break the editor controls into a sidebar and make the same style resolver feed the live MapLibre preview and browser export. Extend the existing imported renderer rather than copying a second component tree.

**Tech Stack:** Next.js, React, TypeScript, MapLibre GL, Zod, node:test, Puppeteer.

**Spec:** `docs/superpowers/specs/2026-10-19-poster-first-customization-design.md`

## Global Constraints

- Desktop preview uses a `2fr` column; sidebar uses `1fr` capped at 360px. Mobile shows poster first.
- Sidebar has Map, Text, Colors, Finish tabs; one open at a time; granular controls live under More options.
- Existing saved designs retain their appearance; preview, download and physical print must represent each exposed setting.
- Do not reintroduce the removed map-layer preset strip. Retain the MIT copyright notice on source-derived code.

## Review Focus

- Old saved drafts missing new fields keep their previous look; Task 2 tests this.
- A palette switch preserves title, camera and finish; Task 3 tests this.
- A style with missing terrain data does not display a false enabled state; Task 4 tests this.
- Keyboard and narrow-screen users can reach controls while seeing the poster; Task 1 browser check covers this.
- Digital and physical output use the same selected palette and layers; Task 5 covers this.

---

### Task 1: Poster-first editor shell

**Files:** Modify `app/app/design/[draftId]/page.tsx`; create `components/poster-editor-sidebar.tsx`; test `components/poster-editor-sidebar.test.tsx`.

**Interfaces:** Sidebar consumes `activeTool: "map" | "type" | "style" | "finish"`, `onToolChange: (tool) => void`, and section children; parent owns poster preview and order/download actions.

- [ ] Write a rendering test asserting four tabs, one selected panel, and a More options disclosure.
- [ ] Run `pnpm exec tsx --test components/poster-editor-sidebar.test.tsx`; confirm failure.
- [ ] Extract sidebar and use `lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]` with sidebar `max-w-[360px]`, sticky poster and poster-first mobile order.
- [ ] Rerun the test and run Puppeteer desktop/mobile checks for poster size, tab selection and keyboard reachability.
- [ ] Commit shell and test.

### Task 2: Validated map and palette config

**Files:** Modify `lib/types.ts`, `lib/validations.ts`, `lib/poster-renderer/adapter.ts`; create `lib/poster-customization.ts`, `lib/poster-customization.test.ts`.

**Interfaces:** Export `resolvePosterCustomization(config: PosterConfig): ResolvedPosterCustomization` and `applyPosterPalette(config: PosterConfig, paletteId: string): Partial<PosterConfig>`. Add optional `palette_id`, `custom_colors: Record<string,string>`, `map_layers: Record<string,boolean>`, `road_weight` (0.5–3), `terrain_exaggeration` (0–5), `terrain_light_azimuth` (0–360), `terrain_light_altitude` (0–90), `building_height_scale` (0.5–3), and `building_default_height` (0–30). Keep existing `rotation` and `pitch` fields. Resolve missing values from current presets so old drafts stay identical.

- [ ] Test parsing old configs, rejecting invalid colors/ranges, and retaining old map defaults.
- [ ] Run `pnpm exec tsx --test lib/poster-customization.test.ts`; confirm failure.
- [ ] Add optional typed fields and Zod bounds; implement resolver and palette update.
- [ ] Rerun the test and `pnpm exec tsc --noEmit`.
- [ ] Commit config, adapter and test.

### Task 3: Styles, palettes and custom colors

**Files:** Create `components/poster-color-controls.tsx`, `components/poster-color-controls.test.tsx`; modify `lib/poster-renderer/styles/index.ts`, `lib/poster-renderer/styles/extra-palettes.ts`, `lib/live-poster-style.ts`, `app/app/design/[draftId]/page.tsx`.

**Interfaces:** Color controls consume `PosterConfig` and `onChange(Partial<PosterConfig>)`; style resolver consumes `resolvePosterCustomization`. Port every supplied poster style and palette entry not already present, with preserved license notice.

- [ ] Test preset count/IDs, palette isolation from text and camera, and valid custom hex colors.
- [ ] Run color tests; confirm failure.
- [ ] Add compact swatches up front, individual semantic colors in More options; wire selected colors into road, water, parks, building, text and paper layers.
- [ ] Rerun tests and visually compare three style/palette combinations in editor and exported PNG.
- [ ] Commit styles and colors.

### Task 4: Map details and 3D

**Files:** Create `components/poster-map-controls.tsx`, `components/poster-map-controls.test.tsx`; modify `components/live-poster-map.tsx`, `lib/live-poster-style.ts`, `lib/poster-renderer/styles/layerToggles.ts`, `app/app/design/[draftId]/page.tsx`.

**Interfaces:** Map controls use the Task 2 config fields; MapLibre style generation maps layer flags to imported layer IDs. Terrain controls appear only when preview and output can load elevation data.

- [ ] Test layer toggle mapping, camera presets and terrain availability states.
- [ ] Run map tests; confirm failure.
- [ ] Implement basic visible controls for framing, camera and main layers; More options holds road hierarchy, contours, boundaries, rail, POIs, landcover, line weight, terrain light and building height.
- [ ] Rerun tests and browser check flat/tilted preview at multiple locations.
- [ ] Commit map controls and renderer.

### Task 5: Output parity gate

**Files:** Modify `lib/live-poster-export.ts`, `app/download/[jobId]/page.tsx`, `scripts/worker.ts`, `scripts/render-poster.ts`, `app/internal/render/page.tsx`; test `lib/live-poster-export.test.ts` and `scripts/render-poster.test.ts`.

**Interfaces:** The full selected `PosterConfig` reaches digital and physical renderers unchanged. Settings unsupported by the physical renderer must be implemented there before being shown to print buyers.

- [ ] Add tests asserting new color, layer, camera and terrain values survive save, checkout and render setup.
- [ ] Run targeted tests; confirm failure.
- [ ] Wire output paths to the same resolved customization, including terrain tiles and palette values.
- [ ] Rerun targeted tests, full tests, TypeScript check and representative PNG/print preview comparisons.
- [ ] Commit output parity changes.
