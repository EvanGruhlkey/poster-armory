# Floating Poster Editor Design

## Intent

Match the supplied seven-state reference: the poster is the product and fills the available editor stage; tools stay collapsed until chosen. Map, Text, Colors, and Finish open in a compact floating panel on desktop and a bottom sheet on mobile. A Room mode presents the same live poster on a tasteful wall. The user asked for low clutter and to see the entire poster without scrolling when tools are closed.

## Current system

The draft editor lives in `app/app/design/[draftId]/page.tsx`. It renders `LivePosterMap` and four existing groups through `PosterEditorSidebar`. Design state is saved per draft in local storage; downloads and print orders already have handlers. `Navbar` and an optional subscription banner precede the editor. The map/export pipeline must remain shared.

## Layout and interaction

- Default state: no tool selected. The poster stage occupies the available width and remaining viewport height beneath the existing app header. A slim desktop rail floats along the right edge with icon and short labels. A mobile dock sits at the bottom.
- Selecting a tool opens one panel with a short header, close button, and a scrollable body. The desktop stage reallocates width to keep the entire poster visible to its left. The mobile panel rises as a bottom sheet; the poster remains visible above it. Escape, close, and selecting the active tool collapse the panel.
- Keep Map, Text, Colors, and Finish controls and their existing behavior. Move size, download, and print actions into Finish and the desktop top action row. Keep advanced controls behind existing “More options” details. No satellite mode is added.
- A compact Map/Room switch controls only presentation. Map shows the existing interactive `LivePosterMap`; Room frames that same live poster element against a generated neutral interior scene and disables map gestures until Map is selected again. Returning to Map retains current edits and map view. Room does not alter downloadable/print artwork.
- Save uses the existing draft persistence and gives explicit feedback. Order Print and Download retain their current authentication and entitlement behavior.

## Visual system

Use the reference’s warm off-white stage, restrained navy controls, fine borders, modest shadows, and generous space around the artwork. The poster remains a real rendered element, never baked into the room asset. Generate a quiet wall-and-floor image with soft side light and peripheral decor; reserve a clear central wall area for the dynamic framed poster. Use the same scene responsively, cropping only peripheral decor. The generated image contains no poster, map, typography, UI, or logos.

## Sizing and responsive behavior

- Calculate available editor height from the measured top of the stage to the viewport bottom, accounting for the app header and any banner. Fit the full poster aspect ratio inside that area with `contain`; never clip it to make the layout fit.
- Verify the collapsed state at desktop 1440×900 and mobile 390×844. At narrower heights, prioritize full poster visibility and allow only settings content to scroll.
- The Room poster uses the same aspect ratio and stays fully visible on desktop and mobile. When a panel opens, the stage may shrink but must keep the artwork fully visible.

## Accessibility and state

Tool buttons expose selected and expanded state; panels have headings and labeled close controls. Desktop focus moves into an opened panel and returns to its tool on close. Mobile sheet has dialog semantics, Escape support, focus management, and a visible close control. Motion respects reduced-motion preferences. Preserve draft config across tool, Map/Room, and viewport changes.

## Boundaries and verification

Change the editor page shell and focused UI components; avoid changes to poster rendering or print layout. Add meaningful interaction tests for tool toggling, Escape/close, persistence, and Map/Room state. Verify the stage and poster bounds in a real browser at desktop and mobile sizes. Compare screenshots with the supplied reference for hierarchy, spacing, and panel behavior. Verify type checking and the relevant test suite.
