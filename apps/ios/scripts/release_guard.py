#!/usr/bin/env python3
"""Fails when a built .app carries anything of the developer review editor.

The editor is DEBUG-only. A Release build must contain none of its type names, its API path or its bundled
reference data. Usage: release_guard.py path/to/Mutshabehat.app
"""
import os
import re
import sys

FORBIDDEN_SYMBOLS = ("qiraat-review", "Qiraat-iOS-Review", "ReviewStore", "ReviewEditorEntry", "ReviewAPI", "ReviewQueue",
                     "URLSessionReviewTransport", "ReferenceLibrary")
FORBIDDEN_DIRS = ("ReviewReference",)
_PRINTABLE = re.compile(rb"[\x20-\x7e]{4,}")


def binary_path(app: str) -> str:
    name = os.path.splitext(os.path.basename(app.rstrip("/")))[0]
    return os.path.join(app, name)


def leaked_symbols(binary: str) -> list[str]:
    with open(binary, "rb") as f:
        data = f.read()
    text = b"\n".join(_PRINTABLE.findall(data)).decode("ascii", "ignore")
    return [s for s in FORBIDDEN_SYMBOLS if s in text]


def leaked_dirs(app: str) -> list[str]:
    found = []
    for root, dirs, _ in os.walk(app):
        found += [os.path.join(root, d) for d in dirs if d in FORBIDDEN_DIRS]
    return found


def check(app: str) -> list[str]:
    problems = [f"binary contains '{s}'" for s in leaked_symbols(binary_path(app))]
    problems += [f"bundle contains {d}" for d in leaked_dirs(app)]
    return problems


def main() -> int:
    if len(sys.argv) != 2 or not os.path.isdir(sys.argv[1]):
        print("usage: release_guard.py path/to/App.app", file=sys.stderr)
        return 2
    problems = check(sys.argv[1])
    for p in problems:
        print(f"release guard: {p}", file=sys.stderr)
    if problems:
        return 1
    print("release guard ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
