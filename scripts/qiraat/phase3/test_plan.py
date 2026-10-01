import unittest

from scripts.qiraat.phase3.emit_sql import sql_literal
from scripts.qiraat.phase3.emit_sql import _text_array, emit_sql
from scripts.qiraat.phase3.plan import (
    ALL_NARRATORS,
    classify_performance,
    d8_decision,
    merge_spans,
    narrator_twice,
    renumber_entry_orders,
    ruling_attribution_mismatch,
    build_plan,
)


class Phase3PlanTests(unittest.TestCase):
    def test_classifier_rules_and_fallback(self):
        cases = [
            ("فتح الياء", "ي", "YAAT_IDAFA"),
            ("إثبات الياء", "ا", "YAAT_ZAWAID"),
            ("الهمزتين", "ا", "HAMZATAN_KALIMA"),
            ("إبدال الهمز", "ا", "TAGHYIR_HAMZ"),
            ("نقل", "ا", "USUL_NAQL"),
            ("سكت", "ا", "USUL_SAKT"),
            ("إمالة", "ا", "IMALAH_TAQLIL"),
            ("صلة الهاء", "ا", "SILAT_HA"),
            ("ميم الجمع", "ا", "USUL_MIM_JAM"),
            ("ترقيق الراء", "ا", "TARQIQ_RA"),
            ("تغليظ اللام", "ا", "TAGHLIZ_LAM"),
            ("ترك الغنة", "ا", "TARK_GHUNNA"),
        ]
        for text, hafs, expected in cases:
            record = {"performanceNote": text, "description": "", "hafsText": hafs,
                      "startToken": 1, "endToken": 1}
            self.assertEqual(classify_performance(record)[0], expected, text)
        self.assertIsNone(classify_performance({"performanceNote": "إشمام", "description": ""})[0])
        self.assertIsNone(classify_performance({"performanceNote": "نقل وإمالة", "description": ""})[0])

    def test_d8_drop_partition_overlap_and_text(self):
        all_readers = sorted(ALL_NARRATORS)
        hafs = {"id": "h", "variantText": "مَالِك", "hafsText": "مَالِك", "readingIds": all_readers[:10] + ["Q05-R02"]}
        other = {"id": "o", "variantText": "مَلِك", "hafsText": "مَالِك", "readingIds": all_readers[10:]}
        self.assertEqual(d8_decision(hafs, [hafs, other])["action"], "drop")
        overlap = dict(other, readingIds=all_readers[9:])
        self.assertEqual(d8_decision(hafs, [hafs, overlap])["action"], "keep_flagged")
        changed = dict(hafs, variantText="مَلِك")
        self.assertEqual(d8_decision(changed, [changed, other])["action"], "keep_flagged")

    def test_span_merge_canonical_ids(self):
        records = [{"surah": 1, "ayah": 2, "startToken": 3, "endToken": 4,
                    "locusId": "fixture-b", "hafsText": "نص"}]
        existing = [{"id": "z", "surah_number": 1, "start_ayah": 2, "start_word": 3,
                     "end_ayah": 2, "end_word": 4, "deleted_at": None},
                    {"id": "a", "surah_number": 1, "start_ayah": 2, "start_word": 3,
                     "end_ayah": 2, "end_word": 4, "deleted_at": None}]
        self.assertEqual(merge_spans(records, existing)[0]["id"], "a")
        records[0]["locusId"] = "fixture-a"
        self.assertEqual(merge_spans(records, [])[0]["id"], "loc-001-002-003-002-004")

    def test_entry_order_renumber_only_changed_and_two_step(self):
        rows = [{"id": "b", "locus_id": "l", "kind": "variant", "entry_order": 3, "wajhIndex": 1},
                {"id": "a", "locus_id": "l", "kind": "variant", "entry_order": 1, "wajhIndex": 2}]
        result = renumber_entry_orders(rows)
        self.assertEqual([(r["id"], r["temporary"], r["final"]) for r in result],
                         [("b", 10001, 1), ("a", 10002, 2)])

    def test_attribution_mismatch_and_narrator_twice(self):
        record = {"readings": [{"readingId": "Q01-R01"}],
                  "attribution": [{"authorityId": "Q02-R01"}]}
        self.assertTrue(ruling_attribution_mismatch(record))
        entries = [{"id": "a", "locus_id": "l", "kind": "ruling", "category_code": "X",
                    "review_status": "unreviewed", "authorities": [{"reading_id": "Q01-R01", "wajh_order": 1}]},
                   {"id": "b", "locus_id": "l", "kind": "ruling", "category_code": "X",
                    "review_status": "unreviewed", "authorities": [{"reading_id": "Q01-R01", "wajh_order": 1}]}]
        self.assertEqual(narrator_twice(entries), {"a", "b"})

    def test_narrator_twice_separates_ruling_categories(self):
        base = {"locus_id": "l", "kind": "ruling", "review_status": "unreviewed",
                "authorities": [{"reading_id": "Q01-R01", "wajh_order": 1}]}
        self.assertEqual(narrator_twice([{**base, "id": "a", "category_code": "X"},
                                         {**base, "id": "b", "category_code": "Y"}]), set())
        self.assertEqual(narrator_twice([{**base, "id": "a", "category_code": "X"},
                                         {**base, "id": "b", "category_code": "X"}]), {"a", "b"})

    def test_rejected_rows_use_non_live_order_range(self):
        rows = [{"id": "live", "locus_id": "l", "kind": "variant", "entry_order": 9,
                 "wajhIndex": 1, "order_live": True},
                {"id": "rejected", "locus_id": "l", "kind": "variant", "entry_order": 1,
                 "wajhIndex": 2, "order_live": False}]
        result = renumber_entry_orders(rows)
        self.assertEqual({x["id"]: x["final"] for x in result}, {"live": 1, "rejected": 5000})

    def test_q6_agreement_and_disagreement(self):
        common = {"id": "v", "surah": 1, "ayah": 1, "startToken": 1, "endToken": 1,
                  "locusType": "performance_variant", "performanceNote": "نقل", "description": "",
                  "hafsText": "نص", "variantText": "نص", "readingIds": ["Q01-R01"]}
        fixtures = {"variants": {1: [common]}, "rulings": {}, "agy": {(1, "v", "نقل"): {"category": "USUL_NAQL"}}}
        snapshot = {"qiraat_loci": [], "qiraat_entries": [], "qiraat_variant_details": [],
                    "qiraat_ruling_details": [], "qiraat_entry_authorities": [], "qiraat_categories": [],
                    "category_codes": {"USUL_NAQL"}}
        plan = build_plan(fixtures, snapshot, page_specs={})
        self.assertEqual(plan["entries"][0]["kind"], "ruling")
        self.assertEqual(plan["ruling_details"][0]["category_code"], "USUL_NAQL")
        fixtures["agy"][(1, "v", "نقل")] = {"category": "FARSH"}
        plan = build_plan(fixtures, snapshot, page_specs={})
        self.assertEqual(plan["entries"][0]["kind"], "variant")
        flag = next(x for x in plan["flags"] if x["flag_type"] == "Q6_AMBIGUOUS")
        self.assertIn("USUL_NAQL", flag["issue_ar"])
        self.assertIn("FARSH", flag["issue_ar"])

    def test_db_only_entry_moves_to_canonical_span_locus(self):
        record = {"id": "fixture", "surah": 1, "ayah": 1, "startToken": 1, "endToken": 1,
                  "locusType": "word_variant", "variantText": "ب", "hafsText": "ا", "readingIds": ["Q01-R01"]}
        snapshot = {"qiraat_loci": [
            {"id": "a", "surah_number": 1, "start_ayah": 1, "start_word": 1, "end_ayah": 1, "end_word": 1, "deleted_at": None},
            {"id": "z", "surah_number": 1, "start_ayah": 1, "start_word": 1, "end_ayah": 1, "end_word": 1, "deleted_at": None}],
            "qiraat_entries": [{"id": "db", "locus_id": "z", "page_id": 1, "kind": "variant", "entry_order": 1,
                                "verification_status": "REVIEWED", "deleted_at": None}],
            "qiraat_variant_details": [], "qiraat_ruling_details": [], "qiraat_entry_authorities": [],
            "qiraat_categories": [], "category_codes": set()}
        plan = build_plan({"variants": {1: [record]}, "rulings": {}, "agy": {}}, snapshot, page_specs={})
        self.assertEqual(next(x for x in plan["entries"] if x["id"] == "db")["locus_id"], "a")

    def test_authority_sql_is_diff_based(self):
        sql = emit_sql({"snapshot_entry_count": 0, "loci": [], "entries": [], "variant_details": [],
                        "ruling_details": [], "authorities": [], "flags": [], "drops": [],
                        "count_schools": [], "evidence": [], "redirects": []})
        self.assertNotIn("UPDATE qiraat_entry_authorities SET deleted_at=now() WHERE entry_id IN", sql)
        self.assertIn("NOT EXISTS (SELECT 1 FROM p3_authorities", sql)
        self.assertIn("qiraat_entry_authorities.condition_ar IS DISTINCT FROM", sql)

    def test_null_and_empty_arrays_emit_bare_null(self):
        self.assertEqual(_text_array(None), None)
        self.assertEqual(_text_array([]), None)
        self.assertIn("NULL", emit_sql({"snapshot_entry_count": 0, "loci": [], "entries": [],
                                        "ruling_details": [{"entry_id": "e", "category_code": "X", "options": None}],
                                        "variant_details": [], "authorities": [], "flags": [], "drops": [],
                                        "count_schools": [], "evidence": [], "redirects": []}))

    def test_sql_literal_round_trip_shape(self):
        value = "نص 'عربي' \\ ومسار"
        quoted = sql_literal(value)
        self.assertEqual(quoted, "'نص ''عربي'' \\ ومسار'")


if __name__ == "__main__":
    unittest.main()
