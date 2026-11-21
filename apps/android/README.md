# Qiraat Android — Phase 2

Native Kotlin/Jetpack Compose port of the iOS Mushaf reader. Phase 2 adds the offline Qiraat layer: the ten readers and narrators, فرش and أصول word marks, detail/peek/comparison UI, persisted reading preferences, page summaries, search, usul index, references, and the three متون with commentary/symbol data.

## Asset strategy

The debug APK bundles all 604 QCF V2 fonts as TTF plus the existing schema-v2 `mushaf.sqlite`. Android cannot load the iOS WOFF2 files directly. `scripts/convert_fonts.py` converts each page font independently with fontTools/brotli; the runtime will only load `pN.ttf` for page N and never substitutes a different page font. Tokens containing spaces are split into page-font glyph runs plus a system-font space, preserving the iOS `QCFFontStore.line` rule for all 198 affected tokens.

The generated database and fonts are gitignored for licensing/data-size reasons. The verified debug APK is **146,790,138 bytes (140 MiB)**, so the bundled strategy remains comfortably below the approximately 250 MB Phase 1 ceiling and avoids a network-dependent first run.

## Generate local assets

From the repository root (the virtual environment deliberately lives in scratch space):

```bash
python3 -m venv /private/tmp/qiraat-android-font-venv
/private/tmp/qiraat-android-font-venv/bin/pip install fonttools brotli
/private/tmp/qiraat-android-font-venv/bin/python apps/android/scripts/convert_fonts.py
mkdir -p apps/android/app/src/main/assets/data
cp apps/ios/Generated/mushaf.sqlite apps/android/app/src/main/assets/data/mushaf.sqlite
python3 apps/android/scripts/prepare_assets.py
```

## Build and test

```bash
cd apps/android
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export PATH="$JAVA_HOME/bin:$PATH"
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export ANDROID_USER_HOME=/private/tmp/qiraat-android-home
export GRADLE_USER_HOME=/private/tmp/qiraat-android-gradle
./gradlew testDebugUnitTest assembleDebug
```

APK: `app/build/outputs/apk/debug/app-debug.apk`

Install on an attached Android device:

```bash
$ANDROID_HOME/platform-tools/adb install -r app/build/outputs/apk/debug/app-debug.apk
```

On first launch, the bundled read-only database is copied atomically to the app's no-backup storage and then opened with `SQLiteDatabase.OPEN_READONLY`.

## Known differences from iOS

- Compose uses a page-slide pager, not the UIKit/iBooks page curl.
- The current surah banner is a native drawn cartouche rather than the iOS selectable illuminated banner asset system.
- The basmala slot uses the same canonical four Page 1 QCF glyphs as iOS. Quran page tokens themselves always use their own converted QCF page font.
- Sync/live overlays, review editing, Quran search, memorization, statistics, backup, and page curl remain outside the Android phase scope.
- No emulator is provisioned by this task, so the build and JVM core tests do not constitute visual-device verification.
