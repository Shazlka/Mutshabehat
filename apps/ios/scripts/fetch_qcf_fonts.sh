#!/usr/bin/env bash
# Download the 604 QCF V2 page fonts (woff2, ~93 MB) the Mushaf reader renders with, from the
# same CDN the web reader loads them from at runtime. Output is gitignored (public repo; the fonts
# are the King Fahd Complex's QCF glyph fonts, not ours to redistribute in source control).
#
# Usage: apps/ios/scripts/fetch_qcf_fonts.sh <output_dir>
# Idempotent: complete fonts already present are skipped; a truncated one is fetched again; a
# failed or incomplete download fails the run and leaves nothing behind.
set -euo pipefail

OUT="${1:?usage: fetch_qcf_fonts.sh <output_dir>}"
# Overridable for tests only: a file:// source and a smaller page range.
BASE="${QCF_FONT_BASE:-https://verses.quran.foundation/fonts/quran/hafs/v2/woff2}"
FIRST="${QCF_FIRST_PAGE:-1}"
LAST="${QCF_LAST_PAGE:-604}"
mkdir -p "$OUT"

# A woff2 file starts with "wOF2" and stores its own total length in bytes 8-11 (big-endian),
# so a truncated download can be told apart from a complete one.
valid_woff2() {
  local f="$1" declared actual
  [[ -s "$f" && "$(head -c 4 "$f")" == "wOF2" ]] || return 1
  declared=$(od -An -tu1 -j8 -N4 "$f" | awk 'NF { print $1*16777216 + $2*65536 + $3*256 + $4; exit }')
  actual=$(stat -f %z "$f")
  [[ "$declared" == "$actual" ]]
}

fetch() {
  set -euo pipefail  # not inherited by the `bash -c` that xargs starts
  local page="$1" out="$2" base="$3"
  local file="$out/p$page.woff2"
  valid_woff2 "$file" && return 0
  # Never delete what is on disk first: only a verified download replaces it.
  if ! curl --fail --silent --show-error --retry 3 --max-time 60 -o "$file.part" "$base/p$page.woff2"; then
    rm -f "$file.part"; echo "page $page: download failed" >&2; return 1
  fi
  valid_woff2 "$file.part" || { rm -f "$file.part"; echo "page $page: incomplete or not a woff2 file" >&2; return 1; }
  mv "$file.part" "$file"
}
export -f fetch valid_woff2

seq "$FIRST" "$LAST" | xargs -P 8 -I{} bash -c 'fetch "$@"' _ {} "$OUT" "$BASE"

expected=$((LAST - FIRST + 1))
count=$(find "$OUT" -name 'p*.woff2' -size +0 | wc -l | tr -d ' ')
[[ "$count" == "$expected" ]] || { echo "expected $expected fonts, found $count" >&2; exit 1; }
echo "fonts ready: $count files, $(du -sh "$OUT" | cut -f1) in $OUT"
