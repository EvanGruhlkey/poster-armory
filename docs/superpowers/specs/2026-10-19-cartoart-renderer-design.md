# CartoArt renderer integration

## Goal

Replace Poster Armory's poster artwork with CartoArt-derived rendering code while keeping Poster Armory's simple editor, accounts, checkout, and orders. The live preview, paid download, and physical print should depict the same composition. Rotation and tilt start at 0 degrees.

## Source and license

Copy only the modules needed for map styling, palettes, terrain, typography, and high-resolution export from the user-provided CartoArt source, recording the exact source version. The user supplied an additional MIT grant for this code with `Copyright (c) 2026 Kyle Kingsberry`. Include that copyright and the full MIT permission notice in copies or substantial portions, as the grant requires. Check imported modules for third-party code not covered by this grant. Do not put CartoArt branding in the app UI.

## Design

1. Put the imported renderer in an isolated module, keeping upstream attribution beside it. Add a small adapter from Poster Armory's `PosterConfig` to CartoArt's rendering options. Existing designs retain their saved city, framing, copy, size, rotation, and tilt; map old palette choices to the closest imported styles.
2. Use the adapted CartoArt MapLibre style and typography in the editor preview. Keep the current editor controls compact. Do not import CartoArt's gallery, storefront, account UI, or API client.
3. Use the imported high-resolution MapLibre export path for downloads. Avoid enlarging the preview canvas. Validate the exported dimensions, text placement, attribution, and PDF output.
4. Replace the Python map renderer used by the print worker with the same browser renderer in a headless render process. Keep the existing job queue, billing, storage, and order handoff. The worker creates the requested print dimensions from the saved config and checks the output before marking a job ready.
5. Roll out behind an internal renderer switch until a sample set of cities, styles, sizes, and 0-degree/tilted views have been visually checked. Then make the new renderer the default. Retain the old renderer in version history for rollback, not in the visible UI.

## Risks and checks

- CartoArt's dependencies and tile endpoints may differ from Poster Armory's. Pin compatible versions and check tile usage terms and attribution before release.
- Large print sizes can exceed GPU texture limits or worker memory. Use the imported tiled export path where needed and test the largest offered size.
- Saved designs must continue to load; test old config mapping, preview/download/print parity, and a physical-order job without changing checkout behavior.
- Do not deploy copied code without the supplied MIT copyright and permission notice. Confirm that every imported file falls within the grant and that any third-party components retain their own required notices.

## Out of scope

No CartoArt API, additional editor controls, gallery, social features, or checkout redesign.
