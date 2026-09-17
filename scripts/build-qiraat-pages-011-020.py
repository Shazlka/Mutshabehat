#!/usr/bin/env python3
"""Builds packages/qiraat-core/fixtures/pages/page-{011..020}.json and
data/qiraat/raw/pages-011-020.json from the task-prompt-provided locus data (pages 1-20 batch;
pages 1-10 already exist from the prior session and are left untouched — see
docs/qiraat/pages-011-020-dedup-check.md).

Import policy (explicit in the new task payload, data/qiraat/raw/pages-001-020-input.json):
  allowed_status: ["reviewed"]; blocked_status: ["needs_manual_review", "needs_high_resolution_transcription"].
Unlike the pages 1-10 batch (which kept NEEDS_MANUAL_REVIEW loci as debug-only fixtures), this
batch's needs_manual_review loci are dropped ENTIRELY per that explicit policy — not imported even
as a flagged placeholder. Dropped this run: P012-L003 (تعبدون), P012-L004 (حسنا), P014-L004
(يأمركم), P019-L001 (إبراهيم إسماعيل...), P020-L001 (إبراهيم), P020-L002 (وأرنا).
RULES_TABLE_REGION / FAWAID_REGION are out of scope: they document waqf/procedural rules and
poetic shawahid, not per-word Qiraat differences anchored to a Quran token — a structurally
different domain the current QiraatVariant model does not (and should not) represent; every
RULES_TABLE_REGION/FAWAID_REGION entry in the payload is additionally still needs_high_resolution
_transcription or a distinct rules taxonomy, so this is also required by the same import policy.

Idempotent: re-running regenerates the same output files from the locus data below (no external
state, no PDF dependency this session — see the pages-1-10 batch's own note on that).
"""
import glob
import json
import os
import re
import sys
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

WORD_LOOKUP = {}
for _fp in sorted(glob.glob(f"{ROOT}/packages/quran-data/mushaf1441/fixtures/page-words/page-*.json")):
    _data = json.load(open(_fp, encoding="utf-8"))
    for _line in _data.get("lines", []):
        for _w in _line.get("words", []):
            if _w.get("charTypeName") not in (None, "word"):
                continue
            WORD_LOOKUP[(_w["surahNumber"], _w["ayahNumber"], _w["wordIndexInAyah"])] = _w.get("textUthmani")
assert len(WORD_LOOKUP) > 70000, f"expected the full 604-page word index, got {len(WORD_LOOKUP)}"

_TASHKEEL_RE = re.compile(r"[ً-ٰٟۖ-ۭ]")

def _strip_tashkeel(s):
    return _TASHKEEL_RE.sub("", unicodedata.normalize("NFC", s or ""))

def real_hafs_text(surah, ayah, start_token, end_token):
    parts = []
    for tok in range(start_token, end_token + 1):
        key = (surah, ayah, tok)
        if key not in WORD_LOOKUP:
            raise ValueError(f"No real Mushaf word at {surah}:{ayah}:{tok} — never guess a word identity (task rule).")
        parts.append(WORD_LOOKUP[key])
    return " ".join(parts)

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

def _resolve_one(name):
    """Resolve one attribution name to narrator id(s). Handles compound 'X عن Y' phrases that are
    not literal NARRATOR keys (e.g. 'قالون عن نافع', 'شعبة عن عاصم') by resolving on the narrator
    part alone — safe because a bare narrator name (other than 'الدوري', which is genuinely
    ambiguous between two unrelated people and is therefore only ever matched via its two full
    compound keys above) already uniquely identifies one narrator across all ten readers."""
    if name in NARRATOR:
        return [NARRATOR[name]]
    if name in READER:
        return list(READER_NARRATORS[READER[name]])
    if " عن " in name:
        head = name.split(" عن ", 1)[0].strip()
        if head in NARRATOR:
            return [NARRATOR[head]]
        if head in READER:
            return list(READER_NARRATORS[READER[head]])
    raise ValueError(f"Unknown attribution name: {name!r}")

def ids_for(names):
    out = []
    for name in names:
        out.extend(_resolve_one(name))
    return sorted(set(out))

def remainder(*explicit_lists):
    covered = set()
    for lst in explicit_lists:
        covered.update(lst)
    return sorted(set(ALL_READINGS) - covered)

SOURCE_NAME = "مصحف القراءات العشر (نسخة PDF المزوَّدة من طرف المستخدم)"

def source(vid, pdf_page, mushaf_page):
    note = (
        "This session had no access to the source PDF file itself (not present in the sandbox) — "
        "the wording/attribution below was typed directly into the task prompt by the user, not "
        "independently read off a page image. Held at REVIEWED rather than VERIFIED until someone "
        "cross-checks it against the actual PDF page image, per this project's own "
        "verification-workflow rule. This batch's import policy explicitly excludes any "
        "needs_manual_review locus from the fixture set entirely (see this script's docstring)."
    )
    return [{
        "id": f"s-{vid}",
        "variantId": vid,
        "sourceName": SOURCE_NAME,
        "sourceType": "pdf",
        "pdfFilename": "مصحف القراءات العشر-1.pdf",
        "pdfPage": pdf_page,
        "sourceReference": f"صفحة المصحف {mushaf_page} · صفحة PDF {pdf_page}",
        "verificationNotes": note,
    }]

NOW = "2026-09-17T12:00:00.000Z"

def variant(vid, surah, ayah, token, operation, hafs_text, variant_text, diff_type, reading_ids,
            mushaf_page, pdf_page, locus_id=None, locus_type="word_variant", performance_note=None,
            notes=None, uthmani_text=None, end_token=None):
    end_token = end_token or token
    resolved_hafs_text = real_hafs_text(surah, ayah, token, end_token)
    if _strip_tashkeel(hafs_text.split(" ")[0]) != _strip_tashkeel(resolved_hafs_text.split(" ")[0]):
        print(
            f"WARNING: {vid}: hand-typed hafsText {hafs_text!r} does not match the real word at "
            f"{surah}:{ayah}:{token} ({resolved_hafs_text!r}) even ignoring diacritics — check the "
            f"token reference.",
            file=sys.stderr,
        )
    if variant_text == hafs_text:
        variant_text = resolved_hafs_text
    v = {
        "id": vid,
        "surah": surah, "ayah": ayah,
        "startToken": token, "endToken": end_token,
        "operation": operation,
        "hafsText": resolved_hafs_text,
        "variantText": variant_text,
        "differenceType": diff_type,
        "verificationStatus": "REVIEWED",
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

def splice(token_text, old_root, new_root):
    """Replace the variable 'root' substring within a real fixture token that also carries an
    attached prefix (e.g. splice('لِّجِبْرِيلَ', 'جِبْرِيلَ', 'جَبْرِيلَ') -> 'لِّجَبْرِيلَ') — never touches
    the real prefix, only swaps in the alternate reading's own spelling of the differing root."""
    if old_root not in token_text:
        raise ValueError(f"splice: root {old_root!r} not found in {token_text!r}")
    return token_text.replace(old_root, new_root)

pages = {n: [] for n in range(11, 21)}

# ============================================================ PAGE 11 — 2:74 (PDF p.16)
pages[11].append(variant(
    "v-p011-l001-fahya", 2, 74, 7, "DIACRITIC_CHANGE", "فَهِىَ", "فَهْيَ", "HARAKAH",
    ids_for(["قالون عن نافع", "أبو عمرو", "الكسائي", "أبو جعفر"]), 11, 16,
    notes="الباقون (ورش عن نافع، ابن كثير، ابن عامر، عاصم، حمزة، يعقوب، خلف العاشر) بكسر الهاء \"فَهِيَ\" موافقةً للرسم الأساس.",
))
pages[11].append(variant(
    "v-p011-l002-taqmaluna", 2, 74, 37, "REPLACE", "تَعْمَلُونَ", "يَعْمَلُونَ", "LETTER",
    ids_for(["ابن كثير"]), 11, 16, uthmani_text="يَعْمَلُونَ",
    notes="الباقون بالتاء \"تَعْمَلُونَ\" موافقةً للرسم الأساس.",
))

# ============================================================ PAGE 12 — 2:78, 2:81 (PDF p.17)
pages[12].append(variant(
    "v-p012-l001-amaniyya", 2, 78, 7, "REPLACE", "أَمَانِىَّ", "أَمَانِيَ", "LETTER",
    ids_for(["أبو جعفر"]), 12, 17, uthmani_text="أَمَانِيَ",
    notes="تخفيف الياء (بلا تشديد) عند أبي جعفر؛ الباقون بتشديد الياء موافقةً للرسم الأساس.",
))
pages[12].append(variant(
    "v-p012-l002-khatiatuhu", 2, 81, 7, "REPLACE", "خَطِيٓـَٔتُهُۥ", "خَطِيئَاتُهُ", "ADDITION",
    ids_for(["نافع", "أبو جعفر"]), 12, 17, uthmani_text="خَطِيئَاتُهُ",
    notes="الجمع \"خَطِيئَاتُهُ\" عند نافع وأبي جعفر؛ الباقون بالإفراد موافقةً للرسم الأساس.",
))
# P012-L003 (تعبدون) and P012-L004 (حسنا) are needs_manual_review — blocked by import policy.

# ============================================================ PAGE 13 — 2:85, 2:87 (PDF p.18)
pages[13].append(variant(
    "v-p013-l001-tazaharuna", 2, 85, 11, "REPLACE", "تَظَـٰهَرُونَ", "تَظَّاهَرُونَ", "LETTER",
    remainder(ids_for(["عاصم", "حمزة", "الكسائي", "خلف العاشر"])), 13, 18, uthmani_text="تَظَّاهَرُونَ",
    notes="تشديد الظاء عند الباقين؛ عاصم وحمزة والكسائي وخلف العاشر بتخفيف الظاء موافقةً للرسم الأساس.",
))
pages[13].append(variant(
    "v-p013-l002-alayhim", 2, 85, 12, "DIACRITIC_CHANGE", "عَلَيْهِم", "عَلَيْهِمُ", "HARAKAH",
    ids_for(["حمزة", "يعقوب"]), 13, 18,
    notes="ضم هاء الضمير عند حمزة ويعقوب؛ الباقون بكسر الهاء موافقةً للرسم الأساس.",
))
pages[13].append(variant(
    "v-p013-l003-usara", 2, 85, 17, "REPLACE", "أُسَـٰرَىٰ", "أَسْرَى", "LETTER",
    ids_for(["حمزة"]), 13, 18, uthmani_text="أَسْرَى",
    notes="الباقون \"أُسَارَى\" موافقةً للرسم الأساس.",
))
pages[13].append(variant(
    "v-p013-l004-tufadoohum", 2, 85, 18, "REPLACE", "تُفَـٰدُوهُمْ", "تَفْدُوهُمْ", "LETTER",
    ids_for(["ابن كثير", "أبو عمرو", "ابن عامر", "حمزة", "خلف العاشر"]), 13, 18, uthmani_text="تَفْدُوهُمْ",
    notes="الباقون (نافع، عاصم، الكسائي، أبو جعفر، يعقوب) \"تُفَادُوهُمْ\" موافقةً للرسم الأساس.",
))
pages[13].append(variant(
    "v-p013-l005-wahuwa-85", 2, 85, 19, "DIACRITIC_CHANGE", "وَهُوَ", "وَهْوَ", "HARAKAH",
    ids_for(["قالون عن نافع", "أبو عمرو", "الكسائي", "أبو جعفر"]), 13, 18,
    notes="إسكان الهاء؛ الباقون (ورش عن نافع، ابن كثير، ابن عامر، عاصم، حمزة، يعقوب، خلف العاشر) بضم الهاء موافقةً للرسم الأساس.",
))
pages[13].append(variant(
    "v-p013-l006-taqmaluna2", 2, 85, 49, "REPLACE", "تَعْمَلُونَ", "يَعْمَلُونَ", "LETTER",
    ids_for(["نافع", "ابن كثير", "شعبة عن عاصم", "يعقوب", "خلف العاشر"]), 13, 18, uthmani_text="يَعْمَلُونَ",
    notes="الباقون (ومنهم حفص عن عاصم) بالتاء موافقةً للرسم الأساس.",
))
pages[13].append(variant(
    "v-p013-l007-alqudus", 2, 87, 16, "DIACRITIC_CHANGE", "ٱلْقُدُسِ", "ٱلْقُدْسِ", "HARAKAH",
    ids_for(["ابن كثير"]), 13, 18,
    notes="إسكان الدال عند ابن كثير؛ الباقون بضم الدال موافقةً للرسم الأساس.",
))

# ============================================================ PAGE 14 — 2:90, 2:91 (PDF p.19)
pages[14].append(variant(
    "v-p014-l001-yunazzila", 2, 90, 12, "REPLACE", "يُنَزِّلَ", "يُنْزِلَ", "LETTER",
    ids_for(["ابن كثير", "أبو عمرو", "يعقوب"]), 14, 19, uthmani_text="يُنْزِلَ",
    notes="إسكان النون وتخفيف الزاي؛ الباقون بفتح النون وتشديد الزاي موافقةً للرسم الأساس.",
))
pages[14].append(variant(
    "v-p014-l002-qila-91", 2, 91, 2, "DIACRITIC_CHANGE", "قِيلَ", "قِيلَ", "IMALAH",
    ids_for(["هشام عن ابن عامر", "الكسائي", "رويس عن يعقوب"]), 14, 19,
    performance_note="إشمام كسرة القاف ضمًا.",
    notes="الباقون بالكسرة الخالصة.",
))
pages[14].append(variant(
    "v-p014-l003-wahuwa-91", 2, 91, 16, "DIACRITIC_CHANGE", "وَهُوَ", "وَهْوَ", "HARAKAH",
    ids_for(["قالون عن نافع", "أبو عمرو", "الكسائي", "أبو جعفر"]), 14, 19,
    notes="إسكان الهاء؛ الباقون بضم الهاء موافقةً للرسم الأساس (نفس حكم 2:85 يُطبَّق هنا).",
))
# P014-L004 (يأمركم) is needs_manual_review — blocked by import policy.

# ============================================================ PAGE 15 — 2:96, 2:97, 2:98 (PDF p.20)
pages[15].append(variant(
    "v-p015-l001-yamaluna", 2, 96, 25, "REPLACE", "يَعْمَلُونَ", "تَعْمَلُونَ", "LETTER",
    ids_for(["يعقوب"]), 15, 20, uthmani_text="تَعْمَلُونَ",
    notes="الباقون بالياء موافقةً للرسم الأساس.",
))
pages[15].append(variant(
    "v-p015-l002-jibril-97", 2, 97, 5, "REPLACE",
    real_hafs_text(2, 97, 5, 5),
    splice(real_hafs_text(2, 97, 5, 5), "جِبْرِيلَ", "جَبْرِيلَ"),
    "LETTER", ids_for(["ابن كثير"]), 15, 20, locus_id="p15-jibril",
    notes="ابن كثير بفتح الجيم بلا همز \"جَبْرِيلَ\". الحرف اللاصق \"لِّ\" من الآية محفوظ كما في الرسم الأساس.",
))
pages[15].append(variant(
    "v-p015-l002-jibril-97-shuba", 2, 97, 5, "REPLACE",
    real_hafs_text(2, 97, 5, 5),
    splice(real_hafs_text(2, 97, 5, 5), "جِبْرِيلَ", "جَبْرَئِلَ"),
    "HAMZ", ids_for(["شعبة عن عاصم"]), 15, 20, locus_id="p15-jibril",
    notes="شعبة عن عاصم بالهمز بلا ياء قبل اللام \"جَبْرَئِلَ\".",
))
pages[15].append(variant(
    "v-p015-l002-jibril-97-hamza", 2, 97, 5, "REPLACE",
    real_hafs_text(2, 97, 5, 5),
    splice(real_hafs_text(2, 97, 5, 5), "جِبْرِيلَ", "جَبْرَئِيلَ"),
    "HAMZ", ids_for(["حمزة", "الكسائي", "خلف العاشر"]), 15, 20, locus_id="p15-jibril",
    notes="حمزة والكسائي وخلف العاشر بالهمز مع الياء \"جَبْرَئِيلَ\". الباقون (نافع، أبو عمرو، ابن عامر، حفص عن عاصم، أبو جعفر، يعقوب) \"جِبْرِيلَ\" موافقةً للرسم الأساس.",
))
pages[15].append(variant(
    "v-p015-l002-jibril-98", 2, 98, 7, "REPLACE",
    real_hafs_text(2, 98, 7, 7),
    splice(real_hafs_text(2, 98, 7, 7), "جِبْرِيلَ", "جَبْرِيلَ"),
    "LETTER", ids_for(["ابن كثير"]), 15, 20, locus_id="p15-jibril",
    notes="نفس حكم 2:97 يُطبَّق هنا (موضع ثانٍ لنفس الكلمة في نفس الصفحة).",
))
pages[15].append(variant(
    "v-p015-l002-jibril-98-shuba", 2, 98, 7, "REPLACE",
    real_hafs_text(2, 98, 7, 7),
    splice(real_hafs_text(2, 98, 7, 7), "جِبْرِيلَ", "جَبْرَئِلَ"),
    "HAMZ", ids_for(["شعبة عن عاصم"]), 15, 20, locus_id="p15-jibril",
))
pages[15].append(variant(
    "v-p015-l002-jibril-98-hamza", 2, 98, 7, "REPLACE",
    real_hafs_text(2, 98, 7, 7),
    splice(real_hafs_text(2, 98, 7, 7), "جِبْرِيلَ", "جَبْرَئِيلَ"),
    "HAMZ", ids_for(["حمزة", "الكسائي", "خلف العاشر"]), 15, 20, locus_id="p15-jibril",
))
pages[15].append(variant(
    "v-p015-l003-mikal-nafi", 2, 98, 8, "REPLACE",
    real_hafs_text(2, 98, 8, 8),
    splice(real_hafs_text(2, 98, 8, 8), "مِيكَىٰلَ", "مِيكَائِلَ"),
    "HAMZ", ids_for(["نافع", "أبو جعفر"]), 15, 20, locus_id="p15-mikal",
    notes="نافع وأبو جعفر \"مِيكَائِلَ\" (بالهمز بلا ياء).",
))
pages[15].append(variant(
    "v-p015-l003-mikal-hamza", 2, 98, 8, "REPLACE",
    real_hafs_text(2, 98, 8, 8),
    splice(real_hafs_text(2, 98, 8, 8), "مِيكَىٰلَ", "مِيكَائِيلَ"),
    "HAMZ", ids_for(["ابن كثير", "ابن عامر", "شعبة عن عاصم", "حمزة", "الكسائي", "خلف العاشر"]), 15, 20,
    locus_id="p15-mikal",
    notes="ابن كثير وابن عامر وشعبة عن عاصم وحمزة والكسائي وخلف العاشر \"مِيكَائِيلَ\" (بالهمز مع الياء). الباقون (أبو عمرو، حفص عن عاصم، يعقوب) \"مِيكَالَ\" موافقةً للرسم الأساس.",
))

# ============================================================ PAGE 16 — 2:102, 2:105 (PDF p.21)
pages[16].append(variant(
    "v-p016-l001-walakini", 2, 102, 11, "DIACRITIC_CHANGE", "وَلَـٰكِنَّ", "وَلَـٰكِنِ", "HARAKAH",
    ids_for(["ابن عامر", "حمزة", "الكسائي", "خلف العاشر"]), 16, 21, locus_id="p16-walakinna",
    performance_note="تخفيف نون \"لكن\" وكسرها في الوصل.",
    notes="الباقون بتشديد النون وفتحها \"وَلَكِنَّ\" موافقةً للرسم الأساس.",
))
pages[16].append(variant(
    "v-p016-l001-shayatinu", 2, 102, 12, "DIACRITIC_CHANGE", "ٱلشَّيَـٰطِينَ", "ٱلشَّيَـٰطِينُ", "HARAKAH",
    ids_for(["ابن عامر", "حمزة", "الكسائي", "خلف العاشر"]), 16, 21, locus_id="p16-walakinna",
    performance_note="رفع \"الشياطين\" (فاعل مع تخفيف \"لكن\").",
    notes="الباقون بنصب \"الشياطين\" موافقةً للرسم الأساس.",
))
pages[16].append(variant(
    "v-p016-l002-yunazzala", 2, 105, 11, "REPLACE", "يُنَزَّلَ", "يُنْزَلَ", "LETTER",
    ids_for(["ابن كثير", "أبو عمرو", "يعقوب"]), 16, 21, uthmani_text="يُنْزَلَ",
    notes="إسكان النون وتخفيف الزاي؛ الباقون بفتح النون وتشديد الزاي موافقةً للرسم الأساس.",
))

# ============================================================ PAGE 17 — 2:106, 2:111, 2:112 (PDF p.22)
pages[17].append(variant(
    "v-p017-l001-nunsikh", 2, 106, 2, "DIACRITIC_CHANGE", "نَنسَخْ", "نُنسِخْ", "HARAKAH",
    ids_for(["ابن عامر"]), 17, 22,
    notes="ضم النون الأولى وكسر السين عند ابن عامر؛ الباقون بفتحهما موافقةً للرسم الأساس.",
))
pages[17].append(variant(
    "v-p017-l002-nansaha", 2, 106, 6, "REPLACE", "نُنسِهَا", "نَنسَأْهَا", "LETTER",
    ids_for(["ابن كثير", "أبو عمرو"]), 17, 22, uthmani_text="نَنسَأْهَا",
    notes="الباقون \"نُنْسِهَا\" موافقةً للرسم الأساس.",
))
pages[17].append(variant(
    "v-p017-l003-amaniyyuhum", 2, 111, 12, "REPLACE", "أَمَانِيُّهُمْ", "أَمَانِيهِمْ", "LETTER",
    ids_for(["أبو جعفر"]), 17, 22, uthmani_text="أَمَانِيهِمْ",
    notes="أبو جعفر بتخفيف الياء \"أَمَانِيهِمْ\"؛ الباقون بتشديدها موافقةً للرسم الأساس.",
))
pages[17].append(variant(
    "v-p017-l004-wahuwa-112", 2, 112, 6, "DIACRITIC_CHANGE", "وَهُوَ", "وَهْوَ", "HARAKAH",
    ids_for(["قالون عن نافع", "أبو عمرو", "الكسائي", "أبو جعفر"]), 17, 22,
    notes="إسكان الهاء؛ الباقون بضم الهاء موافقةً للرسم الأساس.",
))
pages[17].append(variant(
    "v-p017-l004b-wahuwa-112-yaqub", 2, 112, 6, "DIACRITIC_CHANGE", "وَهُوَ", "وَهُوَ", "WAQF",
    ids_for(["يعقوب"]), 17, 22,
    performance_note="ضم الهاء مع جواز الوقف بهاء السكت (خاص بيعقوب).",
    notes="النص المنطوق كالباقين \"وَهُوَ\"؛ الفارق أداءٌ وقفي فقط عند يعقوب.",
))
pages[17].append(variant(
    "v-p017-l005-khawfa-112", 2, 112, 13, "DIACRITIC_CHANGE", "خَوْفٌ", "خَوْفَ", "HARAKAH",
    ids_for(["يعقوب"]), 17, 22, locus_id="p17-khawf-alayhim",
    notes="فتح الفاء بلا تنوين عند يعقوب (مقترن بضم هاء \"عليهم\" التالية)؛ الباقون بالتنوين المرفوع موافقةً للرسم الأساس.",
))
pages[17].append(variant(
    "v-p017-l005-alayhim-112", 2, 112, 14, "DIACRITIC_CHANGE", "عَلَيْهِمْ", "عَلَيْهِمُ", "HARAKAH",
    ids_for(["حمزة", "يعقوب"]), 17, 22, locus_id="p17-khawf-alayhim",
    notes="ضم هاء الضمير عند حمزة ويعقوب؛ الباقون بكسر الهاء موافقةً للرسم الأساس.",
))

# ============================================================ PAGE 18 — 2:116, 2:117, 2:119 (PDF p.23)
pages[18].append(variant(
    "v-p018-l001-waqaloo", 2, 116, 1, "OMISSION", "وَقَالُوا۟", "قَالُوا۟", "OMISSION",
    ids_for(["ابن عامر"]), 18, 23, uthmani_text="قَالُوا۟",
    notes="حذف الواو عند ابن عامر؛ الباقون بإثباتها موافقةً للرسم الأساس.",
))
pages[18].append(variant(
    "v-p018-l002-fayakuna", 2, 117, 11, "DIACRITIC_CHANGE", "فَيَكُونُ", "فَيَكُونَ", "HARAKAH",
    ids_for(["ابن عامر"]), 18, 23,
    notes="نصب النون عند ابن عامر؛ الباقون برفعها موافقةً للرسم الأساس.",
))
pages[18].append(variant(
    "v-p018-l003-tasal", 2, 119, 7, "REPLACE", "تُسْـَٔلُ", "تَسْأَلْ", "HARAKAH",
    ids_for(["نافع", "يعقوب"]), 18, 23, uthmani_text="تَسْأَلْ",
    notes="فتح التاء وجزم اللام (بناء للفاعل) عند نافع ويعقوب؛ الباقون بضم التاء ورفع اللام (بناء للمفعول) موافقةً للرسم الأساس. \"وَلَا\" السابقة لهذه الكلمة لا تتغيّر بين الوجهين.",
))

# ============================================================ PAGE 19 — 2:125, 2:126 (PDF p.24)
pages[19].append(variant(
    "v-p019-l002-wattakhidhu", 2, 125, 7, "DIACRITIC_CHANGE", "وَٱتَّخِذُوا۟", "وَٱتَّخَذُوا۟", "HARAKAH",
    ids_for(["نافع", "ابن عامر"]), 19, 24,
    notes="فتح الخاء عند نافع وابن عامر؛ الباقون بكسرها موافقةً للرسم الأساس.",
))
pages[19].append(variant(
    "v-p019-l003-faumattiuhu", 2, 126, 22, "REPLACE", "فَأُمَتِّعُهُۥ", "فَأُمْتِعُهُ", "LETTER",
    ids_for(["ابن عامر"]), 19, 24, uthmani_text="فَأُمْتِعُهُ",
    notes="إسكان الميم وتخفيف التاء المكسورة عند ابن عامر؛ الباقون بفتح الميم وتشديد التاء موافقةً للرسم الأساس.",
))
# P019-L001 (إبراهيم/إبراهام) is needs_manual_review — blocked by import policy.

# ============================================================ PAGE 20 — 2:132 (PDF p.25)
pages[20].append(variant(
    "v-p020-l003-wawassa", 2, 132, 1, "REPLACE", "وَوَصَّىٰ", "وَأَوْصَى", "LETTER",
    ids_for(["نافع", "ابن عامر", "أبو جعفر"]), 20, 25, uthmani_text="وَأَوْصَى",
    notes="همزة مفتوحة بين الواوين وتخفيف الصاد عند نافع وابن عامر وأبي جعفر؛ الباقون بتشديد الصاد موافقةً للرسم الأساس.",
))
# P020-L001 (إبراهيم/إبراهام) and P020-L002 (وأرنا) are needs_manual_review — blocked by import policy.

# ---- write outputs ----
raw_all = []
for n in range(11, 21):
    raw_all.extend(pages[n])

os.makedirs(f"{ROOT}/data/qiraat/raw", exist_ok=True)
with open(f"{ROOT}/data/qiraat/raw/pages-011-020.json", "w", encoding="utf-8") as f:
    json.dump(raw_all, f, ensure_ascii=False, indent=2)

for n in range(11, 21):
    path = f"{ROOT}/packages/qiraat-core/fixtures/pages/page-{n:03d}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(pages[n], f, ensure_ascii=False, indent=2)

total_variants = sum(len(v) for v in pages.values())
total_loci = len({v.get("locusId") or v["id"] for v in raw_all})
empty_reading_ids = [v["id"] for v in raw_all if not v["readingIds"]]

print("pages:", {n: len(pages[n]) for n in range(11, 21)})
print("total variant records:", total_variants)
print("total loci (approx, by locusId or own id):", total_loci)
print("all REVIEWED (import policy blocks anything else):", all(v["verificationStatus"] == "REVIEWED" for v in raw_all))
print("records with empty readingIds (should be none — needs_manual_review loci are dropped, not placeholder-ed):", empty_reading_ids)
