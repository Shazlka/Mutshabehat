#!/usr/bin/env python3
"""
Compiles Generated/mutshabehat_seed.json into Generated/mutshabehat.sqlite
for offline use in the iOS app.
"""
import json
import os
import sqlite3
import sys

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    seed_path = os.path.join(root, "Generated", "mutshabehat_seed.json")
    db_path = os.path.join(root, "Generated", "mutshabehat.sqlite")

    if not os.path.exists(seed_path):
        print(f"Error: {seed_path} not found", file=sys.stderr)
        sys.exit(1)

    if os.path.exists(db_path):
        os.remove(db_path)

    with open(seed_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    cur.execute("PRAGMA journal_mode = WAL;")
    cur.execute("PRAGMA foreign_keys = ON;")

    # Tables for Personal Groups
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

    # Table for Automated Groups
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

    # Indices
    cur.execute("CREATE INDEX idx_verses_group ON verses(group_id);")
    cur.execute("CREATE INDEX idx_verses_surah ON verses(surah);")
    cur.execute("CREATE INDEX idx_parts_verse ON parts(verse_id);")
    cur.execute("CREATE INDEX idx_automated_title ON automated_groups(title);")

    # Insert groups
    groups = data.get("groups", [])
    print(f"Importing {len(groups)} personal groups...")

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
    conn.close()

    size_kb = os.path.getsize(db_path) / 1024
    print(f"Generated {db_path} ({size_kb:.1f} KB)")

if __name__ == "__main__":
    main()
