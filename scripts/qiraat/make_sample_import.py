#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Builds the small sample Excel fixture used by the end-to-end pipeline test
(task requirement #24) and by manual smoke-testing of the importer.

    python3 scripts/qiraat/make_sample_import.py [output_path]

Produces one workbook with two sheets across pages 1 and 2, covering:
  - a clean VALID record with an explicit attribution (page 1, مالك/ملك)
  - a VALID record using a group symbol attribution ("الأخوان")
  - a record using "الباقون" (remainder attribution)
  - a duplicate of the first record (same fact, to exercise idempotency/dedup)
  - a record with an unresolvable attribution ("خلف", deliberately ambiguous)
  - a record with an out-of-range ayah (validation error)
  - a record whose base_text does not exist on that page (NEEDS_MANUAL_MAPPING)
  - a record on page 2 with a category/ruling cell
"""
import os
import sys

import openpyxl

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    'tests', 'fixtures', 'qiraat_sample_import.xlsx')

HEADERS = [
    'الصفحة', 'السورة', 'الآية', 'نص حفص', 'القراءة', 'الفئة', 'القراء والرواة',
    'الشاطبية', 'ملاحظات',
]

ROWS_SHEET1 = [
    # page, surah, ayah, base_text, variant_text, category, attribution, shatibiyyah, note
    [1, 1, 4, 'مَـٰلِكِ', 'مَلِكِ', 'فرش', 'عاصم والكسائي ويعقوب وخلف العاشر', 'شاهد تجريبي', 'سجل صالح'],
    [1, 1, 6, 'ٱلصِّرَٰطَ', 'السراط', 'فرش', 'الأخوان', 'شاهد تجريبي', 'رمز مجموعة (الأخوان)'],
    [1, 1, 4, 'مَـٰلِكِ', 'مَلِكِ', 'فرش', 'عاصم والكسائي ويعقوب وخلف العاشر', 'شاهد تجريبي', 'مكرر عمدًا لاختبار الكشف عن التكرار'],
    [1, 1, 7, 'صِرَٰطَ', 'الباقون', 'فرش', 'الباقون', '', 'اختبار عزو الباقون'],
    [1, 1, 5, 'نَعْبُدُ', 'نعبد بتشديد', 'فرش', 'خلف', '', 'عزو غامض عمدًا (خلف) — يجب أن يُرفض'],
    [1, 1, 999, 'كلمة غير موجودة', 'بديل', 'فرش', 'نافع', '', 'آية خارج النطاق عمدًا'],
    [1, 1, 2, 'كلمة لا وجود لها في الصفحة', 'بديل', 'فرش', 'نافع', '', 'نص أساس غير موجود على الصفحة (يحتاج ربطًا يدويًا)'],
]

ROWS_SHEET2 = [
    [2, 2, 3, 'يُؤْمِنُونَ', '', 'الإخفاء', 'حمزة والكسائي', '', 'مثال أصول (لا يغيّر الرسم)'],
]


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    wb = openpyxl.Workbook()
    ws1 = wb.active
    ws1.title = 'القراءات'
    ws1.append(HEADERS)
    for row in ROWS_SHEET1:
        ws1.append(row)

    ws2 = wb.create_sheet('أصول')
    ws2.append(HEADERS)
    for row in ROWS_SHEET2:
        ws2.append(row)

    # An intentionally empty sheet, to exercise "skip empty sheets".
    wb.create_sheet('فارغة')

    wb.save(OUT)
    print(f'Wrote {OUT}')


if __name__ == '__main__':
    main()
