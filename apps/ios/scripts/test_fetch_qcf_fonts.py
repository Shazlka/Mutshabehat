"""Tests for fetch_qcf_fonts.sh against a local file:// source of synthetic woff2 files.
Stdlib only, no network: python3 apps/ios/scripts/test_fetch_qcf_fonts.py -v"""
import os
import shutil
import struct
import subprocess
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, "fetch_qcf_fonts.sh")


def fake_woff2(page):
    """What the script checks: the "wOF2" signature and the total length stored in bytes 8-11."""
    body = bytes([page % 251]) * (1000 + page)
    size = 12 + len(body)
    return b"wOF2" + b"\x00\x01\x00\x00" + struct.pack(">I", size) + body


class FetchQcfFontsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.src = os.path.join(self.tmp, "src")
        self.out = os.path.join(self.tmp, "out")
        os.makedirs(self.src)
        for page in (1, 2):
            with open(os.path.join(self.src, f"p{page}.woff2"), "wb") as f:
                f.write(fake_woff2(page))

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def truncate(self, path):
        with open(path, "rb") as f:
            data = f.read()
        with open(path, "wb") as f:
            f.write(data[: len(data) // 2])  # still starts with "wOF2"

    def run_script(self):
        env = dict(os.environ, QCF_FONT_BASE="file://" + self.src, QCF_FIRST_PAGE="1", QCF_LAST_PAGE="2")
        return subprocess.run(["bash", SCRIPT, self.out], env=env, capture_output=True, text=True)

    def test_complete_fonts_are_fetched(self):
        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        for page in (1, 2):
            self.assertTrue(os.path.getsize(os.path.join(self.out, f"p{page}.woff2")) > 0)

    def test_a_truncated_download_fails_the_run_and_is_not_kept(self):
        self.truncate(os.path.join(self.src, "p2.woff2"))
        result = self.run_script()
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(os.path.exists(os.path.join(self.out, "p2.woff2")), "truncated font was kept")
        self.assertFalse(os.path.exists(os.path.join(self.out, "p2.woff2.part")))

    def test_a_truncated_font_already_on_disk_is_fetched_again(self):
        os.makedirs(self.out)
        shutil.copy(os.path.join(self.src, "p1.woff2"), self.out)
        self.truncate(os.path.join(self.out, "p1.woff2"))
        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        with open(os.path.join(self.out, "p1.woff2"), "rb") as got, open(os.path.join(self.src, "p1.woff2"), "rb") as want:
            self.assertEqual(got.read(), want.read())

    def test_a_missing_source_fails_the_run(self):
        os.remove(os.path.join(self.src, "p2.woff2"))
        result = self.run_script()
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(os.path.exists(os.path.join(self.out, "p2.woff2.part")))


if __name__ == "__main__":
    unittest.main()
