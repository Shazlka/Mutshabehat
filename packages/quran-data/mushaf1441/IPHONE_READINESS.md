# Mushaf 1441 iPhone Readiness

Phase 6 review for future iPhone and Capacitor conversion. This document records the preview module readiness state; it does not claim that verified Mushaf Al-Madinah 1441 data or the final 1441 font has been loaded.

## iPhone screen layout

The preview route uses one full-width Mushaf page area and a selected-ayah panel. On desktop the panel is a side panel. On mobile and iPhone it opens as a bottom sheet so the Mushaf page remains the primary reading surface.

## touch targets

Interactive controls in the Mushaf module should use 44px-compatible sizing. The implementation uses `min-h-11` or fixed `h-11` for controls, with larger tap areas for word, ayah, navigation, tab, close, and save/delete actions.

## RTL behavior

The viewer root explicitly sets `dir="rtl"`. Word rows also render inside RTL containers. Numeric metadata and technical ids may use `dir="ltr"` locally when needed.

## offline-first

Current page-word data is stored as immutable per-page JSON fixtures for pages 1-604. A future iPhone build should copy those page files into the app bundle and cache recently opened pages locally instead of adding a remote dependency for reading.

## localStorage

The viewer keeps the annotation draft cache in `mushaf1441:ayah-notes:v1` so the current note/highlight form state survives reloads. Saved notes, highlights, bookmarks, and favorites are synced through the preview Supabase annotation API when the user is authenticated.

## Capacitor

The module keeps the rendering surface isolated from persistence concerns. Draft state uses browser storage APIs that map cleanly to a later Capacitor storage replacement, while the Supabase annotation API remains a thin transport layer that can be swapped or wrapped later. Safe-area CSS uses native iPhone `env()` values.

## 604 pages

`pageLoader.ts` defines the 604-page contract with `MUSHAF_1441_PAGE_COUNT = 604` and lazy-loads one page fixture at a time from the QCF V2 page-word dataset.

## lazy loading

The renderer loads the initial page on the server, then fetches one page-word fixture per navigation through `/api/mushaf-1441/page-words`. Loaded pages are cached in the viewer.

## font loading

The preview loads the matching QCF V2 page font for each page. A future iPhone build should package these font files locally with documented licensing and a fallback path for offline use.

## safe area

The viewer accounts for `env(safe-area-inset-top)` on the page shell and `env(safe-area-inset-bottom)` on the mobile bottom sheet.

## Performance notes

The 604-page dataset is split into per-page files. Keep only recently loaded pages in memory, preserve dynamic imports or equivalent lazy loading in the native shell, and keep word geometry optional until verified layout data is available.
