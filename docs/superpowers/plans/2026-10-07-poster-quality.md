# Poster Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give buyers a good initial crop and require approval of the actual print file before a physical order can be paid or fulfilled.

**Architecture:** Keep MapLibre for instant editing. The existing Python worker produces one immutable full-size print artifact; a proof is downsampled from that file. Approval binds the artifact, user, design hash, and size, and checkout reuses the same artifact.

**Tech Stack:** Next.js 14, TypeScript, MapLibre, Supabase/Postgres, Python/Pillow, Stripe, Gelato.

**Spec:** `docs/superpowers/specs/2026-10-07-poster-quality-design.md`

## Global Constraints

- Editor choices remain place, framing, text, color, and size; rotation and pitch default to 0.
- A paid physical order must use the buyer-approved artifact, with no silent re-render.
- Existing in-progress orders continue through their current path during rollout.
- No galleries, markers, room mockups, or extra style controls.

## Review Focus

- Invalid or missing location bounds: use a finite point fallback and never jump to latitude/longitude 0 accidentally (Task 1).
- Long title or attribution near the trim edge: preflight blocks approval if outside the safe area (Task 3).
- Two users request the same design: neither can view or approve the other's artifact (Task 4).
- Buyer edits a design or size after approval: checkout rejects the stale approval (Task 5).
- Worker fails or times out: proof shows retry and no charge or fulfillment occurs (Tasks 3–5).

---

### Task 1: Initial framing

**Files:** Create `lib/poster-framing.ts`, `tests/poster-framing.test.ts`; modify `app/app/page.tsx`, `app/app/design/[draftId]/page.tsx`, `components/live-poster-map.tsx`.

**Interfaces:** `suggestPosterView(place: {lat:number; lon:number; bounds?: [number,number,number,number]}, aspect:number): {lat:number; lon:number; distance:number}`. Existing `PosterConfig` remains the saved camera state.

- [ ] Write tests for portrait/landscape bounds, a point without bounds, invalid bounds, and manual framing surviving text/style/size changes.
- [ ] Run `pnpm exec tsx --test tests/poster-framing.test.ts`; expect failures for the new helper.
- [ ] Implement the helper using map-window aspect and bounded padding; use it once when a location is first chosen, plus an explicit Reset framing action. Keep 0° rotation and pitch defaults.
- [ ] Run the test and `pnpm exec tsc --noEmit`; expect both to pass.
- [ ] Commit only Task 1 files.

### Task 2: Artifact identity and approval storage

**Files:** Create `supabase/migrations/017_print_artifacts.sql`, `lib/print-artifacts.ts`, `tests/print-artifacts.test.ts`; modify `lib/types.ts`, `lib/config-hash.ts`.

**Interfaces:** `canonicalArtifactKey(config: PosterConfig, sizeKey: string, orientation: ProductOrientation, rendererVersion: string, mapVersion?: string): string`. Tables `print_artifacts` (owner, key, config, size, orientation, job, print path, proof path, status, preflight result) and `print_approvals` (owner, artifact ID, key, approved_at), with owner-scoped RLS and a unique `(user_id, key)` artifact index.

- [ ] Write tests that all visual inputs and size change the key, while nonvisual shipping data does not; include renderer/map version changes.
- [ ] Run `pnpm exec tsx --test tests/print-artifacts.test.ts`; expect failure.
- [ ] Implement normalized identity, migration, and server-only artifact lookup/create helpers. Store a full snapshot of render inputs and never overwrite a completed print path.
- [ ] Run test, TypeScript check, and migration syntax check with the project's Supabase tooling; expect pass.
- [ ] Commit only Task 2 files.

### Task 3: Full-size file, derived proof, and preflight

**Files:** Create `scripts/print_proof.py`, `tests/test_print_proof.py`; modify `scripts/worker.ts`, `lib/poster-products.ts`, `create_map_poster.py` only where margins require it.

**Interfaces:** `make_proof(print_path, proof_path, detail_path, product_width_in, product_height_in, safe_margin_mm) -> PreflightResult`. Worker writes `print.png`, `proof.png`, and `detail.png` to immutable artifact paths and marks the artifact ready only after preflight passes.

- [ ] Write Python tests for exact ratio, effective DPI at 8×10/12×16/18×24, proof pixels derived from source, text safe area, malformed PNG, and a long title near the edge.
- [ ] Run `python -m pytest tests/test_print_proof.py -q`; expect failure.
- [ ] Implement Pillow downsampling and checks. Use the product's actual trim/bleed profile; leave nonbleed products unextended. Preserve the current 300 DPI worker render settings unless a product needs a different size.
- [ ] Run Python tests and TypeScript check; expect pass. Force a worker render failure and confirm artifact status is retryable with no ready proof.
- [ ] Commit only Task 3 files.

### Task 4: Proof API and page

**Files:** Create `app/api/print-proof/route.ts`, `app/api/print-proof/[id]/route.ts`, `app/api/print-proof/[id]/approve/route.ts`, `app/app/print-proof/[id]/page.tsx`, `lib/print-proof-authorization.ts`, `tests/print-proof-authorization.test.ts`; modify `app/app/order/page.tsx` to enter proof before checkout.

**Interfaces:** `POST /api/print-proof` starts or reuses an artifact; `GET /api/print-proof/:id` returns owned status and signed proof/detail URLs; `POST /api/print-proof/:id/approve` records approval only for a ready, preflight-passing artifact.

- [ ] Write tests for ready/pending/failed artifacts, other-user access, duplicate start, stale input, and retry after worker failure.
- [ ] Run `pnpm exec tsx --test tests/print-proof-authorization.test.ts`; expect failure.
- [ ] Implement owner checks and routes. Show full poster, detail, physical dimensions, progress, retry, and one Approve print action; keep the editor's controls unchanged.
- [ ] Run tests, TypeScript check, and a local browser pass through ready and failed states; expect pass.
- [ ] Commit only Task 4 files.

### Task 5: Checkout and fulfillment binding

**Files:** Modify `app/api/orders/route.ts`, `app/api/internal/job-complete/route.ts`, `app/api/stripe/webhook/route.ts`, `lib/gelato.ts`; create `lib/approved-order.ts`, `tests/approved-order.test.ts`; add `approved_artifact_id` to `poster_orders` in a new migration.

**Interfaces:** `requireApprovedArtifact(userId: string, artifactId: string, expectedKey: string)` returns a ready artifact with immutable print path or throws. New orders reference that artifact and pass its stored file URL to Gelato.

- [ ] Write tests for missing approval, changed design/size, wrong owner, failed preflight, retry, duplicate checkout, and legacy in-progress orders.
- [ ] Run `pnpm exec tsx --test tests/approved-order.test.ts`; expect failure.
- [ ] Require the approved artifact before creating a Stripe session; bind its ID to the order. On payment, submit the stored file, without starting a new print job. Keep old job-based fulfillment for orders created before rollout.
- [ ] Run tests and TypeScript check; in Gelato draft mode verify the submitted URL is the approved storage object.
- [ ] Commit only Task 5 files.

### Task 6: Paid download parity and rollout

**Files:** Modify `app/app/design/[draftId]/page.tsx`, `app/download/[jobId]/page.tsx`, `app/api/jobs/[id]/export-urls/route.ts`, `app/api/jobs/[id]/complete/route.ts`, `lib/live-poster-export.ts`; create `tests/download-parity.test.ts`.

**Interfaces:** Paid PNG/PDF downloads are derived from the canonical render for the chosen size; browser WebGL capture remains an editing preview only. A feature flag keeps existing production orders on the old path until sample prints pass.

- [ ] Write tests that downloadable crop/text/hash match the approved artifact, that changing size creates a new artifact, and that a failed conversion does not consume a completed download.
- [ ] Run `pnpm exec tsx --test tests/download-parity.test.ts`; expect failure.
- [ ] Route new paid downloads through the canonical artifact and derive PDF from its image without changing artwork. Gate new physical checkout behind the rollout flag until samples are approved.
- [ ] Run tests, TypeScript check, `git diff --check`, and a local end-to-end proof/download/order-draft flow.
- [ ] Order physical samples in small and large sizes, framed and unframed; record observed crop, detail, paper, color, and edge coverage. Enable the new order path only after the samples pass.
- [ ] Commit only Task 6 files and sample notes.
