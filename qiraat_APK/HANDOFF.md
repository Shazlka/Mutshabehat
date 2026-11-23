# Qiraat Android (APK) — Handoff

Date: 2026-11-23 · Branch: `qiraat_apk` · Repo: https://github.com/Shazlka/Mutshabehat

Native **Kotlin / Jetpack Compose** port of the Qiraat iOS app (Mushaf 1441 reader + القراءات العشر + المتشابهات + search + memorization). Built phase by phase by Codex and Antigravity (agy) under Claude's planning/review. This file is everything a new agent needs to continue.

## 1. Branch map

| Branch | What it holds |
|---|---|
| `main` | The Next.js **web app** (متشابهات V2) |
| `ios/main` | The **iOS app** (`apps/ios`, SwiftUI) — the reference implementation |
| `qiraat_apk` (this) | **Android app + handoff**. Orphan branch, contains only `qiraat_APK/` |

`qiraat_apk` is a permanent branch. It shares no history with the others; the original Android commit history lives on `ios/main` (commits below).

## 2. Folder layout

```
qiraat_APK/
  HANDOFF.md            this file
  android/              the Gradle project (open this in Android Studio / run ./gradlew here)
    app/src/main/java/com/shazlka/qiraat/{core,reader,mutshabehat,search,reading,memorization,settings,backup,ui}
    app/src/test/...    77 JVM unit tests (JUnit + Robolectric)
    scripts/            convert_fonts.py, prepare_assets.py (asset generation)
    verification/       emulator + real-phone screenshots from each phase
    CHANGELOG.md, README.md   (README still says "Phase 3": stale, this file wins)
  ios_reference/        copy of apps/ios as of 2026-11-23 (working tree, incl. uncommitted edits). READ-ONLY reference
  briefs/               the 9 prompts that produced each Android phase (useful as examples)
```

`ios_reference/` omits gitignored generated data (`Generated/` fonts + sqlite, `DerivedData`, `build`, `Config.xcconfig`, `Signing.xcconfig`). The last iOS edits (reading-statistics chart) were uncommitted on `ios/main` when copied, so that part may not compile on its own.

## 3. What exists (all verified by build + 77 JVM tests; screens checked on emulator, several on a real phone)

- **Reader**: 604-page RTL pager, per-page QCF V2 fonts, justified lines, surah banner + basmala, single page on phones / spread only on wide landscape, **vertical line stretching** to fill height (iOS rule), floating iOS-style footer bar (الفهرس · بحث · الفواصل · القراءات · المزيد · الإعدادات), 10 s chrome auto-hide.
- **Qiraat layer**: word marks (underline/dots per reader), tap → bottom sheet with iOS-style **variant/ruling cards**, reader pills, classification line, references row, compare view, reader/narrator picker, legend, page summary, usul index, mutoon viewer, qiraat search.
- **Mutashabihat**: library (magazine/list), group detail with live Arabic diff, editor (local SQLite), seed from `mutshabehat.sqlite`.
- **Search**: iOS advanced AST query language + morphology lexicon, results open the reader highlighted.
- **Reading / memorization / settings / backup**: reading stats + khatma, bookmarks, memorization dashboard/update/history, appearance (light/dark/sepia…), local JSON backup via Storage Access Framework (iOS-compatible export).

## 4. Build and run

Toolchain used (macOS, Apple Silicon): JDK 17 (`brew install openjdk@17`), Android cmdline-tools + `platforms;android-35`, `build-tools;35.0.0`, `platform-tools`, Gradle wrapper included. `minSdk 26`, `targetSdk/compileSdk 35`, package `com.shazlka.qiraat`.

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17 PATH=/opt/homebrew/opt/openjdk@17/bin:$PATH
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
cd qiraat_APK/android
echo "sdk.dir=$ANDROID_HOME" > local.properties
./gradlew clean testDebugUnitTest assembleDebug       # expect 77 tests, 0 failures
# APK: app/build/outputs/apk/debug/app-debug.apk  (~154 MB, debug-signed)
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### Generated assets (NOT in git — licence/size)

The app bundles 604 QCF fonts (converted to TTF), `mushaf.sqlite` (54 MB), the Qiraat JSON (`assets/qiraat`, `assets/qiraat_mutoon`, `assets/qiraat_references`, ~50 MB) and the mutashabihat seed (`assets/data/mutshabehat.sqlite`). They are produced from the iOS build outputs:

1. On the iOS side: `cd apps/ios && make fonts && make all` (on `ios/main`; needs `brew install xcodegen`) produces `Generated/{Fonts/p1..p604.woff2, mushaf.sqlite, Qiraat, QiraatMutoon, QiraatReferences, mutshabehat.sqlite}`. Sources for the sqlite come from `packages/quran-data/mushaf1441/fixtures` on `main`.
2. Android: `python3 -m venv venv && venv/bin/pip install fonttools brotli`, then `scripts/convert_fonts.py` (WOFF2 → TTF into `app/src/main/assets/fonts/`), copy `mushaf.sqlite` to `app/src/main/assets/data/`, run `scripts/prepare_assets.py` (see `android/README.md` for exact commands). The scripts hard-code `apps/ios/Generated` and `apps/android` paths — adjust to this folder layout or run them from a full checkout of `ios/main`.
3. Without these assets the project compiles but the reader has no fonts/data.

**Licence**: QCF fonts belong to the King Fahd Complex; do not commit them or publish an APK that bundles them without checking the licence. The current APK is for personal use. The Uthmanic Hafs OTF (`assets/fonts/uthmanic_hafs.otf`) is committed.

The latest APK was copied to the owner's Google Drive (My Drive → `Qiraat-android-debug.apk`).

## 5. Verification state — be honest about this

- Gates: `./gradlew clean testDebugUnitTest assembleDebug` green (77 tests). No instrumented/UI tests exist.
- Emulator (Pixel 6 AVD `qiraat_pixel_6`, Android 35 arm64, headless `-gpu swiftshader_indirect`) screenshots for every phase are in `android/verification/`.
- **Real phone** (Samsung SM-A245F, Android 16, 1080×2340 @ 450 dpi = 384×832 dp): the owner confirmed on-device an earlier build (single page, no clipping, new footer). A real-device run exposed a **two-page clipping bug the emulator missed** — fixed in phase 7. The **final build (commit 33275d3c, variant cards + stretched lines)** has NOT been confirmed on the phone by an agent (phone was not on adb); verify that first.
- Lesson: emulators with different density/font-scale hid a real bug. Test on the physical device; do not change its settings or touch the lock screen.

## 6. Known gaps / backlog

1. Confirm final build visually on the real phone (cards, stretched lines, footer menus).
2. iOS **page curl** and **iPad two-page spread** not ported (phones use a slide pager; spread rule exists in `core/Navigation.kt` for ≥1024 dp landscape but is unverified on a tablet).
3. **Sync** (iCloud/Supabase live sync) not ported; only local stores + JSON backup.
4. DEBUG-only **review editor** not ported (by design).
5. Mutoon verse view lacks iOS's per-grapheme inline symbol colouring.
6. System back gesture can dismiss bottom sheets instead of collapsing them.
7. Release path missing: release keystore/signing, R8/minify, AAB, Play listing; APK is 154 MB because fonts are bundled (consider on-demand font download).
8. Localisation: Arabic strings follow iOS `Localizable.xcstrings`; English parity unchecked.
9. `android/README.md` is stale (says Phase 3).
10. agy reported "exact iOS match" for footer/cards; only the reader footer and the مالك sheet were reviewed by a human against iOS code. Compare remaining screens against `ios_reference/Sources/**`.

## 7. Working agreement and tooling notes (important)

- Owner rule: **Claude plans/reviews; Codex and agy implement.** Every phase = brief (see `briefs/`) → implementer → reviewer re-runs the gates and looks at screenshots → commit. Never trust the implementer's "all passing": agy once claimed 59 passing while a clean build failed 29 (Robolectric home dir created at configuration time, deleted by `clean`; fixed with `doFirst { mkdirs() }` in `app/build.gradle.kts`).
- Codex: `codex exec -m gpt-5.6-sol --sandbox workspace-write -c 'sandbox_workspace_write.network_access=true' --cd <repo> --skip-git-repo-check -o out.txt - < brief.txt` (network needed for Gradle). It hit its usage limit mid-Phase 4.
- agy: `agy --add-dir <repo> --dangerously-skip-permissions --print "$(cat brief.txt)"`. Without `--dangerously-skip-permissions` it stalls silently (blocked on a permission prompt). The flag auto-approves all tool calls: the owner explicitly approved it for this project; keep the brief's scope tight ("do NOT touch apps/ios, src/, packages/", "do NOT commit").
- The delegate skills' `relay.mjs` was not present; direct CLI calls worked.
- Repo rule: every change must also be logged in root `CHANGELOG.md` and `CLAUDE.md` (newest first) on `ios/main`; this branch keeps its own `android/CHANGELOG.md`.
- Do not commit APKs, fonts, `local.properties`, `.gradle`, `build/`.

## 8. History (commits on `ios/main`, `apps/android`)

| Commit | Phase |
|---|---|
| 67080ee8 | 1–2 Gradle scaffold, reader, Qiraat layer |
| 832e4b74 | 3 Mutashabihat, Quran search, footer tabs |
| 458f8857 | 4 Reading stats, khatma, bookmarks, memorization, settings, backup |
| 3ad2ce17 | 5 Emulator verification, status-bar inset, software canvas layer |
| 0677b075 | 6 Surah banner + glyph rendering fixes (hinting off, RTL piece order) |
| e182523f | 7 Single-page portrait pager, clipping fix, touch-slop gestures |
| 641be08a | 8 iOS-style single footer bar + variant/ruling cards |
| 33275d3c | 9 Full-height line stretching |

## 9. First 30 minutes for the next agent

1. Check out this branch, read this file, skim `android/app/src/main/java/com/shazlka/qiraat/reader/ReaderScreen.kt` and `core/PageLayout.kt`.
2. Regenerate assets (section 4), run the gates, install the APK on the phone, and compare page 1, a full page (26) and a Qiraat sheet with `ios_reference` behaviour.
3. Pick backlog items 1–2 first, then release signing (item 7).
