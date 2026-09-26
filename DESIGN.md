---
name: Genery
description: A calibrated local-image proofing bench for fast, precise curation.
colors:
  primary: "#0a84ff"
  primary-hover: "#3499ff"
  primary-soft: "rgba(10, 132, 255, 0.18)"
  rating-amber: "#ff9f0a"
  destructive-red: "#ff453a"
  success-green: "#30d158"
  canvas: "#101012"
  canvas-deep: "#0b0b0d"
  chrome: "rgba(31, 31, 35, 0.94)"
  chrome-solid: "#1d1d20"
  surface: "#242428"
  surface-raised: "#2b2b30"
  surface-hover: "#333339"
  seam: "rgba(255, 255, 255, 0.09)"
  seam-strong: "rgba(255, 255, 255, 0.15)"
  text-primary: "#f3f3f5"
  text-secondary: "#b6b6bd"
  text-tertiary: "#85858e"
typography:
  headline:
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "Segoe UI", sans-serif'
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "Segoe UI", sans-serif'
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "Segoe UI", sans-serif'
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  label:
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "Segoe UI", sans-serif'
    fontSize: "10.5px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.055em"
rounded:
  badge: "4px"
  compact: "5px"
  preview-action: "6px"
  control: "7px"
  surface: "8px"
  notice: "9px"
  sheet: "10px"
  state: "13px"
  pill: "999px"
spacing:
  micro: "4px"
  tight: "5px"
  compact: "8px"
  control: "9px"
  cluster: "12px"
  frame: "14px"
  panel: "15px"
  roomy: "17px"
components:
  button-chrome:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 11px"
    height: "34px"
  button-chrome-hover:
    backgroundColor: "{colors.surface-hover}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.control}"
    padding: "0 11px"
    height: "34px"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 13px"
    height: "34px"
  input-toolbar:
    backgroundColor: "{colors.canvas-deep}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.surface}"
    padding: "0 9px"
    height: "34px"
  tag-chip:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-hover}"
    typography: "{typography.label}"
    rounded: "{rounded.badge}"
    padding: "2px 5px"
  proof-card:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.surface}"
    padding: "0"
  sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sheet}"
    padding: "0"
---

# Design System: Genery

## Overview

**Creative North Star: "The Calibrated Proofing Bench"**

Genery should feel like a purpose-built macOS workstation for inspecting local images: quiet graphite controls surround a calibrated near-black field so the collection, not the interface, carries the visual energy. It is a personal power tool—dense, direct, and native-feeling—rather than a lifestyle gallery or a generic developer dashboard.

The interface earns clarity through stable panes, exact alignment, compact typography, and visible state. Blue is optical focus, amber is evaluative status, and hairline seams organize the workspace without turning every region into a card. Translucency is shallow and functional; decoration never competes with image judgment.

**Key Characteristics:**

- Image-led three-pane proofing workspace
- Graphite macOS chrome around a calibrated near-black canvas
- Compact system typography with tabular file facts
- Restrained blue focus and selection, sparse amber ratings
- Hairline seams, tight radii, and shallow overlay depth
- Keyboard-first density with explicit, accessible state

## Colors

The palette is nearly achromatic graphite, with blue reserved for optical focus and action, amber reserved for rating, and semantic red and green used only when their meaning is necessary.

### Primary

- **Optical Blue:** Marks focus, selection, active navigation, and primary actions; its brighter companion is limited to hover emphasis and its translucent form to selected backgrounds.

### Secondary

- **Rating Amber:** Identifies stars, ratings, and limited pending or attention states without becoming a general-purpose accent.

### Tertiary

- **Destructive Red:** Signals failures, destructive actions, and irreversible warnings.
- **Success Green:** Signals successful operations and the enabled state of the macOS-style toggle.

### Neutral

- **Calibrated Black:** The main image-proofing field; it recedes behind visual content.
- **Deep Canvas:** The darkest grounding layer for the app body and image wells.
- **Translucent Graphite:** Toolbar chrome that allows restrained material depth.
- **Solid Graphite:** Status bars and stable structural chrome.
- **Control Graphite:** Default control and contained surface fill.
- **Raised Graphite:** The top plane of chrome controls.
- **Hover Graphite:** A restrained state change for neutral controls.
- **Hairline Seam:** Default dividers and panel boundaries.
- **Strong Hairline:** Input outlines and boundaries requiring clearer affordance.
- **Proof White:** Primary text and critical image facts.
- **Muted Silver:** Secondary labels and inactive controls.
- **Quiet Gray:** Metadata, shortcuts, placeholders, and subordinate labels.

### Named Rules

**The Optical Focus Rule.** Blue means focus, selection, or a primary action; it must not become ambient decoration.

**The Amber Rating Rule.** Amber belongs to ratings and genuine attention states, never general navigation.

**The Images Own the Color Rule.** Product chrome stays nearly achromatic so photographs remain the richest color on screen.

## Typography

**Display Font:** None; this is a utility workspace, not an editorial surface.  
**Body Font:** SF system stack with Segoe UI fallback.  
**Label/Mono Font:** The system stack remains canonical; filenames, counts, dates, dimensions, and shortcuts use tabular numerals where applicable.

**Character:** Compact SF-style typography makes the interface feel native, fast, and unforced. Weight and contrast establish hierarchy; oversized type and decorative display faces do not belong in the working surface.

### Hierarchy

- **Headline** (600, compact 17px, tight 1.25 line height): Empty-state headings and rare high-level moments.
- **Title** (600, compact 15px, 1.3 line height): Window identity, inspector filenames, and primary local headings.
- **Body** (400, compact 12.5px, 1.45 line height): Controls, rows, descriptions, and working content.
- **Label** (600, utility 10.5px, tracked 0.055em): Uppercase sidebar groups and dense metadata labels.

### Named Rules

**The Working Scale Rule.** Most interface text stays between 10.5px and 15px; 17px is reserved for true headings, never routine control labels.

**The Tabular Facts Rule.** Counts, dates, dimensions, file sizes, ratings, and paths use stable-width numerals to prevent visual jitter during review.

## Layout

Genery uses Three-pane Proofing: a 58px unified toolbar above a 220px source rail, an adaptive center proof grid, a 350px contextual inspector, and a 35px status strip. The center pane is elastic and owns remaining width. Its grid uses a 155px minimum column width, 12px gaps, and 14px frame padding so density responds to the actual proofing area rather than the browser window.

At 1280px the side panes compress to 194px and 320px. At 1100px the source rail collapses. At 850px the inspector becomes a right-edge overlay drawer and lower-value toolbar labels disappear. At 620px the toolbar compacts to 54px, overflow controls move into a menu, and the proof grid becomes two columns with 9px gaps and padding.

Spacing follows a compact 4–17px rhythm. Hairline dividers establish pane ownership; uninterrupted canvas is preferred over nested card stacks. Controls may wrap or collapse, but required actions and a useful image area remain available.

**The Center Pane Rule.** Responsive decisions protect the proof grid first: collapse secondary chrome before reducing the image workspace below practical review density.

## Elevation & Depth

The system is flat and layered by tone at rest. One shallow structural shadow separates toolbar chrome, while a single deeper overlay tier lifts notices, drawers, menus, filters, and sheets. Selected images use a crisp blue ring, never a diffuse glow. Translucency and blur belong only to chrome and overlays where underlying context remains useful.

### Shadow Vocabulary

- **Chrome Edge** (`0 1px 0 rgba(0, 0, 0, 0.45)`): A single-pixel structural edge below the toolbar.
- **Control Bevel** (`inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 1px 2px rgba(0, 0, 0, 0.25)`): Gives compact neutral buttons a subtle native control plane.
- **Overlay Lift** (`0 18px 44px rgba(0, 0, 0, 0.38)`): Separates transient overlays and the narrow inspector drawer from the workspace.
- **Sheet Lift** (`0 28px 90px rgba(0, 0, 0, 0.58), 0 1px 0 rgba(255, 255, 255, 0.05) inset`): Reserved for modal sheets above a dimmed backdrop.

### Named Rules

**The Flat Proof Rule.** Gallery cells remain flat at rest; focus is expressed by a crisp border and ring rather than elevation.

**The One Overlay Plane Rule.** Deep shadow is reserved for content that temporarily sits above the proofing workspace.

## Shapes

The form language is compact and gently machined. Dense badges use 4px corners, icon and segmented-control elements use 5px, standard controls use 7px, proof cells and field containers use 8px, and modal sheets use 10px. A 13px radius is reserved for the larger empty-state icon tile. Pills are limited to toggles, scrollbars, and removable tag forms; image surfaces are never pill-shaped.

Borders are one-pixel hairlines. Media is clipped to restrained rounded rectangles, while full-width inspector previews stay square to the panel edges. The three macOS traffic lights are the only recurring ornamental circles.

**The Tight Corner Rule.** Control radii stay smaller than sheet radii so hierarchy is felt without bubbly card-wall styling.

## Components

Components should feel restrained and tactile: compact enough for repeated use, but explicit in hover, focus, pressed, selected, disabled, and error states.

### Buttons

- **Shape:** Gently machined control corners for standard actions; compact corners for icon-only and segmented controls.
- **Primary:** Optical blue fill, white text, compact horizontal padding, and 34px control height. Use only for the leading action in a local context.
- **Hover / Focus:** Neutral buttons brighten by one graphite step; primary buttons shift to brighter blue. Keyboard focus is always a 2px blue outline with 2px offset, and press translates by 1px where appropriate.
- **Secondary / Ghost:** Secondary controls use the raised-to-base graphite gradient with a strong hairline. Ghost controls are reserved for embedded actions inside an already-bounded region.

### Chips

- **Style:** Compact blue-tinted tag chips use proof-blue text on a translucent blue field with tight corners.
- **State:** Selected filter chips may strengthen both tint and border; removable modal tags may become pills, but passive proof-card tags remain compact rectangles.

### Cards / Containers

- **Corner Style:** Proof cells use restrained surface corners, with the image inset one radius step tighter.
- **Background:** Proof cells are transparent at rest and receive only a faint tonal wash on hover or focus.
- **Shadow Strategy:** No card shadow; focused cells use a crisp optical-blue border and ring.
- **Border:** Transparent at rest so the grid reads as a contact sheet, not a wall of boxes.
- **Internal Padding:** Metadata uses tight vertical spacing beneath an image-dominant 4:3 preview.

### Inputs / Fields

- **Style:** Dark inset fields use a strong hairline, compact 7–8px corners, proof-white text, and quiet placeholder copy.
- **Focus:** The global 2px optical-blue focus outline is mandatory; editor fields may also shift the border to blue.
- **Error / Disabled:** Errors pair destructive red with text or icon explanation. Disabled controls reduce prominence while retaining legibility and semantic shape.

### Navigation

Source navigation uses compact 31px rows, quiet silver labels, 15px icons, and tabular counts. The active row becomes a solid blue selection with white content. On narrower screens, the entire source rail collapses before the proof grid is compromised.

### Proof Cell

The proof cell is the signature component: a dominant 4:3 image, restrained filename and facts, amber rating, compact tag state, and controls revealed only when needed. Hover may scale the image by 1.015 over 220ms; focus and selection remain independently legible.

### Inspector and Sheets

The inspector is persistent context, not a dashboard card. Its sections are separated by hairlines and its file facts align label/value pairs. Modal sheets use graphite translucency, the single sheet shadow tier, 10px corners, clear title and action zones, and explicit destructive warnings.

## Do's and Don'ts

### Do:

- **Do** keep images dominant and chrome nearly achromatic.
- **Do** use optical blue only for focus, selection, active navigation, and primary actions.
- **Do** use amber for rating and genuine attention states.
- **Do** preserve compact density, keyboard access, visible focus, and tabular file facts.
- **Do** use hairline seams and tonal layers to express structure before adding shadows.
- **Do** collapse secondary panes and labels before sacrificing a useful proof-grid area.
- **Do** pair color with shape, text, iconography, or position for selection, failure, and status.

### Don't:

- **Don't** turn the workspace into a generic dashboard wall of boxed cards.
- **Don't** use large marketing typography, decorative gradients, or ornamental color in the working interface.
- **Don't** use blue or amber as ambient decoration; every accent must communicate state or action.
- **Don't** add diffuse glows or card shadows to gallery cells.
- **Don't** make dense controls pill-shaped or inflate their spacing for casual-app aesthetics.
- **Don't** hide destructive meaning, keyboard focus, or recovery feedback behind color alone.
