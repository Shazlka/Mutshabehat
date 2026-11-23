"""Snapshot Qiraat pages and their catalog using only the Python standard library."""

import argparse
import ast
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from http.client import HTTPException
from http.cookiejar import CookieJar
import json
import os
from pathlib import Path
import re
import sys
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import build_opener, HTTPCookieProcessor, HTTPRedirectHandler


DEFAULT_BASE = "https://mutshabehat-v2.vercel.app"
COLLECTIONS = ("variants", "rulings", "rules")
VARIANT_FIELDS = {"id", "surah", "ayah", "startToken", "endToken", "readingIds"}
RULING_FIELDS = {
    "id", "category", "categoryAr", "color", "wordAnchored", "surah", "ayah",
    "startToken", "endToken", "readings", "attribution",
}


class PageError(Exception):
    """A safe diagnostic that never includes response headers or cookies."""


def validate_page(value, number):
    if not isinstance(value, dict) or type(value.get("pageNumber")) is not int:
        raise ValueError("pageNumber must be an integer in an object")
    if value["pageNumber"] != number:
        raise ValueError("pageNumber does not match the requested page")
    for key in COLLECTIONS:
        if not isinstance(value.get(key), list):
            raise ValueError(f"{key} must be a list")
    for key, fields, lists in (
        ("variants", VARIANT_FIELDS, ("readingIds",)),
        ("rulings", RULING_FIELDS, ("readings", "attribution")),
    ):
        for row in value[key]:
            if not isinstance(row, dict) or not fields.issubset(row):
                raise ValueError(f"{key} record is missing required fields")
            if any(not isinstance(row[field], list) for field in lists):
                raise ValueError(f"{key} record has an invalid list field")
    return value


def reject_constant(value):
    raise ValueError("non-finite numbers are not JSON")


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"), parse_constant=reject_constant)


def write_atomic(path, value):
    part = path.with_name(path.name + ".part")
    try:
        with part.open("w", encoding="utf-8") as stream:
            json.dump(value, stream, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
        os.replace(part, path)
    finally:
        part.unlink(missing_ok=True)


class LimitedRedirectHandler(HTTPRedirectHandler):
    max_repeats = 5
    max_redirections = 5

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        count = getattr(req, "qiraat_redirects", 0)
        if count >= 5:
            raise HTTPError(req.full_url, code, "redirect limit reached", headers, fp)
        redirected = super().redirect_request(req, fp, code, msg, headers, newurl)
        if redirected is not None:
            redirected.qiraat_redirects = count + 1
        return redirected


class APISource:
    def __init__(self, base):
        self.base = base
        self.local = threading.local()

    def fetch(self, number):
        if not hasattr(self.local, "opener"):
            self.local.opener = build_opener(
                HTTPCookieProcessor(CookieJar()), LimitedRedirectHandler())
        url = f"{self.base}/api/mushaf-1441/qiraat?page={number}"
        for attempt in range(3):
            try:
                with self.local.opener.open(url, timeout=60) as response:
                    body = response.read()
            except HTTPError as error:
                code = error.code
                error.close()
                if not 500 <= code <= 599 or attempt == 2:
                    raise PageError(f"HTTP {code}") from None
            except (URLError, OSError, HTTPException):
                if attempt == 2:
                    raise PageError("network error after 3 attempts") from None
            else:
                try:
                    return json.loads(body.decode("utf-8"), parse_constant=reject_constant)
                except (ValueError, UnicodeError):
                    raise PageError("invalid JSON response") from None
            time.sleep(2 ** attempt)


def fixture_page(repo, number):
    page = {"pageNumber": number}
    for folder, key in (("pages", "variants"), ("rulings", "rulings"), ("rules", "rules")):
        path = repo / "packages/qiraat-core/fixtures" / folder / f"page-{number:03d}.json"
        try:
            page[key] = read_json(path)
        except FileNotFoundError:
            page[key] = []
    return page


# Only literal strings, numeric values and object/array syntax are accepted.
# This parses the source tables without executing TypeScript or guessing values.
TS_TOKEN = re.compile(
    r"(?P<string>'(?:\\.|[^'\\])*'|\"(?:\\.|[^\"\\])*\")"
    r"|(?P<comment>//[^\n]*|/\*[\s\S]*?\*/)"
    r"|(?P<space>\s+)|(?P<identifier>[A-Za-z_$][\w$]*)"
    r"|(?P<number>-?\d+)|(?P<punctuation>[{}\[\],:])"
)


def without_comments(text):
    # Keep quoted strings intact, including any comment-like text inside them.
    pattern = re.compile(
        r"'(?:\\.|[^'\\])*'|\"(?:\\.|[^\"\\])*\"|//[^\n]*|/\*[\s\S]*?\*/")
    return pattern.sub(lambda match: " " if match[0].startswith(("//", "/*")) else match[0], text)


def literal_table(path, name, fields, expected_ids):
    text = without_comments(path.read_text(encoding="utf-8"))
    match = re.search(r"\bconst\s+" + re.escape(name) + r"\b[^=]*=\s*(\[[\s\S]*?^\s*\])", text, re.M)
    if not match:
        raise ValueError(f"missing literal table {name}")
    literal = match[1]
    tokens = []
    offset = 0
    while offset < len(literal):
        token = TS_TOKEN.match(literal, offset)
        if not token:
            raise ValueError(f"unsupported literal in {name}")
        offset = token.end()
        kind = token.lastgroup
        if kind in ("space", "comment"):
            continue
        if kind == "string":
            tokens.append(json.dumps(ast.literal_eval(token[0]), ensure_ascii=False))
        elif kind == "identifier":
            if not literal[offset:].lstrip().startswith(":"):
                raise ValueError(f"nonliteral value in {name}")
            tokens.append(json.dumps(token[0]))
        else:
            tokens.append(token[0])
    # Remove trailing commas as tokens, never by rewriting inside a string.
    converted = "".join(token for i, token in enumerate(tokens)
                        if not (token == "," and i + 1 < len(tokens) and tokens[i + 1] in ("}", "]")))
    rows = json.loads(converted)
    result = []
    for row in rows:
        if not isinstance(row, dict) or any(field not in row for field in fields):
            raise ValueError(f"missing field in {name}")
        if type(row["sortOrder"]) is not int or row["sortOrder"] < 1:
            raise ValueError(f"invalid sortOrder in {name}")
        if any(not isinstance(row[key], str) or not row[key] for key in fields if key != "sortOrder"):
            raise ValueError(f"missing string value in {name}")
        result.append({key: row[key] for key in fields})
    if len(result) != len(expected_ids) or {row["id"] for row in result} != expected_ids:
        raise ValueError(f"incomplete or duplicate identities in {name}")
    return result


def literal_color(path, name):
    text = without_comments(path.read_text(encoding="utf-8"))
    match = re.search(r"\bconst\s+" + re.escape(name) + r"\s*=\s*(['\"])(#[0-9a-fA-F]{6})\1", text)
    if not match:
        raise ValueError(f"missing color {name}")
    return match[2]


def catalog_metadata(repo):
    core = repo / "packages/qiraat-core"
    marker = repo / "src/app/mushaf-1441/_components/qiraat/qiraatWordMarker.ts"
    reader_ids = {f"Q{number:02d}" for number in range(1, 11)}
    narrator_ids = {f"{reader}-R{number:02d}" for reader in reader_ids for number in (1, 2)}
    readers = literal_table(core / "readers.ts", "QIRAAT_READERS",
                            ("id", "nameAr", "nameArShort", "color", "sortOrder"), reader_ids)
    narrators = literal_table(core / "narrators.ts", "QIRAAT_NARRATORS",
                              ("id", "readerId", "nameAr", "color", "sortOrder"), narrator_ids)
    if any(row["readerId"] != row["id"].split("-")[0] for row in narrators):
        raise ValueError("narrator readerId does not match its identity")
    return {
        "readers": readers,
        "narrators": narrators,
        "multiReaderColor": literal_color(core / "colors.ts", "QIRAAT_MULTI_READER_COLOR"),
        "performanceColor": literal_color(marker, "PERFORMANCE_MARKER_COLOR"),
        "unresolvedColor": literal_color(marker, "UNRESOLVED_MARKER_COLOR"),
    }


def positive_int(value):
    number = int(value)
    if number < 1:
        raise argparse.ArgumentTypeError("must be a positive integer")
    return number


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("repo_root", type=Path)
    parser.add_argument("out_dir", type=Path)
    parser.add_argument("--source", choices=("api", "fixtures"), default="api")
    parser.add_argument("--base", default=os.environ.get("QIRAAT_API_BASE", DEFAULT_BASE))
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--workers", type=positive_int, default=6)
    parser.add_argument("--page-count", type=positive_int, default=604)
    args = parser.parse_args(argv)
    base = args.base.rstrip("/")
    if args.source == "api":
        parsed = urlsplit(base)
        if parsed.scheme not in ("http", "https") or not parsed.netloc or parsed.query or parsed.fragment:
            parser.error("--base must be an HTTP(S) URL without a query or fragment")
    try:
        metadata = catalog_metadata(args.repo_root)
        args.out_dir.mkdir(parents=True, exist_ok=True)
    except (OSError, ValueError, SyntaxError):
        print("Cannot prepare output or parse required catalog values.", file=sys.stderr)
        return 1

    source = APISource(base) if args.source == "api" else None

    def ensure_page(number):
        path = args.out_dir / f"page-{number:03d}.json"
        if not args.refresh:
            try:
                validate_page(read_json(path), number)
                return
            except (OSError, ValueError):
                pass
        data = source.fetch(number) if source else fixture_page(args.repo_root, number)
        validate_page(data, number)
        write_atomic(path, data)

    failed = set()
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(ensure_page, number): number for number in range(1, args.page_count + 1)}
        for future in as_completed(futures):
            number = futures[future]
            try:
                future.result()
            except (PageError, OSError, ValueError):
                # Do not log raw exceptions: HTTP errors can contain session data.
                failed.add(number)

    counts = dict.fromkeys(COLLECTIONS, 0)
    for number in range(1, args.page_count + 1):
        try:
            page = validate_page(read_json(args.out_dir / f"page-{number:03d}.json"), number)
            for key in COLLECTIONS:
                counts[key] += len(page[key])
        except (OSError, ValueError):
            failed.add(number)
    if failed:
        print("Failed pages: " + ", ".join(map(str, sorted(failed))), file=sys.stderr)
        return 1

    catalog = {
        "schemaVersion": 1,
        "source": args.source,
        "sourceUrl": base if args.source == "api" else None,
        "fetchedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "pageCount": args.page_count,
        "counts": counts,
        **metadata,
    }
    try:
        write_atomic(args.out_dir / "catalog.json", catalog)
    except (OSError, ValueError):
        print("Cannot write catalog.json.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
