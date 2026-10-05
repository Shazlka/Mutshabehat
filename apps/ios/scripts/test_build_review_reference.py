"""Offline tests: python3 apps/ios/scripts/test_build_review_reference.py -v."""

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SCRIPT = Path(__file__).with_name("build_review_reference.py")
spec = importlib.util.spec_from_file_location("build_review_reference", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

REFERENCE = "src/app/mushaf-1441/review/_lib/reference"


def make_repo(root, surahs=114, shamil_index=True):
    nquran = Path(root) / REFERENCE / "nquran"
    shamil = Path(root) / REFERENCE / "shamil"
    nquran.mkdir(parents=True)
    shamil.mkdir(parents=True)
    for n in range(1, surahs + 1):
        (nquran / f"surah-{n:03d}.json").write_text(json.dumps([{"surahNumber": n, "ayah": 1, "differences": []}]))
    (shamil / "surah-002.json").write_text("[]")
    if shamil_index:
        (shamil / "index.json").write_text(json.dumps({"surahs": {"2": {"entries": 0}}}))


class BuildReviewReferenceTests(unittest.TestCase):
    def test_copies_all_114_surahs(self):
        with tempfile.TemporaryDirectory() as repo, tempfile.TemporaryDirectory() as out:
            make_repo(repo)
            module.build(Path(repo), Path(out))
            self.assertEqual(len(list((Path(out) / "nquran").glob("surah-*.json"))), 114)
            self.assertTrue((Path(out) / "shamil" / "index.json").is_file())
            self.assertTrue((Path(out) / "shamil" / "surah-002.json").is_file())

    def test_fails_when_a_surah_is_missing(self):
        with tempfile.TemporaryDirectory() as repo, tempfile.TemporaryDirectory() as out:
            make_repo(repo, surahs=113)
            with self.assertRaises(SystemExit):
                module.build(Path(repo), Path(out))

    def test_fails_without_shamil_index(self):
        with tempfile.TemporaryDirectory() as repo, tempfile.TemporaryDirectory() as out:
            make_repo(repo, shamil_index=False)
            with self.assertRaises(SystemExit):
                module.build(Path(repo), Path(out))

    def test_replaces_stale_files(self):
        with tempfile.TemporaryDirectory() as repo, tempfile.TemporaryDirectory() as out:
            make_repo(repo)
            stale = Path(out) / "nquran" / "surah-999.json"
            stale.parent.mkdir(parents=True)
            stale.write_text("[]")
            module.build(Path(repo), Path(out))
            self.assertFalse(stale.exists())


if __name__ == "__main__":
    unittest.main()
