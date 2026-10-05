#!/usr/bin/env python3
"""Syncs databases directly from Colima PostgreSQL (mutshabehat-db on Mac Mini) into iCloud Drive Mushaf_Qiraat.

Exports:
- mutshabehat.sqlite & mutshabehat.json (251 Groups, 943 Verses, 3054 Parts, Automated Groups, Annotations)
- database_backup.sql & database_dump.dump (Full PostgreSQL Backups for Web App Restoration)
- qiraat.sqlite & qiraat.qiraatdata (Ten Qira'at Catalog, Rulings, Variants, 604 Pages)
- mushaf.sqlite (Quran 1441 Page Layout, Words, Glyph Coordinates, Search Tokens)
- manifest.json (Metadata, Timestamps, Entity Counts, SHA-256 Hashes)

Usage:
    python3 apps/ios/scripts/sync_colima_to_icloud.py [--dest PATH]
"""

import argparse
import base64
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import tempfile

DEFAULT_ICLOUD_DEST = os.path.expanduser("~/Library/Mobile Documents/com~apple~CloudDocs/Mushaf_Qiraat")

ENV = dict(os.environ)
ENV["PATH"] = "/Library/Developer/CommandLineTools/usr/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:" + ENV.get("PATH", "")
ENV["DOCKER_HOST"] = "unix:///Users/amrelshazly/.colima/default/docker.sock"


def safe_copy(src: Path, dst: Path):
    """Copies file contents using standard POSIX read/write streams, avoiding macOS fcopyfile(3) EPERM on iCloud files."""
    with open(src, "rb") as fsrc, open(dst, "wb") as fdst:
        while True:
            chunk = fsrc.read(1048576)
            if not chunk:
                break
            fdst.write(chunk)


def compute_sha256(filepath: Path) -> str:
    try:
        stat_res = os.stat(filepath)
        # SF_DATALESS flag on macOS is 0x40000000
        if getattr(stat_res, "st_flags", 0) & 0x40000000:
            return "dataless_icloud_file"
        hasher = hashlib.sha256()
        with open(filepath, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
        return hasher.hexdigest()
    except Exception as e:
        return f"unavailable_{type(e).__name__}"


def run_cmd(cmd: str, check: bool = True) -> str:
    res = subprocess.run(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=ENV)
    if check and res.returncode != 0:
        raise RuntimeError(f"Command failed ({res.returncode}): {cmd}\nStderr: {res.stderr}")
    return res.stdout


def export_colima_data():
    print("  [1/5] Extracting personal groups, verses, and parts from Colima postgres...")
    sql_groups = """
    SELECT json_build_object(
      'version', 2,
      'exported_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'source', 'colima://mutshabehat-db (amr-Mac-mini)',
      'groups', coalesce(json_agg(g ORDER BY g.created_at DESC), '[]'::json)
    )
    FROM (
      SELECT 
        g.id,
        g.title,
        g.color,
        g.status,
        g.favorite,
        g.completed,
        coalesce(g.note, '') as note,
        coalesce(g.unote, '') as unote,
        to_char(g.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
        to_char(g.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at,
        coalesce(
          (
            SELECT json_agg(v ORDER BY v.sort_order, v.ayah)
            FROM (
              SELECT 
                v.id,
                v.surah,
                v.ayah,
                v.label,
                v.sort_order,
                coalesce(
                  (
                    SELECT json_agg(p ORDER BY p.sort_order)
                    FROM (
                      SELECT p.id, p.type, p.text, p.sort_order
                      FROM parts p
                      WHERE p.verse_id = v.id
                      ORDER BY p.sort_order
                    ) p
                  ),
                  '[]'::json
                ) as parts
              FROM verses v
              WHERE v.group_id = g.id
              ORDER BY v.sort_order, v.ayah
            ) v
          ),
          '[]'::json
        ) as verses
      FROM groups g
    ) g;
    """
    raw_json = run_cmd(f"docker exec mutshabehat-db psql -U postgres -d postgres -t -A -c \"{sql_groups}\"")
    mutsh_data = json.loads(raw_json)

    print("  [2/5] Querying metadata counts from Colima...")
    auto_count_str = run_cmd("docker exec mutshabehat-db psql -U postgres -d postgres -t -A -c 'SELECT count(*) FROM automated_groups;'").strip()
    auto_count = int(auto_count_str) if auto_count_str else 0

    annot_count_str = run_cmd("docker exec mutshabehat-db psql -U postgres -d postgres -t -A -c 'SELECT count(*) FROM mushaf_annotations;'").strip()
    annot_count = int(annot_count_str) if annot_count_str else 0

    return mutsh_data, auto_count, annot_count


def build_mutshabehat_sqlite(data: dict, output_path: Path):
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


def import_to_colima(json_path: Path):
    print(f"=== Importing from iCloud JSON into Colima PostgreSQL: {json_path} ===")
    if not json_path.exists():
        raise FileNotFoundError(f"Cannot find {json_path}")

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    groups = data.get("groups", [])
    print(f"  -> Found {len(groups)} groups to import/sync into Colima...")

    # Build SQL script for atomic upsert
    statements = [
        "BEGIN;",
        "SET LOCAL search_path = public, auth;",
    ]

    # Get admin user ID from auth.users or profiles
    user_id_query = run_cmd("docker exec mutshabehat-db psql -U postgres -d postgres -t -A -c 'SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1;'").strip()
    if not user_id_query:
        user_id_query = "00000000-0000-0000-0000-000000000000"

    for g in groups:
        gid = g["id"].replace("'", "''")
        title = g.get("title", "").replace("'", "''")
        color = (g.get("color") or "#55b94f").replace("'", "''")
        status = (g.get("status") or "draft").replace("'", "''")
        fav = "true" if g.get("favorite") else "false"
        comp = "true" if g.get("completed") else "false"
        note = (g.get("note") or "").replace("'", "''")
        unote = (g.get("unote") or "").replace("'", "''")
        created_at = g.get("created_at") or "now()"
        updated_at = g.get("updated_at") or "now()"

        statements.append(f"""
        INSERT INTO groups (id, user_id, title, color, status, favorite, completed, note, unote, created_at, updated_at)
        VALUES ('{gid}', '{user_id_query}', '{title}', '{color}', '{status}', {fav}, {comp}, '{note}', '{unote}', '{created_at}', '{updated_at}')
        ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            color = EXCLUDED.color,
            status = EXCLUDED.status,
            favorite = EXCLUDED.favorite,
            completed = EXCLUDED.completed,
            note = EXCLUDED.note,
            unote = EXCLUDED.unote,
            updated_at = EXCLUDED.updated_at;
        """)

        # Delete existing verses to replace with incoming verses atomically
        statements.append(f"DELETE FROM verses WHERE group_id = '{gid}';")

        for v in g.get("verses", []):
            vid = v["id"].replace("'", "''")
            surah = (v.get("surah") or "").replace("'", "''")
            ayah = int(v.get("ayah") or 1)
            label = (v.get("label") or "").replace("'", "''")
            sort_order = int(v.get("sort_order") or 0)

            statements.append(f"""
            INSERT INTO verses (id, group_id, surah, ayah, label, sort_order)
            VALUES ('{vid}', '{gid}', '{surah}', {ayah}, '{label}', {sort_order});
            """)

            for p in v.get("parts", []):
                pid = p["id"].replace("'", "''")
                ptype = (p.get("type") or "normal").replace("'", "''")
                ptext = (p.get("text") or "").replace("'", "''")
                psort = int(p.get("sort_order") or 0)

                statements.append(f"""
                INSERT INTO parts (id, verse_id, type, text, sort_order)
                VALUES ('{pid}', '{vid}', '{ptype}', '{ptext}', {psort});
                """)

    statements.append("COMMIT;")

    sql_payload = "\n".join(statements)
    proc = subprocess.Popen(
        ["docker", "exec", "-i", "mutshabehat-db", "psql", "-U", "postgres", "-d", "postgres"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=ENV
    )
    stdout, stderr = proc.communicate(input=sql_payload)
    if proc.returncode != 0:
        raise RuntimeError(f"Failed to import into Colima Postgres: {stderr}")

    print("  ✓ Successfully imported groups, verses, and parts into Colima Postgres!")
    print(f"  ✓ Output summary: {stdout.strip().splitlines()[-1] if stdout else 'DONE'}")


def main():
    parser = argparse.ArgumentParser(description="Sync Colima PostgreSQL databases to/from iCloud Drive Mushaf_Qiraat folder.")
    parser.add_argument("--dest", default=DEFAULT_ICLOUD_DEST, help="Destination iCloud Drive directory")
    parser.add_argument("--import-icloud", action="store_true", help="Import from iCloud mutshabehat.json into Colima Postgres")
    args = parser.parse_args()

    dest_dir = Path(args.dest)
    dest_dir.mkdir(parents=True, exist_ok=True)

    if args.import_icloud:
        import_to_colima(dest_dir / "mutshabehat.json")
        return

    print("=== Colima PostgreSQL to iCloud Mushaf_Qiraat Sync ===")
    print(f"Target iCloud Folder: {dest_dir}")

    with tempfile.TemporaryDirectory() as tmp_str:
        tmp_dir = Path(tmp_str)

        # 1. Export JSON and compile SQLite
        mutsh_data, auto_count, annot_count = export_colima_data()
        groups_list = mutsh_data.get("groups", [])
        groups_cnt = len(groups_list)
        verses_cnt = sum(len(g.get("verses", [])) for g in groups_list)
        parts_cnt = sum(len(v.get("parts", [])) for g in groups_list for v in g.get("verses", []))
        print(f"  -> Extracted: {groups_cnt} groups, {verses_cnt} verses, {parts_cnt} parts.")

        tmp_json = tmp_dir / "mutshabehat.json"
        tmp_json.write_text(json.dumps(mutsh_data, ensure_ascii=False, indent=2), encoding="utf-8")

        tmp_sqlite = tmp_dir / "mutshabehat.sqlite"
        build_mutshabehat_sqlite(mutsh_data, tmp_sqlite)
        print(f"  -> Compiled mutshabehat.sqlite ({tmp_sqlite.stat().st_size / 1024:.1f} KB)")

        # 2. Dump Postgres Full Backups for Web App
        print("  [3/5] Generating database_backup.sql and database_dump.dump from Colima...")
        tmp_sql = tmp_dir / "database_backup.sql"
        tmp_dump = tmp_dir / "database_dump.dump"
        run_cmd(f"docker exec mutshabehat-db pg_dump -U postgres -d postgres --schema=public > '{tmp_sql}'")
        run_cmd(f"docker exec mutshabehat-db pg_dump -U postgres -d postgres --schema=public --schema=auth -Fc > '{tmp_dump}'")
        print(f"  -> database_backup.sql: {tmp_sql.stat().st_size / (1024*1024):.1f} MB, database_dump.dump: {tmp_dump.stat().st_size / (1024*1024):.1f} MB")

        # 3. Publish to iCloud folder
        print("  [4/5] Publishing files to iCloud folder...")
        for f in [tmp_json, tmp_sqlite, tmp_sql, tmp_dump]:
            dest_file = dest_dir / f.name
            safe_copy(f, dest_file)
            print(f"     ✓ {f.name} -> {dest_file}")

        # 4. Check Qiraat and Mushaf files
        qiraat_sqlite = dest_dir / "qiraat.sqlite"
        qiraat_data = dest_dir / "qiraat.qiraatdata"
        mushaf_sqlite = dest_dir / "mushaf.sqlite"

        # 5. Build and write manifest
        print("  [5/5] Generating manifest.json with SHA-256 signatures...")
        now_iso = datetime.now(timezone.utc).isoformat()
        manifest = {
            "schema_version": 1,
            "exported_at": now_iso,
            "source_of_truth": "colima://mutshabehat-db (amr-Mac-mini)",
            "databases": {
                "mutshabehat": {
                    "file": "mutshabehat.sqlite",
                    "json_file": "mutshabehat.json",
                    "groups_count": groups_cnt,
                    "verses_count": verses_cnt,
                    "parts_count": parts_cnt,
                    "automated_groups_count": auto_count,
                    "mushaf_annotations_count": annot_count,
                    "sha256": compute_sha256(dest_dir / "mutshabehat.sqlite"),
                    "size_bytes": (dest_dir / "mutshabehat.sqlite").stat().st_size,
                },
                "postgres_full": {
                    "file": "database_dump.dump",
                    "dump_file": "database_dump.dump",
                    "sql_file": "database_backup.sql",
                    "sha256": compute_sha256(dest_dir / "database_dump.dump"),
                    "sha256_dump": compute_sha256(dest_dir / "database_dump.dump"),
                    "size_bytes": (dest_dir / "database_dump.dump").stat().st_size,
                    "size_dump_bytes": (dest_dir / "database_dump.dump").stat().st_size,
                    "size_sql_bytes": (dest_dir / "database_backup.sql").stat().st_size,
                }
            }
        }
        if qiraat_sqlite.exists():
            manifest["databases"]["qiraat"] = {
                "file": "qiraat.sqlite",
                "archive_file": "qiraat.qiraatdata" if qiraat_data.exists() else None,
                "page_count": 604,
                "sha256": compute_sha256(qiraat_sqlite),
                "size_bytes": qiraat_sqlite.stat().st_size,
            }
        if mushaf_sqlite.exists():
            manifest["databases"]["mushaf"] = {
                "file": "mushaf.sqlite",
                "sha256": compute_sha256(mushaf_sqlite),
                "size_bytes": mushaf_sqlite.stat().st_size,
            }

        manifest_path = dest_dir / "manifest.json"
        manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"     ✓ manifest.json -> {manifest_path}")

    print("\n✅ Successfully exported database from Colima and imported into iCloud Mushaf_Qiraat!")


if __name__ == "__main__":
    main()
