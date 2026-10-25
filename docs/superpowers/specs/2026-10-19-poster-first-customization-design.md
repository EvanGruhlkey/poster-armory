# Poster-first customization editor

## Goal

Give customers the poster controls available in the supplied CartoArt editor while making the poster itself the focus. The design must be easy to scan, and a setting must affect the poster they can actually download or order. Animation and STL export are separate products and are outside this editor.

## Reference inventory

The live CartoArt editor exposes Place, Typography, Style, Rendering, 3D, Labels, Markers, and Output. Its supplied source also exposes these poster controls:

- Place and camera: search, map center and zoom, flat/3D presets, bearing, pitch.
- Style and rendering: style and palette presets; individual background, road hierarchy, water, parks, building and text colors; visible streets, railroads, buildings, water, parks, landcover, contours, boundaries, and points of interest; line weights; terrain shading and light; building height and fallback height.
- Labels and markers: map name groups and label sizing; a location marker; custom markers with symbol, size, color and label; connecting route with line and segment labels; scale bar and geographic grid.
- Typography: poster title and subtitle, placement, style presets, individual font controls, visibility, coordinates, backdrop and its strength/size.
- Output: size and orientation, map margin, border, circular mask and compass, paper/canvas/grain texture and strength.

This inventory describes reference capabilities, not a request to import its component tree. Preserve the copyright notice for any source-derived code or data.

## Editor layout

On desktop, a sticky poster preview takes a `2fr` grid column and a narrow sidebar takes `1fr`, capped at 360px. The sidebar uses four tabs: **Map**, **Text**, **Colors**, and **Finish**. Only one tab's controls is visible at once. The poster remains visible while controls scroll. Order and download actions remain close to the preview/sidebar boundary.

On small screens, the poster appears first at a useful size. Controls follow in a single column. Avoid a permanently fixed preview that consumes the whole viewport. Preserve the existing preview gestures and keyboard-accessible controls.

Each section starts with choices people can understand without technical terms: map framing and 3D angle; layer switches; text style and placement; palette; size and finish. Put granular controls under one **More options** disclosure per section. Show a live selected state, short plain labels, and units only where needed. Hide dependent controls when their parent feature is off. Do not reintroduce the removed map-layer preset strip.

## Feature groups and staged delivery

1. **Poster-first shell and map/colors:** rearrange the editor without changing saved designs. Port the supplied poster style and palette presets, custom colors, geographic/data layer switches, road weight, terrain/3D controls, and camera presets. Map styling uses the existing MapLibre renderer. Terrain controls require elevation data in both preview and output before they appear in the editor.
2. **Text, labels and markers:** retain the current style/placement choices. Add remaining visibility, backing, map label groups and sizing, center/custom markers, route controls, and scale/grid options. Keep detailed type and marker controls behind disclosures.
3. **Finish and output:** add margin, border variants, mask/compass, texture and intensity, size/aspect/orientation. Keep the print product and digital download behavior clear. Only expose aspect ratios or sizes supported by the actual export and order flow.

For each group, ship only settings that affect both the live preview and the produced poster. If an export path cannot represent a feature, update that path before exposing the control. The settings need not be implemented in the reference site's order, but the finished poster editor should cover the poster feature groups above.

## Data and rendering

Extend `PosterConfig` with optional, validated fields so older saved designs keep their appearance. Keep defaults in one place and use the same resolved config for preview, digital export, saved drafts, checkout, and print rendering. Use shared pure calculations for poster geometry, palette, typography, masks and overlays. Renderer-specific drawing code may differ, but visual intent and selected values must match.

Map interactions update the config or camera state and persist when a design is saved. Presets change their own group without erasing unrelated text, location, or finish choices. Manual changes retain the current design and indicate a custom state. Unsupported map data, tiles or elevation should fail gracefully: show a clear unavailable state rather than silently ignoring a selected setting or blocking unrelated edits.

## Verification

- Unit tests cover config defaults, validation, preset isolation, and layout calculations.
- Browser checks cover desktop and mobile poster prominence, control discovery, selected states, and a representative setting from each group.
- Compare preview with high resolution digital output for representative flat, 3D, text, marker, mask and texture designs. Compare the physical print path for every setting available to print buyers.
- Run existing tests and TypeScript checks; verify old saved designs still render with their prior defaults.

## Completion criteria

A user can start with a location and make a sale-ready poster using a handful of visible choices. They can open More options for the reference site's finer poster controls. The poster is the largest visual element on desktop, and all shown settings persist and appear in the final output.
