#!/usr/bin/env python3
"""Builds packages/qiraat-core/fixtures/pages/page-{001..010}.json and
data/qiraat/raw/pages-001-010.json from the task-prompt-provided locus data.

REVIEWED tier throughout (no PDF was available to visually verify), except the loci the task
itself flagged as uncertain, which get NEEDS_MANUAL_REVIEW. See
docs/qiraat/pages-001-010-existing-architecture.md, docs/qiraat/pages-001-010-reconciliation.md and
docs/qiraat/pages-001-010-final-report.md for the full policy. Idempotent: re-running regenerates
the same output files from the locus data below (no external state, no PDF dependency).
"""
import glob
import json
import os
import re
import sys
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# --- ground truth: the REAL, never-modified Mushaf-1441 word fixtures. hafsText is always derived
# from here (never hand-typed verbatim) so a diacritic-mark-ordering slip or an incomplete
# multi-token span can never silently diverge from the actual base Quran text (task rule: "existing
# Mushaf 1441 Quran text must NEVER be overwritten" — this also means our own copy of it must be
# byte-exact, not just visually similar). ---
WORD_LOOKUP = {}
for _fp in sorted(glob.glob(f"{ROOT}/packages/quran-data/mushaf1441/fixtures/page-words/page-*.json")):
    _data = json.load(open(_fp, encoding="utf-8"))
    for _line in _data.get("lines", []):
        for _w in _line.get("words", []):
            if _w.get("charTypeName") not in (None, "word"):
                continue
            WORD_LOOKUP[(_w["surahNumber"], _w["ayahNumber"], _w["wordIndexInAyah"])] = _w.get("textUthmani")
assert len(WORD_LOOKUP) > 70000, f"expected the full 604-page word index, got {len(WORD_LOOKUP)}"

_TASHKEEL_RE = re.compile(r"[ً-ٰٟۖ-ۭ]")

def _strip_tashkeel(s):
    # NFC first: the real fixtures store decomposed alef-madda (U+0627 U+0653), a hand-typed
    # literal normally uses the precomposed U+0622 — both are the same letter, not a real mismatch.
    return _TASHKEEL_RE.sub("", unicodedata.normalize("NFC", s or ""))

def real_hafs_text(surah, ayah, start_token, end_token):
    parts = []
    for tok in range(start_token, end_token + 1):
        key = (surah, ayah, tok)
        if key not in WORD_LOOKUP:
            raise ValueError(f"No real Mushaf word at {surah}:{ayah}:{tok} — never guess a word identity (task rule).")
        parts.append(WORD_LOOKUP[key])
    return " ".join(parts)

# --- canonical reader/narrator IDs (must match packages/qiraat-core/{readers,narrators}.ts) ---
READER = {
    "نافع": "Q01", "ابن كثير": "Q02", "أبو عمرو": "Q03", "ابن عامر": "Q04", "عاصم": "Q05",
    "حمزة": "Q06", "الكسائي": "Q07", "أبو جعفر": "Q08", "يعقوب": "Q09", "خلف العاشر": "Q10",
}
READER_NARRATORS = {
    "Q01": ["Q01-R01", "Q01-R02"], "Q02": ["Q02-R01", "Q02-R02"], "Q03": ["Q03-R01", "Q03-R02"],
    "Q04": ["Q04-R01", "Q04-R02"], "Q05": ["Q05-R01", "Q05-R02"], "Q06": ["Q06-R01", "Q06-R02"],
    "Q07": ["Q07-R01", "Q07-R02"], "Q08": ["Q08-R01", "Q08-R02"], "Q09": ["Q09-R01", "Q09-R02"],
    "Q10": ["Q10-R01", "Q10-R02"],
}
NARRATOR = {
    "قالون": "Q01-R01", "ورش": "Q01-R02",
    "البزي": "Q02-R01", "قنبل": "Q02-R02",
    "الدوري عن أبي عمرو": "Q03-R01", "السوسي": "Q03-R02",
    "هشام": "Q04-R01", "ابن ذكوان": "Q04-R02",
    "شعبة": "Q05-R01", "حفص": "Q05-R02",
    "خلف عن حمزة": "Q06-R01", "خلاد": "Q06-R02",
    "أبو الحارث": "Q07-R01", "الدوري عن الكسائي": "Q07-R02",
    "ابن وردان": "Q08-R01", "ابن جماز": "Q08-R02",
    "رويس": "Q09-R01", "روح": "Q09-R02",
    "إسحاق": "Q10-R01", "إدريس": "Q10-R02",
}
ALL_READINGS = [n for ids in READER_NARRATORS.values() for n in ids]
assert len(ALL_READINGS) == 20

def ids_for(names):
    """Expand a list of Arabic reader/narrator names into narrator IDs."""
    out = []
    for name in names:
        if name in READER:
            out.extend(READER_NARRATORS[READER[name]])
        elif name in NARRATOR:
            out.append(NARRATOR[name])
        else:
            raise ValueError(f"Unknown attribution name: {name!r}")
    return sorted(set(out))

def remainder(*explicit_lists):
    covered = set()
    for lst in explicit_lists:
        covered.update(lst)
    return sorted(set(ALL_READINGS) - covered)

NEEDS_REVIEW = {
    "v-p004-l001-shaa-allah",
    "v-p008-l002-bariikum",
    "v-p009-l003-alayhim-hameed",
    "v-p009-l004-nabiyyin",
    "v-p010-l003-yamurukum",
}

def status_for(vid):
    return "NEEDS_MANUAL_REVIEW" if vid in NEEDS_REVIEW else "REVIEWED"

SOURCE_NAME = "مصحف القراءات العشر (نسخة PDF المزوَّدة من طرف المستخدم)"

def source(vid, pdf_page, mushaf_page, note=""):
    base_note = (
        "This session had no access to the source PDF file itself (not present in the sandbox) — "
        "the wording/attribution below was typed directly into the task prompt by the user, not "
        "independently read off a page image. Held at REVIEWED (or NEEDS_MANUAL_REVIEW where the "
        "user flagged it) rather than VERIFIED until someone cross-checks it against the actual "
        "PDF page image, per this project's own verification-workflow rule."
    )
    return [{
        "id": f"s-{vid}",
        "variantId": vid,
        "sourceName": SOURCE_NAME,
        "sourceType": "pdf",
        "pdfFilename": "مصحف القراءات العشر-1.pdf",
        "pdfPage": pdf_page,
        "sourceReference": f"صفحة المصحف {mushaf_page} · صفحة PDF {pdf_page}",
        "verificationNotes": (base_note + (" " + note if note else "")),
    }]

NOW = "2026-09-16T12:00:00.000Z"

def variant(vid, surah, ayah, token, operation, hafs_text, variant_text, diff_type, reading_ids,
            mushaf_page, pdf_page, locus_id=None, locus_type="word_variant", performance_note=None,
            notes=None, uthmani_text=None, end_token=None):
    end_token = end_token or token
    # hafsText is ALWAYS the real fixture text (byte-exact), never the hand-typed literal above —
    # the literal is only a sanity check that this record points at the token its author intended.
    resolved_hafs_text = real_hafs_text(surah, ayah, token, end_token)
    if _strip_tashkeel(hafs_text.split(" ")[0]) != _strip_tashkeel(resolved_hafs_text.split(" ")[0]):
        print(
            f"WARNING: {vid}: hand-typed hafsText {hafs_text!r} does not match the real word at "
            f"{surah}:{ayah}:{token} ({resolved_hafs_text!r}) even ignoring diacritics — check the "
            f"token reference.",
            file=sys.stderr,
        )
    if variant_text == hafs_text:
        # A performance-only call site signals "no text change" by passing the same literal for
        # both — once hafsText is resolved to the real (possibly reordered-diacritic/waqf-mark-
        # bearing) fixture text, variantText must track it exactly or the UI's
        # `variantText === hafsText` performance-only check silently breaks.
        variant_text = resolved_hafs_text
    v = {
        "id": vid,
        "surah": surah, "ayah": ayah,
        "startToken": token, "endToken": end_token,
        "operation": operation,
        "hafsText": resolved_hafs_text,
        "variantText": variant_text,
        "differenceType": diff_type,
        "verificationStatus": status_for(vid),
        "createdAt": NOW, "updatedAt": NOW,
        "readingIds": reading_ids,
        "sources": source(vid, pdf_page, mushaf_page),
    }
    if uthmani_text:
        v["uthmaniText"] = uthmani_text
    if locus_id:
        v["locusId"] = locus_id
        v["locusType"] = locus_type
    if performance_note:
        v["performanceNote"] = performance_note
    if notes:
        v["notes"] = notes
    return v

pages = {n: [] for n in range(1, 11)}

# ============================================================ PAGE 1 — Al-Fatihah (PDF p.6)
pages[1].append(variant(
    "v-p001-l001-malik-melik", 1, 4, 1, "REPLACE", "مَـٰلِكِ", "مَلِكِ", "LETTER",
    ids_for(["نافع", "ابن كثير", "أبو عمرو", "ابن عامر", "حمزة", "أبو جعفر"]),
    1, 6, uthmani_text="مَلِكِ",
    notes="الباقون (عاصم، الكسائي، يعقوب، خلف العاشر) يقرؤون \"مَالِكِ\" موافقةً للرسم الأساس.",
))
pages[1].append(variant(
    "v-p001-l002-sirat-sin", 1, 6, 2, "REPLACE", "ٱلصِّرَٰطَ", "ٱلسِّرَٰطَ", "LETTER",
    ids_for(["قنبل", "رويس"]), 1, 6, uthmani_text="ٱلسِّرَٰطَ",
    locus_id="p1-sirat", locus_type="word_variant",
))
pages[1].append(variant(
    "v-p001-l002-sirat-ishmam", 1, 6, 2, "DIACRITIC_CHANGE", "ٱلصِّرَٰطَ", "ٱلصِّرَٰطَ", "IMALAH",
    ids_for(["حمزة"]), 1, 6, locus_id="p1-sirat",
    performance_note="إشمام الصاد زايًا (صوت بين الصاد والزاي، لا يغيّر الرسم).",
))
pages[1].append(variant(
    "v-p001-l003-sirat2-sin", 1, 7, 1, "REPLACE", "صِرَٰطَ", "سِرَٰطَ", "LETTER",
    ids_for(["قنبل", "رويس"]), 1, 6, uthmani_text="سِرَٰطَ",
    locus_id="p1-sirat2",
))
pages[1].append(variant(
    "v-p001-l003-sirat2-ishmam", 1, 7, 1, "DIACRITIC_CHANGE", "صِرَٰطَ", "صِرَٰطَ", "IMALAH",
    ids_for(["خلف عن حمزة"]), 1, 6, locus_id="p1-sirat2",
    performance_note="إشمام الصاد زايًا. ملاحظة: خلّاد (الناوي الآخر عن حمزة) لا يُشمّ في هذا الموضع بحسب البيانات المُدخلة — يُنصح بمراجعة ذلك مقابل المصدر.",
))
for tok in (4, 7):
    pages[1].append(variant(
        f"v-p001-l004-alayhim-{tok}", 1, 7, tok, "DIACRITIC_CHANGE", "عَلَيْهِمْ", "عَلَيْهِمُ", "HARAKAH",
        ids_for(["حمزة", "يعقوب"]), 1, 6, locus_id="p1-alayhim",
        notes="موضع واحد بمعنى \"معًا\": ميم الجمع مضمومة عند حمزة ويعقوب في كِلا موضعَي \"عليهم\" بهذه الآية.",
    ))

# ============================================================ PAGE 2 — Al-Baqarah 1-5 (PDF p.7)
pages[2].append(variant(
    "v-p002-l001-alm-sakt", 2, 1, 1, "DIACRITIC_CHANGE", "الٓمٓ", "الٓمٓ", "WAQF",
    ids_for(["أبو جعفر"]), 2, 7,
    performance_note="السكت على حروف الهجاء (الألف، اللام، الميم) دون تنفّس، لا يغيّر الرسم.",
))
pages[2].append(variant(
    "v-p002-l002-fihi-silah", 2, 2, 5, "DIACRITIC_CHANGE", "فِيهِ", "فِيهِ", "SILAH",
    ids_for(["ابن كثير"]), 2, 7,
    performance_note="صلة هاء الضمير بياء في الوصل (تُشبع الكسرة فتتولّد ياء مدّية)، لا يغيّر الرسم.",
    notes="السوسي عن أبي عمرو يُدغم إدغامًا كبيرًا في مواضع مشابهة عمومًا، لكن هذا السجل لا يُثبت ذلك هنا تحديدًا — لم يَرِد نص صريح من المستخدم يربط قاعدة الإدغام الكبير بهذا الموضع بعينه، فلم يُدرَج تجنّبًا للتخمين.",
))
pages[2].append(variant(
    "v-p002-l003-huda-taqlil", 2, 2, 6, "DIACRITIC_CHANGE", "هُدًۭى", "هُدًۭى", "IMALAH",
    ids_for(["ورش"]), 2, 7, locus_id="p2-huda",
    performance_note="التقليل بخلف عنه وقفًا.",
))
pages[2].append(variant(
    "v-p002-l003-huda-imalah", 2, 2, 6, "DIACRITIC_CHANGE", "هُدًۭى", "هُدًۭى", "IMALAH",
    ids_for(["حمزة", "الكسائي", "خلف العاشر"]), 2, 7, locus_id="p2-huda",
    performance_note="الإمالة وقفًا.",
    notes="الباقون يقفون بالفتح.",
))
pages[2].append(variant(
    "v-p002-l003-huda2-taqlil", 2, 5, 3, "DIACRITIC_CHANGE", "هُدًۭى", "هُدًۭى", "IMALAH",
    ids_for(["ورش"]), 2, 7, locus_id="p2-huda",
    performance_note="التقليل بخلف عنه وقفًا (نفس حكم 2:2 يُطبَّق هنا).",
))
pages[2].append(variant(
    "v-p002-l003-huda2-imalah", 2, 5, 3, "DIACRITIC_CHANGE", "هُدًۭى", "هُدًۭى", "IMALAH",
    ids_for(["حمزة", "الكسائي", "خلف العاشر"]), 2, 7, locus_id="p2-huda",
    performance_note="الإمالة وقفًا (نفس حكم 2:2 يُطبَّق هنا).",
))

# ============================================================ PAGE 3 — Al-Baqarah 6-16 (PDF p.8)
pages[3].append(variant(
    "v-p003-l001-alayhim-damm", 2, 6, 5, "DIACRITIC_CHANGE", "عَلَيْهِمْ", "عَلَيْهِمْ", "HARAKAH",
    ids_for(["حمزة", "يعقوب"]), 3, 8,
    performance_note="ضم هاء الضمير.",
    notes="الباقون بكسر الهاء.",
))
pages[3].append(variant(
    "v-p003-l002-yukhadiuna", 2, 9, 6, "REPLACE", "يَخْدَعُونَ", "يُخَـٰدِعُونَ", "LETTER",
    ids_for(["نافع", "ابن كثير", "أبو عمرو"]), 3, 8, uthmani_text="يُخَـٰدِعُونَ",
))
pages[3].append(variant(
    "v-p003-l003-yukadhdhibuna", 2, 10, 12, "DIACRITIC_CHANGE", "يَكْذِبُونَ", "يَكْذِبُونَ", "IDGHAM",
    ids_for(["عاصم", "حمزة", "الكسائي", "خلف العاشر"]), 3, 8,
    performance_note="تخفيف الذال (الفعل من \"كذب\" الثلاثي).",
    notes="الباقون بتشديد الذال \"يُكَذِّبُونَ\" (من \"كذّب\" المضعّف) — فرقٌ في بِنية الفعل مع بقاء الرسم القرآني \"يكذبون\" في المصاحف كما هو مثبت هنا؛ يُنصح بمراجعة ما إذا كان الفارق يستدعي أيضًا رسمًا مختلفًا (تشديد الذال) عند التحقق من المصدر.",
))
for tok_ayah, tok in ((11, 2), (13, 2)):
    pages[3].append(variant(
        f"v-p003-l004-qila-{tok_ayah}", 2, tok_ayah, tok, "DIACRITIC_CHANGE", "قِيلَ", "قِيلَ", "IMALAH",
        ids_for(["هشام", "الكسائي", "رويس"]), 3, 8, locus_id="p3-qila",
        performance_note="إشمام الكسرة الضم (إشارة إلى الضم مع بقاء الكسرة).",
        notes="الباقون بالكسرة الخالصة.",
    ))

# ============================================================ PAGE 4 — Al-Baqarah 17-24 (PDF p.9)
pages[4].append(variant(
    "v-p004-l001-shaa-allah", 2, 20, 15, "DIACRITIC_CHANGE", "شَآءَ", "شَآءَ", "HAMZ", [], 4, 9,
    end_token=16,
    performance_note=(
        "اختلاف أداء في تحقيق/تسهيل/إبدال الهمزتين المتجاورتين بين \"شاء\" و\"الله\" — "
        "البيانات المُدخلة غير مؤكدة بما يكفي لتحديد نص أو رواة دقيقين؛ راجع المصدر الأصلي "
        "قبل أي اعتماد."
    ),
    notes=(
        "مرشّح غير مؤكَّد فقط (لا يُدرَج كقراءة فعلية): تحقيق الهمزة الأولى مع تسهيل/إبدال الثانية "
        "منسوب احتمالًا إلى نافع وأبو جعفر وابن كثير وأبو عمرو ورويس عن يعقوب، مقابل تحقيق "
        "الهمزتين عند الباقين تقريبًا. لم تُدرَج قائمة readingIds لعدم التأكد؛ هذا السجل "
        "لغرض التتبّع فقط وليس للعرض للمستخدم النهائي."
    ),
))

# ============================================================ PAGE 5 — Al-Baqarah 25-29 (PDF p.10)
pages[5].append(variant(
    "v-p005-l001-turjaun", 2, 28, 13, "REPLACE", "تُرْجَعُونَ", "تَرْجِعُونَ", "HARAKAH",
    ids_for(["يعقوب"]), 5, 10, uthmani_text="تَرْجِعُونَ",
    notes="فتح التاء وكسر الجيم، بناء للفاعل، عند يعقوب؛ الباقون بضم التاء وفتح الجيم بناء للمفعول.",
))

# ============================================================ PAGE 6 — Al-Baqarah 30-37 (PDF p.11)
pages[6].append(variant(
    "v-p006-l001-lilmalaikatu", 2, 34, 3, "DIACRITIC_CHANGE", "لِلْمَلَـٰٓئِكَةِ", "لِلْمَلَـٰٓئِكَةِ", "HARAKAH",
    ids_for(["أبو جعفر"]), 6, 11,
    performance_note="ضم التاء حال الوصل \"لِلْمَلَائِكَةُ اسجدوا\".",
    notes="الباقون بالكسر \"لِلْمَلَائِكَةِ\".",
))
pages[6].append(variant(
    "v-p006-l002-azalahuma", 2, 36, 1, "REPLACE", "فَأَزَلَّهُمَا", "فَأَزَالَهُمَا", "LETTER",
    ids_for(["حمزة"]), 6, 11, uthmani_text="فَأَزَالَهُمَا",
    notes="إثبات ألف بعد الزاي مع تخفيف اللام عند حمزة؛ الباقون بدون الألف مع تشديد اللام.",
))
pages[6].append(variant(
    "v-p006-l003-adam-1", 2, 37, 2, "REPLACE", "ءَادَمُ", "ءَادَمَ", "HARAKAH",
    ids_for(["ابن كثير"]), 6, 11, uthmani_text="ءَادَمَ",
    locus_id="p6-adam-kalimat", locus_type="multi_word_variant",
    notes="جزء من قراءة مزدوجة الكلمة مع \"كلمات\" في نفس الآية (رفع/نصب متبادلان).",
))
pages[6].append(variant(
    "v-p006-l003-kalimat-1", 2, 37, 5, "REPLACE", "كَلِمَـٰتٍۢ", "كَلِمَاتٌ", "HARAKAH",
    ids_for(["ابن كثير"]), 6, 11, uthmani_text="كَلِمَاتٌ",
    locus_id="p6-adam-kalimat", locus_type="multi_word_variant",
    notes="عند ابن كثير: \"آدَمَ\" بالنصب و\"كَلِمَاتٌ\" بالرفع (عكس البنية عند الباقين)، فالفعل \"تلقّى\" يُسنَد إلى الكلمات لا إلى آدم.",
))

# ============================================================ PAGE 7 — Al-Baqarah 38-48 (PDF p.12)
pages[7].append(variant(
    "v-p007-l001-khawfa", 2, 38, 13, "REPLACE", "خَوْفٌ", "خَوْفَ", "HARAKAH",
    ids_for(["يعقوب"]), 7, 12, uthmani_text="خَوْفَ",
    locus_id="p7-khawf",
    notes="فتح الفاء وحذف التنوين عند يعقوب؛ الباقون بالتنوين المرفوع \"خَوْفٌ\".",
))
pages[7].append(variant(
    "v-p007-l002-tuqbalu", 2, 48, 10, "REPLACE", "يُقْبَلُ", "تُقْبَلُ", "LETTER",
    ids_for(["ابن كثير", "أبو عمرو", "يعقوب"]), 7, 12, uthmani_text="تُقْبَلُ",
))

# ============================================================ PAGE 8 — Al-Baqarah 49-57 (PDF p.13)
pages[8].append(variant(
    "v-p008-l001-waadna", 2, 51, 2, "REPLACE", "وَٰعَدْنَا", "وَعَدْنَا", "LETTER",
    ids_for(["أبو عمرو", "أبو جعفر", "يعقوب"]), 8, 13, uthmani_text="وَعَدْنَا",
    notes="حذف الألف عند أبي عمرو وأبي جعفر ويعقوب؛ الباقون بإثبات الألف \"وَاعَدْنَا\".",
))
for tok_ayah, tok in ((54, 13), (54, 20)):
    pages[8].append(variant(
        f"v-p008-l002-bariikum-{tok}", 2, tok_ayah, tok, "DIACRITIC_CHANGE", "بَارِئِكُمْ", "بَارِئِكُمْ", "HAMZ",
        [], 8, 13, locus_id="p8-bariikum",
        performance_note=(
            "اختلاف أداء متعدد الأوجه في همزة \"بارئكم\" بين السكون المحض، الاختلاس، إتمام "
            "الكسرة، والإمالة مع تحقيق الهمزة — البيانات المُدخلة تنسب أوجهًا للسوسي والدوري "
            "عن أبي عمرو، ولحمزة، وللدوري عن الكسائي، لكنها غير مؤكدة بدقة كافية للربط "
            "الحاسم بين كل وجه ورواته. راجع المصدر الأصلي قبل أي اعتماد."
        ),
        notes=(
            "مرشّحات غير مؤكدة (للتتبع فقط): إسكان الهمزة (السوسي عن أبي عمرو)؛ الإسكان مع "
            "جواز الاختلاس (الدوري عن أبي عمرو)؛ إتمام الكسرة (حمزة، مع حكم خاص بالوقف على "
            "الهمز يُراجَع من المصدر)؛ الإمالة مع تحقيق الهمزة (الدوري عن الكسائي)؛ إتمام "
            "كسرة الهمزة وترك الإمالة عند الباقين."
        ),
    ))

# ============================================================ PAGE 9 — Al-Baqarah 58-61 (PDF p.14)
pages[9].append(variant(
    "v-p009-l001-yughfar", 2, 58, 16, "REPLACE", "نَّغْفِرْ", "يُغْفَرْ", "LETTER",
    ids_for(["نافع", "أبو جعفر"]), 9, 14, uthmani_text="يُغْفَرْ",
    locus_id="p9-naghfir",
    notes="ياء مضمومة، فتح الفاء، بناء للمفعول، عند نافع وأبي جعفر.",
))
pages[9].append(variant(
    "v-p009-l001-tughfar", 2, 58, 16, "REPLACE", "نَّغْفِرْ", "تُغْفَرْ", "LETTER",
    ids_for(["ابن عامر"]), 9, 14, uthmani_text="تُغْفَرْ",
    locus_id="p9-naghfir",
    notes="تاء مضمومة، فتح الفاء، بناء للمفعول، عند ابن عامر. الباقون بنون مفتوحة وكسر الفاء بناء للفاعل \"نَغْفِرْ\".",
))
pages[9].append(variant(
    "v-p009-l002-qila", 2, 59, 7, "DIACRITIC_CHANGE", "قِيلَ", "قِيلَ", "IMALAH",
    ids_for(["هشام", "الكسائي", "رويس"]), 9, 14,
    performance_note="إشمام الكسرة الضم.",
    notes="الباقون بالكسرة الخالصة (نفس حكم 2:11 و2:13).",
))
pages[9].append(variant(
    "v-p009-l003-alayhim-hameed", 2, 61, 38, "DIACRITIC_CHANGE", "عَلَيْهِمُ", "عَلَيْهِمُ", "HARAKAH",
    [], 9, 14,
    performance_note=(
        "بنية أداء مركّبة لهاء ومیم الضمير في \"عليهم\" هنا (ضم الهاء صراحةً عند حمزة "
        "ويعقوب، تفصيل بين الوصل والوقف عند الكسائي وخلف العاشر، وتفصيل آخر عند أبي عمرو) "
        "— لم تتضح تفاصيلها الدقيقة بما يكفي من البيانات المُدخلة للفصل بين الحالات "
        "بثقة. راجع المصدر الأصلي قبل أي اعتماد."
    ),
    notes=(
        "مرشّحات غير مؤكدة (للتتبع فقط): ضم الهاء (حمزة، يعقوب)؛ ضم/كسر الهاء بحسب "
        "الوصل والوقف (الكسائي، خلف العاشر)؛ كسر الهاء مع تفصيل في الميم (أبو عمرو)؛ "
        "الباقون بحسب أصلهم المعتاد."
    ),
))
pages[9].append(variant(
    "v-p009-l004-nabiyyin", 2, 61, 52, "DIACRITIC_CHANGE", "ٱلنَّبِيِّـۧنَ", "ٱلنَّبِيِّـۧنَ", "HAMZ",
    [], 9, 14,
    performance_note=(
        "مرشّح غير مؤكد: إثبات همزة \"النبيئين\" عند قالون وورش عن نافع، مقابل ترك الهمز "
        "\"النبيّين\" عند الباقين — التفاصيل الدقيقة (بما فيها أي أثر على المدّ) لم تُؤكَّد "
        "من مصدر أساسي. راجع المصدر الأصلي قبل أي اعتماد."
    ),
    notes="مرشّح فقط، غير مُدرَج كقراءة فعلية (readingIds فارغة) لعدم اليقين.",
))

# ============================================================ PAGE 10 — Al-Baqarah 62-69 (PDF p.15)
pages[10].append(variant(
    "v-p010-l001-sabiina", 2, 62, 7, "REPLACE", "وَٱلصَّـٰبِـِٔينَ", "وَٱلصَّابِينَ", "OMISSION",
    ids_for(["نافع", "أبو جعفر"]), 10, 15, uthmani_text="وَٱلصَّابِينَ",
    notes="حذف الهمزة عند نافع وأبي جعفر؛ الباقون بإثبات الهمزة. حمزة له حكم خاص بالوقف على الهمز يُراجَع من المصدر عند الحاجة.",
))
pages[10].append(variant(
    "v-p010-l002-khawfa", 2, 62, 20, "REPLACE", "خَوْفٌ", "خَوْفَ", "HARAKAH",
    ids_for(["يعقوب"]), 10, 15, uthmani_text="خَوْفَ",
    notes="فتح الفاء وحذف التنوين عند يعقوب (نفس حكم 2:38)؛ الباقون بالتنوين المرفوع \"خَوْفٌ\".",
))
pages[10].append(variant(
    "v-p010-l003-yamurukum", 2, 67, 7, "DIACRITIC_CHANGE", "يَأْمُرُكُمْ", "يَأْمُرُكُمْ", "HAMZ",
    [], 10, 15,
    performance_note=(
        "اختلاف أداء في همزة الراء (إبدال الهمزة ألفًا مع ضم/إسكان الراء، أو تحقيق الهمزة "
        "مع ضم/إسكان الراء وجواز الاختلاس) — لم يتضح بثقة كافية أي رواة يتبعون أي وجه من "
        "البيانات المُدخلة. راجع المصدر الأصلي قبل أي اعتماد."
    ),
    notes=(
        "مرشّحات غير مؤكدة (للتتبع فقط): إبدال الهمزة ألفًا مع ضم الراء (ورش عن نافع، أبو "
        "جعفر)؛ تحقيق الهمزة مع إسكان الراء وجواز الاختلاس (الدوري عن أبي عمرو)؛ إبدال "
        "الهمزة ألفًا مع إسكان الراء (السوسي عن أبي عمرو)؛ تحقيق الهمزة مع ضم الراء عند "
        "الباقين. حمزة له حكم خاص بالوقف على الهمز يُراجَع من المصدر."
    ),
))
pages[10].append(variant(
    "v-p010-l004-huzuwa-1", 2, 67, 13, "DIACRITIC_CHANGE", "هُزُوًۭا", "هُزُوًۭا", "HAMZ",
    ids_for(["حفص"]), 10, 15, locus_id="p10-huzuwa",
    performance_note="إبدال الهمزة واوًا مع ضم الزاي.",
))
pages[10].append(variant(
    "v-p010-l004-huzuwa-2", 2, 67, 13, "REPLACE", "هُزُوًۭا", "هُزْؤًا", "HAMZ",
    ids_for(["حمزة", "خلف العاشر"]), 10, 15, locus_id="p10-huzuwa",
    uthmani_text="هُزْؤًا",
    performance_note="إسكان الزاي مع إثبات الهمز.",
    notes="حمزة له حكم خاص بالوقف على الهمز يُراجَع من المصدر.",
))
pages[10].append(variant(
    "v-p010-l004-huzuwa-3", 2, 67, 13, "REPLACE", "هُزُوًۭا", "هُزُؤًا", "HAMZ",
    remainder(ids_for(["حفص"]), ids_for(["حمزة", "خلف العاشر"])),
    10, 15, locus_id="p10-huzuwa", uthmani_text="هُزُؤًا",
    performance_note="ضم الزاي مع إثبات الهمز.",
    notes="باقي الرواة (كل من عدا حفص، وحمزة وخلف العاشر).",
))

# ---- write outputs ----
raw_all = []
for n in range(1, 11):
    raw_all.extend(pages[n])

os.makedirs(f"{ROOT}/data/qiraat/raw", exist_ok=True)
with open(f"{ROOT}/data/qiraat/raw/pages-001-010.json", "w", encoding="utf-8") as f:
    json.dump(raw_all, f, ensure_ascii=False, indent=2)

for n in range(1, 11):
    path = f"{ROOT}/packages/qiraat-core/fixtures/pages/page-{n:03d}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(pages[n], f, ensure_ascii=False, indent=2)

total_variants = sum(len(v) for v in pages.values())
total_loci = len({v.get("locusId") or v["id"] for v in raw_all})
needs_review_count = sum(1 for v in raw_all if v["verificationStatus"] == "NEEDS_MANUAL_REVIEW")
reviewed_count = sum(1 for v in raw_all if v["verificationStatus"] == "REVIEWED")
empty_reading_ids = [v["id"] for v in raw_all if not v["readingIds"]]

print("pages:", {n: len(pages[n]) for n in range(1, 11)})
print("total variant records:", total_variants)
print("total loci (approx, by locusId or own id):", total_loci)
print("REVIEWED:", reviewed_count, "NEEDS_MANUAL_REVIEW:", needs_review_count)
print("records with empty readingIds (candidate-only, not shown to users):", empty_reading_ids)
