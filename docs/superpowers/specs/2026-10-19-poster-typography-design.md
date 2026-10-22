# Poster typography and frame options

## Goal

Give buyers a few clear ways to make the finished poster feel personal and polished. Keep the editor compact. Every choice must appear the same in the live preview, digital PNG/PDF, and physical print render.

## Scope

The existing Text tab gains three one-click type presets with small visual samples: **Gallery** (current clean sans layout), **Editorial** (serif title), and **Modern** (condensed sans title). The current title, subtitle, date, and coordinate fields remain. A collapsed **Customize** area offers title font, title size, letter spacing, and frame style. Font choices are a small curated set available to both the browser preview and worker Chromium; no arbitrary font names. Frame choices are None, Fine, and Double. The default remains visually close to today's Gallery poster.

The selected preset sets the four customization values. A later manual change marks the selection as Custom; selecting a preset again restores its values. Presets do not overwrite a buyer's title or other content. All settings are stored with the existing poster config as optional fields with defaults so previously saved designs still load and render as Gallery.

## Rendering

A shared typography resolver converts the saved config into font family, size ratio, tracking, weight, and frame geometry. The editor CSS preview and canvas export both read that resolver. Title and subtitle layout use the same poster-relative measurements and width limit, including long titles. The map frame geometry stays fixed; Fine and Double decorate its edge without changing geographic crop. Before export, the browser waits for the selected font to load. If loading fails, it uses a bundled fallback consistently. PDF page size continues to use the selected physical size.

## Data and controls

Extend `PosterConfig` and its Zod schema with optional preset/font/size/tracking/frame values. Put the preset row above text fields and the collapsed Customize controls below them. Only valid curated values are accepted by saved designs and job requests. Worker and client exports use the same config and renderer; no separate print-only typography path.

## Verification

Test default resolution for old configs, preset-to-custom behavior, validation, and frame measurements. Render sample posters for all three presets plus a long title; compare editor screenshots to PNG and PDF output, and generate a physical print sample. Run TypeScript and focused tests.

## Out of scope

Free-form font uploads, textures, backdrops, text over the map, and a large matrix of independent styling switches. These add complexity without improving the main choice among polished poster looks.
