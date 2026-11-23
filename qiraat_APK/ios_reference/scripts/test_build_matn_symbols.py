"""Offline tests: python3 apps/ios/scripts/test_build_matn_symbols.py -v. The hemistichs are synthetic."""

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("build_matn_symbols.py")
spec = importlib.util.spec_from_file_location("build_matn_symbols", SCRIPT)
build_matn_symbols = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build_matn_symbols)

MUTOON = {"schemaVersion": 1, "works": [{"work": "shatibiyyah", "chapters": [{"verses": [
    {"number": 1, "lines": ["وَقُلْ رَاوِيهِ وَسِرَاطٍ نَاصِرٌ،", "وَحَقٌّ صُحْبَةٌ رَمَى رَمَى"]}]}]}]}


def mark(word, mode="letter", line=0, **extra):
    return dict({"work": "shatibiyyah", "verse": 1, "line": line, "word": word, "mode": mode, "symbol": "ر",
                 "kind": "reader", "readingIds": ["Q07"], "status": "verified"}, **extra)


class BuildMatnSymbolsTests(unittest.TestCase):
    def test_a_letter_keeps_its_marks_and_is_one_character(self):
        self.assertEqual(build_matn_symbols.characters("حَقٌّ"), ["حَ", "قٌّ"])
        m = build_matn_symbols.build([mark("رَاوِيهِ")], MUTOON)["annotations"][0]
        self.assertEqual((m["start"], m["end"], m["text"]), (4, 5, "رَ"))  # وَ قُ لْ and the space come first

    def test_a_word_symbol_covers_the_word_without_its_punctuation(self):
        doc = build_matn_symbols.build([mark("صُحْبَةٌ", "word", 1, symbol="صحبة", kind="group"),
                                        mark("نَاصِرٌ", "word")], MUTOON)
        texts = [m["text"] for m in doc["annotations"]]
        self.assertIn("صُحْبَةٌ", texts)
        self.assertIn("نَاصِرٌ", texts)  # the trailing «،» is not marked

    def test_only_the_named_word_is_marked_and_occurrence_picks_a_repeat(self):
        first = build_matn_symbols.build([mark("رَمَى", line=1)], MUTOON)["annotations"][0]
        second = build_matn_symbols.build([mark("رَمَى", line=1, occurrence=2)], MUTOON)["annotations"][0]
        self.assertLess(first["start"], second["start"])
        # The ر inside «وَسِرَاطٍ» is never marked: marks come only from the list, never from the letter alone.
        doc = build_matn_symbols.build([mark("رَاوِيهِ")], MUTOON)
        self.assertEqual(len(doc["annotations"]), 1)

    def test_a_stray_mark_before_a_word_stays_with_the_space(self):
        mutoon = {"works": [{"work": "shatibiyyah", "chapters": [{"verses": [{"number": 1, "lines": ["قَالَ \u0650إلَى هُنَا", ""]}]}]}]}
        m = build_matn_symbols.build([mark("\u0650إلَى", symbol="أ", readingIds=["Q01"])], mutoon)["annotations"][0]
        self.assertEqual(m["text"], "إ")
        self.assertEqual(build_matn_symbols.characters("قَالَ \u0650إلَى")[3], " \u0650")

    def test_letters_alone_find_a_word_spelled_with_other_marks(self):
        m = build_matn_symbols.build([mark("راويه")], MUTOON)["annotations"][0]
        self.assertEqual(m["text"], "رَ")

    def test_a_missing_word_or_a_double_mark_stops_the_build(self):
        with self.assertRaises(ValueError):
            build_matn_symbols.build([mark("كَلِمَةٌ")], MUTOON)
        with self.assertRaises(ValueError):
            build_matn_symbols.build([mark("رَاوِيهِ"), mark("رَاوِيهِ")], MUTOON)
        with self.assertRaises(ValueError):
            build_matn_symbols.build([mark("رَاوِيهِ", status="guessed")], MUTOON)
        with self.assertRaises(ValueError):
            build_matn_symbols.build([mark("رَاوِيهِ", method="guessed")], MUTOON)

    def test_the_method_is_kept_and_defaults_to_by_hand(self):
        doc = build_matn_symbols.build([mark("رَاوِيهِ"), mark("نَاصِرٌ", method="match")], MUTOON)
        self.assertEqual([m["method"] for m in doc["annotations"]], ["hand", "match"])

    def test_main_writes_the_file(self):
        with tempfile.TemporaryDirectory() as folder:
            folder = Path(folder)
            (folder / "marks.json").write_text(json.dumps({"marks": [mark("رَاوِيهِ")]}, ensure_ascii=False), encoding="utf-8")
            (folder / "mutoon.json").write_text(json.dumps(MUTOON, ensure_ascii=False), encoding="utf-8")
            out = folder / "out" / "mutoon-symbols.json"
            self.assertEqual(build_matn_symbols.main(["x", str(folder / "missing.json"), str(folder / "mutoon.json"), str(out)]), 1)
            self.assertEqual(build_matn_symbols.main(["x", str(folder / "marks.json"), str(folder / "mutoon.json"), str(out)]), 0)
            self.assertEqual(json.loads(out.read_text(encoding="utf-8"))["schemaVersion"], 1)


if __name__ == "__main__":
    unittest.main()
