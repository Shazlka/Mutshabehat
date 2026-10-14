"""python3 -m unittest tests/qiraat/subcategory_rules_test.py   (rules in scripts/qiraat/subcategory_rules.py)"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "scripts", "qiraat"))
import subcategory_rules as r  # noqa: E402


def ruling(cat, *actions, text=""):
    return {"kind": "ruling", "category": cat, "text_ar": text, "auth": [{"n": f"Q0{i}-R01", "a": a} for i, a in enumerate(actions, 1)]}


def variant(base, reading, desc, auth=()):
    return {"kind": "variant", "variant_type": "other", "base_text": base, "reading_text": reading, "description": desc, "perf": None,
            "auth": [{"n": "Q01-R01", "a": a} for a in auth]}


class UsulLabels(unittest.TestCase):
    def test_single_rules(self):
        self.assertEqual(r.usul_label(ruling("MADD_BADAL", "مد البدل")), "مد البدل")
        self.assertEqual(r.usul_label(ruling("MADD_BADAL", "قرأ بتثليث مد البدل.")), "تثليث مد البدل")
        self.assertEqual(r.usul_label(ruling("TARQIQ_RA", "ترقيق الراء")), "ترقيق الراء")
        self.assertEqual(r.usul_label(ruling("IDGHAM_KABIR", "إدغام اللام في اللام")), "إدغام لام في لام")
        self.assertEqual(r.usul_label(ruling("YAAT_IDAFA", "فتح الياء وصلاً")), "فتح الياء")
        self.assertEqual(r.usul_label(ruling("YAAT_IDAFA", "إسكان الياء وصلاً")), "إسكان الياء")
        self.assertEqual(r.usul_label(ruling("WAQF_RASM", "الوقف بهاء السكت")), "الوقف بهاء السكت")

    def test_imalah_variants(self):
        self.assertEqual(r.usul_label(ruling("IMALAH_TAQLIL", "قرأ بإمالة هاء التأنيث وقفا.")), "إمالة هاء التأنيث وقفاً")
        self.assertEqual(r.usul_label(ruling("IMALAH_TAQLIL", "إمالة فتحة الجيم والألف")), "إمالة")
        self.assertEqual(r.usul_label(ruling("IMALAH_TAQLIL", "تقليل الألف (رأس آية)")), "تقليل")
        self.assertEqual(r.usul_label(ruling("IMALAH_TAQLIL", "إمالة", "تقليل")), "إمالة وتقليل (وجهان)")

    def test_mixed_actions_use_the_family_label(self):
        e = ruling("USUL_MIM_JAM", "قرأ بصلة ميم الجمع وصلا بخلف عنه.", "قرأ بصلة ميم الجمع وصلا.")
        self.assertEqual(r.usul_label(e), "صلة ميم الجمع (أوجه متعددة)")

    def test_unknown_text_is_not_guessed(self):
        self.assertIsNone(r.usul_label(ruling("TAGHYIR_HAMZ", "كسر الدوري الهمزة")))
        self.assertIsNone(r.usul_label(ruling("IDGHAM_KABIR", "إدغام صغير")))  # text contradicts the category

    def test_every_label_is_in_the_vocabulary(self):
        entries = [ruling("USUL_SAKT", "قرأ بالنقل وصلا ووقفا."), ruling("USUL_TAHQIQ", "قرأ بتحقيق الهمزة وصلا، ووقف بإبدالها حرفا مديا."),
                   ruling("HAMZATAN_KALIMA", "التسهيل مع الإدخال")]
        vocab = r.vocabulary(entries)
        for e in entries:
            self.assertIn(r.usul_label(e), vocab[e["category"]])


class FarshTypes(unittest.TestCase):
    def test_vowel_only(self):
        self.assertEqual(r.farsh_type(variant("وَهُوَ", "وَهْوَ", "إسكان الهاء")), "vowel")

    def test_letter_changes_follow_the_letters(self):
        self.assertEqual(r.farsh_type(variant("صِرَٰطٍۢ", "سِرَٰطٍ", "بالسين")), "consonant")
        self.assertEqual(r.farsh_type(variant("يُؤْتِيَنِ", "يُؤْتِيَنِي", "إثبات الياء")), "addition")
        self.assertEqual(r.farsh_type(variant("فَبِمَا", "بِمَا", "بحذف الفاء")), "omission")

    def test_different_word(self):
        self.assertEqual(r.farsh_type(variant("ثَمَرَٰتٍۢ", "ثَمَرَةٍ", "بالمفرد")), "word_change")

    def test_hafs_own_reading_and_mixed_descriptions_are_queued(self):
        self.assertIsNone(r.farsh_type(variant("وَصُدُّوا۟", "وَصُدُّوا۟", "وجه حفص المطابق لرسم المصحف")))
        self.assertIsNone(r.farsh_type(variant("وَهُوَ", "وَهْوَ", "أبو جعفر: إسكان الهاء الكسائي: وإمالة اهْتَدَى")))
        self.assertIsNone(r.farsh_type(variant("فَلَا", "فَلَا", "تحقيق")))


if __name__ == "__main__":
    unittest.main()
