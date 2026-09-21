# Compact Qiraat Editor UX

The Phase 5 editor is an overlay-free split workspace on desktop and a full-height
responsive sheet on small viewports. The Mushaf pane and editor pane are siblings;
the editor owns its own `overflow-y-auto` scroll region with `overscroll-contain`,
so scrolling annotation fields never moves the Quran page.

## Entry and identity

Qiraat Edit Mode is enabled from the existing `ق` toolbar control (labelled
`وضع تحرير القراءات`). In edit mode, each rendered semantic word exposes its
canonical word id/key. Clicking a word opens the editor and applies a subtle
selected-word outline without changing the canonical text.

## Fast entry

The editor uses direct compact controls for Reader roots, Narrators, Usul/Farsh
type, taxonomy roots/children, and common structured face presets. Authority-to-rule
assignments are displayed as removable chips. Advanced corpus/framework, scope,
reading context, inheritance, sources, and notes remain collapsed until requested.

The sticky action bar belongs to the editor pane only and provides Save, Save &
Previous, Save & Next, and Cancel. Existing authenticated API writes, optimistic
concurrency checks, revision history, resolver invalidation, and resolved-cache
refresh are unchanged.

## Responsive behavior

At desktop widths the editor has a bounded 460px column beside the Mushaf. On
smaller widths the same editor switches to the existing fixed responsive sheet so
the page remains readable and controls remain reachable.

## Verification

The local browser smoke verifies the real word click, canonical key header, 200
editor load, direct controls, draft save and cleanup, one visible editor instance,
selected-word stability while the editor is scrolled, and zero page/console errors
at desktop and mobile viewports. Node 22 TypeScript checking passes.
