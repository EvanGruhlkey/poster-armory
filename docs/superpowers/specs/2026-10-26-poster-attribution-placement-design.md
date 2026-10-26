# Poster attribution placement

## Intent

Keep the editable poster preview visually clean while preserving required map-data credit in the website and distributed files.

## Design

- Remove the OpenStreetMap/OpenFreeMap line from inside the live poster preview.
- Show a compact linked attribution line outside the artwork in the editor.
- Retain attribution in PNG, PDF, and physical print artwork at 1 point, converted to the matching output-pixel size.
- Keep the credit unobtrusive, readable, and inside the printable safe area.

## Approaches considered

- **Selected:** Website credit outside the preview plus a 1-point credit in exported artwork. This keeps editing clean and supports attribution when files leave the website.
- Website-only attribution was rejected because downloaded static images still require attribution.
- Reverse-side printing was rejected because the current Gelato poster products have only one print area.

## Scope

This changes attribution placement and size only. It does not change poster layout, map framing, pricing, or fulfillment products.
