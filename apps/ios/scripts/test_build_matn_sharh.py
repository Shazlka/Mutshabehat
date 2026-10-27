"""Offline tests: python3 apps/ios/scripts/test_build_matn_sharh.py -v. Synthetic HTML fixtures."""

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("build_matn_sharh.py")
spec = importlib.util.spec_from_file_location("build_matn_sharh", SCRIPT)
build_matn_sharh = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build_matn_sharh)


class BuildMatnSharhTests(unittest.TestCase):
    def test_wafi_blocks_parses_numbered_verses(self):
        lines = [
            ("9", "١ - بدأت ببسم الله ... وموئلا"),
            ("9", "[اللغة]: البدء والابتداء واحد."),
            ("9", "والمعنى: الاستعانة بالله تعالى."),
            ("10", "٢ - وثنيت ... مجلا"),
            ("10", "المعنى: الثناء على الله."),
        ]
        blocks = build_matn_sharh.wafi_blocks(lines)
        self.assertEqual(set(blocks.keys()), {1, 2})
        self.assertEqual(blocks[1][1], ["9"])
        self.assertIn("الاستعانة بالله", blocks[1][0])
        self.assertEqual(blocks[2][1], ["10"])
        self.assertIn("الثناء على الله", blocks[2][0])

    def test_hadi_blocks_matches_quoted_hemistichs(self):
        verses = {
            1: ["قال محمد هو ابن الجزري", "يا ذا الجلال ارحمه واستر واغفر"],
            2: ["الحمد لله على ما يسره", "من نشر منقول حوى ما فرقه"],
        }
        lines = [
            ("7", "قال ابن الجزري:"),
            ("7", "قال محمد هو ابن الجزري ... يا ذا الجلال ارحمه واستر واغفر"),
            ("7", "المعنى: بدأ المؤلف بمناجاة الله تعالى."),
            ("8", "قال ابن الجزري:"),
            ("8", "الحمد لله على ما يسره ... من نشر منقول حوى ما فرقه"),
            ("8", "المعنى: يرفع المؤلف الثناء والشكر."),
        ]
        blocks = build_matn_sharh.hadi_blocks(lines, verses)
        self.assertEqual(set(blocks.keys()), {1, 2})
        self.assertIn("مناجاة الله", blocks[1][0])
        self.assertIn("الثناء والشكر", blocks[2][0])

    def test_build_document_and_main(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            dir_path = Path(temp_dir)
            sharh_dir = dir_path / "sharh-html"
            wafi_dir = sharh_dir / "38075"
            wafi_dir.mkdir(parents=True)
            (wafi_dir / "1.html").write_text(
                '<input id="fld_goto_top" value="1"/>'
                '<div class="nass">١ - شطر أول ... شطر ثان<br/>شرح البيت الأول</div><div id="appended_pages"></div>',
                encoding="utf-8"
            )

            mutoon_file = dir_path / "mutoon.json"
            mutoon_file.write_text(json.dumps({
                "schemaVersion": 1,
                "works": [
                    {"work": "shatibiyyah", "title": "الشاطبية", "chapters": [
                        {"title": "المقدمة", "verses": [{"number": 1, "lines": ["شطر أول", "شطر ثان"]}]}
                    ]}
                ]
            }, ensure_ascii=False), encoding="utf-8")

            out_file = dir_path / "out" / "mutoon-sharh.json"

            # Check CLI runs successfully
            code = build_matn_sharh.main(["build_matn_sharh.py", str(sharh_dir), str(mutoon_file), str(out_file)])
            self.assertEqual(code, 0)
            self.assertTrue(out_file.exists())

            doc = json.loads(out_file.read_text(encoding="utf-8"))
            self.assertEqual(doc["schemaVersion"], 1)
            self.assertIn("shatibiyyah", doc["commentaries"])
            shat = doc["commentaries"]["shatibiyyah"]
            self.assertEqual(shat["title"], "الوافي في شرح الشاطبية")
            self.assertIn("1", shat["verses"])
            self.assertIn("شرح البيت الأول", shat["verses"]["1"]["text"])


if __name__ == "__main__":
    unittest.main()
