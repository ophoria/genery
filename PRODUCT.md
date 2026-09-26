# Genery

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Genery is a personal power tool for people who review, filter, rate, tag, annotate, and manage large collections of local images. Its primary user is comfortable with dense information, keyboard shortcuts, and direct filesystem concepts.

## Product Purpose

Genery makes large local image folders fast to inspect and organize without importing them into a hosted library. Success means that a user can scan a folder, narrow the result set, evaluate images, add metadata, and perform bulk file operations with minimal friction.

## Positioning

Unlike a conventional photo library, Genery operates directly on user-selected local directories and combines visual browsing with advanced filtering, keyboard-first curation, persistent metadata, and batch filesystem operations.

## Operating Context

The product runs locally in a desktop browser alongside the user's filesystem. The main workflow is folder selection, scanning, rapid thumbnail review, filtering and sorting, focused image inspection, rating/tagging/commenting, and optional bulk copy, delete, rename, or ZIP operations.

## Capabilities and Constraints

- React, TypeScript, Vite, Express, and Tailwind CSS.
- Local directory and recursive subdirectory scanning.
- Thumbnail generation and image metadata extraction.
- Search, basic filters, nested logical filters, and sorting.
- Keyboard and mouse navigation.
- Ratings, hashtags, and comments stored locally.
- Bulk copy, delete, rename, and ZIP operations.
- Existing functionality and direct filesystem behavior must be preserved during the redesign.

## Brand Commitments

- Product name: Genery.
- The interface should feel like a modern macOS power tool rather than a generic developer dashboard.
- Power-user speed, scanability, and information density must remain central.

## Evidence on Hand

- Existing feature descriptions and workflows in `README.md`.
- Working test gallery assets in `test-gallery/`.
- Existing UI implementation in `src/`.
- No external testimonials, benchmarks, marketing claims, or formal brand assets are present.

## Product Principles

1. Keep local files under the user's direct control.
2. Make repeated curation actions fast from the keyboard.
3. Show useful image information without competing with the images.
4. Keep destructive file operations explicit and understandable.
5. Preserve power while progressively revealing advanced controls.

## Accessibility & Inclusion

Maintain complete keyboard access, visible focus states, readable contrast in light and dark appearance, reduced-motion support, and clear non-color indicators for selection and status.
