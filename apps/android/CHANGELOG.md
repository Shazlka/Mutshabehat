# Changelog

## 2026-11-21 — Android Phase 2

- Ported the offline Qiraat catalog/page models, loader, marks, filters, presentation, comparison, page summary, search, usul index, reading forms, references, and mutoon/sharh/symbol data.
- Added reader tint/underline marks, marked-word tap and long-press interactions, persisted reader/usul preferences, legend, comparison, and page summary UI.
- Added the Qiraat hub with usul, offline search, mutoon, and references, plus an idempotent generated-asset preparation script and JVM coverage for core rules and real bundled JSON.

## 2026-11-21 — Android Phase 1

- Added the native Kotlin/Jetpack Compose Android project and RTL Mushaf page reader.
- Ported the Phase 1 MushafCore models, schema-v2 read-only database access, geometry, navigation, and page-specific QCF font handling.
- Added deterministic WOFF2-to-TTF conversion, bundled offline assets, launcher icon, core unit tests, and build/install documentation.
