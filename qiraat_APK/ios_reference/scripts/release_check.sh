#!/usr/bin/env bash
# Release-readiness check for a built Mutshabehat .app (or an .xcarchive) before App Store upload.
#
#   scripts/release_check.sh                      # newest DerivedData/Build/Products/Release-*/Mutshabehat.app
#   scripts/release_check.sh path/to/Mutshabehat.app
#   scripts/release_check.sh --archive path/to/Mutshabehat.xcarchive
#
# Prints PASS / FAIL / WARN per check and exits 1 when any check FAILs (2 on a usage error).
# ALLOW_SHARH=1 allows bundled *-sharh.json files (only once their copyright is cleared).
# macOS tools only: plutil, PlistBuddy, strings, codesign, du (plus grep/find/sed/awk).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IOS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCES_DIR="$IOS_DIR/Sources"
PLISTBUDDY=/usr/libexec/PlistBuddy

FAILS=0
WARNS=0
if [ -t 1 ]; then G=$'\033[32m'; R=$'\033[31m'; Y=$'\033[33m'; N=$'\033[0m'; else G=; R=; Y=; N=; fi
pass() { printf '%sPASS%s  %s\n' "$G" "$N" "$*"; }
fail() { printf '%sFAIL%s  %s\n' "$R" "$N" "$*"; FAILS=$((FAILS + 1)); }
warn() { printf '%sWARN%s  %s\n' "$Y" "$N" "$*"; WARNS=$((WARNS + 1)); }
info() { printf '      %s\n' "$*"; }
# rel PREFIX TEXT -> TEXT with every PREFIX removed and newlines joined by ", " (bash 3.2-safe).
rel() { printf '%s' "$2" | awk -v p="$1" 'BEGIN{ORS=""} {n=index($0,p); while(n){ $0=substr($0,1,n-1) substr($0,n+length(p)); n=index($0,p)} print (NR>1?", ":"") $0}'; }
section() { printf '\n== %s\n' "$*"; }

usage() {
  sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
  exit 2
}

# ---------------------------------------------------------------- arguments
APP=""
ARCHIVE=""
while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help) usage ;;
    --archive) [ $# -ge 2 ] || usage; ARCHIVE="$2"; shift 2 ;;
    -*) echo "unknown option: $1" >&2; usage ;;
    *) [ -z "$APP" ] || usage; APP="$1"; shift ;;
  esac
done

if [ -n "$ARCHIVE" ]; then
  [ -z "$APP" ] || { echo "give either an .app or --archive, not both" >&2; exit 2; }
  [ -d "$ARCHIVE" ] || { echo "no such archive: $ARCHIVE" >&2; exit 2; }
  APP="$(find "$ARCHIVE/Products/Applications" -maxdepth 1 -name '*.app' -type d 2>/dev/null | head -n 1 || true)"
  [ -n "$APP" ] || { echo "no .app under $ARCHIVE/Products/Applications" >&2; exit 2; }
elif [ -z "$APP" ]; then
  # Newest Release build of any platform (ls -td sorts by modification time, newest first).
  APP="$(ls -td "$IOS_DIR"/DerivedData/Build/Products/Release-*/Mutshabehat.app 2>/dev/null | head -n 1 || true)"
  [ -n "$APP" ] || { echo "no Release build under $IOS_DIR/DerivedData/Build/Products/Release-*/ (build one, or pass a path)" >&2; exit 2; }
fi
APP="${APP%/}"
[ -d "$APP" ] || { echo "no such app bundle: $APP" >&2; exit 2; }
INFO="$APP/Info.plist"
[ -f "$INFO" ] || { echo "no Info.plist in $APP" >&2; exit 2; }

# plist_raw FILE KEYPATH -> prints the value (arrays/dicts print their count); empty and status 1 if absent.
plist_raw() { plutil -extract "$2" raw -o - "$1" 2>/dev/null; }
plist_has() { plutil -extract "$2" xml1 -o - "$1" >/dev/null 2>&1; }

EXEC_NAME="$(plist_raw "$INFO" CFBundleExecutable || true)"
[ -n "$EXEC_NAME" ] || EXEC_NAME="$(basename "$APP" .app)"
BINARY="$APP/$EXEC_NAME"

echo "Release check: $APP"
[ -z "$ARCHIVE" ] || echo "Archive:       $ARCHIVE"
echo "Bundle id:     $(plist_raw "$INFO" CFBundleIdentifier || echo '?')   platform: $(plist_raw "$INFO" DTPlatformName || echo '?')"

# ---------------------------------------------------------------- 1. privacy manifest
section "1. Privacy manifest (PrivacyInfo.xcprivacy)"
PRIV="$APP/PrivacyInfo.xcprivacy"
if [ ! -f "$PRIV" ]; then
  fail "PrivacyInfo.xcprivacy is not in the bundle (Sources/PrivacyInfo.xcprivacy exists? add it to the app target's resources)"
elif ! plutil -lint -s "$PRIV" >/dev/null 2>&1; then
  fail "PrivacyInfo.xcprivacy is not a valid plist: $(plutil -lint "$PRIV" 2>&1 | tail -n 1)"
else
  pass "PrivacyInfo.xcprivacy present and valid plist"
  tracking="$(plist_raw "$PRIV" NSPrivacyTracking || true)"
  if [ "$tracking" = "false" ]; then pass "NSPrivacyTracking = false"
  else fail "NSPrivacyTracking must be false (found: ${tracking:-missing})"; fi

  # Collect "Category:reason1,reason2" lines for every accessed-API entry.
  api_lines=""
  n="$(plist_raw "$PRIV" NSPrivacyAccessedAPITypes || echo 0)"
  i=0
  while [ "$i" -lt "${n:-0}" ]; do
    cat_="$(plist_raw "$PRIV" "NSPrivacyAccessedAPITypes.$i.NSPrivacyAccessedAPIType" || true)"
    m="$(plist_raw "$PRIV" "NSPrivacyAccessedAPITypes.$i.NSPrivacyAccessedAPITypeReasons" || echo 0)"
    reasons=""
    j=0
    while [ "$j" -lt "${m:-0}" ]; do
      reasons="$reasons,$(plist_raw "$PRIV" "NSPrivacyAccessedAPITypes.$i.NSPrivacyAccessedAPITypeReasons.$j" || true)"
      j=$((j + 1))
    done
    api_lines="$api_lines$cat_:$reasons,"$'\n'
    i=$((i + 1))
  done
  has_reason() { printf '%s' "$api_lines" | grep -q "^$1:.*,$2,"; }

  if has_reason NSPrivacyAccessedAPICategoryUserDefaults CA92.1; then pass "UserDefaults declared with reason CA92.1"
  else fail "NSPrivacyAccessedAPICategoryUserDefaults with reason CA92.1 is missing"; fi
  if has_reason NSPrivacyAccessedAPICategoryFileTimestamp C617.1 || has_reason NSPrivacyAccessedAPICategoryFileTimestamp 3B52.1; then
    pass "File timestamp declared with reason C617.1 or 3B52.1"
  else fail "NSPrivacyAccessedAPICategoryFileTimestamp with reason C617.1 or 3B52.1 is missing"; fi
fi

# ---------------------------------------------------------------- 2. Info.plist
section "2. Info.plist"
enc="$(plist_raw "$INFO" ITSAppUsesNonExemptEncryption || true)"
if [ "$enc" = "false" ]; then pass "ITSAppUsesNonExemptEncryption = false"
else fail "ITSAppUsesNonExemptEncryption must be false (found: ${enc:-missing}); without it every upload asks the export-compliance question"; fi

short="$(plist_raw "$INFO" CFBundleShortVersionString || true)"
build="$(plist_raw "$INFO" CFBundleVersion || true)"
if [ -n "$short" ]; then pass "CFBundleShortVersionString = $short"; else fail "CFBundleShortVersionString is not set"; fi
if [ -n "$build" ]; then pass "CFBundleVersion = $build"; else fail "CFBundleVersion is not set"; fi

if plist_has "$INFO" UILaunchScreen; then pass "UILaunchScreen present"
else fail "UILaunchScreen is missing"; fi

ats_bad=""
for k in NSAllowsArbitraryLoads NSAllowsArbitraryLoadsInWebContent NSAllowsArbitraryLoadsForMedia; do
  v="$(plist_raw "$INFO" "NSAppTransportSecurity.$k" || true)"
  [ "$v" != "true" ] || ats_bad="$ats_bad $k"
done
if [ -z "$ats_bad" ]; then pass "no NSAllowsArbitraryLoads in NSAppTransportSecurity"
else fail "App Transport Security is disabled:$ats_bad = true"; fi

# ---------------------------------------------------------------- 3. developer strings in the binaries
section "3. No developer/editor strings or secrets in the binaries"
binaries=()
[ -f "$BINARY" ] && binaries+=("$BINARY")
while IFS= read -r f; do binaries+=("$f"); done < <(
  { find "$APP/Frameworks" -maxdepth 1 -name '*.dylib' -type f 2>/dev/null
    for fw in "$APP"/Frameworks/*.framework; do
      [ -d "$fw" ] && [ -f "$fw/$(basename "$fw" .framework)" ] && echo "$fw/$(basename "$fw" .framework)"
    done
    for ex in "$APP"/PlugIns/*.appex; do
      [ -d "$ex" ] || continue
      e="$(plist_raw "$ex/Info.plist" CFBundleExecutable || true)"
      [ -n "$e" ] && [ -f "$ex/$e" ] && echo "$ex/$e"
    done; } 2>/dev/null || true)
if [ "${#binaries[@]}" -eq 0 ]; then
  fail "no executable found at $BINARY"
else
  info "scanning: ${binaries[*]#"$APP/"} + Info.plist"
  corpus="$(mktemp -t release_check)"
  trap 'rm -f "$corpus"' EXIT
  # Read from stdin so strings(1) scans the whole file (every slice of a universal binary and any trailing
  # data), not only the sections it recognises; sort -u folds the duplicate per-architecture copies.
  { for b in "${binaries[@]}"; do strings -a <"$b" 2>/dev/null || true; done
    plutil -convert xml1 -o - "$INFO" 2>/dev/null || true; } | LC_ALL=C sort -u >"$corpus"

  # label|extended-regex|secret(1 = never print the match)
  patterns=(
    'qiraat-review|qiraat-review|0'
    'qiraat-editor|qiraat-editor|0'
    'ReviewEditor|ReviewEditor|0'
    'review-reference|review-reference|0'
    'QIRAAT_TEST_ISOLATION|QIRAAT_TEST_ISOLATION|0'
    'localhost|localhost|0'
    '127.0.0.1|127\.0\.0\.1|0'
    'ts.net (home server hostname)|[A-Za-z0-9-]+\.ts\.net|0'
    'service_role|service_role|1'
    'eyJ… (JWT: header.payload)|eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}|1'
  )
  leaked=0
  for p in "${patterns[@]}"; do
    label="${p%%|*}"; rest="${p#*|}"; re="${rest%|*}"; secret="${rest##*|}"
    count="$(grep -E -c -- "$re" "$corpus" || true)"
    if [ "${count:-0}" -gt 0 ]; then
      leaked=1
      if [ "$secret" = "1" ]; then
        sample="$(grep -E -o -m 1 -- "$re" "$corpus" | head -n 1 | cut -c1-6)…(redacted)"
      else
        sample="$(grep -E -o -m 1 -- ".{0,40}$re.{0,40}" "$corpus" | head -n 1)"
      fi
      fail "'$label' found in $count string(s), e.g. $sample"
    fi
  done
  [ "$leaked" -eq 1 ] || pass "none of the developer/editor strings, local hosts, ts.net hostnames or service_role/JWT secrets"
  info "note: a whole Swift literal of <=15 bytes can be stored inside instructions and is then invisible to strings(1)"
fi

# ---------------------------------------------------------------- 4. bundle contents
section "4. Bundle contents"
review_dirs="$(find "$APP" -type d -name ReviewReference 2>/dev/null || true)"
if [ -z "$review_dirs" ]; then pass "no ReviewReference folder"
else fail "ReviewReference folder in the bundle: $(rel "$APP/" "$review_dirs")"; fi

sharh="$(find "$APP" -type f -name '*-sharh.json' 2>/dev/null || true)"
if [ -z "$sharh" ]; then pass "no *-sharh.json files"
elif [ "${ALLOW_SHARH:-0}" = "1" ]; then warn "*-sharh.json bundled (allowed by ALLOW_SHARH=1): $(rel "$APP/" "$sharh")"
else fail "*-sharh.json bundled (copyright not cleared; set ALLOW_SHARH=1 once it is): $(rel "$APP/" "$sharh")"; fi

# A distribution-signed .app always carries embedded.mobileprovision at its root; that one is expected.
secrets="$(find "$APP" -type f \( -name '*.p12' -o -name '*.mobileprovision' -o -name '.env' -o -name '.env.*' -o -name '*.env' \) \
  ! -path "$APP/embedded.mobileprovision" 2>/dev/null || true)"
if [ -z "$secrets" ]; then pass "no .p12 / .mobileprovision / .env files"
else fail "signing or environment files bundled: $(rel "$APP/" "$secrets")"; fi
[ ! -f "$APP/embedded.mobileprovision" ] || info "embedded.mobileprovision present (expected for a signed device build)"

# ---------------------------------------------------------------- 5. iCloud entitlement
section "5. iCloud entitlement"
icloud_src="$(grep -rl --include='*.swift' forUbiquityContainerIdentifier "$SOURCES_DIR" 2>/dev/null || true)"
if [ -z "$icloud_src" ]; then
  pass "Sources do not call forUbiquityContainerIdentifier; no iCloud entitlement needed"
else
  info "used in: $(rel "$IOS_DIR/" "$icloud_src")"
  wanted="$(grep -rhoE --include='*.swift' 'forUbiquityContainerIdentifier: *"[^"]+"' "$SOURCES_DIR" 2>/dev/null \
    | sed -E 's/.*"([^"]+)"/\1/' | sort -u || true)"
  sig="$(codesign -dv "$APP" 2>&1 || true)"
  if printf '%s' "$sig" | grep -q 'not signed at all'; then
    ents=""
    info "bundle is not code-signed"
  else
    ents="$(codesign -d --entitlements - --xml "$APP" 2>/dev/null || true)"
    # Simulator builds keep their entitlements in a __TEXT section of the binary instead of the signature.
    if [ -z "$ents" ] && [ -f "$BINARY" ]; then
      ents="$(strings -a "$BINARY" 2>/dev/null | sed -n '/<key>com.apple.developer.icloud-container-identifiers<\/key>/,/<\/array>/p' || true)"
    fi
    printf '%s' "$sig" | grep -q 'Signature=adhoc' && info "ad-hoc signed (simulator/local build); a distribution build is signed again at export"
  fi
  if printf '%s' "$ents" | grep -q 'com.apple.developer.icloud-container-identifiers'; then
    missing=""
    for c in $wanted; do printf '%s' "$ents" | grep -q "<string>$c</string>" || missing="$missing $c"; done
    if [ -z "$missing" ]; then pass "iCloud container entitlement present${wanted:+ ($(echo $wanted))}"
    else warn "iCloud entitlement present but missing container(s):$missing; hide the iCloud UI or add them"; fi
  else
    warn "Sources use iCloud (forUbiquityContainerIdentifier${wanted:+ $(echo $wanted)}) but the build has no iCloud container entitlement: the iCloud sync UI must be hidden in this build"
  fi
fi

# ---------------------------------------------------------------- 6. size
section "6. Bundle size"
kb="$(du -sk "$APP" | awk '{print $1}')"
mb=$((kb / 1024))
info "$(du -sh "$APP" | awk '{print $1}') on disk (uncompressed; the App Store download is compressed and thinned per device)"
info "largest items:"
du -sk "$APP"/* 2>/dev/null | sort -rn | head -n 5 | awk -v app="$APP/" '{ sub(app, "", $2); printf "        %7.1f MB  %s\n", $1/1024, $2 }'
if [ "$mb" -gt 200 ]; then warn "bundle is $mb MB (> 200 MB): users on cellular get a download prompt if the thinned download also exceeds 200 MB"
else pass "bundle is $mb MB (<= 200 MB)"; fi

# ---------------------------------------------------------------- 7. SDK / Xcode
section "7. SDK and Xcode used for the build"
sdk="$(plist_raw "$INFO" DTSDKName || true)"
xcode="$(plist_raw "$INFO" DTXcode || true)"
xbuild="$(plist_raw "$INFO" DTXcodeBuild || true)"
platform="$(plist_raw "$INFO" DTPlatformName || true)"
info "DTSDKName=${sdk:-missing}  DTXcode=${xcode:-missing}  DTXcodeBuild=${xbuild:-missing}  DTPlatformName=${platform:-missing}"
if [ -z "$sdk" ]; then fail "DTSDKName missing (not an Xcode build?)"
elif printf '%s' "$sdk" | grep -qi beta; then fail "built with a beta SDK ($sdk); App Store Connect rejects beta-SDK builds"
else pass "SDK $sdk is not a beta"; fi
if ! printf '%s' "$xcode" | grep -qE '^[0-9]+$'; then fail "DTXcode missing or not numeric (${xcode:-missing})"
elif [ "$((10#$xcode))" -lt 2600 ]; then fail "built with Xcode $xcode (< 2600); uploads need Xcode 26 or later since 2026-04-28"
else pass "Xcode $xcode >= 2600"; fi
# Apple's beta/RC Xcode builds end in a lowercase letter (e.g. 17A5285i); release builds do not.
if printf '%s' "$xbuild" | grep -qE '[a-z]$'; then warn "DTXcodeBuild $xbuild looks like a beta/RC Xcode (trailing lowercase letter)"; fi
if [ "$platform" = "iphonesimulator" ]; then warn "this is a simulator build; App Store Connect needs a device (iphoneos) archive"; fi

# ---------------------------------------------------------------- summary
echo
if [ "$FAILS" -gt 0 ]; then
  printf '%sNOT READY%s: %d FAIL, %d WARN\n' "$R" "$N" "$FAILS" "$WARNS"
  exit 1
fi
printf '%sREADY%s: 0 FAIL, %d WARN\n' "$G" "$N" "$WARNS"
