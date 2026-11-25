# Changelog

## 2026-11-25 — Android manifest & sync log hardening

- Set `android:allowBackup="false"` in `AndroidManifest.xml` so OS/ADB backups cannot extract local SQLite progress databases or PKCE pending preferences (tokens remain Keystore-encrypted in `noBackupFilesDir`).
- Removed raw HTTP response body snippets and full endpoint URLs from `SyncEngine` failure logs (`error` code / path / status only).

## 2026-11-25 — Cloud login and sync reliability (`Qiraat-Cloud-Sync-v9.apk`)

- Fixed Android OAuth token refresh races and silent sync failures (`SyncEngine.kt`, `CloudAccount.kt`): serialized token refreshes under a single-flight `Mutex` with double-checked expiry validation so concurrent sync passes (`LiveSync` 5-second loop, launch sync, manual sync) cannot reuse an already-rotated refresh token and trigger Neon Auth refresh-family revocation (`invalid_grant: session not found`).
- Added direct `/oauth2/token` refresh in `SyncEngine` with the `resource` (`origin`) parameter, one-time retry on HTTP `401` via forced refresh, and clear `QiraatSync` diagnostics.
- Distinguished permanent `400`/`401` `invalid_grant`/`invalid_client` token errors (clears the dead session and surfaces an explicit re-login message) from transient offline/`5xx` errors (preserves the session and retries automatically).
- Fixed `NativeSignIn.submit` dismissing the sign-in dialog as successful when `CloudAccount.finishSignIn` caught an error internally; now verifies an active session ID was saved and displays `CloudAccount.error` in place.
- Fixed the quick Google sign-in button on `CloudAccountScreen` in patched APKs passing `AuthMode.SIGN_IN` instead of `AuthMode.GOOGLE` (`patch_approved_apk.py`), widened `v4` smali token/account HTTP timeouts from 15s to 30s (`0x3a98` -> `0x7530`) for Neon Compute cold starts, made `NativeSignIn` scrollable with IME padding, and resolved relative OAuth redirects against the issuing URL (`CloudAuthClient.kt`).
- Added unit tests in `SyncEngineTest.kt` and `CloudAuthClientTest.kt` (`100` unit tests passing, `0` failed).

## 2026-11-24 — Reader: the header always stays, and the empty strip under the page shows and hides the footer (`Qiraat-Cloud-Sync-v8.apk`)

- Tapping the page used to hide the header and the footer together. Now only the footer hides; the header (surah, juz', page, memorization status, bookmark star) is always shown.
- With the footer hidden, the empty strip where it was did nothing, so the only way back was to tap the page. That strip is a plain spacer that was zero wide in its column, so it could not be tapped. It is now full width and a tap on it shows the footer; a tap beside the footer capsule hides it again (`ReaderChromeTap`). The 10-second auto-hide still applies to the footer only.
- Patched into the approved APK: `ReadyReader`'s header flag is forced on and the spacer gets the tap target; the new class goes into `classes12.dex` and `classes3.dex` is the fourth patched shard. Verified on the emulator and on the phone (hide by tapping the page, show by tapping the strip; the header stayed).

## 2026-11-24 — Android khatma statistics screen matches iOS (`Qiraat-Cloud-Sync-v7.apk`)

- The khatma percentage showed 0%: it was read from a stored column that is never updated. It is now counted in Mushaf pages from the pages saved with each read ayah, like iOS (`KhatmaProgress`): below 100% until every ayah has been read. The summary also shows pages read and left, lifetime time, reading days, ayahs and completed khatmas.
- The daily chart is tappable: touch a bar to see that day's ayahs, pages or juz' and its reading time; touch again to clear. It also has the iOS metric picker (ayahs / pages / juz'), the 7 / 14 / 30 day menu, the average / total / peak summary and a daily history card.
- Surah cards use the iOS compact row (completed rows are no longer taller), the iOS search field, filter chips with counts and swipe to complete or undo a surah; the continue-reading card names the surah and ayah.
- Same palette, spacing and left-to-right layout as the iPhone screen (`KhatmaStatsUi.kt`), light and dark. The reading code is `khatmaPercent` (3 new tests; 95 unit tests pass).
- The approved APK is patched the same way as before: `ReadingStatisticsScreen` forwards to the new screen, the new classes go into `classes12.dex`, and `classes9.dex` is the third patched shard. The patch script now also checks that every member the new code calls exists in the approved app.
- Verified on the emulator (screen, chart tap, swipe to complete). Installed on the phone, not opened there because it was locked.

## 2026-11-24 — Approved APK v4 patched: in-app sign-in and sign-up, working live sync (`Qiraat-Cloud-Sync-v6.apk`)

- Built from the approved `Qiraat-Cloud-Sync-v4.apk` (0.4.4-cloud-sync, versionCode 5), not from source: only `classes5.dex` and `classes6.dex` change and `classes12.dex` is added. Every other entry (reader, icon, banner, import/export, resources) is byte-identical. Reproduce with `scripts/patch_approved_apk.py`.
- Sign-in and sign-up: the account screen's own buttons now open an in-app dialog (`NativeSignIn`) instead of a Custom Tab. It gets the authorization code through `CloudAuthClient` and passes it to the approved module's own `finishSignIn`, so token storage, the account card and setup behave as before. Google still uses the browser.
- Sync: the approved sync failed for real accounts (`reading_deletions ORDER BY id` on a table with no `id`, an empty baseline hash after choosing the cloud copy, a conflict on a first memorization sync). `CloudAccount.sync` now runs `SyncEngine`, the algorithm used on iOS, and drives the same busy/error/conflict/last-sync state, so the screens and conflict dialog are unchanged.
- Live sync: `LiveSync` replaces the single sync per resume with a sync every 5 seconds while the app is open, waiting for the reader's databases first so launch no longer shows a false error.
- Verified on the emulator against the live Neon project: sign-up in the dialog, cloud change adopted by the app within 5 seconds, local change uploaded within one cycle, baseline equal to the cloud revision.
- Google: v4's "Continue with Google" button called the same sign-in as the main button and relied on the browser page for the Google choice, so the in-app dialog hid it. The dialog now has a "المتابعة بحساب Google" button that opens that browser page; the rest of the Google round trip is v4's own. Checked up to Google's own sign-in page (Neon's Google client is accepted, no redirect or client error); the Google login itself needs your Google account and was not completed here.
- Phone sync error fixed (found on a real Samsung A24): the exchange used `SELECT *` and positional inserts, which break on older database layouts. The phone's `reading_deletions` has 4 columns where the cloud format has 6, and an iPhone database stores `reading_days` with `last_read_at` and `seconds_read` swapped, so values would have crossed between devices. `SnapshotIO` now reads and writes every table by column name in one fixed order; a table that lacks the expected columns (the phone's `reading_deletions`) is skipped in both directions, and the cloud's deletion records are remembered and sent back unchanged so an Android upload does not erase them. The error banner now names the failing step, and the patch script fails the build if a patched call points at a class that is not packaged (a missing `SnapshotIO` had silently stopped the loop).
- Large histories: requests allow 2 minutes and stream the upload; the periodic pass skips reading the database when nothing changed (it compares the database files and asks the cloud only for its revision); a person's tap on a sync or conflict button waits for the running pass instead of being dropped; an open conflict no longer re-downloads the snapshot every 5 seconds.
- Account details: the account card shows the email and name. The tokens carry neither and the server's `/v1/account` returns only the id, so the sign-in dialog passes what was typed to the approved `finishSignIn`, which stores it like any other account. Signed in before this build, or with Google: the card keeps its short-id name until you sign in again with email.
- Signing: v4 was signed with a key that is not on this Mac, so v6 is signed with this machine's debug key. Uninstall v4 before installing v6 (progress that was synced stays in the cloud).

## 2026-11-24 — In-app sign-in and sign-up, 5-second live sync (source build 0.4.3-native-auth, versionCode 4)

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
