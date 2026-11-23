#!/usr/bin/env python3
"""Copies the web review editor's reference data (nquran.com and الشامل) into Generated/Review/reference.

The files are the web app's own data, copied unchanged and never committed (Generated/ is gitignored).
Usage: build_review_reference.py REPO_ROOT OUT_DIR
"""

from pathlib import Path
import shutil
import sys

REFERENCE = Path("src/app/mushaf-1441/review/_lib/reference")
NQURAN_SURAHS = 114


def fail(message):
    print(f"error: {message}", file=sys.stderr)
    raise SystemExit(1)


def build(repo, out):
    source = Path(repo) / REFERENCE
    nquran = sorted((source / "nquran").glob("surah-*.json"))
    expected = {f"surah-{n:03d}.json" for n in range(1, NQURAN_SURAHS + 1)}
    missing = sorted(expected - {p.name for p in nquran})
    if missing:
        fail(f"nquran reference is missing {len(missing)} surah file(s), first: {missing[0]}")
    if not (source / "shamil" / "index.json").is_file():
        fail("shamil reference has no index.json")

    out = Path(out)
    for name in ("nquran", "shamil"):
        shutil.rmtree(out / name, ignore_errors=True)
        (out / name).mkdir(parents=True)
        for file in sorted((source / name).glob("*.json")):
            shutil.copyfile(file, out / name / file.name)
    print(f"review reference: {len(nquran)} nquran surahs, "
          f"{len(list((out / 'shamil').glob('surah-*.json')))} shamil surahs -> {out}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        fail("usage: build_review_reference.py REPO_ROOT OUT_DIR")
    build(sys.argv[1], sys.argv[2])
