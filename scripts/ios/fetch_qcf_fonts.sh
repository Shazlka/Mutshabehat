#!/usr/bin/env bash
# Download the 604 QCF V2 page fonts (woff2, ~93 MB) the Mushaf reader renders with, from the
# same CDN the web reader loads them from at runtime. Output is gitignored (public repo; the fonts
# are the King Fahd Complex's QCF glyph fonts, not ours to redistribute in source control).
#
# Usage: scripts/ios/fetch_qcf_fonts.sh <output_dir>
# Idempotent: pages already present and non-empty are skipped; a failed page fails the run.
set -euo pipefail

OUT="${1:?usage: fetch_qcf_fonts.sh <output_dir>}"
BASE="https://verses.quran.foundation/fonts/quran/hafs/v2/woff2"
mkdir -p "$OUT"

fetch() {
  local page="$1" out="$2" base="$3"
  local file="$out/p$page.woff2"
  [[ -s "$file" ]] && return 0
  curl --fail --silent --show-error --retry 3 --max-time 60 -o "$file.part" "$base/p$page.woff2"
  # woff2 files start with the ASCII signature "wOF2".
  [[ "$(head -c 4 "$file.part")" == "wOF2" ]] || { echo "page $page: not a woff2 file" >&2; rm -f "$file.part"; return 1; }
  mv "$file.part" "$file"
}
export -f fetch

seq 1 604 | xargs -P 8 -I{} bash -c 'fetch "$@"' _ {} "$OUT" "$BASE"

count=$(find "$OUT" -name 'p*.woff2' -size +0 | wc -l | tr -d ' ')
[[ "$count" == "604" ]] || { echo "expected 604 fonts, found $count" >&2; exit 1; }
echo "fonts ready: $count files, $(du -sh "$OUT" | cut -f1) in $OUT"
