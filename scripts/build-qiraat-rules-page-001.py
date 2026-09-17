#!/usr/bin/env python3
"""Builds packages/qiraat-core/fixtures/rules/page-001.json — the page-level Qiraat "rules"
(RULES_TABLE_REGION in the task payload) for Mushaf page 1, the only page in the pages 1-20 batch
whose RULES_TABLE_REGION isn't itself `needs_high_resolution_transcription`.

These are NOT per-word `QiraatVariant` records — they document procedural/recitation conventions
(ayah-counting, idgham across an ayah boundary, connection options between two surahs, madd length
before that idgham) that don't anchor to one Quran token. See the `QiraatRule` doc comment in
packages/qiraat-core/types.ts for why this is a separate domain/fixture tree.

Idempotent: re-running regenerates the same output from the locus data below.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

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
    "الدوري عن أبي عمرو": "Q03-R01", "السوسي عن أبي عمرو": "Q03-R02",
    "هشام": "Q04-R01", "ابن ذكوان": "Q04-R02",
    "شعبة": "Q05-R01", "حفص": "Q05-R02",
    "خلف عن حمزة": "Q06-R01", "خلاد": "Q06-R02",
    "أبو الحارث": "Q07-R01", "الدوري عن الكسائي": "Q07-R02",
    "ابن وردان": "Q08-R01", "ابن جماز": "Q08-R02",
    "رويس": "Q09-R01", "روح": "Q09-R02",
    "إسحاق": "Q10-R01", "إدريس": "Q10-R02",
}
# This rule category (أوجه الوصل بين السورتين) is the one place in this batch a bare "خلف" means
# the READER خلف العاشر (Q10, both narrators) rather than the narrator "خلف عن حمزة" (Q06-R01) —
# confirmed by cross-checking that R004+R005+R006+R007's attributions sum to exactly 20 readings
# with no overlap only under this reading (see the script's own assertion below).
WASL_BAB_OVERRIDES = {"خلف": "Q10"}

def ids_for(names, overrides=None):
    overrides = overrides or {}
    out = []
    for name in names:
        if name in overrides:
            out.extend(READER_NARRATORS[overrides[name]])
        elif name in NARRATOR:
            out.append(NARRATOR[name])
        elif name in READER:
            out.extend(READER_NARRATORS[READER[name]])
        else:
            raise ValueError(f"Unknown attribution name: {name!r}")
    return sorted(set(out))

SOURCE_NAME = "مصحف القراءات العشر (نسخة PDF المزوَّدة من طرف المستخدم)"
NOW = "2026-09-18T12:00:00.000Z"

def source(rid, pdf_page, mushaf_page):
    return [{
        "id": f"s-{rid}",
        "ruleId": rid,
        "sourceName": SOURCE_NAME,
        "sourceType": "pdf",
        "pdfFilename": "مصحف القراءات العشر-1.pdf",
        "pdfPage": pdf_page,
        "sourceReference": f"صفحة المصحف {mushaf_page} · صفحة PDF {pdf_page}",
        "verificationNotes": (
            "This session had no access to the source PDF file itself (not present in the "
            "sandbox) — the wording/attribution below was typed directly into the task prompt by "
            "the user, not independently read off a page image. Held at REVIEWED rather than "
            "VERIFIED until someone cross-checks it against the actual PDF page image."
        ),
    }]

def rule(rid, mushaf_page, pdf_page, category, **kwargs):
    r = {
        "id": rid,
        "pageNumber": mushaf_page,
        "category": category,
        "verificationStatus": "REVIEWED",
        "sources": source(rid, pdf_page, mushaf_page),
    }
    r.update({k: v for k, v in kwargs.items() if v is not None})
    return r

rules = [
    rule(
        "r-p001-r001-ayat-count-basmalah", 1, 6, "عد الآي",
        text="بسم الله الرحمن الرحيم",
        attributionLabel="المكي، الكوفي (يعدّان البسملة آية مستقلة من الفاتحة)",
        notes="اصطلاح عدّي وليس قراءة أداء: يخص مدرستَي عدّ الآي المكي والكوفي، لا القراء أو الرواة العشرة.",
    ),
    rule(
        "r-p001-r002-ayat-count-anamta", 1, 6, "عد الآي",
        text="أنعمت عليهم",
        attributionLabel="المدنيان، البصري، الشامي (يعدّون \"أنعمت عليهم\" رأس آية)",
        notes="اصطلاح عدّي وليس قراءة أداء: يخص مدارس العدّ المدني والبصري والشامي، لا القراء أو الرواة العشرة.",
    ),
    rule(
        "r-p001-r003-idgham-kabir", 1, 6, "الإدغام الكبير",
        text="الرحيم ۝ مالك",
        readingIds=ids_for(["السوسي عن أبي عمرو"]),
        notes="إدغام الميم في الميم عبر فاصل رأس الآية (الإدغام الكبير) خاص بالسوسي عن أبي عمرو.",
    ),
    rule(
        "r-p001-r004-wasl-basmalah", 1, 6, "الأوجه بين السورتين",
        reading="البسملة",
        readingIds=ids_for(["قالون", "ابن كثير", "عاصم", "الكسائي", "أبو جعفر"]),
        notes="بين آخر الفاتحة وأول البقرة.",
    ),
    rule(
        "r-p001-r005-wasl-wasl", 1, 6, "الأوجه بين السورتين",
        reading="الوصل",
        readingIds=ids_for(["حمزة", "خلف"], WASL_BAB_OVERRIDES),
        notes="\"خلف\" هنا يعني خلف العاشر (القارئ العاشر) لا خلف عن حمزة (الراوي) — كلاهما بلا بسملة ولا سكت بين السورتين.",
    ),
    rule(
        "r-p001-r006-wasl-sakt-or-wasl", 1, 6, "الأوجه بين السورتين",
        reading="السكت أو الوصل",
        readingIds=ids_for(["أبو عمرو", "ابن عامر", "يعقوب"]),
    ),
    rule(
        "r-p001-r007-wasl-sakt-wasl-basmalah", 1, 6, "الأوجه بين السورتين",
        reading="السكت أو الوصل أو البسملة",
        readingIds=ids_for(["ورش"]),
        notes="ورش وحده له التخيير بين ثلاثة أوجه؛ قالون (الراوي الآخر عن نافع) بالبسملة فقط (انظر الوجه أعلاه).",
    ),
    rule(
        "r-p001-r008-madd-before-idgham", 1, 6, "المد قبل الإدغام الكبير",
        options=["القصر", "التوسط", "الإشباع"],
        notes="لا نسبة قارئ/راوٍ محددة في المصدر لهذا الخيار — ثلاثة أوجه في مقدار المد قبل الإدغام الكبير (انظر r-p001-r003) متاحة لمن يُدغم.",
    ),
]

# Sanity check: the four أوجه بين السورتين rules must partition all 20 readings exactly once —
# confirms the "خلف" = خلف العاشر reading above, since any other resolution would over/under-count.
wasl_rules = [r for r in rules if r["category"] == "الأوجه بين السورتين"]
all_wasl_ids = [rid for r in wasl_rules for rid in r["readingIds"]]
assert len(all_wasl_ids) == 20, f"expected exactly 20 readings across the 4 وصل/بسملة/سكت rules, got {len(all_wasl_ids)}"
assert len(set(all_wasl_ids)) == 20, "a reading was attributed to more than one وصل/بسملة/سكت rule"

os.makedirs(f"{ROOT}/packages/qiraat-core/fixtures/rules", exist_ok=True)
with open(f"{ROOT}/packages/qiraat-core/fixtures/rules/page-001.json", "w", encoding="utf-8") as f:
    json.dump(rules, f, ensure_ascii=False, indent=2)

print(f"wrote {len(rules)} rules to packages/qiraat-core/fixtures/rules/page-001.json")
