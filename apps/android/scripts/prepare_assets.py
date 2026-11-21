#!/usr/bin/env python3
"""Idempotently prepare the gitignored Android assets from the iOS generated sources."""

from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[2]
IOS = ROOT / "ios" / "Generated"
ASSETS = ROOT / "android" / "app" / "src" / "main" / "assets"

SOURCES = {
    IOS / "Qiraat": ASSETS / "qiraat",
    IOS / "QiraatMutoon": ASSETS / "qiraat_mutoon",
    IOS / "QiraatReferences": ASSETS / "qiraat_references",
}


def sync_tree(source: Path, target: Path) -> None:
    if not source.is_dir():
        raise SystemExit(f"Missing generated source: {source}")
    target.mkdir(parents=True, exist_ok=True)
    expected = set()
    for item in source.rglob("*"):
        if not item.is_file() or item.suffix in {".py", ".html", ".txt"}:
            continue
        relative = item.relative_to(source)
        expected.add(relative)
        destination = target / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists() or destination.stat().st_size != item.stat().st_size:
            shutil.copy2(item, destination)
    for item in sorted(target.rglob("*"), reverse=True):
        if item.is_file() and item.relative_to(target) not in expected:
            item.unlink()
        elif item.is_dir() and not any(item.iterdir()):
            item.rmdir()
    print(f"{source.name}: {len(expected)} files -> {target}")


if __name__ == "__main__":
    for source, target in SOURCES.items():
        sync_tree(source, target)
