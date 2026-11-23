# Phase 1 — word taps after startup

Work branch: `ios/word-context-fixes`, based on `a4732b03`.

## Root cause and reproduction

The reader starts iCloud synchronization after appearing. A successful snapshot install replaces
`MushafLibrary.qiraat`. Previously, the sync service announced `qiraatDatabaseDidUpdate`, but
`MushafPageView` only observed `qiraatPageDidChange`. Its cached word marks also determine which
words accept taps. New snapshot entries therefore remained untappable on an already laid-out
page. Recreating the page by turning away and back read the new store and rebuilt the marks.

A page detached from its window removes its observers. On returning at the same size, the layout
size guard also skipped rebuilding its marks. Both stale-state paths are covered by regression
tests in `MushafPageHitTestTests`.

The fixture copies the real bundled catalog and page-001 bytes unchanged into a temporary store.
It first models an unavailable page, then installs those exact bytes and announces the snapshot
update. Before the fix, both visible-page and detached-page tests failed with a nil tapped word
for the real word at 1:4:1. The existing first-layout path and reader/narrator changes passed.
This proves the snapshot-invalidation defect; reproduction of the owner's precise physical-device
session remains **UNVERIFIED**.

## Change

- Announce a successful snapshot replacement from `MushafLibrary`, covering iCloud, backup restore
  and explicit import, and remove the sync service's duplicate announcement.
- Observe that announcement in visible page views and immediately refresh the derived marks.
- Refresh marks when a page reattaches, including when its layout dimensions have not changed.
- Keep the existing layout, CoreText measurement, fonts, colours, hit-test geometry and sheet routing.
  No delays, page recreation or source-data changes are needed.

## Running the simulator checks safely

The ordinary UI launch helpers are not all isolated from iCloud. On a simulator, the sync service
can resolve the Mac's real `Mushaf_Qiraat` folder. The first baseline run reached that path and
wrote `ReadingDevices/94280f66-b236-4ff7-9b15-c9307a6a1fef.sqlite` at
2026-10-15 08:55:16 Asia/Dubai. That run was stopped; no iCloud files were deleted or rolled back by recovery actions.
The same run replaced `Backups/latest`, created `Backups/history/20261015-085105`, and added
a content-addressed Qiraat archive under `Backups/shared`. A read-only comparison found:

| Backup contents | Previous history `20261014-203947` | Affected latest/history |
|---|---:|---:|
| Memorized ayahs / events | 1,357 / 1,357 | 0 / 0 |
| Memorization batches | 69 | 0 |
| Reading completion rows | 11,128 | 11,128 |
| Reading activity events | 72 | 72 |
| Mutshabehat and Qiraat notes files | unchanged hashes | unchanged hashes |

The previous history backup remains available. These counts do not establish that the live device
state changed, or that every reading field is identical. History retention effects are unverified.
No restoration is authorized by this UI task. A proposed recovery is to preserve local copies of
both complete backups and referenced archives, validate hashes against each manifest, then replace
only `Backups/latest` with the intact previous history backup. This would restore that older
memorization snapshot as the latest restore candidate, but could omit progress since its timestamp;
it requires explicit approval before changing iCloud. The simulator reading-device file should be
inspected separately before any removal, because its records may include merged personal history.
The previously completed unit suites passed, but that interrupted UI run is not full acceptance.

Use the snapshot test wrapper for this task and subsequent phases:

```sh
python3 scripts/test_existing_snapshot.py \
  --destination 'platform=iOS Simulator,id=4206C7E5-E9C7-47BD-BFE3-389CD07F60D0' \
  --result-bundle /tmp/qiraat-phase1-check.xcresult
```

The wrapper builds tests without fetching or generating Quran/Qiraat data, sets
`QIRAAT_TEST_ISOLATION=1` for both test hosts and UI target apps, then runs the existing suites.
In DEBUG only, that flag blocks iCloud folder resolution and the real Qiraat network fetch, and
loads the bundled snapshot rather than an installed import or live overlay. Mock live-sync tests
still exercise their injected transports. Release and ordinary app launches retain their behavior.
`--skip-build` reuses existing test products; arguments after `--` go to `xcodebuild`, for example
`-only-testing:MutshabehatTests/MushafPageHitTestTests`.

## Physical-device checklist — UNVERIFIED

- Cold launch and immediately tap coloured words without turning a page.
- Let the existing startup iCloud sync finish; tap newly available entries on the same page.
- Repeat after background/resume and returning from settings or another reader destination.
- Change reader and narrator, then tap the currently marked words.
- Check diacritics, small alif, combining signs, rub-al-hizb tokens and line/page-edge words.
- Confirm Arabic fonts, colours, page appearance and normal page gestures are unchanged.

No physical device was used and no physical-device performance numbers are claimed.

## Verification record

- Before the behavior fix: 48 Python data checks, 439 core tests and the original 273 app unit
  tests passed. The two new snapshot/hit-map regressions then failed as expected.
- The full isolated baseline completed with 373 passes, 3 failures and 4 iPad-only skips.
  One failure was the folder-discovery test's old expectation of real host access; that test
  now asserts that isolated runs cannot resolve that folder.
- Two other baseline failures are existing `QiraatLocalizationUITests` assertions looking for
  separate `Orthography` / `رسم` static-text badges. The current classification view exposes a
  combined accessible classification label. No localization file was changed for this task.
- After the fix: all 12 focused checks passed (six page hit-map tests, the isolated-folder test,
  and five Qiraat UI tests including cold launch/background/settings).
- The DEBUG test build reported only the same three App Intents metadata notices as the baseline;
  no new compiler warnings were introduced.
