# -*- coding: utf-8 -*-
"""Arabic group/attribution phrase -> list of resolved reader Q-IDs.

This is a Python mirror of the CANONICAL group definitions already shipped in
`packages/qiraat-core/symbols.ts` (رموز الشاطبية والدرة الكلمية والحرفية) plus the
geographic/group-name table in that same file. Nothing here is invented: every entry below
is transcribed verbatim from that file's `WORD_SYMBOLS`, `LETTER_GROUP_SYMBOLS` and
`GROUP_NAMES` tables so the importer never runs a second, competing reader/narrator model
(task requirement #6: "Reuse the existing Mutshabehat authority model. Do NOT invent
another reader/narrator naming system.").

A term that `packages/qiraat-core/symbols.ts` itself documents as context-dependent
(e.g. "المدني", "البصري" — ambiguous inside the Ten between two different people) is
DELIBERATELY left out of GROUPS below. Excel rows using such a term must fail to resolve
and surface as UNRESOLVED_AUTHORITY for manual review, per task requirement #6:
"If an Excel value cannot be resolved deterministically: DO NOT GUESS."

Every value is a whole-reader id list (each expands to both narrators of that reader via
`authorities.readings_of`), matching how symbols.ts's own `readingsOfGroupSymbol` works.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import authorities as A  # noqa: E402

# name (Arabic, as it appears in Excel attribution text) -> list of reader Q-IDs.
# Transcribed from packages/qiraat-core/symbols.ts WORD_SYMBOLS + LETTER_GROUP_SYMBOLS.
GROUPS = {
    # ── الرموز الكلمية الثمانية (الشاطبية) ──
    # صحبة/صحاب also carry a narrator-only member (شعبة / حفص respectively); modelled
    # explicitly below rather than as "reader" expansion, exactly like the TS source.
    'صحبة': {'readers': ['Q06', 'Q07'], 'narrators': ['Q05-R01']},   # حمزة، الكسائي، شعبة
    'صحاب': {'readers': ['Q06', 'Q07'], 'narrators': ['Q05-R02']},   # حمزة، الكسائي، حفص
    'عم': {'readers': ['Q01', 'Q04'], 'narrators': []},
    'سما': {'readers': ['Q01', 'Q02', 'Q03'], 'narrators': []},
    'حق': {'readers': ['Q02', 'Q03'], 'narrators': []},
    'نفر': {'readers': ['Q02', 'Q03', 'Q04'], 'narrators': []},
    'حرمي': {'readers': ['Q01', 'Q02'], 'narrators': []},
    'حصن': {'readers': ['Q01', 'Q05', 'Q06', 'Q07'], 'narrators': []},
    # ── الرموز الحرفية الستة (ثخذ ظغش) ──
    'الكوفيون الثلاثة': {'readers': ['Q05', 'Q06', 'Q07'], 'narrators': []},
    'الستة غير نافع': {'readers': ['Q02', 'Q03', 'Q04', 'Q05', 'Q06', 'Q07'], 'narrators': []},
    'الكوفيون وابن عامر': {'readers': ['Q05', 'Q06', 'Q07', 'Q04'], 'narrators': []},
    'الكوفيون وابن كثير': {'readers': ['Q05', 'Q06', 'Q07', 'Q02'], 'narrators': []},
    'الكوفيون وأبو عمرو': {'readers': ['Q05', 'Q06', 'Q07', 'Q03'], 'narrators': []},
    'الأخوان': {'readers': ['Q06', 'Q07'], 'narrators': []},
    # ── أسماء البلدان والجماعات (غير الغامض بالسياق فقط — packages/qiraat-core/symbols.ts §7) ──
    'المدنيان': {'readers': ['Q01', 'Q08'], 'narrators': []},
    'المكي': {'readers': ['Q02'], 'narrators': []},
    'البصريان': {'readers': ['Q03', 'Q09'], 'narrators': []},
    'الشامي': {'readers': ['Q04'], 'narrators': []},
    'الدمشقي': {'readers': ['Q04'], 'narrators': []},
    'اليحصبي': {'readers': ['Q04'], 'narrators': []},
    # «الكوفيون» عند إطلاقه في العشرة: الثلاثة + خلف العاشر (symbols.ts GROUP_NAMES).
    'الكوفيون': {'readers': ['Q05', 'Q06', 'Q07', 'Q10'], 'narrators': []},
    'الحجازيون': {'readers': ['Q01', 'Q02', 'Q08'], 'narrators': []},
    'العراقيون': {'readers': ['Q03', 'Q05', 'Q06', 'Q07', 'Q09', 'Q10'], 'narrators': []},
    'الثلاثة المتممون للعشرة': {'readers': ['Q08', 'Q09', 'Q10'], 'narrators': []},
}

# Deliberately unresolved: symbols.ts flags these as needing context/scope before they can
# be turned into a fixed reader list. Listed here (not silently absent) so an importer can
# give a specific, cited reason instead of a bare "unknown authority".
AMBIGUOUS_WITHOUT_CONTEXT = {
    'المدني': 'يحتاج إلى السياق؛ ففي العشرة إمامان مدنيان (نافع وأبو جعفر)',
    'البصري': 'يحتاج إلى السياق؛ ففي العشرة أبو عمرو ويعقوب',
    'الباقون': 'ليست مجموعة ذات قائمة ثابتة؛ تُحلّ فقط بمعرفة كل مَن سبق ذكره في نفس الموضع (remainder)',
    'غيره': 'ليست مجموعة ذات قائمة ثابتة؛ تحتاج تحديد مرجع الضمير',
    'سواهم': 'ليست مجموعة ذات قائمة ثابتة؛ تحتاج تحديد مرجع الضمير',
    'الجميع': 'ليست مجموعة ذات قائمة ثابتة؛ تحتاج تحديد النطاق',
    'خلف': 'رمز غامض بين خلف عن حمزة (Q06-R01) وخلف العاشر (Q10) — استخدم اسمًا كاملًا',
    'الدوري': 'رمز غامض بين الدوري عن أبي عمرو (Q03-R01) والدوري عن الكسائي (Q07-R02)',
}


def _normalize_key(name: str) -> str:
    return ' '.join(name.strip().split())


def resolve_group(name: str):
    """Return sorted reading ids (Q0N-R0M) for a group name, or raise BadAuthority."""
    key = _normalize_key(name)
    if key in AMBIGUOUS_WITHOUT_CONTEXT:
        raise A.BadAuthority(f'group {name!r} is ambiguous without context: {AMBIGUOUS_WITHOUT_CONTEXT[key]}')
    if key not in GROUPS:
        raise A.BadAuthority(f'unknown authority group {name!r}')
    spec = GROUPS[key]
    out = []
    for reader_id in spec['readers']:
        for r in A.readings_of(reader_id):
            if r not in out:
                out.append(r)
    for narrator_id in spec.get('narrators', []):
        if narrator_id not in out:
            out.append(narrator_id)
    return sorted(out)


def is_group(name: str) -> bool:
    key = _normalize_key(name)
    return key in GROUPS or key in AMBIGUOUS_WITHOUT_CONTEXT
