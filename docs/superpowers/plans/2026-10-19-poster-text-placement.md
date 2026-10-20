# Poster Text Placement and Styles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the reference's eight text looks and three on-map placements alongside the current below-map layout, consistently in editor and exports.

**Architecture:** A typed preset registry and pure layout resolver own all text metrics and placement. The editor and Canvas export consume the same values. Optional config fields preserve old posters.

**Tech Stack:** Next.js 14, React, TypeScript, Zod, MapLibre, browser Canvas, @fontsource, Node tests.

**Spec:** `docs/superpowers/specs/2026-10-19-poster-text-placement-design.md`

## Global Constraints

- Keep old configs in Gallery, Below map with unchanged map dimensions and title band.
- Add Modern Bold, Classic Serif, Minimal Clean, Editorial Strong, Vintage Elegant, Technical Mono, Geometric Modern, Condensed Impact.
- Support Below map, Top, Center, Bottom. Changing placement never changes map camera or crop.
- Fonts are local packages: Inter, Playfair Display, Oswald, Montserrat, Crimson Text, JetBrains Mono, Poppins.
- No font uploads, freehand dragging, textures, or circular masks.

## Review Focus

- Old saved config or checkout payload missing new fields stays Gallery/Below map; Task 1 test.
- Each preset applies all styling fields and preserves entered text; Task 1 test.
- Long titles fit within the map safe inset in all placements; Task 2 geometry test and browser sample.
- Dark-map Center text stays legible without hiding the whole map; Task 2 browser sample.
- Worker-generated PNG uses the chosen font and placement; Task 3 physical sample.

---

### Task 1: Preset model and compatibility

**Files:** Modify `lib/poster-typography.ts`, `lib/poster-typography.test.ts`, `lib/types.ts`, `lib/validations.ts`.

**Interfaces:** `resolvePosterTypography(config): ResolvedPosterTypography` adds subtitle font/size/weight/tracking, capitalization, backdrop; `applyTypographyPreset(config,preset)` accepts Gallery/Editorial/Modern and eight new IDs; `applyTextPlacement(config,placement): Partial<PosterConfig>` changes only placement. Optional config fields: `text_placement`, `subtitle_font`, `subtitle_size`, `subtitle_weight`, `subtitle_tracking`, `title_all_caps`, `text_backdrop`.

- [ ] **Step 1: Write failing tests** for all eight preset font/size/weight/spacing/case/backdrop values from `frontend/lib/typography/textPresets.ts`, old-config Gallery/Below map, content preservation, Custom transition, and Zod rejection of invalid positions/fonts/ratios.
- [ ] **Step 2: Run** `pnpm exec tsx --test lib/poster-typography.test.ts`; **Expected:** new assertions fail.
- [ ] **Step 3: Implement** the registry and resolver. Preserve old three IDs; new preset IDs match the reference. Map reference `titleSize`/`subtitleSize` to poster width percent. Limit Below map effective title size to its band while retaining saved values. Keep positioning independent from preset selection.
- [ ] **Step 4: Run** focused tests and `pnpm exec tsc --noEmit`; **Expected:** pass.
- [ ] **Step 5: Commit** model, validation, and tests with message `Add reference text presets and placement config`.

### Task 2: Shared placement geometry and rendering

**Files:** Modify `components/live-poster-map.tsx`, `lib/live-poster-export.ts`, `lib/poster-renderer/export.ts`, `app/globals.css`, `package.json`, `pnpm-lock.yaml`; create `lib/poster-text-layout.ts` and `lib/poster-text-layout.test.ts`.

**Interfaces:** `getPosterTextLayout(config,width,height)` returns map rectangle unchanged and a text safe rectangle for Below map/Top/Center/Bottom. `getPosterTextBackdrop(config)` returns none/halo/solid/gradient parameters used by CSS and Canvas.

- [ ] **Step 1: Write failing tests** for unchanged map rectangle, distinct safe text rectangles for four placements in portrait/landscape, long-title maximum width, and backdrop selection.
- [ ] **Step 2: Run** `pnpm exec tsx --test lib/poster-text-layout.test.ts`; **Expected:** fail until helper exists.
- [ ] **Step 3: Implement** locally bundled fonts and shared layout. CSS preview overlays text for Top/Center/Bottom and preserves the current Below map band. Canvas uses the same box, typography, letter spacing, case, and backdrop. Keep frame overlay and attribution visible. Wait for both title and subtitle fonts before export; use bundled fallback.
- [ ] **Step 4: Run** tests and TypeScript; render browser samples for all placements and each backdrop, light/dark maps, long title. **Expected:** no clipping and preview/export composition matches.
- [ ] **Step 5: Commit** renderer, fonts, and tests with message `Render poster text across four placements`.

### Task 3: Compact editor choices and physical verification

**Files:** Modify `app/app/design/[draftId]/page.tsx`; create `components/poster-text-choices.tsx` and `components/poster-text-choices.test.tsx`.

**Interfaces:** `PosterTextChoices({config,onChange})` renders preset and placement controls and emits `Partial<PosterConfig>`. Text tab consumes it. Existing draft persistence and job payload carry new optional fields.

- [ ] **Step 1: Write a failing server-rendered component test** asserting nine preset buttons, four placement buttons, and selected states for an old config; run `pnpm exec tsx --test components/poster-text-choices.test.tsx` and confirm module/markup failure.
- [ ] **Step 2: Implement** four placement buttons and visual cards for all eight reference presets plus Gallery in a compact scrollable/responsive picker component, then wire it into the Text tab. Extend collapsed controls for subtitle typography, capitalization, and readability. Use clear selected state and accessible labels.
- [ ] **Step 3: Run** full available test suite, `pnpm exec tsc --noEmit`, and `git diff --check`; **Expected:** pass.
- [ ] **Step 4: Check** desktop/mobile previews and generate one light and one dark physical PNG through `/internal/render`; **Expected:** same chosen placement/fonts as editor. Run `pnpm build`; if only Windows standalone symlink EPERM follows successful compilation/page generation, record the limitation.
- [ ] **Step 5: Commit** controls and tests with message `Add text placement and reference style choices`.
