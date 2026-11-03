import unittest

import sync_colima_to_icloud as sync


class SqlLiteralTests(unittest.TestCase):
    """The iCloud JSON is data from another device. Whatever it holds must end up as a value, never as SQL."""

    def test_a_timestamp_is_parsed_and_written_back_in_a_fixed_form(self):
        self.assertEqual(sync.sql_timestamp("2026-10-30T12:34:56+00:00"), "'2026-10-30T12:34:56+00:00'::timestamptz")
        self.assertEqual(sync.sql_timestamp("2026-10-30T12:34:56Z"), "'2026-10-30T12:34:56+00:00'::timestamptz")

    def test_a_missing_timestamp_is_now(self):
        self.assertEqual(sync.sql_timestamp(None), "now()")
        self.assertEqual(sync.sql_timestamp(""), "now()")

    def test_a_timestamp_that_carries_sql_is_refused(self):
        for hostile in ["x'); DROP TABLE groups; --", "2026-10-30'; DELETE FROM groups; --", "now()", "1; select 1"]:
            with self.assertRaises(ValueError, msg=hostile):
                sync.sql_timestamp(hostile)

    def test_text_has_its_quotes_doubled(self):
        self.assertEqual(sync.sql_text("it's"), "'it''s'")
        self.assertEqual(sync.sql_text("x'); DROP TABLE groups; --"), "'x''); DROP TABLE groups; --'")

    def test_text_with_a_nul_byte_is_refused(self):
        with self.assertRaises(ValueError):
            sync.sql_text("a\x00b")

    def test_none_is_an_empty_string(self):
        self.assertEqual(sync.sql_text(None), "''")


if __name__ == "__main__":
    unittest.main()
