# -*- coding: utf-8 -*-
"""Import every authored Qiraat fixture into PostgreSQL.

Connects to the self-hosted PostgreSQL instance, disables triggers during bulk insert,
populates qiraat_pages, qiraat_loci, qiraat_entries, qiraat_variant_details,
qiraat_ruling_details, qiraat_entry_authorities, qiraat_entry_readings,
qiraat_entry_count_schools, qiraat_evidence_texts, and qiraat_evidence_links,
then re-enables triggers and verifies counts and integrity.
"""
import argparse, hashlib, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, 'scripts/qiraat'))
import tokens as T
import authorities as A
from data_variants import PAGES


def disambiguated_variant_id(record):
    """Stable identity for a variant whose historical source key is reused."""
    payload = {
        'variantText': record.get('variantText'),
        'readingIds': sorted(set(record.get('readingIds', []))),
    }
    identity = {
        'kind': 'variant',
        'page': record['_page'],
        'sourceId': record.get('id'),
        'surah': record.get('surah'),
        'ayah': record.get('ayah'),
        'endAyah': record.get('endAyah'),
        'startToken': record.get('startToken'),
        'endToken': record.get('endToken'),
        'payload': payload,
    }
    digest = hashlib.sha256(
        json.dumps(identity, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')
    ).hexdigest()[:16]
    return f"{record['id']}-a{record['ayah']}-t{record['startToken']}-h{digest}"


def load_reconcile_keys(root):
    """Return legacy variant keys reused by multiple fixture faces."""
    counts = {}
    for page in range(1, 605):
        path = os.path.join(root, f'packages/qiraat-core/fixtures/pages/page-{page:03d}.json')
        if not os.path.exists(path):
            continue
        with open(path, encoding='utf-8') as handle:
            for record in json.load(handle):
                key = f"{record['id']}-a{record['ayah']}-t{record['startToken']}"
                counts[key] = counts.get(key, 0) + 1
    return {key for key, count in counts.items() if count > 1}


def load_fixture_page_specs(root, existing_specs):
    """Extend the historical page map to every committed fixture page."""
    metadata_path = os.path.join(root, 'packages/quran-data/mushaf1441/fixtures/page-ayahs.json')
    with open(metadata_path, encoding='utf-8') as handle:
        metadata = {item['pageNumber']: item['ayahs'] for item in json.load(handle)['pages']}
    specs = dict(existing_specs)
    fixture_pages = set()
    for directory in ('pages', 'rulings'):
        fixture_dir = os.path.join(root, f'packages/qiraat-core/fixtures/{directory}')
        for filename in os.listdir(fixture_dir):
            if filename.startswith('page-') and filename.endswith('.json'):
                fixture_pages.add(int(filename[5:8]))
    for page in sorted(fixture_pages):
        if page in specs:
            continue
        ayahs = metadata[page]
        specs[page] = {
            'source': page,
            'surah': ayahs[0]['surahNumber'],
            'af': ayahs[0]['ayahNumber'],
            'at': ayahs[-1]['ayahNumber'],
        }
    return specs


def consolidate_duplicate_variant_faces(records):
    """Keep one row per fully described word face and union its reader/source details."""
    merged = {}
    trimmed = lambda value: (value or '').strip()
    for record in records:
        end_ayah = record.get('endAyah') or (
            record['ayah'] + 1 if record['endToken'] < record['startToken'] else record['ayah']
        )
        key = (
            record.get('surah'), record.get('ayah'), record.get('startToken'),
            end_ayah, record.get('endToken'),
            record.get('variantText'), record.get('differenceType'),
            # Same fallback as the DB face key: a missing Uthmani text is stored as variantText.
            trimmed(record.get('uthmaniText') or record.get('variantText')), trimmed(record.get('description')),
            trimmed(record.get('performanceNote')),
        )
        current = merged.get(key)
        if current is None:
            merged[key] = dict(record)
            continue

        # Pick a stable canonical ID independent of fixture order. Metadata in the key
        # separates true alternate faces; reader sets and provenance are unioned below.
        if record.get('id', '') < current.get('id', ''):
            current, record = dict(record), current
            merged[key] = current
        current['readingIds'] = sorted(set(current.get('readingIds', [])) | set(record.get('readingIds', [])))
        current['alternateOf'] = sorted(set(current.get('alternateOf', [])) | set(record.get('alternateOf', [])))
        notes = [value for value in dict.fromkeys((current.get('notes'), record.get('notes'))) if value]
        if notes:
            current['notes'] = '؛ '.join(notes)
        for field in ('evidence', 'sources'):
            values = list(current.get(field, []))
            known = {json.dumps(value, ensure_ascii=False, sort_keys=True) for value in values}
            for value in record.get(field, []):
                encoded = json.dumps(value, ensure_ascii=False, sort_keys=True)
                if encoded not in known:
                    values.append(value)
                    known.add(encoded)
            if values:
                current[field] = values
    return list(merged.values())


def variant_face_key(page, surah, ayah, end_ayah, start_word, end_word,
                     reading_text, variant_type, uthmani_text, description, performance_note):
    """Identity of one fully described face; assigned readers are deliberately excluded."""
    return (
        page, surah, ayah, start_word, end_ayah, end_word, reading_text, variant_type,
        (uthmani_text or '').strip(), (description or '').strip(), (performance_note or '').strip(),
    )

# Inverse of DIFF map to get lowercase enum value for qiraat_variant_type
DIFF_INV = {
    'ORTHOGRAPHY': 'orthography', 'HARAKAH': 'vowel', 'LETTER': 'consonant',
    'HAMZ': 'hamza', 'MADD': 'madd', 'IDGHAM': 'idgham', 'IMALAH': 'imalah',
    'WAQF': 'sakt', 'NAQL': 'naql', 'OTHER': 'other', 'ADDITION': 'addition',
    'OMISSION': 'omission'
}

CATEGORY_INV = {
    # Older fixture labels are retained in the source JSON; PostgreSQL uses
    # the canonical category catalog codes.
    'SAKT': 'USUL_SAKT',
    'MEEM_JAM': 'USUL_MIM_JAM',
}

def main():
    import psycopg2
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '--reconcile', action='store_true',
        help='insert only fixture records absent from PostgreSQL; preserve conflicts and disambiguate reused variant keys',
    )
    args = parser.parse_args()
    print("Connecting to PostgreSQL at 127.0.0.1:5433...")
    conn = psycopg2.connect(os.environ['QIRAAT_DB_DSN']) if os.environ.get('QIRAAT_DB_DSN') else psycopg2.connect()
    cur = conn.cursor()

    existing_entry_ids = set()
    duplicate_variant_keys = set()
    reserved_entry_orders = set()
    existing_variant_faces = {}
    if args.reconcile:
        cur.execute("SELECT id FROM qiraat_entries;")
        existing_entry_ids = {row[0] for row in cur.fetchall()}
        cur.execute("SELECT locus_id, entry_order FROM qiraat_entries WHERE kind = 'variant';")
        reserved_entry_orders = set(cur.fetchall())
        duplicate_variant_keys = load_reconcile_keys(ROOT)
        print(f"Reconcile mode: preserving {len(existing_entry_ids)} existing entries; "
              f"{len(duplicate_variant_keys)} reused variant keys will be disambiguated.")

    cur.execute("""
        SELECT e.id, e.locus_id, e.entry_order, e.verification_status::text,
               e.created_at, p.mushaf_page_number, l.surah_number,
               l.start_ayah, l.start_word, l.end_ayah, l.end_word,
               vd.reading_text, vd.variant_type::text, vd.uthmani_text,
               vd.description_ar, vd.performance_note
          FROM qiraat_entries e
          JOIN qiraat_pages p ON p.id = e.page_id
          JOIN qiraat_loci l ON l.id = e.locus_id
          JOIN qiraat_variant_details vd ON vd.entry_id = e.id
         WHERE e.kind = 'variant' AND NOT e.synthetic
           AND e.verification_status <> 'REJECTED'
         ORDER BY CASE e.verification_status
                    WHEN 'VERIFIED' THEN 0 WHEN 'PUBLISHED' THEN 0
                    WHEN 'REVIEWED' THEN 1 ELSE 2 END,
                  e.created_at, e.id;
    """)
    for row in cur.fetchall():
        entry_id, locus_id, entry_order, status, created_at, page, surah, ayah, start_word, end_ayah, end_word, reading_text, variant_type, uthmani_text, description, performance_note = row
        key = variant_face_key(page, surah, ayah, end_ayah, start_word, end_word,
                               reading_text, variant_type, uthmani_text, description, performance_note)
        existing_variant_faces.setdefault(key, (entry_id, locus_id, entry_order))

    # Load surah names
    surah_names_file = os.path.join(ROOT, 'public/quran/surah-names.json')
    with open(surah_names_file, 'r', encoding='utf-8') as f:
        surah_names = json.load(f)

    page_specs = load_fixture_page_specs(ROOT, PAGES)

    if args.reconcile:
        # Evidence rows use the source label carried by each fixture.  Older
        # imports only seeded D/SH/T and the primary mushaf document, so add
        # missing labels as catalog entries instead of dropping provenance.
        evidence_sources = set()
        for page in page_specs:
            path = os.path.join(ROOT, f'packages/qiraat-core/fixtures/pages/page-{page:03d}.json')
            if os.path.exists(path):
                with open(path, encoding='utf-8') as handle:
                    for record in json.load(handle):
                        evidence_sources.update(item['source'] for item in record.get('evidence', []))
        for source_id in sorted(evidence_sources):
            cur.execute("""
                INSERT INTO qiraat_source_documents (id, name_ar, document_type, notes)
                VALUES (%s, %s, 'other', %s)
                ON CONFLICT (id) DO NOTHING;
            """, (source_id, source_id, 'Fixture evidence label; bibliographic metadata requires editorial enrichment.'))

    # Disable sync trigger for bulk performance
    cur.execute("ALTER TABLE qiraat_entry_authorities DISABLE TRIGGER qiraat_entry_authorities_sync_trg;")

    total_pages = 0
    total_loci = 0
    total_entries = 0
    total_variants = 0
    total_rulings = 0
    total_readings = 0

    page_nums = sorted(page_specs.keys())
    print(f"Starting import for {len(page_nums)} pages (pages {page_nums[0]} to {page_nums[-1]})...")

    for page in page_nums:
        spec = page_specs[page]
        surah_num = spec['surah']
        surah_name = surah_names.get(str(surah_num), 'غير محدد')

        source_page_number = spec.get('source', page)
        if page > 244:
            # The legacy DOCX batch used source pages 240-249 for Mushaf
            # pages 235-244. Keep later Mushaf pages in a separate key space
            # so source-page uniqueness cannot relabel an earlier page.
            source_page_number = 10000 + page
        cur.execute("""
            INSERT INTO qiraat_pages (
                source_document_id, source_page_number, mushaf_page_number,
                surah_number, surah_name_ar, ayah_from, ayah_to,
                extraction_status, notes
            ) VALUES (
                'SRC-MUSHAF-10', %s, %s, %s, %s, %s, %s, 'REVIEWED', %s
            ) ON CONFLICT (source_document_id, source_page_number) DO UPDATE SET
                mushaf_page_number = EXCLUDED.mushaf_page_number,
                surah_number = EXCLUDED.surah_number,
                surah_name_ar = EXCLUDED.surah_name_ar,
                ayah_from = EXCLUDED.ayah_from,
                ayah_to = EXCLUDED.ayah_to,
                extraction_status = EXCLUDED.extraction_status
            RETURNING id;
        """, (source_page_number, page, surah_num, surah_name, spec['af'], spec['at'], spec.get('notes')))
        page_db_id = cur.fetchone()[0]
        total_pages += 1

        # 2. Process variants
        var_fixture_path = os.path.join(ROOT, f'packages/qiraat-core/fixtures/pages/page-{page:03d}.json')
        if os.path.exists(var_fixture_path):
            with open(var_fixture_path, 'r', encoding='utf-8') as f:
                var_items = consolidate_duplicate_variant_faces(json.load(f))

            for order_idx, v in enumerate(var_items, 1):
                end_ayah = v.get('endAyah') or (v['ayah'] + 1 if v['endToken'] < v['startToken'] else v['ayah'])
                variant_type = DIFF_INV.get(v.get('differenceType'), 'other')
                face_key = variant_face_key(
                    page, v['surah'], v['ayah'], end_ayah, v['startToken'], v['endToken'],
                    v['variantText'], variant_type, v.get('uthmaniText') or v['variantText'],
                    v.get('description'), v.get('performanceNote'),
                )
                legacy_entry_id = f"{v['id']}-a{v['ayah']}-t{v['startToken']}"
                if args.reconcile and legacy_entry_id in duplicate_variant_keys:
                    v['_page'] = page
                    own_entry_id = disambiguated_variant_id(v)
                else:
                    own_entry_id = legacy_entry_id
                existing_face = existing_variant_faces.get(face_key)
                # A natural-key match on a DIFFERENT row (e.g. source ID changed between
                # imports, or this row was merged away as a duplicate) folds into that
                # canonical row. A match on the record's own row upserts normally so
                # fixture status/detail changes still propagate on re-import.
                merge_existing_face = existing_face is not None and existing_face[0] != own_entry_id
                if merge_existing_face:
                    entry_id, locus_id, entry_order = existing_face
                else:
                    entry_id = own_entry_id
                    locus_id = f"{v['locusId']}-a{v['ayah']}-t{v['startToken']}"
                    entry_order = v.get('wajhIndex', 1)
                if args.reconcile and entry_id in existing_entry_ids and not merge_existing_face:
                    continue
                if args.reconcile and not merge_existing_face:
                    while (locus_id, entry_order) in reserved_entry_orders:
                        entry_order += 1
                    reserved_entry_orders.add((locus_id, entry_order))

                cur.execute("""
                    INSERT INTO qiraat_loci (
                        id, page_id, surah_number, start_ayah, start_word,
                        end_ayah, end_word, base_text, base_text_normalized,
                        location_order, mapping_status
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'verified'
                    ) ON CONFLICT (id) DO UPDATE SET
                        base_text = EXCLUDED.base_text,
                        base_text_normalized = EXCLUDED.base_text_normalized;
                """, (
                    locus_id, page_db_id, v['surah'], v['ayah'], v['startToken'],
                    end_ayah, v['endToken'], v['hafsText'], T.norm(v['hafsText']),
                    order_idx
                ))
                total_loci += 1

                # Entry
                vstatus = v.get('verificationStatus', 'REVIEWED')
                if merge_existing_face:
                    if v.get('notes'):
                        cur.execute("""
                            UPDATE qiraat_entries
                               SET notes = concat_ws(E'\\n', NULLIF(notes, ''), %s)
                             WHERE id = %s AND position(%s IN COALESCE(notes, '')) = 0;
                        """, (v['notes'], entry_id, v['notes']))
                else:
                    cur.execute("""
                        INSERT INTO qiraat_entries (
                            id, locus_id, page_id, kind, entry_order,
                            attribution_mode, verification_status, notes
                        ) VALUES (
                            %s, %s, %s, 'variant', %s, 'explicit', %s, %s
                        ) ON CONFLICT (id) DO UPDATE SET
                            verification_status = EXCLUDED.verification_status,
                            notes = EXCLUDED.notes;
                    """, (
                        entry_id, locus_id, page_db_id, entry_order,
                        vstatus, v.get('notes')
                    ))
                    total_entries += 1
                    total_variants += 1
                    existing_variant_faces.setdefault(face_key, (entry_id, locus_id, entry_order))
                    if args.reconcile:
                        existing_entry_ids.add(entry_id)

                # Variant details
                is_base = ('Q05-R02' in v.get('readingIds', []) and T.norm(v['variantText']) == T.norm(v['hafsText']))
                if not merge_existing_face:
                    cur.execute("""
                        INSERT INTO qiraat_variant_details (
                            entry_id, reading_text, reading_text_normalized, uthmani_text,
                            description_ar, variant_type, is_baseline_reading, performance_note
                        ) VALUES (
                            %s, %s, %s, %s, %s, %s, %s, %s
                        ) ON CONFLICT (entry_id) DO UPDATE SET
                            reading_text = EXCLUDED.reading_text,
                            reading_text_normalized = EXCLUDED.reading_text_normalized,
                            uthmani_text = EXCLUDED.uthmani_text,
                            description_ar = EXCLUDED.description_ar,
                            variant_type = EXCLUDED.variant_type,
                            is_baseline_reading = EXCLUDED.is_baseline_reading,
                            performance_note = EXCLUDED.performance_note;
                    """, (
                        entry_id, v['variantText'], T.norm(v['variantText']), v.get('uthmaniText') or v['variantText'],
                        v.get('description'), variant_type, is_base, v.get('performanceNote')
                    ))

                # Entry readings & authorities
                alt_set = set(v.get('alternateOf', []))
                for r in v.get('readingIds', []):
                    is_def = (r not in alt_set)
                    cur.execute("""
                        INSERT INTO qiraat_entry_readings (entry_id, reading_id, action_ar, is_default)
                        VALUES (%s, %s, '', %s)
                        ON CONFLICT (entry_id, reading_id, action_ar) DO UPDATE SET
                            is_default = EXCLUDED.is_default;
                    """, (entry_id, r, is_def))
                    total_readings += 1

                    cur.execute("""
                        INSERT INTO qiraat_entry_authorities (
                            entry_id, authority_id, action_ar, is_default
                        ) VALUES (%s, %s, %s, %s)
                        ON CONFLICT (entry_id, authority_id, COALESCE(action_ar, '')) DO NOTHING;
                    """, (entry_id, r, v.get('description', ''), is_def))

                # Evidence
                for ev_order, ev in enumerate(v.get('evidence', []), 1):
                    src_doc = ev['source']
                    ev_text = ev['text']
                    norm_text = T.norm(ev_text)
                    cur.execute("""
                        INSERT INTO qiraat_evidence_texts (source_document_id, text_ar, text_normalized)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (source_document_id, text_normalized) DO UPDATE SET
                            text_ar = EXCLUDED.text_ar
                        RETURNING id;
                    """, (src_doc, ev_text, norm_text))
                    ev_text_id = cur.fetchone()[0]

                    cur.execute("""
                        INSERT INTO qiraat_evidence_links (evidence_text_id, page_id, locus_id, evidence_order)
                        VALUES (%s, %s, %s, %s)
                        ON CONFLICT (evidence_text_id, page_id, locus_id) DO UPDATE SET
                            evidence_order = EXCLUDED.evidence_order;
                    """, (ev_text_id, page_db_id, locus_id, ev_order))

        # 3. Process rulings
        rul_fixture_path = os.path.join(ROOT, f'packages/qiraat-core/fixtures/rulings/page-{page:03d}.json')
        if os.path.exists(rul_fixture_path):
            with open(rul_fixture_path, 'r', encoding='utf-8') as f:
                rul_items = json.load(f)

            for order_idx, r in enumerate(rul_items, 1):
                r_locus_id = r['id']
                btext = r.get('baseText', '')
                r_end_ayah = r.get('endAyah') or (r['ayah'] + 1 if r['endToken'] < r['startToken'] else r['ayah'])
                cur.execute("""
                    INSERT INTO qiraat_loci (
                        id, page_id, surah_number, start_ayah, start_word,
                        end_ayah, end_word, base_text, base_text_normalized,
                        location_order, mapping_status
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'verified'
                    ) ON CONFLICT (id) DO UPDATE SET
                        base_text = EXCLUDED.base_text,
                        base_text_normalized = EXCLUDED.base_text_normalized;
                """, (
                    r_locus_id, page_db_id, r['surah'], r['ayah'], r['startToken'],
                    r_end_ayah, r['endToken'], btext, T.norm(btext),
                    order_idx
                ))
                total_loci += 1

                entry_id = r['id']
                if args.reconcile and entry_id in existing_entry_ids:
                    continue
                cur.execute("""
                    INSERT INTO qiraat_entries (
                        id, locus_id, page_id, kind, entry_order,
                        attribution_mode, verification_status, notes
                    ) VALUES (
                        %s, %s, %s, 'ruling', 1, 'explicit', 'REVIEWED', %s
                    ) ON CONFLICT (id) DO UPDATE SET
                        notes = EXCLUDED.notes;
                """, (entry_id, r_locus_id, page_db_id, r.get('notes')))
                total_entries += 1
                total_rulings += 1
                if args.reconcile:
                    existing_entry_ids.add(entry_id)

                # Ruling details
                opts = r.get('options')
                if opts is not None and not isinstance(opts, list):
                    opts = [str(opts)]
                category_code = CATEGORY_INV.get(r['category'], r['category'])
                cur.execute("""
                    INSERT INTO qiraat_ruling_details (
                        entry_id, category_code, text_ar, options
                    ) VALUES (
                        %s, %s, %s, %s
                    ) ON CONFLICT (entry_id) DO UPDATE SET
                        category_code = EXCLUDED.category_code,
                        text_ar = EXCLUDED.text_ar,
                        options = EXCLUDED.options;
                """, (entry_id, category_code, r.get('text'), opts))

                # Entry authorities
                for attr in r.get('attribution', []):
                    auth_id = attr.get('authorityId')
                    if not auth_id:
                        continue
                    act = attr.get('action')
                    cond = attr.get('condition') or r.get('condition')
                    cur.execute("""
                        INSERT INTO qiraat_entry_authorities (
                            entry_id, authority_id, action_ar, condition_ar, is_default
                        ) VALUES (
                            %s, %s, %s, %s, true
                        ) ON CONFLICT (entry_id, authority_id, COALESCE(action_ar, '')) DO UPDATE SET
                            condition_ar = EXCLUDED.condition_ar;
                    """, (entry_id, auth_id, act, cond))

                # Entry readings
                for rd in r.get('readings', []):
                    if isinstance(rd, dict):
                        r_id = rd['readingId']
                        r_act = rd.get('action', '')
                        r_def = rd.get('isDefault', True)
                    else:
                        r_id = rd
                        r_act = ''
                        r_def = True
                    cur.execute("""
                        INSERT INTO qiraat_entry_readings (entry_id, reading_id, action_ar, is_default)
                        VALUES (%s, %s, %s, %s)
                        ON CONFLICT (entry_id, reading_id, action_ar) DO UPDATE SET
                            is_default = EXCLUDED.is_default;
                    """, (entry_id, r_id, r_act, r_def))
                    total_readings += 1

                # Count schools
                for cs in r.get('countSchools', []):
                    cur.execute("""
                        INSERT INTO qiraat_entry_count_schools (entry_id, count_school_id)
                        VALUES (%s, %s)
                        ON CONFLICT (entry_id, count_school_id) DO NOTHING;
                    """, (entry_id, cs))

    # Re-enable trigger
    cur.execute("ALTER TABLE qiraat_entry_authorities ENABLE TRIGGER qiraat_entry_authorities_sync_trg;")

    conn.commit()
    print("\nDatabase import committed successfully!")
    print(f"  Pages imported:     {total_pages}")
    print(f"  Loci created:       {total_loci}")
    print(f"  Total entries:      {total_entries} ({total_variants} variants, {total_rulings} rulings)")
    print(f"  Reading assertions: {total_readings}")

    # Integrity verification
    cur.execute("SELECT count(*) FROM qiraat_pages;")
    db_pages = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM qiraat_loci;")
    db_loci = cur.fetchone()[0]
    cur.execute("SELECT kind, count(*) FROM qiraat_entries GROUP BY kind;")
    db_entries = dict(cur.fetchall())
    cur.execute("SELECT count(*) FROM qiraat_entry_readings;")
    db_readings = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM qiraat_evidence_texts;")
    db_ev_texts = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM qiraat_evidence_links;")
    db_ev_links = cur.fetchone()[0]

    print("\nLive DB Verification:")
    print(f"  qiraat_pages:          {db_pages} rows")
    print(f"  qiraat_loci:           {db_loci} rows")
    print(f"  qiraat_entries:        {db_entries.get('variant', 0)} variants, {db_entries.get('ruling', 0)} rulings (total {sum(db_entries.values())})")
    print(f"  qiraat_entry_readings: {db_readings} rows")
    print(f"  qiraat_evidence_texts: {db_ev_texts} rows")
    print(f"  qiraat_evidence_links: {db_ev_links} rows")

    conn.close()

if __name__ == '__main__':
    main()
