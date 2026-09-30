"""Tests for build_mushaf_db.py. Stdlib only: python3 scripts/ios/test_build_mushaf_db.py -v"""
import os
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_mushaf_db  # noqa: E402

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


class BuildMushafDbTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.path = os.path.join(cls.tmp.name, "mushaf.sqlite")
        cls.tokens = build_mushaf_db.build(REPO, cls.path)
        cls.db = sqlite3.connect(cls.path)

    @classmethod
    def tearDownClass(cls):
        cls.db.close()
        cls.tmp.cleanup()

    def count(self, sql):
        return self.db.execute(sql).fetchone()[0]

    def decorations(self, page):
        return self.db.execute(
            "SELECT line, surah_header, basmala FROM decorations WHERE page = ? ORDER BY line", (page,)).fetchall()

    def test_row_counts_match_the_fixtures(self):
        self.assertEqual(self.tokens, 83665)  # page-words-manifest.json totalTokens
        self.assertEqual(self.count("SELECT COUNT(*) FROM words"), 83665)
        self.assertEqual(self.count("SELECT COUNT(*) FROM pages"), 604)
        self.assertEqual(self.count("SELECT COUNT(*) FROM surahs"), 114)
        self.assertEqual(self.count("SELECT COUNT(*) FROM decorations"), 226)
        self.assertEqual(self.count("SELECT COUNT(DISTINCT page) FROM decorations"), 116)
        self.assertEqual(self.count("SELECT value FROM meta WHERE key = 'schema_version'"), "1")

    def test_every_word_has_a_glyph_and_every_ayah_ends_once(self):
        self.assertEqual(self.count("SELECT COUNT(*) FROM words WHERE glyph = ''"), 0)
        self.assertEqual(self.count("SELECT COUNT(*) FROM words WHERE char_type = 'end'"), 6236)

    def test_decorations_match_pageDecorations_ts(self):
        # Verified against computeMushaf1441PageDecorations for all 604 pages on 2026-09-30 (0 diffs).
        self.assertEqual(self.decorations(1), [(1, 1, 0)])                # Al-Fatihah: header only
        self.assertEqual(self.decorations(2), [(1, 2, 0), (2, None, 1)])  # Al-Baqarah: header + basmala
        self.assertEqual(self.decorations(187), [(1, 9, 0)])              # At-Tawbah: no basmala
        self.assertEqual(self.decorations(76), [(15, 4, 0)])              # An-Nisa header at the foot of 76 ...
        self.assertEqual(self.decorations(77), [(1, None, 1)])            # ... and its basmala tops 77

    def test_rebuild_is_idempotent(self):
        second = os.path.join(self.tmp.name, "again.sqlite")
        build_mushaf_db.build(REPO, second)
        other = sqlite3.connect(second)
        query = "SELECT * FROM words ORDER BY id"
        self.assertEqual(self.db.execute(query).fetchall(), other.execute(query).fetchall())
        other.close()


if __name__ == "__main__":
    unittest.main()
