#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IOS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DERIVED_DATA="$IOS_DIR/DerivedData"
SCREENSHOT_ROOT="$IOS_DIR/build/screenshots"
RUN_ID="$(date +%Y%m%d-%H%M%S)"

device_listing="$(xcrun simctl list devices available)" || {
  echo "FAIL: could not list available simulators" >&2
  exit 1
}

choose_device() {
  local label="$1"
  shift
  local candidate
  for candidate in "$@"; do
    if grep -Fq "    ${candidate} (" <<<"$device_listing"; then
      printf '%s' "$candidate"
      return 0
    fi
  done
  echo "FAIL: no available ${label} simulator. Tried: $*" >&2
  echo "$device_listing" >&2
  return 1
}

IPHONE_MEDIUM="$(choose_device '6.3-inch iPhone' 'iPhone 18 Pro' 'iPhone 17 Pro')"
IPHONE_LARGE="$(choose_device '6.9-inch iPhone' 'iPhone 18 Pro Max')"
IPAD_13="$(choose_device '13-inch iPad Pro' 'iPad Pro 13-inch (M5)' 'iPad Pro 13-inch (M4)')"

echo "Screenshot simulators selected from 'simctl list devices available':"
echo "  6.3-inch iPhone: $IPHONE_MEDIUM"
echo "  6.9-inch iPhone: $IPHONE_LARGE"
echo "  13-inch iPad Pro: $IPAD_13"

normalize_attachments() {
  local exported_dir="$1"
  local output_dir="$2"
  python3 - "$exported_dir" "$output_dir" <<'PY'
import json
import pathlib
import re
import shutil
import sys

source_dir = pathlib.Path(sys.argv[1])
output_dir = pathlib.Path(sys.argv[2])
manifest = json.loads((source_dir / "manifest.json").read_text(encoding="utf-8"))
pattern = re.compile(r"^(\d{2}-[a-z0-9-]+-(?:ar|en))(?:\.png)?$")
copied = []

for test in manifest:
    for attachment in test.get("attachments", []):
        human_name = attachment["suggestedHumanReadableName"]
        match = pattern.fullmatch(human_name)
        if not match:
            continue
        destination = output_dir / f"{match.group(1)}.png"
        if destination.exists():
            raise SystemExit(f"duplicate screenshot attachment: {destination.name}")
        shutil.copy2(source_dir / attachment["exportedFileName"], destination)
        copied.append(destination.name)

expected = {f"{number:02d}-{screen}-{language}.png"
            for language in ("ar", "en")
            for number, screen in enumerate((
                "qiraat-layer", "word-card", "warsh-summary",
                "mutoon", "mutashabihat", "memorization",
            ), start=1)}
actual = set(copied)
if actual != expected:
    missing = ", ".join(sorted(expected - actual)) or "none"
    extra = ", ".join(sorted(actual - expected)) or "none"
    raise SystemExit(f"screenshot attachment mismatch; missing: {missing}; extra: {extra}")
PY
}

validate_pngs() {
  local output_dir="$1"
  local size_class="$2"
  local failed=0
  local png width height size accepted

  for png in "$output_dir"/*.png; do
    width="$(sips -g pixelWidth "$png" | awk '/pixelWidth:/ { print $2 }')"
    height="$(sips -g pixelHeight "$png" | awk '/pixelHeight:/ { print $2 }')"
    size="${width}x${height}"
    accepted=0
    case "$size_class:$size" in
      medium:1206x2622|medium:1179x2556) accepted=1 ;;
      large:1320x2868|large:1290x2796) accepted=1 ;;
      ipad:2064x2752|ipad:2752x2064|ipad:2048x2732|ipad:2732x2048) accepted=1 ;;
    esac
    if [[ "$accepted" == 1 ]]; then
      echo "PASS: $(basename "$png") is $size"
    else
      echo "FAIL: $(basename "$png") is $size (not accepted for $size_class)" >&2
      failed=1
    fi
  done
  return "$failed"
}

run_device() {
  local output_name="$1"
  local device_name="$2"
  local size_class="$3"
  local output_dir="$SCREENSHOT_ROOT/$output_name"
  local result_bundle="$SCREENSHOT_ROOT/.results/${output_name}-${RUN_ID}.xcresult"
  local exported_dir

  echo
  echo "Generating $output_name screenshots on $device_name..."
  mkdir -p "$output_dir" "$(dirname "$result_bundle")"
  find "$output_dir" -maxdepth 1 -type f \( -name '[0-9][0-9]-*.png' -o -name 'manifest.json' \) -delete

  xcrun simctl boot "$device_name" 2>/dev/null || true
  xcrun simctl bootstatus "$device_name" -b
  xcrun simctl status_bar "$device_name" override \
    --time 9:41 --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3

  QIRAAT_SCREENSHOTS=1 xcodebuild \
    -project "$IOS_DIR/Mutshabehat.xcodeproj" \
    -scheme Mutshabehat \
    -derivedDataPath "$DERIVED_DATA" \
    -destination "platform=iOS Simulator,name=$device_name" \
    -only-testing:MutshabehatUITests/AppStoreScreenshotsUITests \
    -collect-test-diagnostics never \
    -resultBundlePath "$result_bundle" \
    test

  exported_dir="$(mktemp -d "${TMPDIR:-/tmp}/qiraat-screenshots.XXXXXX")"
  xcrun xcresulttool export attachments \
    --path "$result_bundle" \
    --output-path "$exported_dir" \
    --filter '*.png'
  normalize_attachments "$exported_dir" "$output_dir"
  cp "$exported_dir/manifest.json" "$output_dir/manifest.json"
  rm -rf "$exported_dir"
  if ! validate_pngs "$output_dir" "$size_class"; then
    validation_failed=1
  fi
}

validation_failed=0
run_device "iphone-6.3-inch" "$IPHONE_MEDIUM" medium
run_device "iphone-6.9-inch" "$IPHONE_LARGE" large
run_device "ipad-13-inch" "$IPAD_13" ipad

if [[ "$validation_failed" != 0 ]]; then
  echo "FAIL: one or more exported screenshots has an unsupported size" >&2
  exit 1
fi

echo
echo "PASS: 36 App Store screenshots exported to $SCREENSHOT_ROOT"
