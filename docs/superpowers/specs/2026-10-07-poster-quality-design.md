# Poster quality and print proof

## Purpose

Help buyers make a poster of an exact, meaningful place and know what will arrive. The editor should remain short: place, framing, text, color, and size. The finished print, not the number of controls, is the product.

## Current system

- The editor displays a live MapLibre map from OpenFreeMap vector tiles.
- Digital downloads capture the browser map and compose a 2,400-pixel-long poster (`lib/live-poster-export.ts`).
- Physical orders use `create_map_poster.py` through `scripts/worker.ts` to make a separate 300 DPI PNG. That renderer can produce different geography, styling, labels, and crop from the editor.
- The order flow starts a print render, but the buyer does not approve that exact file before checkout.

## Approaches considered

1. **Recommended: one canonical print artifact.** Render a full-size print file before checkout, derive the buyer proof by downsampling that same file, and reuse the approved file for fulfillment and downloads. Keep the live map as the fast editing surface. This requires a proof step but avoids claiming the live canvas is pixel-identical to a different renderer.
2. Make WebGL the sole renderer, including large-format fulfillment. This would best align editor and print, but 300 DPI posters can exceed practical browser/WebGL canvas limits and need tiling or server-side rendering work.
3. Make Python the live renderer. This gives parity but makes every edit a render job and would likely worsen the already reported preview delay.

## Design

### 1. Place and framing

The place search result remains the starting point. For a city or region with a usable bounding box, derive an initial camera view that fits that area within the *poster map window*, with fixed visual padding; for a point or address, use a neighborhood-scale fallback. Keep rotation and pitch at 0 by default. The buyer can pan and zoom after the suggested view. Preserve their manual framing if they change text, color, or size; offer a separate Reset framing action to recalculate.

The editor shows the selected location text and current map center. Before proof, validate finite coordinates, a supported scale, a nonempty title, and a real print size. Do not promise that every mapped feature is current. OpenFreeMap uses OpenStreetMap snapshots, and the data in a specific location can still lag reality.

### 2. Canonical proof

Create an immutable `print_artifact` keyed by a normalized design hash, physical size, orientation, renderer version, and map-data version where available. The artifact contains the exact full-resolution file that will be sent to fulfillment and a proof image generated only by downsampling the file. The proof page shows the entire poster, a crop at native detail around the chosen location, final dimensions, and a clear Approve print button. If the buyer changes any design input or size, the approval expires and a new artifact is needed.

The live editor remains responsive, but checkout is gated on the canonical proof. The proof page should say that it is the file used for printing; the editor need not claim that its WebGL canvas is an exact print proof. Reuse a completed artifact for identical designs to avoid extra renders. Show render progress and a retry path on failure. Never charge or place an order from an unapproved artifact.

### 3. Output and fulfillment

Use one canonical rendering path for the proof, digital download, and physical order. The downloaded PDF/PNG and the Gelato file must be generated from the approved design and dimensions; format conversions may differ, but the crop, text, and visible map features must match the approved proof. Keep the existing Python print renderer initially because it already handles 300 DPI physical output, and remove the fixed 2,400-pixel WebGL download from the paid output path only after parity is verified.

Validate image dimensions against the selected product, effective DPI, and a configurable safe area before exposing Approve. Keep text and attribution inside the safe area. Apply the selected Gelato product's trim/bleed requirements when creating its file; do not assume one bleed value for every product. Reject a file that fails preflight and show a useful error rather than sending it to fulfillment.

### 4. Interface

Editor: one strong default, direct map drag/zoom, text, color, and size. Proof: poster, zoomed detail, size, approval. Checkout follows approval. No new galleries, markers, mock rooms, or extra style controls are part of this work.

## Data flow

`editor config -> normalized design -> canonical render job -> full-size file -> downsampled proof -> buyer approval -> checkout -> existing file to Gelato`

The approval record binds user, design hash, artifact ID, and size. Checkout checks that binding server-side. Retries cannot alter the approved file. Existing in-progress jobs and orders continue on their current path; new approvals use the new path after rollout.

## Verification

- Automated: framing math at portrait/landscape sizes; design hash invalidation; approval and checkout authorization; output dimensions/DPI; failure and retry behavior.
- Visual: compare proof against its full-size source at multiple crops for a dense city, a shoreline city, a rural address, and a long title.
- Physical: order samples in at least a small and a large supported size, with and without a frame; inspect crop, legibility, paper, color, and edge coverage before enabling fulfillment broadly.
- Rollout: start with a local/internal proof path, then a small paid-order cohort. Preserve current order path until samples pass.

## Success criteria

- Every new paid physical order references a buyer-approved artifact and sends that exact artifact to fulfillment.
- Changing place, framing, text, color, or size invalidates approval.
- A proof is derived from the full-size file, and sample prints show no meaningful crop or text mismatch.
- The first edit remains live and responsive; only the final proof requires a render wait.
