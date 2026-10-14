#!/usr/bin/env python3
"""Sub-category rules for the Qiraat entries (closed vocabulary, no «أخرى»).

    python3 scripts/qiraat/subcategory_rules.py artifacts/live-subcat.json artifacts/subcat   # coverage report + SQL

Farsh: the existing `variant_type` (plus the new `word_change`) is derived from the explanation text and the letters.
Usul: `qiraat_ruling_details.sub_category` is one Arabic label from the closed list below, chosen by keywords in the
narrators' own action texts (and the ruling text). An entry whose text matches no rule gets NO label and is listed for
the human queue; nothing is guessed.
"""
import json
import re
import sys
from collections import Counter, defaultdict

MARKS = re.compile(r"[ً-ٰٟۖ-ۭـ]")


def norm(s: str) -> str:
    s = MARKS.sub("", s or "")
    for a, b in (("أ", "ا"), ("إ", "ا"), ("آ", "ا"), ("ٱ", "ا"), ("ى", "ي"), ("ة", "ه"), ("ؤ", "و"), ("ئ", "ي")):
        s = s.replace(a, b)
    return re.sub(r"\s+", " ", s).strip()


def has(n: str, *words: str) -> bool:
    return any(w in n for w in words)


# ----------------------------------------------------------------------------- usul

def mim_jam(n):
    if has(n, "بضم ميم", "ضم ميم"):
        return "ضم الميم ووصلها بواو لفظية"
    if has(n, "كسر الدوري الميم", "كسر الميم", "بكسر الهاء وصله الميم", "كسر الياء والهاء وصله الميم"):
        return "كسر الميم وصلاً (التقاء الساكنين)" if "كسر الدوري الميم" in n or n.startswith("كسر الميم") else "صلة ميم الجمع وصلاً"
    if has(n, "الاشباع"):
        return "صلة ميم الجمع مع الإشباع"
    if has(n, "صله ميم", "صله الميم"):
        return "صلة ميم الجمع بخلف" if "بخلف" in n or "وجهان" in n else "صلة ميم الجمع وصلاً"
    if has(n, "ترك الصله", "اسكان الميم"):
        return "ترك الصلة (إسكان الميم)"
    return None


def imalah(n):
    ha = has(n, "هاء التانيث", "ها التانيث", "هاء التانيث")
    if ha:
        return "إمالة هاء التأنيث وقفاً"
    both = has(n, "امال") and has(n, "قلل", "تقليل") or "امال/تقليل" in n or "اماله/تقليل" in n or "امال وتقليل" in n
    if both:
        return "إمالة وتقليل (وجهان)"
    if has(n, "تقليل", "قلل", "بين بين", "بالتقليل"):
        return "تقليل"
    if has(n, "امال", "اميل", "بالاماله"):
        return "إمالة"
    if has(n, "فتح") and not has(n, "امال"):
        return "فتح"
    return None


def sakt_naql(n):
    if has(n, "هاء السكت", "ها السكت", "بهاء السكت"):
        return "هاء السكت وقفاً"
    sakt = "السكت" in n or "بالسكت" in n
    naql = has(n, "النقل", "بالنقل", "نقل حركه", "ونقل")
    tark = has(n, "ترك السكت", "بتركه", "تركهما")
    wa_adamuh = has(n, "وعدمه")
    tahqiq = has(n, "التحقيق", "تحقيق")
    if sakt and naql and (tahqiq or "وتركهما" in n or tark):
        return "سكت ونقل وتحقيق (أوجه)"
    if tark and naql:
        return "نقل مع ترك السكت" if not tahqiq else "نقل وتحقيق مع ترك السكت"
    if sakt and wa_adamuh and naql:
        return "سكت وترك السكت (وجهان) مع النقل وقفاً"
    if sakt and wa_adamuh:
        return "سكت وترك السكت (وجهان)"
    if sakt and naql:
        return "سكت ونقل"
    if sakt and "حروف التهجي" in n:
        return "سكت على حروف التهجي"
    if naql and tahqiq:
        return "نقل وتحقيق (وجهان)"
    if naql:
        return "نقل حركة الهمزة"
    if sakt:
        return "سكت"
    if tahqiq:
        return "تحقيق"
    return None


WAQF_OPTS = (("تسهيل", ("تسهيل", "التسهيل", "بين بين", "الروم")), ("إبدال", ("ابدال", "الابدال", "بدال")),
             ("حذف", ("حذف", "حذفها", "بحذف")), ("نقل", ("النقل", "نقل", "بالنقل")),
             ("تحقيق", ("تحقيق", "التحقيق")), ("سكت", ("السكت", "بالسكت")))


def hamza(n):
    if has(n, "خمسه القياس"):
        return "أوجه الوقف على الهمزة"
    if has(n, "السكون المحض", "اشمام", "بالروم"):
        parts = None
    # split "wasl, waqf" description
    m = re.search(r"(?:وقف|وقفا|الوقف)(.*)$", n)
    waqf = m.group(1) if m else ""
    wasl = n[: m.start()] if m else n
    found = [name for name, keys in WAQF_OPTS if any(k in waqf for k in keys)]
    wasl_tahqiq = has(wasl, "تحقيق الهمزه", "بتحقيق", "تحقيق") and m is not None
    if m and wasl_tahqiq:
        if len(found) >= 2:
            return "أوجه الوقف على الهمزة"
        if found == ["تسهيل"]:
            return "تحقيق وصلاً وتسهيل وقفاً"
        if found == ["إبدال"]:
            return "تحقيق وصلاً وإبدال وقفاً"
        if found == ["تحقيق"]:
            return "تحقيق الهمزة"
        if found == ["نقل"]:
            return "تحقيق وصلاً ونقل وقفاً"
    # plain one-word forms
    opts = [name for name, keys in WAQF_OPTS if any(k in n for k in keys)]
    if len(opts) >= 2:
        return "أوجه الوقف على الهمزة"
    if opts == ["إبدال"]:
        return "إبدال الهمزة"
    if opts == ["تسهيل"]:
        return "تسهيل الهمزة"
    if opts == ["نقل"]:
        return "نقل حركة الهمزة"
    if opts == ["حذف"]:
        return "حذف الهمزة"
    if opts == ["تحقيق"]:
        return "تحقيق الهمزة"
    if opts == ["سكت"]:
        return "سكت"
    if "ابدال" in n or "الهمز" in n and "ابدال" in n:
        return "إبدال الهمزة"
    return None


def hamzatan(n):
    if has(n, "همزه واحده"):
        return "قراءة بهمزة واحدة"
    if has(n, "اسقاط الاولي", "اسقاط الهمزه الاولي", "حذف الاولي"):
        return "إسقاط الأولى"
    if has(n, "تحقيق الهمزتين", "تحقيقهما"):
        return "تحقيق الهمزتين"
    ibdal = has(n, "ابدال")
    tashil = has(n, "تسهيل", "التسهيل")
    idkhal = has(n, "الادخال", "ادخال")
    no_idkhal = has(n, "بلا ادخال", "بدون ادخال", "دون ادخال", "عدم الادخال")
    if tashil and ibdal:
        return "تسهيل الثانية أو إبدالها"
    if ibdal:
        return "إبدال الثانية"
    if tashil and no_idkhal:
        return "تسهيل الثانية بلا إدخال"
    if tashil and idkhal:
        return "تسهيل الثانية مع الإدخال"
    if has(n, "تسهيل الاولي"):
        return "تسهيل الأولى"
    if tashil:
        return "تسهيل الثانية"
    if has(n, "التحقيق مع الادخال"):
        return "تحقيق الهمزتين مع الإدخال"
    if has(n, "تحقيق"):
        return "تحقيق الهمزتين"
    return None


def idgham(n, cat):
    if (cat == "IDGHAM_KABIR" and "ادغام صغير" in n) or (cat == "IDGHAM_SAGHIR" and "ادغام كبير" in n):
        return None  # the text contradicts the category: a human decides
    m = re.search(r"ادغام ال(\S+) في ال(\S+)", n)
    if m:
        return f"إدغام {m.group(1)} في {m.group(2)}"
    if has(n, "ادغام كبير"):
        return "إدغام كبير"
    if has(n, "ادغام صغير"):
        return "إدغام صغير"
    if has(n, "ادغم", "ادغام"):
        return "إدغام كبير" if cat == "IDGHAM_KABIR" else "إدغام صغير"
    return None


def ghunna_ikhfa(n):
    if has(n, "اسكان الميم") and has(n, "اخفاء"):
        return "إسكان الميم مع الإخفاء"
    if has(n, "ترك الغنه", "بلا غنه", "بغير غنه"):
        return "ترك الغنة"
    if has(n, "اخفاء"):
        return "إخفاء"
    return None


def yaat_idafa(n):
    if has(n, "اسكان", "اسكن"):
        return "إسكان الياء"
    if has(n, "فتح", "الفتح"):
        return "فتح الياء"
    if has(n, "اثبات الياء"):
        return "إثبات الياء"
    return None


def yaat_zawaid(n):
    if has(n, "حذف"):
        return "حذف الياء"
    wasl = has(n, "وصلا")
    waqf = has(n, "وقفا")
    both = has(n, "الحالين") or (wasl and waqf)
    if both:
        return "إثبات الياء وصلاً ووقفاً"
    if wasl:
        return "إثبات الياء وصلاً"
    if waqf:
        return "إثبات الياء وقفاً"
    if has(n, "اثبات", "بالياء"):
        return "إثبات الياء"
    return None


def madd(n, cat):
    if cat == "MADD_LIN":
        return "مد اللين المهموز (توسط/طول)"
    if has(n, "تثليث"):
        return "تثليث مد البدل"
    if has(n, "مد البدل"):
        return "مد البدل"
    return None


def silat_ha(n):
    if has(n, "ضم الهاء"):
        return "ضم الهاء"
    if has(n, "اسكان الهاء", "قصر الهاء", "القصر", "الاسكان"):
        return "إسكان الهاء (قصر)"
    if has(n, "صله"):
        return "صلة الهاء"
    return None


def tarqiq_taghliz(n, cat):
    if cat == "TAGHLIZ_LAM":
        return "تغليظ اللام بعد الصاد أو الطاء أو الظاء" if has(n, "الصاد", "الطاء") else "تغليظ اللام"
    if has(n, "ترقيق"):
        return "ترقيق الراء"
    return None


def waqf_rasm(n):
    if has(n, "هاء السكت"):
        return "الوقف بهاء السكت"
    if has(n, "بالياء", "اثبات الياء"):
        return "الوقف بالياء"
    if has(n, "بالهاء", "اثبات الهاء"):
        return "الوقف بالهاء"
    if has(n, "على الالف", "على الالف او اللام", "على ما"):
        return "الوقف على المرسوم"
    return None


CAT_FUNC = {
    "USUL_MIM_JAM": lambda n, c: mim_jam(n),
    "IMALAH_TAQLIL": lambda n, c: imalah(n),
    "USUL_SAKT": lambda n, c: sakt_naql(n), "USUL_NAQL": lambda n, c: sakt_naql(n),
    "USUL_TAHQIQ": lambda n, c: hamza(n), "WAQF_HAMZA": lambda n, c: hamza(n), "USUL_TASHIL": lambda n, c: hamza(n),
    "USUL_IBDAL": lambda n, c: hamza(n), "TAGHYIR_HAMZ": lambda n, c: hamza(n),
    "HAMZATAN_KALIMA": lambda n, c: hamzatan(n), "HAMZATAN_KALIMATAYN": lambda n, c: hamzatan(n),
    "IDGHAM_SAGHIR": lambda n, c: idgham(n, c), "IDGHAM_KABIR": lambda n, c: idgham(n, c),
    "TARK_GHUNNA": lambda n, c: ghunna_ikhfa(n) or ("ترك الغنة" if has(n, "ادغام") else None), "IKHFA": lambda n, c: ghunna_ikhfa(n),
    "YAAT_IDAFA": lambda n, c: yaat_idafa(n), "YAAT_ZAWAID": lambda n, c: yaat_zawaid(n),
    "MADD_BADAL": lambda n, c: madd(n, c), "MADD_LIN": lambda n, c: madd(n, c),
    "SILAT_HA": lambda n, c: silat_ha(n), "TARQIQ_RA": lambda n, c: tarqiq_taghliz(n, c), "TAGHLIZ_LAM": lambda n, c: tarqiq_taghliz(n, c),
    "WAQF_RASM": lambda n, c: waqf_rasm(n),
}

FIXED = {  # categories whose only meaning is the sub-category itself (the text adds nothing to decide)
    "TARQIQ_RA": "ترقيق الراء", "MADD_BADAL": None, "AYAH_COUNT": "عد الآية",
}


MIXED = {  # an entry holds several narrators whose action texts differ: the rule family names the whole entry
    "USUL_MIM_JAM": "صلة ميم الجمع (أوجه متعددة)",
    "USUL_SAKT": "سكت ونقل وتحقيق (أوجه)", "USUL_NAQL": "سكت ونقل وتحقيق (أوجه)",
    "USUL_TAHQIQ": "أوجه الوقف على الهمزة", "WAQF_HAMZA": "أوجه الوقف على الهمزة", "USUL_TASHIL": "أوجه الوقف على الهمزة",
    "USUL_IBDAL": "أوجه الوقف على الهمزة", "TAGHYIR_HAMZ": "تغيير الهمز (أوجه متعددة)",
    "HAMZATAN_KALIMA": "أوجه الهمزتين من كلمة (متعددة)", "HAMZATAN_KALIMATAYN": "أوجه الهمزتين من كلمتين (متعددة)",
    "YAAT_ZAWAID": "إثبات الياء (أوجه متعددة)", "YAAT_IDAFA": "فتح الياء وإسكانها",
    "IMALAH_TAQLIL": "إمالة وتقليل (وجهان)",
}


EXTRA_VOCAB = {  # allowed labels no live entry needs today but the editor must be able to choose
    "USUL_MIM_JAM": ["صلة ميم الجمع وصلاً", "صلة ميم الجمع بخلف", "صلة ميم الجمع مع الإشباع", "ترك الصلة (إسكان الميم)"],
    "IMALAH_TAQLIL": ["إمالة", "تقليل", "إمالة هاء التأنيث وقفاً", "إمالة وتقليل (وجهان)", "فتح"],
    "YAAT_ZAWAID": ["إثبات الياء وصلاً", "إثبات الياء وصلاً ووقفاً", "إثبات الياء وقفاً", "حذف الياء"],
    "YAAT_IDAFA": ["فتح الياء", "إسكان الياء", "فتح الياء وإسكانها"],
    "MADD_BADAL": ["مد البدل", "تثليث مد البدل"],
    "SILAT_HA": ["صلة الهاء", "ضم الهاء", "إسكان الهاء (قصر)"],
    "WAQF_RASM": ["الوقف بالهاء", "الوقف بهاء السكت", "الوقف بالياء", "الوقف على المرسوم"],
    "IDGHAM_SAGHIR": ["إدغام صغير"], "IDGHAM_KABIR": ["إدغام كبير"],
    "TARK_GHUNNA": ["ترك الغنة"], "IKHFA": ["إخفاء", "إسكان الميم مع الإخفاء"],
    "TARQIQ_RA": ["ترقيق الراء"], "TAGHLIZ_LAM": ["تغليظ اللام", "تغليظ اللام بعد الصاد أو الطاء أو الظاء"],
}
SAKT_FAMILY = ["سكت", "نقل حركة الهمزة", "تحقيق", "هاء السكت وقفاً", "سكت على حروف التهجي", "سكت ونقل", "نقل مع ترك السكت", "نقل وتحقيق مع ترك السكت",
               "نقل وتحقيق (وجهان)", "سكت وترك السكت (وجهان)", "سكت وترك السكت (وجهان) مع النقل وقفاً", "سكت ونقل وتحقيق (أوجه)"]
HAMZA_FAMILY = ["تحقيق الهمزة", "تسهيل الهمزة", "إبدال الهمزة", "نقل حركة الهمزة", "حذف الهمزة", "سكت", "تحقيق وصلاً وتسهيل وقفاً", "تحقيق وصلاً وإبدال وقفاً",
                "تحقيق وصلاً ونقل وقفاً", "أوجه الوقف على الهمزة", "تغيير الهمز (أوجه متعددة)"]
HAMZATAN_FAMILY = ["إسقاط الأولى", "تحقيق الهمزتين", "تحقيق الهمزتين مع الإدخال", "تسهيل الثانية مع الإدخال", "تسهيل الثانية بلا إدخال", "تسهيل الثانية",
                   "تسهيل الأولى", "إبدال الثانية", "تسهيل الثانية أو إبدالها", "قراءة بهمزة واحدة"]
for _c in ("USUL_SAKT", "USUL_NAQL"):
    EXTRA_VOCAB[_c] = SAKT_FAMILY
for _c in ("USUL_TAHQIQ", "WAQF_HAMZA", "USUL_TASHIL", "USUL_IBDAL", "TAGHYIR_HAMZ"):
    EXTRA_VOCAB[_c] = HAMZA_FAMILY
for _c, _m in (("HAMZATAN_KALIMA", "أوجه الهمزتين من كلمة (متعددة)"), ("HAMZATAN_KALIMATAYN", "أوجه الهمزتين من كلمتين (متعددة)")):
    EXTRA_VOCAB[_c] = HAMZATAN_FAMILY + [_m]
EXTRA_VOCAB["USUL_MIM_JAM"] += ["صلة ميم الجمع (أوجه متعددة)", "ضم الميم ووصلها بواو لفظية", "كسر الميم وصلاً (التقاء الساكنين)"]
EXTRA_VOCAB["YAAT_ZAWAID"] += ["إثبات الياء (أوجه متعددة)"]
EXTRA_VOCAB["YAAT_IDAFA"] += ["إثبات الياء"]
EXTRA_VOCAB["AYAH_COUNT"] = ["عد الآية"]


def vocabulary(entries):
    """category -> sorted allowed labels = hand-written lists + every label the rules produce on `entries`."""
    vocab = {c: set(v) for c, v in EXTRA_VOCAB.items()}
    for e in entries:
        if e["kind"] == "ruling":
            lab = usul_label(e)
            if lab:
                vocab.setdefault(e["category"], set()).add(lab)
    return {c: sorted(v) for c, v in vocab.items()}


def usul_label(entry):
    cat = entry["category"]
    if cat == "AYAH_COUNT":
        return FIXED[cat]
    fn = CAT_FUNC.get(cat)
    if fn is None:
        return None
    texts = [t for t in ((a.get("a") or "").strip() for a in (entry.get("auth") or [])) if t]
    if not texts:
        texts = [entry.get("text_ar") or ""]
    labels = []
    for t in dict.fromkeys(texts):
        lab = fn(norm(t), cat)
        if lab is None and cat in ("TARQIQ_RA", "MADD_BADAL", "MADD_LIN", "TAGHLIZ_LAM"):
            lab = fn(norm(entry.get("text_ar") or ""), cat)
        labels.append(lab)
    if not labels or any(l is None for l in labels):
        return None
    uniq = list(dict.fromkeys(labels))
    if len(uniq) == 1:
        return uniq[0]
    if cat == "IMALAH_TAQLIL" and {"إمالة", "تقليل"} <= set(uniq):
        return "إمالة وتقليل (وجهان)"
    merged = MIXED.get(cat)
    if merged is None:
        return None
    return merged if isinstance(merged, str) else merged(uniq)


# ----------------------------------------------------------------------------- farsh

def skeleton(s: str) -> str:
    s = (s or "").replace("\u0670", "ا")  # dagger alef is a real long vowel in the reading
    s = re.sub(r"[ءٔٓ]", "", norm(s))
    return re.sub(r"[\s\u06DF]+", "", s)


def letter_type(base: str, reading: str):
    a, b = skeleton(base), skeleton(reading)
    if a == b:
        return "vowel"
    if len(a) == len(b):
        if sum(1 for x, y in zip(a, b) if x != y) == 1:
            return "consonant"
        return "word_form" if len(base.split()) > 1 and sorted(norm(base).split()) == sorted(norm(reading).split()) else "word_change"
    if len(b) > len(a):
        return "addition" if a in b else "word_change"
    return "omission" if b in a else "word_change"


FAMILY_WORDS = (  # (type, normalized keywords)
    ("hamza", ("همز", "تسهيل", "ابدال همزه")),
    ("imalah", ("اماله", "امال", "تقليل", "قلل")),
    ("idgham", ("ادغام",)),
    ("sakt", ("سكت",)),
    ("naql", ("نقل حركه",)),
    ("madd", ("المد", "بالمد", "قصر", "اشباع")),
    ("omission", ("بحذف", "حذف")),
    ("addition", ("اثبات", "باثبات", "زياده")),
    ("vowel", ("اسكان", "اسكن", "ضم ", "فتح", "كسر", "تشديد", "تخفيف", "رفع", "نصب", "تنوين", "سكون", "بضم", "بفتح", "بكسر", "باسكان", "بالخفض", "بخفض", "شدد", "خفف")),
)


def farsh_type(entry):
    """variant_type for an entry stored as `other`; None when the evidence is missing or contradictory (human queue)."""
    text = norm(" ".join(filter(None, [entry.get("description"), entry.get("perf")] + [(a.get("a") or "") for a in entry.get("auth") or []])))
    base, reading = entry.get("base_text") or "", entry.get("reading_text") or ""
    if has(text, "مطابق لرسم المصحف", "وجه حفص"):
        return None  # Hafs's own reading: not a difference
    # "ها السكت" is a stop on the written letters, not a pause (sakt)
    probe = text.replace("هاء السكت", "").replace("ها السكت", "")
    fams = [t for t, keys in FAMILY_WORDS if any(k in probe for k in keys)]
    same_letters = skeleton(base) == skeleton(reading)
    if same_letters:
        return fams[0] if len(fams) == 1 else None
    lt = letter_type(base, reading)
    others = [f for f in fams if f != "vowel"]
    if not others:
        return None if fams == ["vowel"] else lt   # a pure vowel description cannot explain a change of letters
    if len(others) == 1 and (others[0] == lt or others[0] in ("hamza", "imalah", "idgham", "sakt", "naql", "madd")):
        return others[0]
    return None


def main(src, prefix):
    entries = json.load(open(src))
    usul = [e for e in entries if e["kind"] == "ruling"]
    farsh = [e for e in entries if e["kind"] == "variant" and e["variant_type"] == "other"]
    stats = Counter()
    unmatched = defaultdict(Counter)
    labels = defaultdict(Counter)
    out_usul = {}
    for e in usul:
        lab = usul_label(e)
        if lab is None:
            stats["usul_unmatched"] += 1
            key = " | ".join(dict.fromkeys(norm(a.get("a") or "") for a in (e.get("auth") or [])))[:130]
            unmatched[e["category"]][key] += 1
        else:
            stats["usul_matched"] += 1
            labels[e["category"]][lab] += 1
            out_usul[e["id"]] = lab
    out_farsh = {}
    for e in farsh:
        t = farsh_type(e)
        if t:
            stats["farsh_matched"] += 1
            labels["FARSH"][t] += 1
            out_farsh[e["id"]] = t
        else:
            stats["farsh_unmatched"] += 1
    json.dump({"usul": out_usul, "farsh": out_farsh}, open(prefix + "-labels.json", "w"), ensure_ascii=False)
    print(dict(stats))
    for c in sorted(labels):
        print("==", c)
        for l, n in labels[c].most_common():
            print("  ", n, l)
    print("---- UNMATCHED (top per category)")
    for c, cn in sorted(unmatched.items(), key=lambda x: -sum(x[1].values())):
        print("==", c, sum(cn.values()))
        for t, n in cn.most_common(12):
            print("  ", n, t)


def is_human(e):
    return e["status"] == "reviewed" and e.get("review_source") is None and not (e.get("device_id") or "").startswith("bulk-")


def write_apply(src, outdir, block=8000, batch=4000):
    """SQL blocks that fill what is still empty (guarded: only NULL sub-categories / 'other' types, never a human-approved farsh type)."""
    import os
    entries = json.load(open(src))
    q = lambda s: "'" + s.replace("'", "''") + "'"
    usul, farsh, queue = [], [], []
    for e in entries:
        if e["kind"] == "ruling":
            if e.get("sub_category"):
                continue
            lab = usul_label(e)
            (usul.append((e["id"], e["category"], lab)) if lab else queue.append(["usul", e["id"], e["category"], "no rule matched the action texts"]))
        elif e["variant_type"] == "other":
            t = None if is_human(e) else farsh_type(e)
            (farsh.append((e["id"], t)) if t else queue.append(["farsh", e["id"], "other", "human-approved" if is_human(e) else "text/letters do not decide a type"]))
    os.makedirs(outdir, exist_ok=True)
    blocks = []
    for i in range(0, len(usul), block):
        sql = ["BEGIN;", "SELECT set_config('app.device_id','auto-review',true);"]
        for j in range(i, min(i + block, len(usul)), batch):
            c = usul[j:min(j + batch, i + block)]
            sql.append("UPDATE qiraat_ruling_details d SET sub_category = v.label FROM (VALUES\n" + ",\n".join(f"  ({q(a)},{q(b)},{q(c_)})" for a, b, c_ in c)
                       + "\n) v(id,cat,label) WHERE d.entry_id=v.id AND d.category_code=v.cat AND d.sub_category IS NULL;")
        sql.append("COMMIT;")
        blocks.append("\n".join(sql) + "\n")
    if farsh:
        blocks.append("\n".join(["BEGIN;", "SELECT set_config('app.device_id','auto-review',true);",
                                 "UPDATE qiraat_variant_details d SET variant_type = v.t::qiraat_variant_type FROM (VALUES\n" + ",\n".join(f"  ({q(a)},{q(b)})" for a, b in farsh)
                                 + "\n) v(id,t) WHERE d.entry_id=v.id AND d.variant_type='other';", "COMMIT;"]) + "\n")
    for i, b in enumerate(blocks, 1):
        open(f"{outdir}/apply-{i:02d}.sql", "w").write(b)
    json.dump(queue, open(f"{outdir}/queue.json", "w"), ensure_ascii=False)
    print({"usul": len(usul), "farsh": len(farsh), "queue": len(queue), "blocks": len(blocks)})


if __name__ == "__main__":
    if sys.argv[1] == "--apply":
        write_apply(sys.argv[2], sys.argv[3])
    else:
        main(sys.argv[1], sys.argv[2])
