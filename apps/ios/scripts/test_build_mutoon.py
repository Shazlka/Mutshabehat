"""Offline tests: python3 apps/ios/scripts/test_build_mutoon.py -v. The verses are synthetic."""

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("build_mutoon.py")
spec = importlib.util.spec_from_file_location("build_mutoon", SCRIPT)
build_mutoon = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build_mutoon)


def verse(work, number, chapter, farsh=False, lines=("شطر أول", "شطر ثان")):
    return {"work": work, "book": {"shatibiyyah": 1, "durrah": 2, "tayyibah": 3}[work], "verse": number,
            "pageId": 10 + number, "printedPage": str(number), "lines": list(lines), "chapter": chapter, "farsh": farsh}


SAMPLE = [
    verse("shatibiyyah", 1, "المقدمة"), verse("shatibiyyah", 2, "المقدمة"), verse("shatibiyyah", 3, "سورة البقرة", True),
    verse("durrah", 1, "المقدمة"), verse("durrah", 2, "سورة البقرة", True),
    verse("tayyibah", 1, "المقدمة"), verse("tayyibah", 3, "سورة البقرة", True),
]


class BuildMutoonTests(unittest.TestCase):
    def test_groups_each_book_by_chapter_in_order(self):
        document = build_mutoon.build(SAMPLE)
        self.assertEqual(document["schemaVersion"], 1)
        self.assertEqual([w["work"] for w in document["works"]], ["shatibiyyah", "durrah", "tayyibah"])
        shatibiyyah = document["works"][0]
        self.assertEqual([c["title"] for c in shatibiyyah["chapters"]], ["المقدمة", "سورة البقرة"])
        self.assertEqual([v["number"] for v in shatibiyyah["chapters"][0]["verses"]], [1, 2])
        self.assertTrue(shatibiyyah["chapters"][1]["farsh"])
        self.assertEqual(shatibiyyah["bookId"], 1)
        self.assertEqual(shatibiyyah["chapters"][0]["verses"][0],
                         {"number": 1, "lines": ["شطر أول", "شطر ثان"], "printedPage": "1", "pageId": 11})

    def test_the_report_names_missing_verse_numbers(self):
        lines = build_mutoon.report(build_mutoon.build(SAMPLE))
        self.assertIn("tayyibah: 2 verses, 2 chapters, last 3, missing [2]", lines)

    def test_a_missing_book_or_an_empty_verse_is_an_error(self):
        with self.assertRaises(ValueError):
            build_mutoon.build([v for v in SAMPLE if v["work"] != "durrah"])
        with self.assertRaises(ValueError):
            build_mutoon.build(SAMPLE + [verse("durrah", 3, "سورة البقرة", True, lines=("  ",))])

    def test_main_writes_the_file_and_fails_clearly_without_input(self):
        with tempfile.TemporaryDirectory() as folder:
            source, target = Path(folder) / "verses.json", Path(folder) / "out" / "mutoon.json"
            self.assertEqual(build_mutoon.main(["build_mutoon.py", str(source), str(target)]), 1)
            source.write_text(json.dumps(SAMPLE, ensure_ascii=False), encoding="utf-8")
            self.assertEqual(build_mutoon.main(["build_mutoon.py", str(source), str(target)]), 0)
            self.assertEqual(len(json.loads(target.read_text(encoding="utf-8"))["works"]), 3)


if __name__ == "__main__":
    unittest.main()
