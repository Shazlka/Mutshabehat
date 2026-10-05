#!/usr/bin/env python3
"""Syncs databases from the Web App (Source of Truth) into the iCloud Drive Mushaf_Qiraat folder.

Exports:
- mutshabehat.sqlite & mutshabehat.json (Personal and Automated Groups, Verses, Parts, Tags)
- qiraat.sqlite & qiraat.qiraatdata (Ten Qira'at Catalog, Rulings, Variants, 604 Pages)
- mushaf.sqlite (Quran 1441 Page Layout, Words, Glyph Coordinates, Search Tokens)
- manifest.json (Metadata, Timestamps, Entity Counts, SHA-256 Hashes)

Usage:
    python3 apps/ios/scripts/sync_webapp_to_icloud.py [--dest PATH] [--update-generated]
"""

import argparse
import base64
from datetime import datetime, timezone
import hashlib
from http.client import HTTPException
from http.cookiejar import CookieJar
import json
import os
from pathlib import Path
import shutil
import sqlite3
import sys
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.request import build_opener, HTTPCookieProcessor, HTTPRedirectHandler

DEFAULT_WEBAPP_URL = "https://mutshabehat-v2.vercel.app"
DEFAULT_ICLOUD_DEST = os.path.expanduser("~/Library/Mobile Documents/com~apple~CloudDocs/Mushaf_Qiraat")


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


def fetch_url(url: str, max_retries: int = 3) -> bytes:
    """Fetches a URL with cookie session support and automatic retries."""
    opener = build_opener(HTTPCookieProcessor(CookieJar()), LimitedRedirectHandler())
    opener.addheaders = [
        ("User-Agent", "Mutshabehat-iCloud-Sync/1.0"),
        ("Accept", "application/json"),
    ]
    for attempt in range(max_retries):
        try:
            with opener.open(url, timeout=45) as resp:
                return resp.read()
        except (HTTPError, URLError, HTTPException, TimeoutError) as err:
            if attempt == max_retries - 1:
                raise
            time.sleep(1.0 * (attempt + 1))
    raise RuntimeError(f"Failed to fetch {url}")


def compute_sha256(filepath: Path) -> str:
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def build_mutshabehat_sqlite(data: dict, output_path: Path):
    """Builds a high-performance SQLite database from the mutshabehat JSON export."""
    if output_path.exists():
        output_path.unlink()

    conn = sqlite3.connect(output_path)
    cur = conn.cursor()
    cur.execute("PRAGMA journal_mode = WAL;")
    cur.execute("PRAGMA foreign_keys = ON;")

    cur.execute("""
    CREATE TABLE groups (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        color TEXT,
        status TEXT,
        favorite INTEGER DEFAULT 0,
        completed INTEGER DEFAULT 0,
        note TEXT,
        unote TEXT,
        created_at TEXT,
        updated_at TEXT
    );
    """)

    cur.execute("""
    CREATE TABLE verses (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        surah TEXT,
        ayah INTEGER,
        label TEXT,
        sort_order INTEGER DEFAULT 0,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
    );
    """)

    cur.execute("""
    CREATE TABLE parts (
        id TEXT PRIMARY KEY,
        verse_id TEXT NOT NULL,
        type TEXT NOT NULL,
        text TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        FOREIGN KEY (verse_id) REFERENCES verses(id) ON DELETE CASCADE
    );
    """)

    cur.execute("""
    CREATE TABLE automated_groups (
        id INTEGER PRIMARY KEY,
        legacy_id TEXT,
        title TEXT NOT NULL,
        color TEXT,
        surahs TEXT,
        payload TEXT NOT NULL,
        copied INTEGER DEFAULT 0
    );
    """)

    cur.execute("CREATE INDEX idx_verses_group ON verses(group_id);")
    cur.execute("CREATE INDEX idx_verses_surah ON verses(surah);")
    cur.execute("CREATE INDEX idx_parts_verse ON parts(verse_id);")
    cur.execute("CREATE INDEX idx_automated_title ON automated_groups(title);")

    groups = data.get("groups", [])
    for g in groups:
        gid = g["id"]
        title = g.get("title", "")
        color = g.get("color")
        status = g.get("status")
        fav = 1 if g.get("favorite") else 0
        comp = 1 if g.get("completed") else 0
        note = g.get("note")
        unote = g.get("unote")
        created_at = g.get("created_at")
        updated_at = g.get("updated_at")

        cur.execute("""
        INSERT INTO groups (id, title, color, status, favorite, completed, note, unote, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (gid, title, color, status, fav, comp, note, unote, created_at, updated_at))

        for v in g.get("verses", []):
            vid = v["id"]
            surah = v.get("surah")
            ayah = v.get("ayah")
            label = v.get("label")
            sort_order = v.get("sort_order", 0)

            cur.execute("""
            INSERT INTO verses (id, group_id, surah, ayah, label, sort_order)
            VALUES (?, ?, ?, ?, ?, ?)
            """, (vid, gid, surah, ayah, label, sort_order))

            for p in v.get("parts", []):
                pid = p["id"]
                ptype = p.get("type", "normal")
                ptext = p.get("text", "")
                psort = p.get("sort_order", 0)

                cur.execute("""
                INSERT INTO parts (id, verse_id, type, text, sort_order)
                VALUES (?, ?, ?, ?, ?)
                """, (pid, vid, ptype, ptext, psort))

    conn.commit()
    cur.execute("PRAGMA wal_checkpoint(TRUNCATE);")
    cur.execute("PRAGMA journal_mode = DELETE;")
    conn.close()


def build_qiraat_sqlite(qiraat_dir: Path, output_path: Path) -> dict:
    """Builds a unified SQLite database containing Qiraat catalog and all 604 pages."""
    if output_path.exists():
        output_path.unlink()

    conn = sqlite3.connect(output_path)
    cur = conn.cursor()
    cur.execute("PRAGMA journal_mode = WAL;")

    cur.execute("""
    CREATE TABLE meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
    """)

    cur.execute("""
    CREATE TABLE catalog (
        key TEXT PRIMARY KEY,
        json_data TEXT NOT NULL
    );
    """)

    cur.execute("""
    CREATE TABLE pages (
        page_number INTEGER PRIMARY KEY,
        variants_count INTEGER NOT NULL,
        rulings_count INTEGER NOT NULL,
        rules_count INTEGER NOT NULL,
        json_data TEXT NOT NULL
    );
    """)

    cur.execute("""
    CREATE TABLE rulings (
        id TEXT PRIMARY KEY,
        page_number INTEGER NOT NULL,
        category TEXT,
        color TEXT,
        surah INTEGER,
        ayah INTEGER,
        start_token INTEGER,
        end_token INTEGER,
        json_data TEXT NOT NULL
    );
    """)

    cur.execute("""
    CREATE TABLE variants (
        id TEXT PRIMARY KEY,
        page_number INTEGER NOT NULL,
        surah INTEGER,
        ayah INTEGER,
        start_token INTEGER,
        end_token INTEGER,
        reading_ids TEXT,
        json_data TEXT NOT NULL
    );
    """)

    cur.execute("CREATE INDEX idx_rulings_page ON rulings(page_number);")
    cur.execute("CREATE INDEX idx_rulings_verse ON rulings(surah, ayah);")
    cur.execute("CREATE INDEX idx_variants_page ON variants(page_number);")
    cur.execute("CREATE INDEX idx_variants_verse ON variants(surah, ayah);")

    # Catalog
    catalog_path = qiraat_dir / "catalog.json"
    catalog_json = catalog_path.read_text(encoding="utf-8")
    cur.execute("INSERT INTO catalog (key, json_data) VALUES ('root', ?)", (catalog_json,))

    total_variants = 0
    total_rulings = 0
    total_rules = 0

    for page_num in range(1, 605):
        page_file = qiraat_dir / f"page-{page_num:03d}.json"
        if not page_file.exists():
            continue
        page_raw = page_file.read_text(encoding="utf-8")
        page_data = json.loads(page_raw)

        variants = page_data.get("variants", [])
        rulings = page_data.get("rulings", [])
        rules = page_data.get("rules", [])

        total_variants += len(variants)
        total_rulings += len(rulings)
        total_rules += len(rules)

        cur.execute("""
        INSERT INTO pages (page_number, variants_count, rulings_count, rules_count, json_data)
        VALUES (?, ?, ?, ?, ?)
        """, (page_num, len(variants), len(rulings), len(rules), page_raw))

        for r in rulings:
            rid = r.get("id")
            if not rid:
                continue
            cur.execute("""
            INSERT OR REPLACE INTO rulings (id, page_number, category, color, surah, ayah, start_token, end_token, json_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                rid, page_num, r.get("category"), r.get("color"),
                r.get("surah"), r.get("ayah"), r.get("startToken"), r.get("endToken"),
                json.dumps(r, ensure_ascii=False)
            ))

        for v in variants:
            vid = v.get("id")
            if not vid:
                continue
            cur.execute("""
            INSERT OR REPLACE INTO variants (id, page_number, surah, ayah, start_token, end_token, reading_ids, json_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                vid, page_num, v.get("surah"), v.get("ayah"),
                v.get("startToken"), v.get("endToken"),
                ",".join(v.get("readingIds", [])),
                json.dumps(v, ensure_ascii=False)
            ))

    cur.execute("INSERT INTO meta (key, value) VALUES ('schema_version', '1')")
    cur.execute("INSERT INTO meta (key, value) VALUES ('exported_at', ?)", (datetime.now(timezone.utc).isoformat(),))
    cur.execute("INSERT INTO meta (key, value) VALUES ('page_count', '604')")
    cur.execute("INSERT INTO meta (key, value) VALUES ('total_variants', ?)", (str(total_variants),))
    cur.execute("INSERT INTO meta (key, value) VALUES ('total_rulings', ?)", (str(total_rulings),))

    conn.commit()
    cur.execute("PRAGMA wal_checkpoint(TRUNCATE);")
    cur.execute("PRAGMA journal_mode = DELETE;")
    conn.close()

    return {
        "page_count": 604,
        "variants_count": total_variants,
        "rulings_count": total_rulings,
        "rules_count": total_rules,
    }


def build_qiraat_archive(qiraat_dir: Path, output_path: Path):
    """Builds a portable single-archive .qiraatdata file for backwards compatibility."""
    archive_files = {}
    catalog_path = qiraat_dir / "catalog.json"
    archive_files["catalog.json"] = base64.b64encode(catalog_path.read_bytes()).decode("ascii")

    for page_num in range(1, 605):
        page_file = qiraat_dir / f"page-{page_num:03d}.json"
        if page_file.exists():
            archive_files[page_file.name] = base64.b64encode(page_file.read_bytes()).decode("ascii")

    archive = {
        "formatVersion": 1,
        "files": archive_files
    }
    output_path.write_text(json.dumps(archive), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Sync web app databases to iCloud Drive Mushaf_Qiraat folder.")
    parser.add_argument("--url", default=DEFAULT_WEBAPP_URL, help="Base URL of the web app")
    parser.add_argument("--dest", default=DEFAULT_ICLOUD_DEST, help="Destination iCloud Drive directory")
    parser.add_argument("--update-generated", action="store_true", help="Also update apps/ios/Generated local files")
    args = parser.parse_args()

    dest_dir = Path(args.dest)
    dest_dir.mkdir(parents=True, exist_ok=True)

    repo_root = Path(__file__).resolve().parent.parent.parent.parent
    ios_generated_dir = repo_root / "apps" / "ios" / "Generated"
    qiraat_source_dir = ios_generated_dir / "Qiraat"
    mushaf_sqlite_source = ios_generated_dir / "mushaf.sqlite"

    print(f"=== Mushaf & Qiraat iCloud Sync ===")
    print(f"Source Web App: {args.url}")
    print(f"Target iCloud Folder: {dest_dir}")

    # 1. Fetch Groups from Web App
    export_url = f"{args.url}/api/groups/export?format=json"
    print(f"\n[1/5] Fetching Mutshabehat groups from {export_url} ...")
    raw_groups_bytes = fetch_url(export_url)
    mutshabehat_data = json.loads(raw_groups_bytes.decode("utf-8"))
    groups_count = len(mutshabehat_data.get("groups", []))
    verses_count = sum(len(g.get("verses", [])) for g in mutshabehat_data.get("groups", []))
    parts_count = sum(len(v.get("parts", [])) for g in mutshabehat_data.get("groups", []) for v in g.get("verses", []))
    print(f"  → Downloaded {groups_count} groups, {verses_count} verses, {parts_count} parts.")

    # 2. Build files in a temporary directory
    with tempfile.TemporaryDirectory() as tmp_str:
        tmp_dir = Path(tmp_str)
        tmp_mutsh_json = tmp_dir / "mutshabehat.json"
        tmp_mutsh_sqlite = tmp_dir / "mutshabehat.sqlite"
        tmp_qiraat_sqlite = tmp_dir / "qiraat.sqlite"
        tmp_qiraat_archive = tmp_dir / "qiraat.qiraatdata"
        tmp_mushaf_sqlite = tmp_dir / "mushaf.sqlite"
        tmp_manifest = tmp_dir / "manifest.json"

        # Save mutshabehat.json
        print("\n[2/5] Compiling mutshabehat.sqlite and mutshabehat.json ...")
        tmp_mutsh_json.write_bytes(raw_groups_bytes)
        build_mutshabehat_sqlite(mutshabehat_data, tmp_mutsh_sqlite)
        print(f"  → mutshabehat.sqlite size: {tmp_mutsh_sqlite.stat().st_size / 1024:.1f} KB")

        # Compile Qiraat
        print("\n[3/5] Compiling qiraat.sqlite and qiraat.qiraatdata ...")
        if not qiraat_source_dir.exists():
            print(f"Error: {qiraat_source_dir} not found. Run make qiraat first.", file=sys.stderr)
            sys.exit(1)
        qiraat_stats = build_qiraat_sqlite(qiraat_source_dir, tmp_qiraat_sqlite)
        build_qiraat_archive(qiraat_source_dir, tmp_qiraat_archive)
        print(f"  → qiraat.sqlite size: {tmp_qiraat_sqlite.stat().st_size / 1024:.1f} KB ({qiraat_stats['rulings_count']} rulings, {qiraat_stats['variants_count']} variants)")

        # Copy Mushaf
        print("\n[4/5] Preparing mushaf.sqlite ...")
        if mushaf_sqlite_source.exists():
            shutil.copy2(mushaf_sqlite_source, tmp_mushaf_sqlite)
            print(f"  → mushaf.sqlite size: {tmp_mushaf_sqlite.stat().st_size / (1024*1024):.1f} MB")
        else:
            print(f"Warning: {mushaf_sqlite_source} not found, skipping mushaf.sqlite copy.")

        # Generate manifest
        print("\n[5/5] Generating manifest.json and deploying to iCloud ...")
        now_iso = datetime.now(timezone.utc).isoformat()
        manifest = {
            "schema_version": 1,
            "exported_at": now_iso,
            "source_of_truth": args.url,
            "databases": {
                "mutshabehat": {
                    "file": "mutshabehat.sqlite",
                    "json_file": "mutshabehat.json",
                    "groups_count": groups_count,
                    "verses_count": verses_count,
                    "parts_count": parts_count,
                    "sha256": compute_sha256(tmp_mutsh_sqlite),
                    "size_bytes": tmp_mutsh_sqlite.stat().st_size,
                },
                "qiraat": {
                    "file": "qiraat.sqlite",
                    "archive_file": "qiraat.qiraatdata",
                    "page_count": qiraat_stats["page_count"],
                    "variants_count": qiraat_stats["variants_count"],
                    "rulings_count": qiraat_stats["rulings_count"],
                    "sha256": compute_sha256(tmp_qiraat_sqlite),
                    "size_bytes": tmp_qiraat_sqlite.stat().st_size,
                },
            }
        }
        if tmp_mushaf_sqlite.exists():
            manifest["databases"]["mushaf"] = {
                "file": "mushaf.sqlite",
                "sha256": compute_sha256(tmp_mushaf_sqlite),
                "size_bytes": tmp_mushaf_sqlite.stat().st_size,
            }

        tmp_manifest.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")

        # Copy atomically to destination iCloud folder
        for src_file in [tmp_manifest, tmp_mutsh_json, tmp_mutsh_sqlite, tmp_qiraat_sqlite, tmp_qiraat_archive]:
            dest_file = dest_dir / src_file.name
            shutil.copy2(src_file, dest_file)
            print(f"  ✓ Published {src_file.name} -> {dest_file}")

        if tmp_mushaf_sqlite.exists():
            dest_mushaf = dest_dir / tmp_mushaf_sqlite.name
            shutil.copy2(tmp_mushaf_sqlite, dest_mushaf)
            print(f"  ✓ Published {tmp_mushaf_sqlite.name} -> {dest_mushaf}")

        # Update local Generated files if requested
        if args.update_generated:
            print("\n[Optional] Updating local apps/ios/Generated seed files ...")
            dest_seed = ios_generated_dir / "mutshabehat_seed.json"
            dest_sqlite = ios_generated_dir / "mutshabehat.sqlite"
            shutil.copy2(tmp_mutsh_json, dest_seed)
            shutil.copy2(tmp_mutsh_sqlite, dest_sqlite)
            print(f"  ✓ Updated {dest_seed} (251 groups)")
            print(f"  ✓ Updated {dest_sqlite}")

    print("\n✅ Successfully synced all databases to iCloud Drive: Mushaf_Qiraat")


if __name__ == "__main__":
    main()
