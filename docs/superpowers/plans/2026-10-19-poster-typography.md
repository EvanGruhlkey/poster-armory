# Poster Typography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three polished poster text presets and compact font, size, spacing, and frame controls with matching preview and exports.

**Architecture:** A pure resolver owns preset values and geometry. The editor controls, CSS preview, and canvas compositor consume its result. Optional config fields preserve old saved posters.

**Tech Stack:** Next.js 14, React, TypeScript, Zod, MapLibre, browser Canvas, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-19-poster-typography-design.md`

## Global Constraints

- Default poster appearance stays close to current Gallery output.
- All fonts must be locally available to the browser and worker Chromium; use @fontsource Inter, Playfair Display, and Oswald.
- No arbitrary font names, textures, backdrops, or text over the map.
- Preserve map crop and selected physical PDF dimensions.

## Review Focus

- Old configs without typography fields resolve to Gallery; Task 1 test.
- Customizing after a preset sets Custom without changing title content; Task 1 test.
- Long city names stay within the title width in preview and canvas; Task 2 test and visual sample.
- A selected font loads in worker Chromium before canvas export; Task 2 integration check.
- Frame styles decorate the existing map edge without shifting it; Task 2 geometry test.

---

### Task 1: Shared typography model

**Files:** Create `lib/poster-typography.ts`, `lib/poster-typography.test.ts`; modify `lib/types.ts`, `lib/validations.ts`.

**Interfaces:** Produce `resolvePosterTypography(config: PosterConfig): ResolvedPosterTypography`, `applyTypographyPreset(config, preset): Partial<PosterConfig>`, `applyTypographyCustomization(config, changes): Partial<PosterConfig>`, and `POSTER_TYPOGRAPHY_PRESETS`. Optional config keys: `typography_preset`, `title_font`, `title_size`, `title_tracking`, `frame_style`.

- [ ] **Step 1: Write failing tests** for old-config Gallery defaults, each preset's exact font/size/tracking/frame values, customization switching to Custom while preserving title, and Zod rejecting unknown fonts and out-of-range size/tracking.
- [ ] **Step 2: Run** `pnpm exec tsx --test lib/poster-typography.test.ts`; **Expected:** tests fail because the resolver is absent.
- [ ] **Step 3: Implement** typed values. Gallery: Inter, 5%, 0.14em, Fine; Editorial: Playfair Display, 5.5%, 0.06em, Double; Modern: Oswald, 5.5%, 0.12em, None. Size range 3.5–7% and tracking range 0–0.25em. Use defaults for missing fields and reject unknown saved values at API boundary.
- [ ] **Step 4: Run** the focused test and `pnpm exec tsc --noEmit`; **Expected:** both pass.
- [ ] **Step 5: Commit** `git add lib/poster-typography.ts lib/poster-typography.test.ts lib/types.ts lib/validations.ts && git commit -m "Add poster typography presets and config"`.

### Task 2: Matching preview and export

**Files:** Modify `components/live-poster-map.tsx`, `lib/live-poster-export.ts`, `app/globals.css`, `package.json`, `pnpm-lock.yaml`; create `lib/poster-frame.ts`, `lib/poster-frame.test.ts` if frame math needs a focused unit.

**Interfaces:** Consume `resolvePosterTypography(config)`. Export `getPosterFrameStrokes(style, width, height)` from `lib/poster-frame.ts` so CSS and canvas use the same inset ratios.

- [ ] **Step 1: Write failing tests** for frame stroke positions, unchanged map rectangle, and title maximum width. Add a browser export check for each font and long text to the existing render harness.
- [ ] **Step 2: Run** `pnpm exec tsx --test lib/poster-frame.test.ts lib/poster-typography.test.ts`; **Expected:** new frame tests fail.
- [ ] **Step 3: Implement** local font packages and `@font-face` imports; preview uses container-relative type sizes and spacing from resolver. Canvas waits for `document.fonts.load`, measures/fits title to 86% width, and draws matching frame strokes. Keep map position and zoom unchanged.
- [ ] **Step 4: Run** focused tests, `pnpm exec tsc --noEmit`, and browser render samples for Gallery, Editorial, Modern, and a long title; **Expected:** tests pass, selected fonts appear in PNG, no clipping, map rectangle unchanged.
- [ ] **Step 5: Commit** `git add components/live-poster-map.tsx lib/live-poster-export.ts lib/poster-frame.ts lib/poster-frame.test.ts app/globals.css package.json pnpm-lock.yaml && git commit -m "Match poster type and frame in preview and export"`.

### Task 3: Compact editor controls and end-to-end check

**Files:** Modify `app/app/design/[draftId]/page.tsx`; add a focused control test if existing component test setup supports it.

**Interfaces:** Consume Task 1 preset/customization helpers. Existing config save, checkout, and worker flows carry the optional fields.

- [ ] **Step 1: Write failing helper/control tests** that selecting a preset preserves entered content, manual adjustments show Custom, and an old saved draft resolves to Gallery.
- [ ] **Step 2: Run** focused tests; **Expected:** at least one new assertion fails before UI wiring.
- [ ] **Step 3: Implement** three visual preset buttons in Text tab, a collapsed Customize area with font, size, spacing, and frame controls, and accessible labels. Keep current content fields and coordinate switch.
- [ ] **Step 4: Run** all focused tests, `pnpm exec tsc --noEmit`, `git diff --check`, and visual checks at desktop/mobile widths. Generate one physical print sample through `/internal/render`; **Expected:** settings persist and all outputs match. If `pnpm build` hits the known Windows standalone symlink EPERM, record that exact post-compilation limit.
- [ ] **Step 5: Commit** `git add app/app/design/[draftId]/page.tsx && git commit -m "Add compact poster typography controls"`.
