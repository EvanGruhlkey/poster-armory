# Poster text placement and style presets

## Goal

Bring the reference poster's text looks and placement choices into Poster Armory while keeping the editor compact and preserving existing designs. A buyer should see the same composition in the editor, digital files, and physical prints.

## Choices

Add all eight reference text looks: Modern Bold, Classic Serif, Minimal Clean, Editorial Strong, Vintage Elegant, Technical Mono, Geometric Modern, and Condensed Impact. Each look sets title and subtitle font, size, weight, spacing, capitalization, and its readability treatment. Their original size ratios and pairings are the target; where the reference uses different poster geometry, scale those ratios so the result fits our frame and long titles stay visible. Use locally bundled fonts for every look. The current Gallery, Editorial, and Modern choices remain available to old saved designs; the new picker presents the eight reference looks and a Gallery option for continuity.

Add four placement choices: Below map (today's default), Top, Center, and Bottom. Top/Center/Bottom place the text over the map. The map rectangle does not move or change its geographic crop when placement changes. For overlay placements, use the reference treatments: none, subtle halo, strong backing, and gradient. Presets select a treatment, and a compact advanced control can override it. The title, subtitle, date line, and coordinates move together. On-map text must remain readable over both dark and light map areas.

## Editor

The Text tab shows a compact placement selector, then a horizontally scrollable or responsive grid of visual preset cards. Existing content inputs stay. A collapsed Customize section holds detailed font, size, spacing, frame, and readability controls. Selecting a preset updates only styling and never replaces entered words or location. Manual changes mark the style Custom. Selecting a preset again restores its full styling. Old saved posters without new fields keep the same Gallery look below the map.

## Data and rendering

Extend the existing optional typography config with placement, subtitle typography, capitalization, and readability treatment. The existing preset field accepts the new IDs; old values continue to resolve. Zod validation rejects unsupported values and bounds numerical controls. A shared layout resolver computes title/subtitle metrics and overlay positions relative to poster size. The CSS preview and Canvas compositor use the same resolver. The print worker already calls the browser renderer, so it receives the same styles as the editor and digital download. Font loading completes before export, with a bundled fallback if one font cannot load. Keep the attribution legible and separate from overlay text.

For Below map, preserve the current title band and map dimensions. For Top/Center/Bottom, reserve no extra space: text sits within the map's safe inset. Apply halo/backing/gradient only behind the text and keep map detail visible elsewhere. Use the same calculated maximum text width and fitting for long names in both preview and Canvas. All placements honor poster orientation and size.

## Verification

Unit tests cover all preset values, old-config compatibility, custom transitions, validation, and placement geometry for portrait/landscape. Browser checks cover each placement, a long title, and each readability treatment in preview and PNG. Generate physical print samples for at least one light and one dark map style; compare to preview. Run the complete available test suite and TypeScript. The known Windows standalone symlink limitation may prevent a successful local production build after compilation.

## Out of scope

Arbitrary font uploads, freehand text dragging, texture overlays, and circular map masks.
