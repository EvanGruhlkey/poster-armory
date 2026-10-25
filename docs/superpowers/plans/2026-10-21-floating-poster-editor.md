# Floating Poster Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Match the supplied poster-first editor reference with collapsed tools, floating settings, mobile bottom sheet, and a live Room preview.

**Architecture:** Keep `LivePosterMap` mounted as the one artwork renderer. A focused editor shell owns tool open/close and Map/Room presentation, while the existing page supplies controls and purchase actions. A generated empty interior background sits behind the live poster in Room mode.

**Tech Stack:** Next.js 14, React, Tailwind, MapLibre, node:test with React server rendering, Puppeteer browser checks, built-in image generation.

**Spec:** `docs/superpowers/specs/2026-10-21-floating-poster-editor-design.md`

## Global Constraints

- Keep Map, Text, Colors, Finish config and all current download, order, auth, and entitlement behavior.
- Default to no open tool; no satellite option.
- The full poster remains visible without page scrolling at 1440×900 and 390×844 with tools closed.
- Room uses the same live poster; the background asset contains no poster or text.
- Existing draft state survives tool and view changes.

## Review Focus

- Short desktop heights: full poster fits after Navbar and subscription banner; Task 2 browser check.
- Narrow mobile viewport: dock does not cover poster in collapsed state; Task 2 browser check.
- Opening/closing panel: no map remount or lost camera; Task 3 browser check.
- Escape and keyboard focus: tool can be opened and closed without a pointer; Task 1 interaction check.
- Room view: poster edits remain live and export stays artwork-only; Task 3 browser and render check.

---

### Task 1: Collapsed tool rail and panel shell

**Files:** Replace `components/poster-editor-sidebar.tsx`; modify `components/poster-editor-sidebar.test.tsx`; add `components/poster-editor-shell.tsx` if the rail/panel layout needs a separate owner.

**Interfaces:** `PosterEditorTool = "map" | "type" | "style" | "finish"`; `PosterEditorSidebar({ activeTool: PosterEditorTool | null, onToolChange: (tool: PosterEditorTool | null) => void, children: ReactNode })` renders the desktop rail, mobile dock, panel heading and close control. Children render only when a tool is active.

- [ ] Write failing tests for default collapsed state, one active tool, active-tool toggle to null, and accessible panel/close labels.
- [ ] Run `pnpm exec tsx --test components/poster-editor-sidebar.test.tsx`; confirm failure.
- [ ] Implement responsive rail and panel; Escape closes, focus enters the panel on open and returns to the tool on close. Reduced motion disables transitions.
- [ ] Rerun test and `pnpm exec tsc --noEmit`; confirm pass.
- [ ] Commit the shell component and tests.

### Task 2: Poster-first page geometry and actions

**Files:** Modify `app/app/design/[draftId]/page.tsx`; add `lib/poster-editor-geometry.ts` and `lib/poster-editor-geometry.test.ts` only if needed for viewport fit calculations.

**Interfaces:** The editor page starts with `activeTool: PosterEditorTool | null = null`. The existing `LivePosterMap`, all settings sections, `handleOrderPhysical`, `handleDownloadPoster`, and draft persistence remain connected. A measured stage height, based on its viewport top, sizes a contained poster without clipping.

- [ ] Write failing tests for a fit helper if extracted and a Puppeteer check at 1440×900 and 390×844 asserting poster bottom ≤ viewport bottom and no stage clipping.
- [ ] Run checks; confirm current layout fails the screenshot reference or viewport bounds.
- [ ] Replace the large heading and permanent sidebar with a compact action row and full-height stage. Move current settings under the floating panel. Put Order Print, Download, and explicit saved feedback in reachable positions without changing handlers.
- [ ] Rerun type check, relevant component tests, and both browser viewport checks; inspect screenshots against the reference.
- [ ] Commit page layout and fit changes.

### Task 3: Generated Room scene with one live poster

**Files:** Create `public/images/poster-room-scene.png`; modify `app/app/design/[draftId]/page.tsx` and, if needed, `components/live-poster-map.tsx`; add/update focused tests.

**Interfaces:** `viewMode: "map" | "room"`, default `"map"`. Map/Room changes only stage presentation; `LivePosterMap` stays mounted once. Room image is a photorealistic neutral wall/floor with side decor and an empty central area.

- [ ] Write failing view-mode test: same poster subtree persists across Map→Room→Map and no config changes occur.
- [ ] Generate room scene with built-in image generation, inspect it, and copy selected file into `public/images/poster-room-scene.png`.
- [ ] Add framed Room presentation and Map/Room control, disabling map gestures while Room is active. Keep poster contained in the measured stage.
- [ ] Rerun tests and browser checks for live updates, unchanged map camera, artwork-only export, and desktop/mobile room bounds.
- [ ] Commit scene asset and code.

### Task 4: Final visual and functional verification

**Files:** Adjust only files from Tasks 1–3 for issues found.

- [ ] Run `pnpm exec tsx --test components/*.test.tsx lib/*.test.ts lib/poster-renderer/*.test.ts scripts/*.test.ts`, `pnpm exec tsc --noEmit`, and `git diff --check`.
- [ ] Browse collapsed, each tool, mobile sheet, and Room at target viewports. Verify order/download controls and no console errors. Fix any issue and rerun its check.
- [ ] Request whole-branch review, address findings, then commit final polish if needed.
