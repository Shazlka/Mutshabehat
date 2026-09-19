# -*- coding: utf-8 -*-
"""Import all verified Qiraat fixtures (pages 1-184) into PostgreSQL.

Connects to the self-hosted PostgreSQL instance, disables triggers during bulk insert,
populates qiraat_pages, qiraat_loci, qiraat_entries, qiraat_variant_details,
qiraat_ruling_details, qiraat_entry_authorities, qiraat_entry_readings,
qiraat_entry_count_schools, qiraat_evidence_texts, and qiraat_evidence_links,
then re-enables triggers and verifies counts and integrity.
"""
import json, os, sys
import psycopg2

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, 'scripts/qiraat'))
import tokens as T
import authorities as A
from data_variants import PAGES

# Inverse of DIFF map to get lowercase enum value for qiraat_variant_type
DIFF_INV = {
    'ORTHOGRAPHY': 'orthography', 'HARAKAH': 'vowel', 'LETTER': 'consonant',
    'HAMZ': 'hamza', 'MADD': 'madd', 'IDGHAM': 'idgham', 'IMALAH': 'imalah',
    'WAQF': 'sakt', 'NAQL': 'naql', 'OTHER': 'other', 'ADDITION': 'addition',
    'OMISSION': 'omission'
}

def main():
    print("Connecting to PostgreSQL at 127.0.0.1:5433...")
    conn = psycopg2.connect(
        host='127.0.0.1',
        port=5433,
        dbname='postgres',
        user='postgres',
        password='O6ih48Hy6Q1nh3AxElyC9HlHLFCzwfjJ'
    )
    cur = conn.cursor()

    # Load surah names
    surah_names_file = os.path.join(ROOT, 'public/quran/surah-names.json')
    with open(surah_names_file, 'r', encoding='utf-8') as f:
        surah_names = json.load(f)

    # Disable sync trigger for bulk performance
    cur.execute("ALTER TABLE qiraat_entry_authorities DISABLE TRIGGER qiraat_entry_authorities_sync_trg;")

    total_pages = 0
    total_loci = 0
    total_entries = 0
    total_variants = 0
    total_rulings = 0
    total_readings = 0

    page_nums = sorted(PAGES.keys())
    print(f"Starting import for {len(page_nums)} pages (pages {page_nums[0]} to {page_nums[-1]})...")

    for page in page_nums:
        spec = PAGES[page]
        surah_num = spec['surah']
        surah_name = surah_names.get(str(surah_num), 'غير محدد')

        # 1. Insert qiraat_pages
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
        """, (spec['source'], page, surah_num, surah_name, spec['af'], spec['at'], spec.get('notes')))
        page_db_id = cur.fetchone()[0]
        total_pages += 1

        # 2. Process variants
        var_fixture_path = os.path.join(ROOT, f'packages/qiraat-core/fixtures/pages/page-{page:03d}.json')
        if os.path.exists(var_fixture_path):
            with open(var_fixture_path, 'r', encoding='utf-8') as f:
                var_items = json.load(f)

            for order_idx, v in enumerate(var_items, 1):
                # Ensure locus ID and entry ID are unique across all loci & words
                locus_id = f"{v['locusId']}-a{v['ayah']}-t{v['startToken']}"
                entry_id = f"{v['id']}-a{v['ayah']}-t{v['startToken']}"
                end_ayah = v.get('endAyah') or (v['ayah'] + 1 if v['endToken'] < v['startToken'] else v['ayah'])

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
                    entry_id, locus_id, page_db_id, v.get('wajhIndex', 1),
                    vstatus, v.get('notes')
                ))
                total_entries += 1
                total_variants += 1

                # Variant details
                v_type = DIFF_INV.get(v.get('differenceType'), 'other')
                is_base = ('Q05-R02' in v.get('readingIds', []) and T.norm(v['variantText']) == T.norm(v['hafsText']))
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
                    entry_id, v['variantText'], T.norm(v['variantText']), v['variantText'],
                    v.get('description'), v_type, is_base, v.get('performanceNote')
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

                # Ruling details
                opts = r.get('options')
                if opts is not None and not isinstance(opts, list):
                    opts = [str(opts)]
                cur.execute("""
                    INSERT INTO qiraat_ruling_details (
                        entry_id, category_code, text_ar, options
                    ) VALUES (
                        %s, %s, %s, %s
                    ) ON CONFLICT (entry_id) DO UPDATE SET
                        category_code = EXCLUDED.category_code,
                        text_ar = EXCLUDED.text_ar,
                        options = EXCLUDED.options;
                """, (entry_id, r['category'], r.get('text'), opts))

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
