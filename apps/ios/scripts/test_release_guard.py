import os
import tempfile
import unittest

import release_guard


def make_app(root: str, binary: bytes, extra_dir=None) -> str:
    app = os.path.join(root, "Mutshabehat.app")
    os.makedirs(app)
    with open(os.path.join(app, "Mutshabehat"), "wb") as f:
        f.write(binary)
    if extra_dir:
        os.makedirs(os.path.join(app, extra_dir))
    return app


class ReleaseGuardTests(unittest.TestCase):
    def test_clean_app_passes(self):
        with tempfile.TemporaryDirectory() as d:
            app = make_app(d, b"\x00\x01Reader\x00Mutshabehat\x00")
            self.assertEqual(release_guard.check(app), [])

    def test_release_guard_detects_leaked_symbol(self):
        for symbol in release_guard.FORBIDDEN_SYMBOLS:
            with tempfile.TemporaryDirectory() as d:
                app = make_app(d, b"\x00\x02" + symbol.encode() + b"\x00")
                self.assertEqual(release_guard.check(app), [f"binary contains '{symbol}'"])

    def test_detects_reference_folder(self):
        with tempfile.TemporaryDirectory() as d:
            app = make_app(d, b"\x00clean\x00", extra_dir="Resources/ReviewReference")
            problems = release_guard.check(app)
            self.assertEqual(len(problems), 1)
            self.assertIn("ReviewReference", problems[0])


if __name__ == "__main__":
    unittest.main()
