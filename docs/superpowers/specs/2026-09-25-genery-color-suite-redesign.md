# Genery Color Suite Redesign

## Objective

Debug Genery's gallery workflow and replace its current developer-dashboard styling with a modern macOS power-tool interface. Preserve the existing local-filesystem capabilities while improving state clarity, keyboard behavior, error recovery, responsiveness, and visual hierarchy.

## Confirmed Product Context

Genery is a personal power tool for reviewing and organizing large local image folders. Its primary user values keyboard speed, direct filesystem control, dense information, and precise image inspection over casual simplicity.

The product remains a local React/TypeScript web application backed by its existing Express server. This redesign does not change storage formats, batch-operation semantics, API routes, or supported image workflows.

## Approved Visual Direction

The approved visual world is **Color Suite**, derived from professional color-grading workspaces and calibrated reference monitors. It uses a near-black image canvas, graphite macOS chrome, precise blue focus, sparse amber status, shallow translucency, hairline separators, and restrained scope-like data presentation.

The approved composition is **Three-pane Proofing**:

1. A slim source sidebar for the current folder, scan controls, recursive-scan state, and useful collection summaries.
2. A central adaptive proof grid where images remain the dominant visual material.
3. A persistent contextual inspector showing the focused image, real file facts, rating, tags, and comment actions.

The full-resolution approved comp is `.impeccable/mocks/color-suite-three-pane.webp`. The surface brief is `.impeccable/surfaces/src-app-tsx.md`.

## Application Structure

`App.tsx` remains the state owner and API orchestration boundary. Presentation is divided into focused units:

- `GalleryHeader`: unified macOS toolbar containing folder location, scan status/action, search, filter toggle, inspector toggle where needed, batch entry, and shortcut help.
- `SourceSidebar`: new source/status rail for the current library, recursive-scan state, total and filtered counts, and folder browsing.
- `GalleryGrid`: adaptive proof surface and empty/loading/error-state host.
- `ThumbnailCard`: image-dominant proof cell with compact filename/facts, rating, selection, comment, and tag state.
- `InspectorPanel`: new contextual panel for the focused image, large preview, real metadata, rating, hashtags, comment access, and fullscreen action.
- `FilterPanel`: existing filters and advanced query builder reorganized as a controlled workspace drawer.
- `WorkspaceStatusBar`: new compact footer for counts, selection state, keyboard hints, and non-blocking operation status.
- Existing modals and `FullscreenViewer`: behavior preserved, visual language replaced with shared Color Suite controls and sheets.

Reusable visual primitives will live in `src/index.css` as semantic component classes and CSS custom properties rather than repeated Tailwind class strings. Tailwind remains available for layout where it is already useful.

## State and Data Flow

The existing image collection remains authoritative in `App.tsx`.

- Folder scans update the full image set, available types, and resolved directory.
- Filtering and sorting derive `processedImages` without mutating source data.
- Focus is anchored by image ID, not only array position. After filtering or sorting, the same image remains focused when it is still visible; otherwise focus moves to the nearest valid result.
- The grid observes its rendered column count with `ResizeObserver` and reports it for correct vertical arrow-key navigation after sidebars or inspectors resize the workspace.
- Card-body clicks set focus and single selection. Checkbox clicks independently toggle membership in the multi-selection set without clearing existing selections.
- Rating, hashtag, and comment edits remain optimistic, but each mutation captures the prior value and restores it if persistence fails.
- Scan and metadata failures produce visible, dismissible status feedback with accessible live-region semantics.

## Interaction Model

- Arrow keys move focus through the actual rendered grid.
- Space opens Quick Look/fullscreen for the focused image.
- Number keys update rating, Enter edits tags, and Shift+Enter edits the comment.
- Viewer shortcuts are suspended while a nested editor dialog is open.
- Toolbar and panel controls have visible keyboard focus and native-feeling pressed/selected states.
- Destructive batch actions remain visually distinct and continue to require their existing confirmation flow.
- Motion is limited to short state transitions and is disabled under `prefers-reduced-motion`.

## Responsive Behavior

- At wide desktop widths, all three panes remain visible.
- At intermediate widths, the source sidebar collapses before reducing useful grid density; the inspector retains a practical fixed width.
- At narrow widths, the grid becomes the primary surface and the inspector opens as an overlay drawer.
- Controls wrap or collapse into icon buttons without hiding required actions.
- Grid sizing is based on the available center pane rather than the browser window width.

## Error and Empty States

The interface distinguishes:

- no directory selected;
- scan in progress;
- directory scanned but containing no supported images;
- filters producing no matches;
- scan failure;
- metadata persistence failure.

Each state has a direct recovery action where applicable. Console logging may remain for diagnosis but is never the only user-visible indication of failure.

## Visual System

- System font stack: `-apple-system`, `BlinkMacSystemFont`, `SF Pro Text`, `Segoe UI`, sans-serif.
- Primary canvas: calibrated near-black rather than blue-black.
- Chrome: graphite translucent surfaces with low-contrast inset edges.
- Accent: macOS blue for focus, selection, and primary actions only.
- Status accent: amber for ratings and pending/attention states.
- Radii: 6–10px, with tighter controls than media surfaces.
- Shadows: one shallow elevation tier for overlays and sheets; selected images use a crisp ring rather than glow.
- Typography: 11–13px utility labels, 14–15px body text, and 16–18px section headings; tabular numerals for file facts.

## Accessibility

- Preserve full keyboard operation.
- Use semantic buttons, labels, dialogs, and live regions.
- Provide visible `:focus-visible` treatment.
- Never encode selection or failure by color alone.
- Maintain readable contrast across all controls and text.
- Respect reduced-motion preferences.
- Provide descriptive image alt text from real filenames.

## Verification

Completion requires all of the following evidence:

1. `npm run build` passes.
2. Filter and sort changes preserve focus by image identity when possible.
3. Grid arrow navigation uses the rendered column count at wide and narrow layouts.
4. Checkbox multi-selection does not clear earlier selections.
5. Fullscreen shortcuts do not operate behind tag or comment dialogs.
6. Failed scan and failed metadata persistence paths show visible feedback and restore optimistic values.
7. Desktop and narrow viewport screenshots show no clipped controls, unintended overflow, or collapsed image area.
8. The live desktop surface materially matches the approved Color Suite comp in composition, density, material language, and focus treatment.
9. The Impeccable detector and finish review complete, and the resulting visual system is recorded in `DESIGN.md`.

## Out of Scope

- New server endpoints or metadata fields.
- Invented EXIF data not present in `ImageItem`.
- Changes to batch-operation filesystem semantics.
- Cloud synchronization, authentication, or hosted libraries.
- A native macOS/Tauri wrapper.
