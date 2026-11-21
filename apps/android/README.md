# Qiraat Android — Phase 3

Native Kotlin/Jetpack Compose port of the iOS Mushaf reader. Phase 3 adds the local Mutashabihat library/editor and indexed Quran search while retaining the Phase 1 reader and Phase 2 offline Qiraat layer.

The four-item RTL footer reaches المصحف، المتشابهات، البحث، and القراءات. Mutashabihat supports magazine/list browsing, coloured group detail, transactional create/edit/delete, adding Quran ayat, and live Arabic word differences. Quran search supports the iOS smart/exact/broad normalization, advanced AST query language, morphology lexicon, guide examples, result-to-reader navigation, and ayah highlighting.

## Asset strategy

The debug APK bundles all 604 QCF V2 fonts as TTF plus the schema-v2 `mushaf.sqlite` and the iOS `mutshabehat.sqlite` seed. Android cannot load the iOS WOFF2 files directly. `scripts/convert_fonts.py` converts each page font independently with fontTools/brotli; the runtime will only load `pN.ttf` for page N and never substitutes a different page font. Tokens containing spaces are split into page-font glyph runs plus a system-font space, preserving the iOS `QCFFontStore.line` rule for all 198 affected tokens.

The generated databases and fonts are gitignored for licensing/data-size reasons. `scripts/prepare_assets.py` idempotently copies the Mutashabihat seed and Qiraat resources; the app copies the seed to private no-backup storage before opening it read/write behind `MutshabehatStore`.

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

On first launch, the bundled Mushaf database is copied atomically and opened read-only. The Mutashabihat seed is copied separately and opened read/write in private app storage.

## Known differences from iOS

- Compose uses a page-slide pager, not the UIKit/iBooks page curl.
- The current surah banner is a native drawn cartouche rather than the iOS selectable illuminated banner asset system.
- The basmala slot uses the same canonical four Page 1 QCF glyphs as iOS. Quran page tokens themselves always use their own converted QCF page font.
- Sync/backup, review editing, memorization, statistics, and page curl remain outside the Android phase scope.
- No emulator is provisioned by this task, so the build and JVM core tests do not constitute visual-device verification.
