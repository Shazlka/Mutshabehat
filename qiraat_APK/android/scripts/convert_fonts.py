#!/usr/bin/env python3
"""Convert the 604 licensed QCF V2 WOFF2 page fonts to Android-loadable TTF files."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

from fontTools.ttLib import TTFont

PAGE_COUNT = 604


def parse_args() -> argparse.Namespace:
    android_root = Path(__file__).resolve().parents[1]
    repo_root = android_root.parents[1]
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=repo_root / "apps/ios/Generated/Fonts")
    parser.add_argument("--output", type=Path, default=android_root / "app/src/main/assets/fonts")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    missing = [args.source / f"p{page}.woff2" for page in range(1, PAGE_COUNT + 1) if not (args.source / f"p{page}.woff2").is_file()]
    if missing:
        print(f"error: expected {PAGE_COUNT} WOFF2 files; missing {len(missing)} (first: {missing[0]})", file=sys.stderr)
        return 2
    args.output.mkdir(parents=True, exist_ok=True)
    for page in range(1, PAGE_COUNT + 1):
        source = args.source / f"p{page}.woff2"
        target = args.output / f"p{page}.ttf"
        font = TTFont(source, recalcBBoxes=False, recalcTimestamp=False)
        font.flavor = None
        font.save(target, reorderTables=False)
        font.close()
        if page % 50 == 0 or page == PAGE_COUNT:
            print(f"converted {page}/{PAGE_COUNT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
