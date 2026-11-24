# Changelog

## 2026-11-24 — In-app sign-in and sign-up, 5-second live sync (build 0.4.3-native-auth, versionCode 4)

- Account & Sync has a native email/password form (sign in or create account), matching iOS. No browser or Custom Tab opens: `CloudAuthClient` runs the Better Auth sign-in and OAuth continue/consent exchange in-app with an in-memory cookie jar. The password is never stored; tokens stay in the Keystore-encrypted file. Sign-out revokes the refresh token. Google remains the only browser path.
- Foreground sync runs every 5 seconds (was 60).
- Tests: `CloudAuthClientTest` (9). APK: `dist/Qiraat-Cloud-Sync-v5.apk`, built from source (the AGY-merged line has no sources and keeps the browser sign-in).

## 2026-11-24 — Cross-platform Qiraat progress sync

- Android build 0.4.2-agy-cloud-sync applies account sync to the November 23 approved AGY APK, retaining its updated reader, app icon, illuminated banner, and manual khatma import and export. The merge script verifies the two approved input APKs before packaging.
- Android build 0.4.1-cloud-sync increments the package version to 2 and packages account sync on the approved Android reader baseline.
- Added account-scoped sync for khatma, reading activity, memorization, review history, and goals across iOS and Android. Added email registration, email sign-in, and development Google sign-in through Neon Auth.
- Added a dedicated Neon development database and Function. Progress is isolated by account in PostgreSQL and in the apps' local SQLite files. Guest progress can be copied into an empty account dataset. Concurrent changes prompt for a choice before replacing either version.

## 2026-11-21 — Android Phase 5

- Installed Android 35 ARM64 system image and emulator tools, created Pixel 6 AVD (`qiraat_pixel_6`) with 3 GB RAM and 10 GB data partition, and booted headless.
- Verified package `com.shazlka.qiraat` installation, launch, and crash-free execution.
- Exercised and visually verified all destinations with screenshots under `apps/android/verification/`: Mushaf Page 1, swipe to Page 2, Qiraat sheet on marked word, Mutashabihat library, Quran search query, Memorization tab, and Settings tab.
- Fixed header status bar overlap cut-off via `statusBarsPadding()` on root container in `ReaderScreen.kt`.
- Fixed 2D canvas rasterization for custom QCF PUA fonts by setting `LAYER_TYPE_SOFTWARE` in `MushafPageCanvas.kt`.
- Created final installable APK at `apps/android/dist/Qiraat-android-debug.apk` (147 MB) with all 59 unit tests passing.


## 2026-11-21 — Android Phase 3

- Ported the Mutashabihat models, transactional local SQLite store, 251-group bundled seed, Arabic live word diff, library/detail/editor screens, and explicit auto-colour workflow.
- Ported Quran normalization, the full iOS morphology lexicon, advanced-query AST parser/data/engine, smart/exact/broad indexed search, advanced guide, result navigation, and reader ayah highlighting.
- Added the RTL Reader/Mutashabihat/Search/Qiraat footer, idempotent seed preparation, and JVM/Robolectric coverage against both real bundled databases.

## 2026-11-21 — Android Phase 2

- Ported the offline Qiraat catalog/page models, loader, marks, filters, presentation, comparison, page summary, search, usul index, reading forms, references, and mutoon/sharh/symbol data.
- Added reader tint/underline marks, marked-word tap and long-press interactions, persisted reader/usul preferences, legend, comparison, and page summary UI.
- Added the Qiraat hub with usul, offline search, mutoon, and references, plus an idempotent generated-asset preparation script and JVM coverage for core rules and real bundled JSON.

## 2026-11-21 — Android Phase 1

- Added the native Kotlin/Jetpack Compose Android project and RTL Mushaf page reader.
- Ported the Phase 1 MushafCore models, schema-v2 read-only database access, geometry, navigation, and page-specific QCF font handling.
- Added deterministic WOFF2-to-TTF conversion, bundled offline assets, launcher icon, core unit tests, and build/install documentation.
