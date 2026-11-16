# iOS parity (phone width) — 2026-11-16

Goal: the web app at phone width (<768px) matches the native Qiraat iOS app (`~/Projects/qiraat-ios/apps/ios`, branch `ios/main`): themes, features, menus. Desktop layout stays as it is.

Rules: iOS is the visual/behavioural reference; web data stays the source of truth. iOS reading/memorization data is on-device, so on web it is client-side (IndexedDB), with no DB migration.
Audits: `AUDIT-reader-qiraat-2026-11-16.md`, `AUDIT-groups-reading-memorization-2026-11-16.md`. Progress is logged in the root `CHANGELOG.md`.
