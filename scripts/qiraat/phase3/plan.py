"""Pure Phase 3 planning functions.

This module deliberately receives already-loaded plain dictionaries.  It has no database
connection and does not read the fixture tree; that boundary keeps the migration decisions
unit-testable and makes the generated SQL reviewable before it is applied.
"""
import re
import unicodedata
from collections import defaultdict

from scripts.qiraat.import_to_postgres import (
    CATEGORY_INV, DIFF_INV, consolidate_duplicate_variant_faces,
    disambiguated_variant_id,
)
from scripts.qiraat.tokens import norm

HAFS = "Q05-R02"
ALL_NARRATORS = {f"Q0{reader}-R0{narrator}" for reader in range(1, 10) for narrator in (1, 2)} | {"Q10-R01", "Q10-R02"}
ALL_NARRATORS |= {"Q01-R01", "Q01-R02", "Q02-R01", "Q02-R02", "Q03-R01", "Q03-R02",
                  "Q04-R01", "Q04-R02", "Q05-R01", "Q05-R02", "Q06-R01", "Q06-R02",
                  "Q07-R01", "Q07-R02", "Q08-R01", "Q08-R02", "Q09-R01", "Q09-R02"}
_DIACRITICS = re.compile(r"[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]")


def _plain_arabic(value):
    value = unicodedata.normalize("NFC", value or "")
    return _DIACRITICS.sub("", value).replace("ـ", "")


def _span(record):
    end_ayah = int(record.get("endAyah") or (int(record["ayah"]) + 1 if int(record["endToken"]) < int(record["startToken"]) else int(record["ayah"])))
    return (int(record["surah"]), int(record["ayah"]), int(record["startToken"]), end_ayah, int(record["endToken"]))


def classify_performance(record):
    """Return (canonical category, rule name), or (None, rule name)."""
    text = _plain_arabic(f"{record.get('performanceNote') or ''} {record.get('description') or ''}")
    hafs_words = _plain_arabic(record.get("hafsText") or "").split()
    last_hafs = hafs_words[-1] if hafs_words else ""
    matches = []
    if re.search(r"(?:فتح|فتحها|إسكان|أسكن|سكون|بإسكان|بفتح).*الياء", text) and last_hafs.endswith(("ي", "ى")):
        matches.append(("YAAT_IDAFA", "yaa_idafa"))
    if re.search(r"(?:إثبات|بإثبات|حذف|بحذف) الياء", text):
        matches.append(("YAAT_ZAWAID", "yaa_zawaid"))
    if re.search(r"الهمزتين|الهمزة الثانية|بين الهمزتين", text):
        matches.append(("HAMZATAN_KALIMA" if int(record.get("startToken", 0)) == int(record.get("endToken", 0)) else "HAMZATAN_KALIMATAYN", "hamzatan"))
    if re.search(r"(?:إبدال|بإبدال|تسهيل|بتسهيل|تحقيق) الهمز", text) and not re.search(r"الهمزتين|الهمزة الثانية|بين الهمزتين", text):
        matches.append(("TAGHYIR_HAMZ", "hamz"))
    for pattern, code, name in (
        (r"نقل", "USUL_NAQL", "naql"), (r"سكت|بالسكت", "USUL_SAKT", "sakt"),
        (r"إمال|تقليل|بين اللفظين|بين بين", "IMALAH_TAQLIL", "imalah"),
        (r"صلة الهاء|بصلة الهاء|قصر الهاء|بقصر الهاء", "SILAT_HA", "silah"),
        (r"ميم الجمع|صلة الميم|بصلة الميم", "USUL_MIM_JAM", "mim_jam"),
        (r"ترقيق الراء", "TARQIQ_RA", "tarqiq"), (r"تغليظ اللام", "TAGHLIZ_LAM", "taghliz"),
        (r"ترك الغنة|بلا غنة|بغير غنة", "TARK_GHUNNA", "ghunna"),
    ):
        if re.search(pattern, text):
            matches.append((code, name))
    if len(matches) == 1:
        return matches[0]
    return None, "Q6_AMBIGUOUS" if matches or text else "Q6_NO_MATCH"


def d8_decision(record, same_span_records):
    if HAFS not in set(record.get("readingIds", [])):
        return {"action": "not_applicable", "reason": None}
    if norm(record.get("variantText")) != norm(record.get("hafsText")):
        return {"action": "keep_flagged", "reason": "D8_HAFS_KEPT"}
    others = [r for r in same_span_records if r is not record and HAFS not in set(r.get("readingIds", []))]
    used = []
    for item in [record] + others:
        ids = set(item.get("readingIds", []))
        if set(used) & ids:
            return {"action": "keep_flagged", "reason": "D8_HAFS_KEPT"}
        used.extend(ids)
    if others and set(used) == ALL_NARRATORS:
        return {"action": "drop", "reason": "D8_BASELINE_PARTITION"}
    return {"action": "keep_flagged", "reason": "D8_HAFS_KEPT"}


def merge_spans(records, existing_loci):
    existing = defaultdict(list)
    for row in existing_loci:
        if row.get("deleted_at") is None:
            existing[(row.get("surah_number"), row.get("start_ayah"), row.get("start_word"), row.get("end_ayah"), row.get("end_word"))].append(row)
    grouped = defaultdict(list)
    for record in records:
        grouped[_span(record)].append(record)
    result = []
    for key in sorted(grouped):
        old = sorted(existing.get(key, []), key=lambda r: r["id"])
        locus_id = old[0]["id"] if old else "loc-%03d-%03d-%03d-%03d-%03d" % key
        fixture_ids = sorted({str(r.get("locusId")) for r in grouped[key] if r.get("locusId")})
        legacy = sorted({r["id"] for r in old} | set(fixture_ids))
        first = sorted(grouped[key], key=lambda r: (int(r.get("wajhIndex", 9999)), str(r.get("id"))))[0]
        base_text = first.get("hafsText") or first.get("baseText") or ""
        result.append({"id": locus_id, "span": key, "records": grouped[key], "existing": old,
                       "legacy_ref": ";".join(legacy), "base_text": base_text,
                       "base_text_normalized": norm(base_text)})
    return result


def renumber_entry_orders(rows):
    groups = defaultdict(list)
    for row in rows:
        groups[(row["locus_id"], row["kind"])].append(row)
    changes = []
    for key in sorted(groups):
        live = [r for r in groups[key] if r.get("order_live", True)]
        non_live = [r for r in groups[key] if not r.get("order_live", True)]
        ordered = sorted(live, key=lambda r: (int(r.get("wajhIndex", r.get("entry_order", 9999))), r["id"]))
        ordered += sorted(non_live, key=lambda r: (int(r.get("wajhIndex", r.get("entry_order", 9999))), r["id"]))
        for number, row in enumerate(ordered, 1):
            number = number if row.get("order_live", True) else 5000 + non_live.index(row)
            current_order = row.get("existing_entry_order", row.get("entry_order"))
            row["_planned_entry_order"] = number
            needs_move = row.get("existing_locus_id") is not None and (row.get("existing_locus_id") != row.get("locus_id") or row.get("existing_kind") != row.get("kind"))
            if current_order != number or needs_move:
                changes.append({"id": row["id"], "temporary": number + 10000, "final": number})
    return changes


def ruling_attribution_mismatch(record, authority_readings=None):
    readings = {x.get("readingId") if isinstance(x, dict) else x for x in record.get("readings", [])}
    authority_readings = authority_readings or {}
    attribution = set()
    for item in record.get("attribution", []):
        authority_id = item.get("authorityId")
        if authority_id in authority_readings:
            attribution.update(authority_readings[authority_id])
        elif authority_id and authority_id.startswith("Q") and "-R" in authority_id:
            attribution.add(authority_id)
    return readings != attribution


def narrator_twice(entries):
    groups = defaultdict(list)
    for entry in entries:
        if entry.get("review_status") == "flagged" or entry.get("deleted_at") is not None:
            continue
        for authority in entry.get("authorities", []):
            if int(authority.get("wajh_order", 1)) == 1:
                key = (entry.get("locus_id"), entry.get("kind"), entry.get("category_code"), authority.get("reading_id") or authority.get("authority_id"))
                groups[key].append(entry["id"])
    return {entry_id for ids in groups.values() if len(ids) > 1 for entry_id in ids}


def _flag(page_id, locus_id, entry_id, code, issue, context=""):
    return {"page_id": page_id, "locus_id": locus_id, "entry_id": entry_id, "severity": "warning",
            "flag_type": code, "issue_ar": "[phase3] " + issue, "original_text": context, "status": "open"}


def build_plan(fixtures, snapshot, conflicts=None, duplicate_keys=None, page_specs=None, fixture_sha256=""):
    """Build the target state and deterministic report inputs from plain dictionaries."""
    conflicts = conflicts or []
    duplicate_keys = duplicate_keys or set()
    variant_records = []
    ruling_records = []
    for page, values in sorted(fixtures.get("variants", {}).items()):
        merged = consolidate_duplicate_variant_faces(values)
        for record in merged:
            r = dict(record); r["_page"] = int(page); r["_kind"] = "variant"
            for field in ("ayah", "startToken", "endToken", "endAyah"):
                if r.get(field) is not None: r[field] = int(r[field])
            variant_records.append(r)
    for page, values in sorted(fixtures.get("rulings", {}).items()):
        for record in values:
            r = dict(record); r["_page"] = int(page); r["_kind"] = "ruling"
            for field in ("ayah", "startToken", "endToken", "endAyah"):
                if r.get(field) is not None: r[field] = int(r[field])
            ruling_records.append(r)
    all_records = variant_records + ruling_records
    spans = merge_spans(all_records, snapshot.get("qiraat_loci", []))
    span_by_key = {tuple(x["span"]): x for x in spans}
    for span in spans:
        span["page_number"] = min(int(record["_page"]) for record in span["records"])
    spans_by_page = defaultdict(list)
    for span in spans: spans_by_page[span["page_number"]].append(span)
    for page_spans in spans_by_page.values():
        for location_order, span in enumerate(sorted(page_spans, key=lambda x: (x["span"][1], x["span"][2], x["id"])), 1):
            span["location_order"] = location_order
    pages = {p["mushaf_page_number"]: p for p in snapshot.get("qiraat_pages", [])}
    page_ids = {page: min([x["id"] for x in snapshot.get("qiraat_pages", []) if x.get("mushaf_page_number") == page], default=None) for page in set(r["_page"] for r in all_records)}
    live_entries = {e["id"]: e for e in snapshot.get("qiraat_entries", []) if e.get("deleted_at") is None}
    existing_vd = {x["entry_id"]: x for x in snapshot.get("qiraat_variant_details", [])}
    existing_rd = {x["entry_id"]: x for x in snapshot.get("qiraat_ruling_details", [])}
    existing_auth = defaultdict(list)
    for row in snapshot.get("qiraat_entry_authorities", []):
        if row.get("deleted_at") is None: existing_auth[row["entry_id"]].append(row)
    conflict_keys = {(int(x["page"]), str(x.get("duplicate", {}).get("id"))) for x in conflicts}
    authority_readings = defaultdict(set)
    for authority in snapshot.get("qiraat_authorities", []):
        if authority.get("authority_type") == "narrator":
            authority_readings[authority["id"]].add(authority["id"])
            if authority.get("parent_id"):
                authority_readings[authority["parent_id"]].add(authority["id"])
    target_entries = []
    target_variants = []
    target_rulings = []
    target_authorities = []
    evidence_rows = []
    count_school_rows = []
    flags = []
    drops = []
    for span in spans:
        same = span["records"]
        for record in same:
            is_ruling = record.get("_kind") == "ruling"
            if is_ruling:
                entry_id = record["id"]
            else:
                key = f"{record['id']}-a{record['ayah']}-t{record['startToken']}"
                entry_id = disambiguated_variant_id(record) if key in duplicate_keys else key
            entry = live_entries.get(entry_id, {})
            category = None
            q6_reason = None
            agy = fixtures.get("agy", {}).get((record.get("_page"), str(record.get("id")), record.get("performanceNote") or record.get("note") or ""))
            own_category, own_reason = (classify_performance(record) if not is_ruling and record.get("locusType") == "performance_variant" else (None, None))
            category = own_category
            if not is_ruling and record.get("locusType") == "performance_variant":
                agy_category = agy.get("category") if agy else None
                agree = bool(own_category and agy_category and agy_category not in ("FARSH", "AMBIGUOUS") and own_category == agy_category)
                if agree:
                    category, q6_reason = own_category, None
                else:
                    category, q6_reason = None, "Q6_AMBIGUOUS"
            kind = "ruling" if is_ruling or category else "variant"
            d8 = d8_decision(record, same) if not is_ruling else {"action": "not_applicable"}
            if d8["action"] == "drop":
                drops.append({"entry_id": entry_id, "page": record["_page"], "span": list(_span(record)), "text": record.get("variantText"), "narrators": sorted(record.get("readingIds", [])), "reason": d8["reason"]})
                continue
            reasons = []
            if d8.get("reason"): reasons.append((d8["reason"], "حفص محفوظ في هذا الموضع ضمن أوجه متعددة"))
            if record.get("verificationStatus") == "NEEDS_MANUAL_REVIEW": reasons.append(("NEEDS_MANUAL_REVIEW", "السجل يحتاج مراجعة يدوية"))
            if (record["_page"], str(record.get("id"))) in conflict_keys: reasons.append(("DOCUMENTED_CONFLICT", "تعارض موثق في تدقيق القارئ"))
            if q6_reason == "Q6_AMBIGUOUS":
                reasons.append(("Q6_AMBIGUOUS", f"تصنيفنا: {own_category or own_reason or 'غير مصنف'}؛ تصنيف المراجع الخارجي: {(agy or {}).get('category', 'غير متاح')}"))
            if is_ruling and HAFS in {x.get("readingId") if isinstance(x, dict) else x for x in record.get("readings", [])}: reasons.append(("D8_HAFS_KEPT", "الحكم يذكر حفصًا صراحة"))
            if is_ruling and ruling_attribution_mismatch(record, authority_readings): reasons.append(("ATTRIBUTION_MISMATCH", "نسبة الرواة لا تطابق قائمة القراءات"))
            page_id = page_ids.get(record["_page"])
            for code, issue in reasons: flags.append(_flag(page_id, span["id"], entry_id, code, issue, record.get("variantText") or record.get("text") or ""))
            review = "flagged" if reasons else "unreviewed"
            note = record.get("notes")
            if is_ruling and record.get("note"): note = "؛ ".join(x for x in (record.get("notes"), record.get("note")) if x)
            target_entries.append({"id": entry_id, "locus_id": span["id"], "page_id": page_id, "kind": kind, "category_code": (category if kind == "ruling" else None),
                                   "page_number": record["_page"],
                                   "entry_order": int(record.get("wajhIndex", entry.get("entry_order", 1))),
                                   "attribution_mode": "explicit", "verification_status": record.get("verificationStatus", "REVIEWED"),
                                   "review_status": review, "legacy_ref": f"{'rulings' if is_ruling else 'pages'}/page-{record['_page']:03d}.json#{record.get('id')}",
                                   "notes": note, "deleted_at": None, "wajh_index": int(record.get("wajhIndex", entry.get("entry_order", 1))), "existing_entry_order": entry.get("entry_order"), "existing_locus_id": entry.get("locus_id"), "existing_kind": entry.get("kind"), "order_live": True})
            if kind == "variant":
                target_variants.append({"entry_id": entry_id, "reading_text": record.get("variantText", ""),
                    "reading_text_normalized": norm(record.get("variantText", "")), "uthmani_text": record.get("uthmaniText") or record.get("variantText", ""),
                    "description_ar": record.get("description"), "variant_type": DIFF_INV.get(record.get("differenceType"), "other"),
                    "is_baseline_reading": False, "performance_note": record.get("performanceNote")})
            else:
                raw_category = record.get("category")
                category = category or CATEGORY_INV.get(raw_category, raw_category)
                if category == "NAQL": category = "USUL_NAQL"
                if category not in snapshot.get("category_codes", set()): flags.append(_flag(page_id, span["id"], entry_id, "UNKNOWN_CATEGORY", f"الفئة غير معروفة: {raw_category}", record.get("text", ""))); review = "flagged"
                target_entries[-1]["category_code"] = category
                options = record.get("options")
                if options is not None and not isinstance(options, list): options = [str(options)]
                target_rulings.append({"entry_id": entry_id, "category_code": category, "text_ar": record.get("text"), "options": options, "rule_id": existing_rd.get(entry_id, {}).get("rule_id")})
            reading_rows = record.get("readingIds", []) if not is_ruling else record.get("readings", [])
            if not is_ruling:
                alternate = set(record.get("alternateOf", []))
                reading_rows = [{"readingId": x, "action": (record.get("performanceNote") or record.get("description")) if kind == "ruling" else None, "isDefault": x not in alternate} for x in reading_rows]
            for reading in reading_rows:
                reading_id = reading.get("readingId") if isinstance(reading, dict) else reading
                if not reading_id: continue
                is_default = reading.get("isDefault", True) if isinstance(reading, dict) else reading_id not in set(record.get("alternateOf", []))
                action = reading.get("action") if isinstance(reading, dict) else None
                note_text = (record.get("description") or record.get("performanceNote") or action) if reading_id == HAFS and not is_default else None
                target_authorities.append({"entry_id": entry_id, "authority_id": reading_id, "action_ar": action, "condition_ar": (reading.get("condition") if isinstance(reading, dict) else None) or record.get("condition"), "is_default": bool(is_default), "wajh_order": 1 if is_default else 2, "wajh_note": note_text})
            for evidence_order, evidence in enumerate(record.get("evidence", []), 1):
                evidence_rows.append({"source_document_id": evidence.get("source"), "text_ar": evidence.get("text", ""), "text_normalized": norm(evidence.get("text", "")), "page_id": page_id, "locus_id": span["id"], "evidence_order": evidence_order})
            for count_school_id in record.get("countSchools", []):
                count_school_rows.append({"entry_id": entry_id, "count_school_id": count_school_id})
    # Existing DB-only rows are retained but quarantined; REJECTED rows are intentionally excluded.
    fixture_ids = {x["id"] for x in target_entries}
    db_only = []
    for entry in snapshot.get("qiraat_entries", []):
        if entry["id"] not in fixture_ids and entry.get("verification_status") != "REJECTED" and entry.get("deleted_at") is None:
            db_only.append(entry["id"])
            old_locus = next((l for l in snapshot.get("qiraat_loci", []) if l.get("id") == entry.get("locus_id")), None)
            span_key = tuple(old_locus.get(x) for x in ("surah_number", "start_ayah", "start_word", "end_ayah", "end_word")) if old_locus else None
            canonical = span_by_key.get(span_key, {}).get("id", entry["locus_id"])
            target_entries.append({"id": entry["id"], "locus_id": canonical, "page_id": entry.get("page_id"), "kind": entry["kind"], "category_code": (existing_rd.get(entry["id"], {}).get("category_code") if entry["kind"] == "ruling" else None), "entry_order": entry["entry_order"], "attribution_mode": entry.get("attribution_mode", "explicit"), "verification_status": entry["verification_status"], "review_status": "flagged", "legacy_ref": f"db-only:{entry['id']}", "notes": entry.get("notes"), "deleted_at": None, "wajh_index": entry["entry_order"], "existing_entry_order": entry["entry_order"], "existing_locus_id": entry.get("locus_id"), "existing_kind": entry.get("kind"), "order_live": True})
            flags.append(_flag(entry.get("page_id"), canonical, entry["id"], "DB_ONLY", f"قاعدة البيانات تحتوي سجلًا بلا مقابل في fixtures: {entry['id']}", entry["id"]))
    for entry in target_entries:
        entry.setdefault("authorities", existing_auth.get(entry["id"], []))
    authority_by_key = {}
    for authority in target_authorities:
        authority_by_key[(authority["entry_id"], authority["authority_id"], authority.get("action_ar") or "")] = authority
    target_authorities = list(authority_by_key.values())
    authorities_by_entry = defaultdict(list)
    for authority in target_authorities:
        authorities_by_entry[authority["entry_id"]].append(authority)
    for entry in target_entries:
        if authorities_by_entry.get(entry["id"]):
            entry["authorities"] = authorities_by_entry[entry["id"]]
    twice = narrator_twice(target_entries)
    for entry in target_entries:
        if entry["id"] in twice:
            entry["review_status"] = "flagged"
            flags.append(_flag(next((x.get("page_id") for x in target_entries if x["id"] == entry["id"]), None), entry["locus_id"], entry["id"], "NARRATOR_TWICE", "راوٍ مكرر في الوجه الأول عند الموضع", entry["id"]))
    flagged_ids = {flag["entry_id"] for flag in flags if flag.get("entry_id")}
    for entry in target_entries:
        if entry["id"] in flagged_ids:
            entry["review_status"] = "flagged"
    dropped_ids = {drop["entry_id"] for drop in drops}
    target_by_id = {entry["id"]: entry for entry in target_entries}
    order_rows = list(target_entries)
    for existing_entry in snapshot.get("qiraat_entries", []):
        if existing_entry.get("deleted_at") is not None or existing_entry["id"] in target_by_id:
            continue
        old_locus = existing_entry.get("locus_id")
        order_rows.append({"id": existing_entry["id"], "locus_id": old_locus, "kind": existing_entry["kind"],
                           "entry_order": existing_entry.get("entry_order"), "wajh_index": existing_entry.get("entry_order", 9999),
                           "existing_entry_order": existing_entry.get("entry_order"), "order_live": False})
    for row in order_rows:
        if row["id"] in dropped_ids:
            row["order_live"] = False
            fixture_drop = next(drop for drop in drops if drop["entry_id"] == row["id"])
            row["locus_id"] = span_by_key[tuple(fixture_drop["span"])]["id"]
        elif row.get("verification_status") == "REJECTED":
            row["order_live"] = False
    order_changes = renumber_entry_orders(order_rows)
    changes_by_id = {x["id"]: x for x in order_changes}
    for entry in target_entries:
        entry["entry_order"] = entry.get("_planned_entry_order", entry["entry_order"])
    merged_away = sorted({old["id"] for span in spans for old in span["existing"][1:]})
    redirects = sorted({(old["id"], span["id"]) for span in spans for old in span["existing"][1:]})
    surviving_loci = {entry["locus_id"] for entry in target_entries if entry.get("verification_status") != "REJECTED"}
    emptied_loci = sorted(locus["id"] for locus in snapshot.get("qiraat_loci", [])
                          if locus.get("deleted_at") is None and locus["id"] not in surviving_loci)
    page_rows = []
    existing_page_keys = {(p.get("source_document_id"), p.get("source_page_number")) for p in snapshot.get("qiraat_pages", [])}
    for page in sorted(page_specs or {}):
        spec = page_specs[page]
        source_number = int(spec.get("source", page)) if page <= 244 else 10000 + page
        if ("SRC-MUSHAF-10", source_number) not in existing_page_keys:
            page_rows.append({"page_number": page, "source_page_number": source_number, "surah_number": spec["surah"], "ayah_from": spec["af"], "ayah_to": spec["at"], "surah_name_ar": spec.get("surah_name_ar", "غير محدد"), "notes": spec.get("notes")})
    counts = {table: {key: 0 for key in ("inserted", "updated", "unchanged", "soft_deleted")} for table in ("pages", "loci", "entries", "variant_details", "ruling_details", "authorities", "evidence", "flags")}
    for table, rows in (("entries", target_entries), ("variant_details", target_variants), ("ruling_details", target_rulings), ("authorities", target_authorities), ("flags", flags)):
        existing_set = {r.get("id") or r.get("entry_id") for r in snapshot.get({"entries":"qiraat_entries", "variant_details":"qiraat_variant_details", "ruling_details":"qiraat_ruling_details", "authorities":"qiraat_entry_authorities", "flags":"qiraat_qa_flags"}[table], [])}
        counts[table]["inserted"] = sum(1 for r in rows if (r.get("id") or r.get("entry_id")) not in existing_set)
        counts[table]["updated"] = len(rows) - counts[table]["inserted"]
    counts["loci"]["inserted"] = sum(1 for x in spans if not x["existing"]); counts["loci"]["updated"] = len(spans) - counts["loci"]["inserted"]; counts["loci"]["soft_deleted"] = len(merged_away)
    counts["entries"]["soft_deleted"] = len(drops) + len(db_only) * 0
    counts["pages"]["inserted"] = len(page_rows)
    existing_evidence_keys = {(x.get("source_document_id"), x.get("text_normalized")) for x in snapshot.get("qiraat_evidence_texts", [])}
    evidence_keys = {(x.get("source_document_id"), x.get("text_normalized")) for x in evidence_rows}
    counts["evidence"]["inserted"] = len(evidence_keys - existing_evidence_keys)
    counts["evidence"]["updated"] = len(evidence_keys & existing_evidence_keys)
    conversions = defaultdict(int)
    q6_insert_conversions = []
    for entry in target_entries:
        before = live_entries.get(entry["id"], {}).get("kind")
        category = next((r["category_code"] for r in target_rulings if r["entry_id"] == entry["id"]), "unknown")
        if before == "variant" and entry["kind"] == "ruling": conversions[category] += 1
        if before is None and entry["kind"] == "ruling" and entry.get("legacy_ref", "").startswith("pages/"):
            conversions[category] += 1
            q6_insert_conversions.append(entry["id"])
    entry_orders = []
    for temporary_index, row in enumerate(sorted(order_rows, key=lambda r: r["id"]), 1):
        change = changes_by_id.get(row["id"])
        if change:
            entry_orders.append({"id": row["id"], "locus_id": row["locus_id"], "kind": row["kind"],
                                 "entry_order": change["final"], "temporary_order": ((row.get("existing_entry_order") or row.get("entry_order", 0)) + 10000)})
    return {"pages": page_rows, "loci": spans, "entries": target_entries, "variant_details": target_variants, "ruling_details": target_rulings,
            "authorities": target_authorities, "evidence": evidence_rows, "count_schools": count_school_rows, "flags": flags, "drops": drops, "db_only": sorted(db_only), "order_changes": order_changes,
            "entry_orders": entry_orders, "merged_away_loci": merged_away, "emptied_loci": emptied_loci, "redirects": redirects,
            "touched_loci": sorted({entry["locus_id"] for entry in target_entries}), "q6_insert_conversions": q6_insert_conversions,
            "conversions": dict(sorted(conversions.items())), "counts": counts,
            "fixture_sha256": fixture_sha256, "snapshot_entry_count": len(snapshot.get("qiraat_entries", [])),
            "snapshot_time": snapshot.get("snapshot_time"), "category_codes": sorted(snapshot.get("category_codes", set()))}
