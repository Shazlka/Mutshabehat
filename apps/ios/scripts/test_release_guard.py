import os
import sqlite3
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


class PrivateNotesTests(unittest.TestCase):
    def _app_with_groups(self, root: str, unotes) -> str:
        app = make_app(root, b"\x00clean\x00")
        conn = sqlite3.connect(os.path.join(app, "mutshabehat.sqlite"))
        conn.execute("CREATE TABLE groups (id TEXT, unote TEXT)")
        conn.executemany("INSERT INTO groups VALUES (?, ?)", [(str(i), n) for i, n in enumerate(unotes)])
        conn.commit()
        conn.close()
        return app

    def test_a_bundled_private_note_fails_the_guard(self):
        with tempfile.TemporaryDirectory() as d:
            app = self._app_with_groups(d, [None, "ملاحظة خاصة", ""])
            self.assertEqual(release_guard.check(app), ["1 bundled groups still carry a private note (unote)"])

    def test_groups_without_private_notes_pass(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(release_guard.check(self._app_with_groups(d, [None, "  ", ""])), [])

    def test_keep_private_notes_switch_allows_them(self):
        with tempfile.TemporaryDirectory() as d:
            app = self._app_with_groups(d, ["x"])
            os.environ["KEEP_PRIVATE_NOTES"] = "YES"
            try:
                self.assertEqual(release_guard.check(app), [])
            finally:
                del os.environ["KEEP_PRIVATE_NOTES"]


if __name__ == "__main__":
    unittest.main()
