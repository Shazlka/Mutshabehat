# -*- coding: utf-8 -*-
"""Parse the page-by-page prose extraction (docx, Mushaf pages 225-584) into Qiraat fixtures.

Third ingestion path. Same hard invariants as build_variants.py (a variant partitions the 20
Riwayat once and the Hafs wajh matches the rasm) and the same drop-on-doubt rule. Rulings are
family-labelled per line in this source, which is cleaner than the ayah tables, but still guarded
against negation/universal statements. DEDUP is additive: new loci are appended, while
source-named reader assignments may be appended to an existing category/locus when uncovered.
Same-reader disagreements are dropped.
"""
import json, os, re, sys, collections, hashlib, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tokens as T
import authorities as A
from import_surah_tables import resolve_readers, Unresolved, is_neg, is_univ, NAMED, NAMES_BY_LEN

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SC = '/tmp/claude-0/-home-user-Mutshabehat/e0ba1b96-dd1a-5b8a-886e-c95aefd540ed/scratchpad'
DOC = {}
PACKAGE_PATH = os.environ.get('QIRAAT_IMPORT_PACKAGE', os.path.expanduser(
    '~/Downloads/mutshabehat_qiraat_import_225_584/qiraat_records.jsonl'))
PACKAGE_RECORDS = {}
if os.path.isfile(PACKAGE_PATH):
    with open(PACKAGE_PATH, encoding='utf-8') as package_file:
        for package_line in package_file:
            record = json.loads(package_line)
            if record.get('record_id'):
                PACKAGE_RECORDS[record['record_id']] = record
# Prefer the original page extraction when the historical scratchpad is unavailable. The
# processed package preserves each source paragraph verbatim, so it can drive the same
# fail-closed page parser without reopening the DOCX or inventing normalized prose.
if PACKAGE_RECORDS:
    packaged_pages=collections.defaultdict(lambda: {'page':None,'surah':None,'ayat':None,
                                                     'farsh':[],'usul':[]})
    for record in sorted(PACKAGE_RECORDS.values(),
                         key=lambda r:(r.get('page_no',0),r.get('record_order',0))):
        page=record.get('page_no')
        raw=record.get('raw_text')
        if not page or not raw:
            continue
        entry=packaged_pages[page]
        entry['page']=page
        entry['surah']=record.get('surah_number')
        entry['ayat']=record.get('ayah_range')
        section=record.get('section')
        if section in ('farsh','mixed'):
            entry['farsh'].append(raw)
        if section in ('usul','mixed'):
            entry['usul'].append(raw)
    DOC={str(page):entry for page,entry in packaged_pages.items()}
else:
    doc_path=SC + '/doc_pages.json'
    if os.path.isfile(doc_path):
        DOC=json.load(open(doc_path,encoding='utf-8'))
    else:
        raise FileNotFoundError('Qiraat source unavailable: provide qiraat_records.jsonl or doc_pages.json')
TS = '2026-09-20T12:00:00.000Z'
ALL20 = set(A.ALL_READINGS)
SRC = dict(sourceName='استخراج القراءات العشر صفحةً صفحة (٢٢٥–٥٨٤)', sourceType='other',
           sourceReference='وثيقة الاستخراج المبوّب: الكلمات الفرشية والأصول لكل صفحة',
           verificationNotes='بيانات مسلَّمة نصًّا صفحةً صفحة. لم تُراجع بعدُ على الأصل الورقي.')
BRACE = re.compile(r'﴿([^﴾]+)﴾')
HDR = re.compile(r'^\s*(?:﴿[^﴾]+﴾[،,\s]*)+(?:\([^)]*\)\s*)?:\s*$')  # braced words (+opt paren) + colon
RCOLORS = {
 'MADD_BADAL':('مد البدل','#2563EB'),'MADD_LIN':('مد اللين المهموز','#2563EB'),
 'TARQIQ_RA':('ترقيق الراءات','#B45309'),'TAGHLIZ_LAM':('تغليظ اللامات','#B45309'),
 'IDGHAM_KABIR':('المدغم الكبير','#15803D'),'IDGHAM_SAGHIR':('المدغم الصغير','#15803D'),
 'IMALAH_TAQLIL':('الممال والمقلل','#C026D3'),'TAGHYIR_HAMZ':('تغيير الهمز','#DC2626'),
 'SILAT_HA':('صلة هاء الكناية','#0D9488'),'MEEM_JAM':('صلة ميم الجمع','#DB2777'),'SAKT':('السكت','#7C3AED'),
 'TARK_GHUNNA':('ترك الغنة','#0891B2'),
 'YAAT_IDAFA':('ياءات الإضافة','#CA8A04'),'YAAT_ZAWAID':('ياءات الزوائد','#CA8A04'),
 'HAMZATAN_KALIMATAYN':('الهمزتان من كلمتين','#DC2626'),
 'HAMZATAN_KALIMA':('الهمزتان من كلمة','#DC2626'),
 'WAQF_RASM':('الوقف على مرسوم الخط','#EA580C'),
 'WAQF_HAMZA':('وقف حمزة','#EA580C'),
 'IKHFA':('الإخفاء','#0891B2'),
}
DIFF={'orthography':'ORTHOGRAPHY','vowel':'HARAKAH','consonant':'LETTER','hamza':'HAMZ',
      'word_form':'LETTER','ishmam':'HARAKAH','other':'OTHER'}
def diff_type(desc):
    for keys,t in [(('بالياء','بالنون','بالتاء','ياء','نون العظمة','تاء','تثنية'),'word_form'),
                   (('بألف','بغير ألف','ألف'),'orthography'),
                   (('همز','تسهيل','إبدال','تحقيق'),'hamza'),
                   (('تشديد','تخفيف','مشدد','مخفف'),'word_form'),
                   (('بضم','بفتح','بكسر','بإسكان','رفع','نصب','جر','ضم','فتح','كسر','إسكان'),'vowel'),
                   (('إشمام',),'ishmam')]:
        if any(k in desc for k in keys): return t
    return 'other'

def face_key(text):
    """Normalize composition and spacing but preserve reader-specific vowel marks."""
    return ' '.join(unicodedata.normalize('NFC',text or '').replace('ـ','').split())

def readers_from(text, claimed):
    """Resolve a reader clause: handles جميع القراء عدا X, الباقون/للجمهور, and name lists."""
    t=text.strip()
    m=re.search(r'جميع القراء عدا\s+(.+)', t)
    if m:
        exc,_=resolve_readers(re.sub(r'[اً]$','',m.group(1)).replace('نافعا','نافع'), set())
        if not exc: raise Unresolved('excepted empty')
        return set(ALL20)-exc
    if any(x in t for x in ('الباقون','الباقين','للباقون','للباقين','للجمهور','الجمهور')):
        return set(ALL20)-claimed
    rs,_=resolve_readers(t, claimed)
    if not rs: raise Unresolved('no readers')
    return rs

# ---------- FARSH ----------
def parse_farsh(page, lines):
    out=[]; i=0; n=len(lines)
    while i<n:
        line=lines[i]
        if HDR.match(line):
            anchor=BRACE.search(line).group(1)
            wujuh=[]; claimed=set(); j=i+1
            while j<n and not HDR.match(lines[j]) and (':' in lines[j]):
                body=lines[j]
                pre,post=body.split(':',1)
                # text = a brace in pre, else None (base wajh has no variant spelling)
                bm=BRACE.search(pre); text=bm.group(1) if bm else None
                try: rs=readers_from(post, claimed)
                except Unresolved: wujuh=None; break
                wujuh.append((text, pre.strip(), rs)); claimed|=rs; j+=1
            i=j
            if wujuh and len(wujuh)>=2:
                yield_block(page, anchor, wujuh, out)
            continue
        i+=1
    return out

def yield_block(page, anchor, wujuh, out, ayah=None, occurrence=1):
    union=set(); overlap=False
    for _,_,rs in wujuh:
        if union&rs: overlap=True
        union|=rs
    if overlap or union!=ALL20: return
    base=[k for k,(_,_,rs) in enumerate(wujuh) if 'Q05-R02' in rs]
    if len(base)!=1: return
    try: loc=T.find(page, anchor, occurrence, ayah=ayah)
    except T.NoMatch: return
    bt=wujuh[base[0]][0]
    if bt and T.norm(bt)!=T.norm(loc['baseText']): return
    lid=f'D{page:03d}-{T.norm(anchor).replace(" ","_")}'
    for wi,(text,desc,rs) in enumerate(wujuh,1):
        if wi-1==base[0]: continue
        perf=bool(text) and T.norm(text)==T.norm(loc['baseText']) and any(k in desc for k in('إشمام','اختلاس','سكت','روم'))
        out.append({'id':f'v-{lid}-w{wi}','surah':loc['surah'],'ayah':loc['startAyah'],
            'startToken':loc['startWord'],'endToken':loc['endWord'],'operation':'REPLACE',
            'hafsText':loc['baseText'],'variantText':loc['baseText'] if perf else (text or loc['baseText']),
            'differenceType':DIFF[diff_type(desc)],'verificationStatus':'REVIEWED',
            'createdAt':TS,'updatedAt':TS,'readingIds':sorted(rs),'locusId':lid,
            'locusType':'performance_variant' if perf else ('multi_word_variant' if loc['endWord']>loc['startWord'] else 'word_variant'),
            **({'performanceNote':desc} if perf else {}),
            'sources':[{'id':f's-{lid}-w{wi}','variantId':f'v-{lid}-w{wi}',**SRC}],
            'description':desc,'wajhIndex':wi,'evidence':[]})

def reconcile_audited_farsh(page, lines, variants, existing_page):
    """Reconcile two source rows whose generic block shape is unsafe.

    Page 229's tanween reading is already present on its exact changed token; the document
    quotes a two-word header, so the generic block parser otherwise creates a duplicate span.
    Page 260's printed alternate has the yā before the hamza, while the explicit description and
    independent القراءات reference put it after the hamza. Keep the literal document quotation
    as sourceText and store only the independently corroborated form as the actual variant.
    """
    source_links_added = 0
    # Explicit, source-partitioned faces on pages 439--442.  These rows are
    # intentionally handled here because their prose contains parenthetical
    # waqf/performance notes and the generic two-clause parser cannot safely
    # partition them.  Every block is checked against the packaged source and
    # anchored to the real token; the base (Q05) face is retained in the block.
    audited_439_442 = {
      439: [
        ('DOCX-P439-R02436','بَيِّنَتٍ','بَيِّنَاتٍ',40,24,
         {'Q01-R01','Q02-R01','Q02-R02','Q04-R01','Q05-R01','Q08-R01','Q09-R01'},
         'بالجمع'),
      ],
      440: [
        ('DOCX-P440-R02448','صِرَٰطٍ','سِرَٰطٍ',4,2,
         {'Q02-R02','Q09-R02'},'بالسين'),
        ('DOCX-P440-R02448','صِرَٰطٍ','صِرَٰطٍ',4,2,
         {'Q06-R01','Q06-R02'},'بإشمام الصاد زياً'),
        ('DOCX-P440-R02451','أَيْدِيهِمْ','أَيْدِيهُمُ',9,4,
         {'Q09-R01','Q09-R02'},'بضم الهاء'),
        ('DOCX-P440-R02452','سَدّٗا','سُدًّا',9,5,
         {'Q01-R01','Q01-R02','Q02-R01','Q02-R02','Q03-R01','Q03-R02','Q04-R01','Q04-R02','Q07-R01','Q07-R02','Q08-R01','Q08-R02','Q09-R01','Q09-R02'},'بضم السين'),
        ('DOCX-P440-R02453','عَلَيْهِمْ','عَلَيْهُمُ',10,2,
         {'Q06-R01','Q06-R02','Q09-R01','Q09-R02'},'بضم الهاء'),
      ],
      442: [
        ('DOCX-P442-R02477','صَيْحَةٗ وَٰحِدَةٗ','صَيْحَةٌ وَاحِدَةٌ',29,4,
         {'Q08-R01','Q08-R02'},'بالرفع'),
        ('DOCX-P442-R02482','الْعُيُونِ','ٱلْعِيُونِ',34,10,
         {'Q01-R01','Q01-R02','Q02-R01','Q02-R02','Q03-R01','Q03-R02'},'بكسر العين'),
        ('DOCX-P442-R02483','ثَمَرِهِۦ','ثُمُرِهِۦ',35,3,
         {'Q06-R01','Q06-R02','Q07-R01','Q07-R02'},'بضمتين'),
        ('DOCX-P442-R02484','وَمَا عَمِلَتْهُ','وَمَا عَمِلَتْ',35,4,
         {'Q04-R01','Q04-R02','Q05-R01','Q06-R01','Q06-R02','Q10-R01','Q10-R02'},'بحذف الهاء'),
      ],
    }
    for record_id, anchor, alternate, ayah, word, readers, action in audited_439_442.get(page,[]):
        rec=PACKAGE_RECORDS.get(record_id)
        if rec is None or rec.get('raw_text') not in lines:
            raise ValueError(f'page {page} audited source row missing: {record_id}')
        if is_neg(rec['raw_text']) or is_univ(rec['raw_text']):
            raise ValueError(f'page {page} audited source row unsafe: {record_id}')
        loc=T.find(page,anchor,ayah=ayah)
        if loc['startWord'] != word or not readers <= ALL20 or 'Q05-R02' in readers:
            raise ValueError(f'page {page} audited face token/partition changed: {record_id}')
        remainder=ALL20-readers
        if not remainder: continue
        yield_block(page,anchor,[(None,'للباقين',remainder),(alternate,action,readers)],variants,ayah=ayah)
        if variants:
            # Two independent performance faces can share the same anchor; keep
            # their fixture identities distinct while retaining the same token.
            if record_id == 'DOCX-P440-R02448' and action == 'بإشمام الصاد زياً':
                suffix='-ishmam'
                variants[-1]['id'] += suffix
                variants[-1]['sources'][0]['id'] += suffix
                variants[-1]['sources'][0]['variantId'] += suffix
            variants[-1]['sources'][0].update({'sourceReference':f'وثيقة الاستخراج، {record_id}','sourceText':rec['raw_text']})
    def require_packaged_source(page_no, raw_text):
        rows=[r for r in PACKAGE_RECORDS.values() if r.get('page_no')==page_no and
              r.get('section')=='farsh' and r.get('raw_text')==raw_text]
        if len(rows)!=1:
            raise ValueError(f'page {page_no} processed-package source row missing/not unique')
        return rows[0]
    # Three directly stated vowel variants in the processed import package. Each
    # branch checks the exact source line, Mushaf token and reader partition before
    # appending; this keeps the generic prose parser fail-closed on these compact rows.
    audited_261_262 = {
        (261, 47, 'تَحْسَبَنَّ'):(
            '﴿فَلَا تَحْسَبَنَّ﴾: بفتح السين لابن عامر، عاصم، حمزة، أبو جعفر؛ وبكسرها للباقين.',
            'تَحْسِبَنَّ',
            {'Q01-R01','Q01-R02','Q02-R01','Q02-R02','Q03-R01','Q03-R02','Q07-R01','Q07-R02','Q09-R01','Q09-R02','Q10-R01','Q10-R02'},
            'https://quranpedia.net/qiraat/ibrahim/47',
            'الفتح: ابن جمّاز عن أبي جعفر، هشام وابن ذكوان عن ابن عامر، شعبة وحفص عن عاصم، خلف وخلاد عن حمزة؛ والكسر لسائر الرواة.'),
        (262, 11, 'يَأْتِيهِم'):(
            '﴿وَمَا يَأْتِيهِم﴾: بكسر الهاء للجمهور؛ وبضمها ﴿يَأْتِيهُم﴾ ليعقوب.',
            'يَأْتِيهُم', {'Q09-R01','Q09-R02'},
            'https://quranpedia.net/qiraat/al-hijr/11',
            'ضم الهاء: رويس وروح عن يعقوب.'),
        (262, 14, 'عَلَيْهِم'):(
            '﴿عَلَيْهِم﴾: بكسر الهاء للجمهور؛ وبضمها لحمزة ويعقوب.',
            'عَلَيْهُم', {'Q06-R01','Q06-R02','Q09-R01','Q09-R02'},
            'https://quranpedia.net/qiraat/al-hijr/14',
            'ضم الهاء: خلف وخلاد عن حمزة، ورويس وروح عن يعقوب.'),
    }
    if page in (261, 262):
        for (p, ayah, anchor), (source_line, alternate, alternate_readers, url, external_text) in audited_261_262.items():
            if p != page:
                continue
            if [line.strip() for line in lines if line.strip() == source_line] != [source_line]:
                raise ValueError(f'page {page} audited {ayah} source row missing/not unique')
            require_packaged_source(page, source_line)
            if is_neg(source_line) or is_univ(source_line):
                raise ValueError(f'page {page} audited {ayah} source row failed negation/universal guard')
            loc=T.find(page,anchor,ayah=ayah)
            if (loc['surah'],loc['startAyah'],loc['endAyah'],loc['startWord'],loc['endWord']) != (14 if page==261 else 15,ayah,ayah,2 if page==261 else (2 if ayah==11 else 3),2 if page==261 else (2 if ayah==11 else 3)):
                raise ValueError(f'page {page} audited {ayah} exact token/span changed')
            readers=set(alternate_readers)
            if len(readers)==0 or not readers <= ALL20 or 'Q05-R02' in readers:
                raise ValueError(f'page {page} audited {ayah} explicit alternate partition failed')
            matches=[x for x in existing_page if
                (x.get('surah'),x.get('ayah'),x.get('startToken'),x.get('endToken')) ==
                (loc['surah'],ayah,loc['startWord'],loc['endWord'])]
            if matches:
                if (len(matches)==1 and matches[0].get('id') ==
                    f'v-AUDIT-P{page}-{loc["surah"]}-{ayah}-{loc["startWord"]}-HARAKAH' and
                    matches[0].get('hafsText') == loc['baseText'] and
                    matches[0].get('variantText') == alternate and
                    set(matches[0].get('readingIds', [])) == readers):
                    continue
                raise ValueError(f'page {page} audited {ayah} token already has a different variant; additive-only import refused')
            before=len(variants)
            yield_block(page,anchor,[(None,'وجه حفص المطابق لرسم المصحف',set(ALL20)-readers),
                                     (alternate,source_line,readers)],variants)
            added=[x for x in variants[before:] if
                (x.get('surah'),x.get('ayah'),x.get('startToken'),x.get('endToken')) ==
                (loc['surah'],ayah,loc['startWord'],loc['endWord'])]
            if len(added)!=1:
                raise ValueError(f'page {page} audited {ayah} 20-reading partition failed')
            v=added[0]
            v['id']=f'v-AUDIT-P{page}-{loc["surah"]}-{ayah}-{loc["startWord"]}-HARAKAH'
            v['locusId']=f'AUDIT-P{page}-{loc["surah"]}-{ayah}-{loc["startWord"]}-HARAKAH'
            for i,src in enumerate(v.get('sources',[]),1):
                src['id']=f's-AUDIT-P{page}-{ayah}-{i}'
                src['variantId']=v['id']
            v['sources'][0].update({'sourceReference':f'qiraat_records.jsonl، Mushaf page {page}',
                'sourceText':source_line,'verificationNotes':'تعيين القراء والوجه قوبل بمرجع مستقل للقراءات العشر.'})
            v['sources'].append({'id':f's-AUDIT-P{page}-{ayah}-EXT','variantId':v['id'],
                'sourceName':'موسوعة القراءات القرآنية — القراءات العشر','sourceType':'website',
                'sourceReference':url,'sourceText':external_text,
                'verificationNotes':'مرجع مستقل يذكر الرواة صراحةً ويثبت الوجه المخالف لحفص.'})
            v['evidence']=[{'source':'موسوعة القراءات القرآنية — القراءات العشر','text':external_text,'url':url}]
    if page == 264:
        p264_candidates=[
            (41,'عَلَىَّ','عَلِيٌّ',{'Q09-R01','Q09-R02'},
             ['DOCX-P264-R00591','DOCX-P264-R00592'],
             'https://quranpedia.net/qiraat/al-hijr/41',
             'Yaqub: Ruways and Rawh read عَلِيٌّ with kasra on the lam and nominative tanwin; the token 3 الصراط alternates are represented separately.'),
            (42,'عَلَيْهِمْ','عَلَيْهُمْ',{'Q06-R01','Q06-R02','Q09-R01','Q09-R02'},
             ['DOCX-P264-R00593'],
             'https://quranpedia.net/qiraat/al-hijr/42',
             'Dammah on hāʾ: Khalaf and Khallād from Hamza, Rawh and Ruways from Yaqub.'),
            (44,'جُزْءٌ','جُزٌّ',{'Q08-R01','Q08-R02'},
             ['DOCX-P264-R00596'],
             'https://quranpedia.net/qiraat/al-hijr/44',
             'Abu Jaafar (Ibn Jammaz and Ibn Wardan): doubled zay with tanwin and deletion of hamza.'),
        ]
        for ayah,anchor,alternate,readers,record_ids,url,external_text in p264_candidates:
            rows=[PACKAGE_RECORDS.get(rid) for rid in record_ids]
            if any(r is None or r.get('page_no')!=264 or r.get('section')!='farsh' for r in rows):
                raise ValueError(f'page 264 audited {ayah} processed-package row missing')
            for r in rows:
                if (not r.get('raw_text') or r.get('attribution_mode') not in ('explicit','remainder') or
                    is_neg(r['raw_text']) or is_univ(r['raw_text'])):
                    raise ValueError(f'page 264 audited {ayah} source lacks explicit packaged attribution')
            loc=T.find(page,anchor,ayah=ayah)
            expected_word={41:4,42:5,44:7}[ayah]
            if (loc['surah'],loc['startAyah'],loc['endAyah'],loc['startWord'],loc['endWord']) != (15,ayah,ayah,expected_word,expected_word):
                raise ValueError(f'page 264 audited {ayah} exact token/span changed')
            matches=[x for x in existing_page if
                (x.get('surah'),x.get('ayah'),x.get('startToken'),x.get('endToken')) ==
                (15,ayah,expected_word,expected_word)]
            stable_id=f'v-AUDIT-P264-15-{ayah}-{expected_word}-HARAKAH'
            if matches:
                if (len(matches)==1 and matches[0].get('id')==stable_id and
                    matches[0].get('hafsText')==loc['baseText'] and
                    matches[0].get('variantText')==alternate and
                    set(matches[0].get('readingIds',[]))==readers and
                    matches[0].get('description')==' / '.join(r['raw_text'] for r in rows)):
                    continue
                # A different source-backed form can coexist at this token if it assigns
                # only readings not already claimed by the existing form (filtered below).
                stable_id += '-ALT-' + hashlib.sha1(T.norm(alternate).encode()).hexdigest()[:8]
            if not readers or 'Q05-R02' in readers or not readers <= ALL20:
                raise ValueError(f'page 264 audited {ayah} reader group failed')
            before=len(variants)
            yield_block(page,anchor,[(None,'وجه حفص المطابق لرسم المصحف',set(ALL20)-readers),
                                     (alternate,'الوجه المنقول في مجموعة المصدر المعالجة',readers)],variants)
            added=[x for x in variants[before:] if
                (x.get('surah'),x.get('ayah'),x.get('startToken'),x.get('endToken')) == (15,ayah,expected_word,expected_word)]
            if len(added)!=1:
                raise ValueError(f'page 264 audited {ayah} 20-reading partition failed')
            v=added[0]; v['id']=stable_id; v['locusId']=stable_id.replace('v-','')
            v['differenceType']='LETTER' if ayah==44 else 'HARAKAH'
            v['sources']=[]
            for rid,row in zip(record_ids,rows):
                v['sources'].append({'id':f's-{rid}','variantId':v['id'],
                    'sourceName':'استخراج القراءات العشر صفحةً صفحة (٢٢٥–٥٨٤)','sourceType':'other',
                    'sourceReference':f'qiraat_records.jsonl، {rid}','sourceText':row['raw_text'],
                    'verificationNotes':'نُقلت مجموعة الراوي من صف السجل المعالج، وقوبلت مستقلاً مع القراءات العشر.'})
            v['description']=' / '.join(r['raw_text'] for r in rows)
            v['sources'].append({'id':f's-AUDIT-P264-{ayah}-EXT','variantId':v['id'],
                'sourceName':'موسوعة القراءات القرآنية — القراءات العشر','sourceType':'website',
                'sourceReference':url,'sourceText':external_text,
                'verificationNotes':'مرجع مستقل يثبت الوجه والراويين صراحةً.'})
            v['evidence']=[{'source':'موسوعة القراءات القرآنية — القراءات العشر','text':external_text,'url':url}]
    if page in (267,268):
        if page==267:
            candidates=[
                (1,'يُشْرِكُونَ','تُشْرِكُونَ',{'Q06-R01','Q06-R02','Q07-R01','Q07-R02'},
                 ['DOCX-P267-R00639','DOCX-P267-R00640'],'https://quranpedia.net/qiraat/an-nahl/1',
                 'At an-Nahl 16:1: address with tāʾ for Khalaf from Hamza, both al-Kisai narrators, and both Khalaf al-Ashir narrators; yāʾ for the other fourteen readings.'),
                (3,'يُشْرِكُونَ','تُشْرِكُونَ',{'Q06-R01','Q06-R02','Q07-R01','Q07-R02'},
                 ['DOCX-P267-R00639','DOCX-P267-R00640'],'https://quranpedia.net/qiraat/an-nahl/3',
                 'At an-Nahl 16:3: address with tāʾ for Khalaf from Hamza, both al-Kisai narrators, and both Khalaf al-Ashir narrators; yāʾ for the other fourteen readings.')]
        else:
            candidates=[(7,'بِشِقِّ','بِشَقِّ',{'Q08-R01','Q08-R02'},['DOCX-P268-R00649'],
                'https://quranpedia.net/qiraat/an-nahl/7',
                'Abu Jaafar (Ibn Wardan and Ibn Jammaz) reads بِشَقِّ with fatḥah on the shīn; the other eighteen readings have kasrah.')]
        for ayah,anchor,alternate,readers,record_ids,url,external_text in candidates:
            rows=[PACKAGE_RECORDS.get(rid) for rid in record_ids]
            if any(r is None or r.get('page_no')!=page or r.get('section')!='farsh' for r in rows):
                raise ValueError(f'page {page} audited {ayah} processed-package row missing')
            if any(not r.get('raw_text') or is_neg(r['raw_text']) or is_univ(r['raw_text']) for r in rows):
                raise ValueError(f'page {page} audited {ayah} processed-package row failed safety guard')
            loc=T.find(page,anchor,ayah=ayah)
            expected_word=7 if page==267 and ayah==3 else 9
            if (loc['surah'],loc['startAyah'],loc['endAyah'],loc['startWord'],loc['endWord']) != (16,ayah,ayah,expected_word,expected_word):
                raise ValueError(f'page {page} audited {ayah} exact token/span changed')
            matches=[x for x in existing_page if
                (x.get('surah'),x.get('ayah'),x.get('startToken'),x.get('endToken')) ==
                (16,ayah,expected_word,expected_word)]
            stable_id=f'v-AUDIT-P{page}-16-{ayah}-{expected_word}-FARSH'
            if matches:
                if (len(matches)==1 and matches[0].get('id')==stable_id and
                    matches[0].get('hafsText')==loc['baseText'] and
                    matches[0].get('variantText')==alternate and
                    set(matches[0].get('readingIds',[]))==readers and
                    matches[0].get('description')==' / '.join(r['raw_text'] for r in rows)):
                    continue
                stable_id += '-ALT-' + hashlib.sha1(T.norm(alternate).encode()).hexdigest()[:8]
            before=len(variants)
            yield_block(page,anchor,[(None,'وجه حفص المطابق لرسم المصحف',set(ALL20)-readers),
                                     (alternate,'وجه فرشي صريح في المصدر المعالج',readers)],variants,ayah=ayah)
            added=[x for x in variants[before:] if
                (x.get('surah'),x.get('ayah'),x.get('startToken'),x.get('endToken')) == (16,ayah,expected_word,expected_word)]
            if len(added)!=1:
                raise ValueError(f'page {page} audited {ayah} 20-reading partition failed')
            v=added[0];v['id']=stable_id;v['locusId']=stable_id.replace('v-','');v['differenceType']='HARAKAH' if page==268 else 'LETTER'
            v['description']=' / '.join(r['raw_text'] for r in rows);v['sources']=[]
            for rid,row in zip(record_ids,rows):
                v['sources'].append({'id':f's-{rid}','variantId':v['id'],
                    'sourceName':'استخراج القراءات العشر صفحةً صفحة (٢٢٥–٥٨٤)','sourceType':'other',
                    'sourceReference':f'qiraat_records.jsonl، {rid}','sourceText':row['raw_text'],
                    'verificationNotes':'قوبل موضع الصفحة ومجموعة القراء بمرجع مستقل للقراءات العشر.'})
            v['sources'].append({'id':f's-AUDIT-P{page}-{ayah}-EXT','variantId':v['id'],
                'sourceName':'موسوعة القراءات القرآنية — القراءات العشر','sourceType':'website',
                'sourceReference':url,'sourceText':external_text,
                'verificationNotes':'مرجع مستقل يذكر الوجه والرواة صراحةً.'})
            v['evidence']=[{'source':'موسوعة القراءات القرآنية — القراءات العشر','text':external_text,'url':url}]
    if page == 270:
        candidates=[
            (27,'يُخْزِيهِمْ','يُخْزِيهُمُ',{'Q09-R01','Q09-R02'},'DOCX-P270-R00672',
             'https://quranpedia.net/tafsir/an-nahl/27',
             'At an-Nahl 16:27, dammah on hāʾ in يُخْزِيهُمْ is attributed to Rawh and Ruways from Yaqub.'),
            (27,'فِيهِمْ','فِيهُمُ',{'Q09-R01','Q09-R02'},'DOCX-P270-R00672',
             'https://quranpedia.net/tafsir/an-nahl/27',
             'At an-Nahl 16:27, dammah on hāʾ in فِيهُمْ is attributed to Rawh and Ruways from Yaqub.'),
            (28,'تَتَوَفَّىٰهُمُ','يَتَوَفَّاهُمُ',{'Q06-R01','Q06-R02','Q10-R01','Q10-R02'},'DOCX-P270-R00676',
             'https://quranpedia.net/ayahs/16/28/1/557',
             'At an-Nahl 16:28 and the following occurrence, Hamza and Khalaf read يَتَوَفَّاهُمْ with yāʾ; the rest read تَتَوَفَّاهُمْ with tāʾ.'),
            (32,'تَتَوَفَّىٰهُمُ','يَتَوَفَّاهُمُ',{'Q06-R01','Q06-R02','Q10-R01','Q10-R02'},'DOCX-P270-R00676',
             'https://quranpedia.net/ayahs/16/28/1/557',
             'At an-Nahl 16:28 and the following occurrence, Hamza and Khalaf read يَتَوَفَّاهُمْ with yāʾ; the rest read تَتَوَفَّاهُمْ with tāʾ.'),
        ]
        for ayah,anchor,alternate,readers,record_id,url,external_text in candidates:
            row=PACKAGE_RECORDS.get(record_id)
            if (row is None or row.get('page_no')!=270 or row.get('section')!='farsh' or
                row.get('attribution_mode')!='explicit' or not row.get('raw_text') or
                is_neg(row['raw_text']) or is_univ(row['raw_text'])):
                raise ValueError(f'page 270 audited {ayah} processed-package row failed source/safety check')
            explicit_names=[m['raw'] for m in row.get('authority_mentions',[])
                            if m.get('resolution')=='exact']
            resolved,unresolved=resolve_readers('،'.join(explicit_names),set())
            if unresolved or resolved!=readers:
                raise ValueError(f'page 270 audited {ayah} processed-package reader group changed')
            loc=T.find(page,anchor,ayah=ayah)
            expected={ (27,'يُخْزِيهِمْ'):4,(27,'فِيهِمْ'):11,
                       (28,'تَتَوَفَّىٰهُمُ'):2,(32,'تَتَوَفَّىٰهُمُ'):2 }[(ayah,anchor)]
            if (loc['surah'],loc['startAyah'],loc['endAyah'],loc['startWord'],loc['endWord']) != (16,ayah,ayah,expected,expected):
                raise ValueError(f'page 270 audited {ayah} exact token/span changed')
            if ayah in (28,32) and row.get('occurrence_note')!='معاً':
                raise ValueError('page 270 paired Nahl 16:28/32 source no longer says معاً')
            matches=[x for x in existing_page if
                (x.get('surah'),x.get('ayah'),x.get('startToken'),x.get('endToken')) ==
                (16,ayah,expected,expected)]
            stable_id=f'v-AUDIT-P270-16-{ayah}-{expected}-FARSH'
            if matches:
                if (len(matches)==1 and matches[0].get('id')==stable_id and
                    matches[0].get('hafsText')==loc['baseText'] and
                    matches[0].get('variantText')==alternate and
                    set(matches[0].get('readingIds',[]))==readers and
                    matches[0].get('description')==row['raw_text']):
                    continue
                stable_id += '-ALT-' + hashlib.sha1(T.norm(alternate).encode()).hexdigest()[:8]
            before=len(variants)
            yield_block(page,anchor,[(None,'وجه حفص المطابق لرسم المصحف',set(ALL20)-readers),
                                     (alternate,row['raw_text'],readers)],variants,ayah=ayah)
            added=[x for x in variants[before:] if
                (x.get('surah'),x.get('ayah'),x.get('startToken'),x.get('endToken')) == (16,ayah,expected,expected)]
            if len(added)!=1:
                raise ValueError(f'page 270 audited {ayah} 20-reading partition failed')
            v=added[0];v['id']=stable_id;v['locusId']=stable_id.replace('v-','');v['differenceType']='HARAKAH' if ayah in (27,28,32) else 'LETTER'
            v['description']=row['raw_text'];v['sources']=[
                {'id':f's-{record_id}','variantId':v['id'],
                 'sourceName':'استخراج القراءات العشر صفحةً صفحة (٢٢٥–٥٨٤)','sourceType':'other',
                 'sourceReference':f'qiraat_records.jsonl، {record_id}','sourceText':row['raw_text'],
                 'verificationNotes':'قوبل موضع الصفحة ومجموعة القراء بمرجع مستقل للقراءات العشر.'},
                {'id':f's-AUDIT-P270-{ayah}-EXT','variantId':v['id'],
                 'sourceName':'موسوعة القراءات القرآنية — القراءات العشر','sourceType':'website',
                 'sourceReference':url,'sourceText':external_text,
                 'verificationNotes':'مرجع مستقل يذكر الوجه والرواة صراحةً.'}]
            v['evidence']=[{'source':'موسوعة القراءات القرآنية — القراءات العشر','text':external_text,'url':url}]
    if page in (271,272):
        candidates=[
            (271,40,'فَيَكُونُ','فَيَكُونَ','DOCX-P271-R00691',
             'https://jamharah.net/showthread.php?t=27567',
             'At an-Nahl 16:40, Ibn Amir and al-Kisai read فَيَكُونَ with naṣb; the rest read with rafʿ.',
             (16,40,10,10),'HARAKAH'),
            (272,43,'نُوحِي إِلَيْهِمْ','يُوحَى إِلَيْهُم','DOCX-P272-R00701',
             'https://jamharah.net/showthread.php?t=27567',
             'At an-Nahl 16:43, Hamza and Yaqub read يُوحَى إِلَيْهُم; the cited source row explicitly names both readers.',
             (16,43,7,8),'LETTER'),
            (272,44,'إِلَيْهِمْ','إِلَيْهُم','DOCX-P272-R00703',
             'https://jamharah.net/showthread.php?t=27567',
             'At an-Nahl 16:44, Hamza and Yaqub read the hāʾ of إِلَيْهِمْ with ḍamma.',
             (16,44,10,10),'HARAKAH'),
            (272,45,'بِهِمُ ٱلْأَرْضَ','بِهِمِ ٱلْأَرْضَ','DOCX-P272-R00705',
             'https://jamharah.net/showthread.php?t=27567',
             'At an-Nahl 16:45, Abu Amr and Yaqub read بِهِمِ الْأَرْضَ with kasrah on hāʾ and mīm.',
             (16,45,8,9),'HARAKAH'),
            (272,47,'لَرَءُوفٌ','لَرَؤُفٌ','DOCX-P272-R00707',
             'https://jamharah.net/showthread.php?t=27567',
             'At an-Nahl 16:47, Jamharah cites al-Nashr: qasr for Abu Amr, Hamza, al-Kisai, Shuʿbah (Abu Bakr), Khalaf, and Yaqub; the rest use madd.',
             (16,47,7,7),'LETTER'),
        ]
        for p,ayah,anchor,alternate,record_id,url,external_text,expected,dtype in candidates:
            if p!=page: continue
            row=PACKAGE_RECORDS.get(record_id)
            if (row is None or row.get('page_no')!=page or row.get('section')!='farsh' or
                row.get('attribution_mode') not in ('explicit','remainder') or not row.get('raw_text') or
                is_neg(row['raw_text']) or is_univ(row['raw_text'])):
                raise ValueError(f'page {page} audited {ayah} processed-package row failed source/safety check')
            if record_id=='DOCX-P272-R00707':
                named_clause=row['raw_text'].split('؛',1)[0].split(':',1)[1]
                named_clause=(named_clause.replace('بالمد','').replace('لحفص','حفص')
                              .replace('وأبي جعفر','أبو جعفر'))
                named,unresolved=resolve_readers(named_clause,set())
            else:
                names=[m['raw'] for m in row.get('authority_mentions',[]) if m.get('resolution')=='exact']
                named,unresolved=resolve_readers('،'.join(names),set())
            if unresolved or not named:
                raise ValueError(f'page {page} audited {ayah} packaged reader mentions did not resolve')
            readers=(ALL20-named) if record_id=='DOCX-P272-R00707' else named
            expected_readers={
                'DOCX-P271-R00691':{'Q04-R01','Q04-R02','Q07-R01','Q07-R02'},
                'DOCX-P272-R00701':{'Q06-R01','Q06-R02','Q09-R01','Q09-R02'},
                'DOCX-P272-R00703':{'Q06-R01','Q06-R02','Q09-R01','Q09-R02'},
                'DOCX-P272-R00705':{'Q03-R01','Q03-R02','Q09-R01','Q09-R02'},
                'DOCX-P272-R00707':{'Q03-R01','Q03-R02','Q05-R01','Q06-R01','Q06-R02',
                                    'Q07-R01','Q07-R02','Q09-R01','Q09-R02','Q10-R01','Q10-R02'},
            }[record_id]
            if readers!=expected_readers:
                raise ValueError(f'page {page} audited {ayah} explicit source readers changed')
            loc=T.find(page,anchor,ayah=ayah)
            if (loc['surah'],loc['startAyah'],loc['startWord'],loc['endWord'])!=expected:
                raise ValueError(f'page {page} audited {ayah} exact token/span changed')
            matches=[x for x in existing_page if
                (x.get('surah'),x.get('ayah'),x.get('startToken'))==(loc['surah'],ayah,loc['startWord'])]
            if any(x.get('hafsText')==loc['baseText'] and x.get('variantText')==alternate and
                   set(x.get('readingIds',[]))==readers for x in matches):
                continue
            lid=f'AUDIT-P{page}-{loc["surah"]}-{ayah}-{loc["startWord"]}-{hashlib.sha1(T.norm(alternate).encode()).hexdigest()[:8]}'
            before=len(variants)
            yield_block(page,anchor,[(None,'وجه حفص المطابق لرسم المصحف',set(ALL20)-readers),
                                     (alternate,row['raw_text'],readers)],variants,ayah=ayah)
            added=[x for x in variants[before:] if
                (x.get('surah'),x.get('ayah'),x.get('startToken'),x.get('endToken')) ==
                (loc['surah'],ayah,loc['startWord'],loc['endWord'])]
            if len(added)!=1:
                raise ValueError(f'page {page} audited {ayah} 20-reading variant could not be constructed')
            v=added[0];v['id']=f'v-{lid}';v['locusId']=lid;v['differenceType']=dtype
            v['description']=row['raw_text'];v['sources']=[
                {'id':f's-{record_id}','variantId':v['id'],
                 'sourceName':'استخراج القراءات العشر صفحةً صفحة (٢٢٥–٥٨٤)','sourceType':'other',
                 'sourceReference':f'qiraat_records.jsonl، {record_id}','sourceText':row['raw_text'],
                 'verificationNotes':'قوبل تعيين الرواة على المصدر المعالج مع مرجع مستقل للقراءات العشر.'},
                {'id':f's-{record_id}-EXT','variantId':v['id'],
                 'sourceName':'مصدر مستقل في القراءات العشر','sourceType':'website',
                 'sourceReference':url,'sourceText':external_text,
                 'verificationNotes':'مرجع مستقل يثبت الوجه ومجموعة القراء.'}]
            v['evidence']=[{'source':'مصدر مستقل في القراءات العشر','text':external_text,'url':url}]
    if page in (273,274):
        candidates=[
            (273,58,'وَهُوَ','وَهْوَ','DOCX-P273-R00712',
             'https://books.rafed.net/view/3090/page/174',
             'Al-Ithaf documents sukūn of the hāʾ in huwa/hiyya after wāw or fāʾ for Qalun, Abu Amr, al-Kisai, and Abu Jaafar.',
             (16,58,8,8),'HARAKAH',{'Q01-R01','Q03-R01','Q03-R02','Q07-R01','Q07-R02','Q08-R01','Q08-R02'}),
            (273,60,'وَهُوَ','وَهْوَ','DOCX-P273-R00712',
             'https://books.rafed.net/view/3090/page/174',
             'Al-Ithaf documents sukūn of the hāʾ in huwa/hiyya after wāw or fāʾ for Qalun, Abu Amr, al-Kisai, and Abu Jaafar.',
             (16,60,10,10),'HARAKAH',{'Q01-R01','Q03-R01','Q03-R02','Q07-R01','Q07-R02','Q08-R01','Q08-R02'}),
            (273,63,'فَهُوَ','فَهْوَ','DOCX-P273-R00712',
             'https://jamharah.net/showthread.php?t=27567',
             'At an-Nahl 16:63, Abu Amr, al-Kisai, Abu Jaafar, and Qalun read فَهْوَ with a silent hāʾ; the rest read with ḍamma.',
             (16,63,12,12),'HARAKAH',{'Q01-R01','Q03-R01','Q03-R02','Q07-R01','Q07-R02','Q08-R01','Q08-R02'}),
            (273,62,'مُّفْرَطُونَ','مُفْرِطُونَ','DOCX-P273-R00714',
             'https://quranpedia.net/tafsir/an-nahl/62',
             'Quranpedia records Nafiʿ reading مُفْرِطُونَ with kasra on rāʾ and no gemination at an-Nahl 16:62.',
             (16,62,17,17),'HARAKAH',{'Q01-R01','Q01-R02'}),
            (273,62,'مُّفْرَطُونَ','مُفَرِّطُونَ','DOCX-P273-R00715',
             'https://quranpedia.net/tafsir/an-nahl/62',
             'Quranpedia records Abu Jaafar reading مُفَرِّطُونَ with kasra on rāʾ and gemination at an-Nahl 16:62.',
             (16,62,17,17),'LETTER',{'Q08-R01','Q08-R02'}),
            (274,66,'نُّسْقِيكُم','نَسْقِيكُمْ','DOCX-P274-R00726',
             'https://www.nquran.com/ar/index.php?ayano=66&group=tb1&sorano=16&tpath=2',
             'The accepted ten-reading collation assigns نَسْقِيكُمْ to Nafi, Ibn Amir, Shuʿbah, and Yaqub at an-Nahl 16:66.',
             (16,66,6,6),'HARAKAH',{'Q01-R01','Q01-R02','Q04-R01','Q04-R02','Q05-R01','Q09-R01','Q09-R02'}),
            (274,66,'نُّسْقِيكُم','تَسْقِيكُمْ','DOCX-P274-R00727',
             'https://www.nquran.com/ar/index.php?ayano=66&group=tb1&sorano=16&tpath=2',
             'The accepted ten-reading collation assigns تَسْقِيكُمْ to Abu Jaafar at an-Nahl 16:66.',
             (16,66,6,6),'LETTER',{'Q08-R01','Q08-R02'}),
            (274,68,'يَعْرِشُونَ','يَعْرُشُونَ','DOCX-P274-R00729',
             'https://www.nquran.com/ar/index.php?ayano=68&group=tb1&sorano=16&tpath=2',
             'At an-Nahl 16:68 Ibn Amir and Shuʿbah read يَعْرُشُونَ with ḍamma on rāʾ.',
             (16,68,13,13),'HARAKAH',{'Q04-R01','Q04-R02','Q05-R01'}),
        ]
        for p,ayah,anchor,alternate,record_id,url,external_text,expected,dtype,expected_readers in candidates:
            if p!=page: continue
            row=PACKAGE_RECORDS.get(record_id)
            if (row is None or row.get('page_no')!=page or row.get('section')!='farsh' or
                row.get('attribution_mode') not in ('explicit','remainder') or not row.get('raw_text') or
                is_neg(row['raw_text']) or is_univ(row['raw_text']) or has_bare_ambiguous_reader(row['raw_text'])):
                raise ValueError(f'page {page} audited {ayah} processed-package row failed source/safety check')
            if record_id=='DOCX-P273-R00712':
                named_clause=row['raw_text'].split('؛',1)[0].split(':',1)[1]
                named_clause=(named_clause.replace('بإسكان الهاء ل','').replace('أبي عمرو','أبو عمرو')
                              .replace('أبي جعفر','أبو جعفر').replace('وأبو','أبو').replace('وال','ال'))
                named=set()
                for name in re.split(r'[،,]',named_clause):
                    name=name.strip()
                    resolved,unresolved=resolve_readers(name,set())
                    if unresolved or not resolved:
                        raise ValueError(f'page {page} audited hāʾ source name failed to resolve: {name}')
                    named.update(resolved)
            else:
                names=[m['raw'] for m in row.get('authority_mentions',[]) if m.get('resolution')=='exact']
                names=[x.replace('أبي جعفر','أبو جعفر').replace('أبي عمرو','أبو عمرو') for x in names]
                named=set()
                for name in names:
                    resolved,unresolved=resolve_readers(name,set())
                    if unresolved or not resolved:
                        raise ValueError(f'page {page} audited {ayah} packaged reader failed to resolve: {name}')
                    named.update(resolved)
            if named!=expected_readers:
                raise ValueError(f'page {page} audited {ayah} explicit source readers changed')
            loc=T.find(page,anchor,ayah=ayah)
            if (loc['surah'],loc['startAyah'],loc['startWord'],loc['endWord'])!=expected:
                raise ValueError(f'page {page} audited {ayah} exact token/span changed')
            before=len(variants)
            yield_block(page,anchor,[(None,'وجه حفص المطابق لرسم المصحف',set(ALL20)-named),
                                     (alternate,row['raw_text'],named)],variants,ayah=ayah)
            added=[x for x in variants[before:] if
                (x.get('surah'),x.get('ayah'),x.get('startToken'),x.get('endToken')) ==
                (loc['surah'],ayah,loc['startWord'],loc['endWord'])]
            if len(added)!=1:
                raise ValueError(f'page {page} audited {ayah} sourced variant could not be constructed')
            v=added[0]
            digest=hashlib.sha1((T.norm(alternate)+'|'+','.join(sorted(named))).encode()).hexdigest()[:8]
            lid=f'AUDIT-P{page}-{loc["surah"]}-{ayah}-{loc["startWord"]}-{digest}'
            v['id']=f'v-{lid}';v['locusId']=lid;v['differenceType']=dtype
            v['description']=row['raw_text'];v['sources']=[
                {'id':f's-{record_id}','variantId':v['id'],
                 'sourceName':'استخراج القراءات العشر صفحةً صفحة (٢٢٥–٥٨٤)','sourceType':'other',
                 'sourceReference':f'qiraat_records.jsonl، {record_id}','sourceText':row['raw_text'],
                 'verificationNotes':'طوبق الوجه والرواة مع مصدر مستقل للقراءات العشر ورمز المصحف.'},
                {'id':f's-{record_id}-EXT','variantId':v['id'],
                 'sourceName':'مصدر مستقل في القراءات العشر','sourceType':'website',
                 'sourceReference':url,'sourceText':external_text,
                 'verificationNotes':'مرجع مستقل يثبت الوجه ومجموعة القراء.'}]
            v['evidence']=[{'source':'مصدر مستقل في القراءات العشر','text':external_text,'url':url}]
    if page == 275:
        p275_candidates=[
            (75,'فَهُوَ',1,'فَهْوَ','DOCX-P275-R00736','HARAKAH',
             {'Q01-R01','Q03-R01','Q03-R02','Q07-R01','Q07-R02','Q08-R01','Q08-R02'},
             'https://rsbcrsc.net/journals/issue/eyJpdiI6InBRNFFVeFFVTlhJZ29xOUErMGo0NGc9PSIsInZhbHVlIjoiUFE3ajhmdkVJUXAvZkdVcHRoMVJiUT09IiwibWFjIjoiYmEwZDEzY2I0MGJiNWE2NGM5NzczY2E5OTY1YWEyZjhkMGY3ZWZlZjAyM2RlNmRhMWUzZTI5YWI2NmViNjI0OCJ9/download',
             'A Qiraat study documents sukūn of the hāʾ in huwa/hiyya when preceded by wāw, fāʾ, or lām, and names Qalun, Abu Amr, al-Kisai, and Abu Jaafar.'),
            (76,'وَهُوَ',1,'وَهْوَ','DOCX-P275-R00736','HARAKAH',
             {'Q01-R01','Q03-R01','Q03-R02','Q07-R01','Q07-R02','Q08-R01','Q08-R02'},
             'https://rsbcrsc.net/journals/issue/eyJpdiI6InBRNFFVeFFVTlhJZ29xOUErMGo0NGc9PSIsInZhbHVlIjoiUFE3ajhmdkVJUXAvZkdVcHRoMVJiUT09IiwibWFjIjoiYmEwZDEzY2I0MGJiNWE2NGM5NzczY2E5OTY1YWEyZjhkMGY3ZWZlZjAyM2RlNmRhMWUzZTI5YWI2NmViNjI0OCJ9/download',
             'A Qiraat study documents sukūn of the hāʾ in huwa/hiyya when preceded by wāw, fāʾ, or lām, and names Qalun, Abu Amr, al-Kisai, and Abu Jaafar.'),
            (76,'وَهُوَ',2,'وَهْوَ','DOCX-P275-R00736','HARAKAH',
             {'Q01-R01','Q03-R01','Q03-R02','Q07-R01','Q07-R02','Q08-R01','Q08-R02'},
             'https://rsbcrsc.net/journals/issue/eyJpdiI6InBRNFFVeFFVTlhJZ29xOUErMGo0NGc9PSIsInZhbHVlIjoiUFE3ajhmdkVJUXAvZkdVcHRoMVJiUT09IiwibWFjIjoiYmEwZDEzY2I0MGJiNWE2NGM5NzczY2E5OTY1YWEyZjhkMGY3ZWZlZjAyM2RlNmRhMWUzZTI5YWI2NmViNjI0OCJ9/download',
             'A Qiraat study documents sukūn of the hāʾ in huwa/hiyya when preceded by wāw, fāʾ, or lām, and names Qalun, Abu Amr, al-Kisai, and Abu Jaafar.'),
            (76,'صِرَٰطٍ',1,'سِرَٰطٍۢ','DOCX-P275-R00737','LETTER',
             {'Q02-R02','Q09-R01'},'https://jamharah.net/showthread.php?t=27567',
             'The ten-reading collation records sīn for Qanbal and Ruways; the separately named Hamza transmission is an ishmaam performance face.'),
            (76,'صِرَٰطٍ',1,'صِرَٰطٍۢ','DOCX-P275-R00737','LETTER',
             {'Q06-R01'},'https://jamharah.net/showthread.php?t=27567',
             'Khalaf from Hamza has ishmaam of ṣād toward zāy; the base text is retained and the sound-only face is recorded as a performance note.'),
            (78,'أُمَّهَاتِكُمْ',1,'إِمِّهَاتِكُم','DOCX-P275-R00739','HARAKAH',
             {'Q06-R01','Q06-R02'},'https://quranpedia.net/book/436/1/243',
             'Al-Wafi states Hamza reads the hamza and mīm of إمهاتكم with kasrah in waṣl.'),
            (78,'أُمَّهَاتِكُمْ',1,'إِمَّهَاتِكُم','DOCX-P275-R00740','HARAKAH',
             {'Q07-R01','Q07-R02'},'https://quranpedia.net/book/436/1/243',
             'Al-Wafi states al-Kisai reads إمهاتكم with kasrah on the hamza and fatḥah on the mīm in waṣl.'),
            (79,'يَرَوْا',1,'تَرَوْا','DOCX-P275-R00741','LETTER',
             {'Q04-R01','Q04-R02','Q06-R01','Q06-R02','Q09-R01','Q09-R02','Q10-R01','Q10-R02'},
             'https://jamharah.net/showthread.php?t=27567',
             'At an-Nahl 16:79, Ibn Amir, Hamza, Yaqub, and Khalaf al-Ashir read with tāʾ of address; the other readings use yāʾ of absence.'),
        ]
        expected_lines={
            'DOCX-P275-R00736':'﴿فَهُوَ﴾، ﴿وَهُوَ﴾ (معاً): بإسكان الهاء لقالون، وأبي عمرو، والكسائي، وأبي جعفر؛ وبالفتح للباقين.',
            'DOCX-P275-R00737':'﴿صِرَٰطٍ﴾: بالصاد للجمهور؛ بالسين لقنبل ورويس؛ بإشمام الصاد زياً لخلف عن حمزة.',
            'DOCX-P275-R00741':'﴿يَرَوْاْ﴾: بياء الغيب لنافع، وابن كثير، وأبي عمرو، وعاصم، والكسائي، وأبي جعفر؛ وبتاء الخطاب ﴿تَرَوْا﴾ للباقين.',
        }
        rows={}
        for rid,expected_line in expected_lines.items():
            row=PACKAGE_RECORDS.get(rid)
            if (row is None or row.get('page_no')!=275 or row.get('section')!='farsh' or
                row.get('raw_text')!=expected_line or is_neg(expected_line) or is_univ(expected_line) or
                has_bare_ambiguous_reader(expected_line)):
                raise ValueError(f'page 275 audited source row failed exact source/safety check: {rid}')
            rows[rid]=row
        for rid in ('DOCX-P275-R00739','DOCX-P275-R00740'):
            row=PACKAGE_RECORDS.get(rid)
            if row is None or row.get('page_no')!=275 or row.get('section')!='farsh' or is_neg(row['raw_text']) or is_univ(row['raw_text']) or has_bare_ambiguous_reader(row['raw_text']):
                raise ValueError(f'page 275 explicit Ummahat source row failed safety check: {rid}')
            rows[rid]=row
        for ayah,anchor,occurrence,alternate,rid,dtype,reader_ids,url,external_text in p275_candidates:
            row=rows[rid]
            if rid=='DOCX-P275-R00736':
                named_clause=row['raw_text'].split(':',1)[1].split('؛',1)[0]
                named_clause=(named_clause.replace('بإسكان الهاء ل','').replace('أبي عمرو','أبو عمرو')
                              .replace('أبي جعفر','أبو جعفر').replace('وأبو','أبو').replace('وال','ال'))
                actual=set()
                for name in re.split(r'[،,]',named_clause):
                    name=name.strip();resolved,unresolved=resolve_readers(name,set())
                    if unresolved or not resolved: raise ValueError(f'p275 hāʾ reader unresolved: {name}')
                    actual.update(resolved)
                expected={'Q01-R01','Q03-R01','Q03-R02','Q07-R01','Q07-R02','Q08-R01','Q08-R02'}
                if actual!=expected: raise ValueError('p275 hāʾ named reader group changed')
            elif rid=='DOCX-P275-R00737':
                if 'خلف عن حمزة' not in row['raw_text']: raise ValueError('p275 ṣirāt Hamza attribution changed')
            elif rid=='DOCX-P275-R00739':
                expected='بكسر الهمزة والميم ﴿إِمِّهَاتِكُم﴾: حمزة.'
                if row['raw_text']!=expected: raise ValueError('p275 Hamza ummahat row changed')
            elif rid=='DOCX-P275-R00740':
                expected='بكسر الهمزة وفتح الميم ﴿إِمَّهَاتِكُم﴾: الكسائي. (وعند الابتداء يتفق الجميع على ضم الهمزة وفتح الميم).'
                if row['raw_text']!=expected: raise ValueError('p275 Kisai ummahat row changed')
            elif rid=='DOCX-P275-R00741':
                named=set()
                for name in ('نافع','ابن كثير','أبو عمرو','عاصم','الكسائي','أبو جعفر'):
                    resolved,unresolved=resolve_readers(name,set())
                    if unresolved: raise ValueError(f'p275 yaraw explicit reader unresolved: {name}')
                    named.update(resolved)
                if set(ALL20)-named != reader_ids: raise ValueError('p275 yaraw remainder group changed')
            loc=T.find(page,anchor,occurrence=occurrence,ayah=ayah)
            if loc['surah']!=16: raise ValueError('p275 audited anchor resolved outside an-Nahl')
            if rid=='DOCX-P275-R00739': reader_ids={'Q06-R01','Q06-R02'}
            if rid=='DOCX-P275-R00740': reader_ids={'Q07-R01','Q07-R02'}
            if rid=='DOCX-P275-R00737' and dtype=='LETTER' and alternate=='سِرَٰطٍۢ':
                # The source names exactly Qanbal and Ruways for the written sīn form.
                if reader_ids!={'Q02-R02','Q09-R01'}: raise ValueError('p275 sīn reader group changed')
            if rid=='DOCX-P275-R00741' and reader_ids!={'Q04-R01','Q04-R02','Q06-R01','Q06-R02','Q09-R01','Q09-R02','Q10-R01','Q10-R02'}:
                raise ValueError('p275 خطاب readers changed')
            if rid=='DOCX-P275-R00737' and alternate==loc['baseText'] and reader_ids!={'Q06-R01'}:
                raise ValueError('p275 ishmaam should be Khalaf from Hamza only')
            if rid=='DOCX-P275-R00737' and alternate!=loc['baseText'] and alternate!='سِرَٰطٍۢ' and reader_ids!={'Q06-R01'}:
                raise ValueError('p275 sound-only ṣirāt face reader changed')
            overlap=set(reader_ids)
            for old in existing_page+variants:
                if (old.get('surah'),old.get('ayah'),old.get('startToken'))==(16,ayah,loc['startWord']):
                    old_readers=set(old.get('readingIds',[]))
                    if old_readers & overlap:
                        if (old.get('variantText')==alternate and old_readers==overlap): break
                        raise ValueError(f'p275 same-token reader conflict at {ayah}:{loc["startWord"]}')
            else:
                pass
            if any((x.get('surah'),x.get('ayah'),x.get('startToken'),x.get('variantText'),set(x.get('readingIds',[])))==(16,ayah,loc['startWord'],alternate,reader_ids) for x in existing_page+variants): continue
            digest=hashlib.sha1((T.norm(alternate)+'|'+','.join(sorted(reader_ids))).encode()).hexdigest()[:8]
            lid=f'AUDIT-P275-16-{ayah}-{loc["startWord"]}-{digest}'
            performance=alternate==loc['baseText']
            variant={'id':f'v-{lid}','surah':16,'ayah':ayah,'startToken':loc['startWord'],'endToken':loc['endWord'],
                'operation':'REPLACE','hafsText':loc['baseText'],'variantText':alternate,'differenceType':dtype,
                'verificationStatus':'REVIEWED','createdAt':TS,'updatedAt':TS,'readingIds':sorted(reader_ids),
                'locusId':lid,'locusType':'performance_variant' if performance else 'word_variant',
                'sources':[{'id':f's-{rid}','variantId':f'v-{lid}','sourceName':'استخراج القراءات العشر صفحةً صفحة (٢٢٥–٥٨٤)',
                    'sourceType':'other','sourceReference':f'qiraat_records.jsonl، {rid}','sourceText':row['raw_text'],
                    'verificationNotes':'طوبق الوجه والرواة مع مرجع مستقل ورمز المصحف.'},
                    {'id':f's-{rid}-EXT-{digest}','variantId':f'v-{lid}','sourceName':'مرجع مستقل في القراءات العشر',
                    'sourceType':'website','sourceReference':url,'sourceText':external_text,
                    'verificationNotes':'مرجع مستقل يثبت الوجه ومجموعة القراء.'}],
                'description':row['raw_text'],'wajhIndex':2,
                'evidence':[{'source':'مرجع مستقل في القراءات العشر','text':external_text,'url':url}]}
            if performance: variant['performanceNote']='إشمام الصاد زايًا'
            variants.append(variant)
    if page == 253:
        source_line = '﴿قُرْءَانًا﴾: بنقل حركة الهمزة إلى الراء وحذف الهمزة ﴿قُرَانًا﴾ لابن كثير.'
        if [line.strip() for line in lines if line.strip() == source_line] != [source_line]:
            raise ValueError('page 253 audited Quranan source row missing/not unique')
        require_packaged_source(page, source_line)
        if is_neg(source_line) or is_univ(source_line):
            raise ValueError('page 253 audited Quranan source row failed negation/universal guard')
        loc=T.find(page,'قُرْءَانًا',ayah=31)
        if (loc['surah'],loc['startAyah'],loc['startWord'],loc['endWord'],loc['baseText']) != (
            13,31,3,3,'قُرْءَانًۭا'):
            raise ValueError('page 253 exact Quranan token/span/base changed')
        readers,unresolved=resolve_readers('ابن كثير',set())
        if unresolved or readers!={'Q02-R01','Q02-R02'}:
            raise ValueError('page 253 explicit Ibn Kathir group did not resolve exactly')
        existing_matches=[x for x in existing_page if
            (x.get('surah'),x.get('ayah'),x.get('startToken'),x.get('endToken'))==(13,31,3,3)]
        if existing_matches:
            # A previous --write may already have added this audited record. Treat that
            # exact record as an idempotent rerun; refuse any other occupied token.
            if len(existing_matches) == 1:
                prior = existing_matches[0]
                if (prior.get('id') == 'v-AUDIT-P253-13-31-QURAAN' and
                    prior.get('hafsText') == loc['baseText'] and
                    prior.get('variantText') == 'قُرَانًا' and
                    set(prior.get('readingIds', [])) == readers):
                    return variants, source_links_added
            raise ValueError('page 253 Quranan token already has a different variant; additive-only import refused')
        before=len(variants)
        yield_block(page,'قُرْءَانًا',[(None,'وجه حفص المطابق لرسم المصحف',set(ALL20)-readers),
            ('قُرَانًا','بنقل حركة الهمزة إلى الراء وحذف الهمزة لابن كثير',readers)],variants)
        added=[x for x in variants[before:] if
            (x.get('surah'),x.get('ayah'),x.get('startToken'),x.get('endToken'))==(13,31,3,3)]
        if len(added)!=1:
            raise ValueError('page 253 audited Quranan 20-reading partition failed')
        variant=added[0]
        variant['id']='v-AUDIT-P253-13-31-QURAAN'
        variant['locusId']='AUDIT-P253-13-31-QURAAN'
        for i,source in enumerate(variant.get('sources',[]),1):
            source['id']=f's-AUDIT-P253-13-31-QURAAN-{i}'
            source['variantId']=variant['id']
        variant['sources'][0].update({
            'sourceReference':'qiraat_records.jsonl، DOCX-P253-R00461',
            'sourceText':source_line,
            'verificationNotes':'قوبل النص ومجموعة ابن كثير بالمرجع المستقل، وثبت أساس حفص حرفياً من رمز الصفحة.'})
        url='https://quranpedia.net/book-attachment/20982/78954'
        external_text='نقل حركة الهمزة إلى الراء وأسقط الهمزة ابن كثير؛ القراءة: قُرَاناً.'
        variant['sources'].append({'id':'s-QAMAR-AL-MUNIR-P253-13-31','variantId':variant['id'],
            'sourceName':'القمر المنير في قراءة الإمام المكي عبد الله بن كثير','sourceType':'printed-book',
            'sourceReference':url,'sourceText':external_text,
            'verificationNotes':'مرجع مستقل خاص بقراءة ابن كثير يثبت نقل حركة الهمزة إلى الراء وإسقاطها في الآية 31.'})
        variant['evidence']=[{'source':'القمر المنير في قراءة الإمام المكي عبد الله بن كثير',
            'text':external_text,'url':url}]
    if page == 252:
        source_line = '﴿عَلَيْهِم﴾: بضم الهاء لحمزة ويعقوب؛ وبكسرها للباقين.'
        if [line.strip() for line in lines if line.strip() == source_line] != [source_line]:
            raise ValueError('page 252 audited عليهم source row missing/not unique')
        if is_neg(source_line) or is_univ(source_line):
            raise ValueError('page 252 audited عليهم source row failed negation/universal guard')
        loc = T.find(page, 'عَلَيْهِم', ayah=23)
        if (loc['surah'], loc['startAyah'], loc['startWord'], loc['endWord'], loc['baseText']) != (
            13, 23, 12, 12, 'عَلَيْهِم'):
            raise ValueError('page 252 exact عليهم token/span/base changed')
        readers, unresolved = resolve_readers('حمزة، يعقوب', set())
        expected = {'Q06-R01','Q06-R02','Q09-R01','Q09-R02'}
        if unresolved or readers != expected:
            raise ValueError('page 252 explicit Hamza/Yaqub group did not resolve exactly')
        before = len(variants)
        yield_block(page, 'عَلَيْهِم', [
            (None, 'وجه حفص المطابق لرسم المصحف', set(ALL20)-readers),
            ('عَلَيْهُم', 'بضم الهاء لحمزة ويعقوب', readers),
        ], variants)
        added = [v for v in variants[before:] if
            (v.get('surah'),v.get('ayah'),v.get('startToken'),v.get('endToken')) ==
            (13,23,12,12)]
        if len(added) != 1:
            raise ValueError('page 252 audited عليهم variant partition failed')
        variant = added[0]
        variant['id'] = 'v-AUDIT-P252-13-23-ALAYHIM'
        variant['locusId'] = 'AUDIT-P252-13-23-ALAYHIM'
        for i, source in enumerate(variant.get('sources', []), 1):
            source['id'] = f's-AUDIT-P252-13-23-ALAYHIM-{i}'
            source['variantId'] = variant['id']
        variant['sources'][0].update({
            'sourceReference': 'qiraat_records_pages_245_584.jsonl، DOCX-P252-R00451',
            'sourceText': source_line,
            'verificationNotes': 'ثبت نص حفص حرفياً من رمز الصفحة، وقوبلت مجموعة حمزة ويعقوب بالمرجع المستقل.',
        })
        url = 'https://quranpedia.net/ayahs/13/23/4'
        external_text = 'عَلَيْهِمْ بضم الهاء وإسكان الميم: خلاد عن حمزة، روح عن يعقوب، رويس عن يعقوب.'
        variant['sources'].append({
            'id': 's-QURANPEDIA-P252-13-23-ALAYHIM', 'variantId': variant['id'],
            'sourceName': 'موسوعة القراءات، الرعد 13:23', 'sourceType': 'reference',
            'sourceReference': url, 'sourceText': external_text,
            'verificationNotes': 'المرجع يؤيد صورة الضم ومجموعة حمزة ويعقوب؛ أُبقيت نسبة القراءة وفق الروايات الصريحة في المصدر.',
        })
        variant['evidence'] = [{'source': 'موسوعة القراءات، الرعد 13:23', 'text': external_text, 'url': url}]
    if page in (250,251):
        cases=[
            {
                'ayah':6,'anchor':'قَبْلِهِمُ','alternate':'قَبْلِهِمِ',
                'sourceLine':'بكسر الهاء والميم وصلاً ﴿قَبْلِهِمِ الْمَثُلَاتُ﴾: أبو عمرو، يعقوب.',
                'resolverText':'أبو عمرو، يعقوب','readers':{'Q03-R01','Q03-R02','Q09-R01','Q09-R02'},
                'externalText':'كسر الهاء والميم وصلاً في «قبلهم المثلات» أبو عمرو ويعقوب.',
                'suffix':'P250-13-6',
            }
        ] if page==250 else [
            {
                'ayah':18,'anchor':'لِرَبِّهِمُ','alternate':'لِرَبِّهِمِ',
                'sourceLine':'بكسر الهاء والميم وصلاً: أبو عمرو، يعقوب.',
                'resolverText':'أبو عمرو، يعقوب','readers':{'Q03-R01','Q03-R02','Q09-R01','Q09-R02'},
                'externalText':'ومثلها «لربهم الحسنى» في كسر الهاء والميم وصلاً لأبي عمرو ويعقوب.',
                'suffix':'P251-13-18',
            }
        ]
        for case in cases:
            if case['sourceLine'] not in {line.strip() for line in lines} or is_neg(case['sourceLine']) or is_univ(case['sourceLine']):
                raise ValueError(f"page {page} audited meem source row missing/unsafe")
            loc=T.find(page,case['anchor'],ayah=case['ayah'])
            if (loc['surah'],loc['startAyah'],loc['baseText']) != (13,case['ayah'],case['anchor']):
                raise ValueError(f"page {page} audited meem token/base changed")
            resolved,unresolved=resolve_readers(case['resolverText'],set())
            if unresolved or resolved!=case['readers']:
                raise ValueError(f"page {page} audited meem reader group changed")
            before=len(variants)
            yield_block(page,case['anchor'],[(None,'وجه حفص المطابق لرسم المصحف',set(ALL20)-case['readers']),
                (case['alternate'],'بكسر الميم وصلاً',case['readers'])],variants)
            added=[v for v in variants[before:] if v.get('surah')==13 and v.get('ayah')==case['ayah'] and v.get('startToken')==loc['startWord']]
            if len(added)!=1:
                raise ValueError(f"page {page} audited meem variant partition failed")
            variant=added[0];variant['id']=f"v-AUDIT-{case['suffix']}";variant['locusId']=f"AUDIT-{case['suffix']}"
            for i,src in enumerate(variant.get('sources',[]),1):
                src['id']=f"s-AUDIT-{case['suffix']}-{i}"
                src['variantId']=variant['id']
            if variant.get('sources'):
                variant['sources'][0].update({'sourceReference':f'وثيقة استخراج القراءات العشر، صفحة المصحف {page}، الكلمات الفرشية',
                    'sourceText':case['sourceLine'],'verificationNotes':'قوبلت مجموعة أبي عمرو ويعقوب المنصوص عليها بالمرجع المستقل، وثبت نص حفص من رمز الصفحة.'})
            url='https://jamharah.net/showthread.php?p=176127'
            variant['sources'].append({'id':f"s-ITHAF-{case['suffix']}",'variantId':variant['id'],
                'sourceName':'إتحاف فضلاء البشر وغيث النفع، نقلاً في جمهرة العلوم','sourceType':'printed-book',
                'sourceReference':url,'sourceText':case['externalText'],
                'verificationNotes':'المرجع يثبت كسر ميم الجمع وصلاً لأبي عمرو ويعقوب؛ اقتصر الاستيراد على المجموعة الصريحة الخالية من الإبهام.'})
            variant['evidence']=[{'source':'إتحاف فضلاء البشر وغيث النفع، نقلاً في جمهرة العلوم','text':case['externalText'],'url':url}]
    if page == 248:
        # The printed table gives two different non-Hafs spellings at the same token.
        # Keep both only after checking their explicitly named groups independently.
        cases = [
            {
                'ayah': 105, 'anchor': 'وَكَأَيِّن', 'alternate': 'وَكَائِن',
                'description': 'بالمد والتحقيق لابن كثير', 'resolverText': 'ابن كثير',
                'readers': {'Q02-R01','Q02-R02'}, 'suffix': 'IBNKATHIR',
                'sourceLine': 'بألف بعد الكاف وبعدها همزة مكسورة ممدودة مداً متصلاً ﴿وَكَائِن﴾: ابن كثير.',
                'externalText': 'قرأ ابن كثير وكائن بالمد والهمز، وأبو جعفر بالتسهيل، والباقون وكأين.',
                'externalUrl': 'https://quranpedia.net/book-attachment/19843/93433',
            },
            {
                'ayah': 105, 'anchor': 'وَكَأَيِّن', 'alternate': 'وَكَايِن',
                'description': 'بتسهيل الهمزة مع المد والقصر لأبي جعفر', 'resolverText': 'أبو جعفر',
                'readers': {'Q08-R01','Q08-R02'}, 'suffix': 'ABUJAAFAR',
                'sourceLine': 'بتسهيل الهمزة مع المد والقصر ﴿وَكَايِن﴾: أبو جعفر.',
                'externalText': 'قرأ ابن كثير وكائن بالمد والهمز، وأبو جعفر بالتسهيل، والباقون وكأين.',
                'externalUrl': 'https://quranpedia.net/book-attachment/19843/93433',
            },
            {
                'ayah': 109, 'anchor': 'تَعْقِلُونَ', 'alternate': 'يَعْقِلُونَ',
                'description': 'بياء الغيب لمن عدا المذكورين في خطاب التاء',
                'resolverText': 'نافع، ابن عامر، عاصم، أبو جعفر، يعقوب',
                'readers': {'Q02-R01','Q02-R02','Q03-R01','Q03-R02','Q06-R01','Q06-R02','Q07-R01','Q07-R02'},
                'suffix': 'GHAIB',
                'sourceLine': '﴿تَعْقِلُونَ﴾: بتاء الخطاب لنافع، ابن عامر، عاصم، أبو جعفر، يعقوب؛ وبياء الغيب ﴿يَعْقِلُونَ﴾ للباقين.',
                'externalText': 'وفي يعقلون بالتاء نافع وابن عامر وعاصم وأبو جعفر ويعقوب، والباقون بالياء.',
                'externalUrl': 'https://ar.wikisource.org/wiki/النشر_في_القراءات_العشر/الجزء_الثاني',
            },
        ]
        source_set={line.strip() for line in lines}
        for case in cases:
            if case['sourceLine'] not in source_set or is_neg(case['sourceLine']) or is_univ(case['sourceLine']):
                raise ValueError(f"page 248 audited source row missing/unsafe: {case['anchor']}")
            loc=T.find(page,case['anchor'],ayah=case['ayah'])
            if loc['surah'] != 12 or loc['startAyah'] != case['ayah'] or loc['endAyah'] != case['ayah']:
                raise ValueError(f"page 248 audited token coordinates changed: {case['anchor']}")
            resolved,unresolved=resolve_readers(case['resolverText'],set())
            if case['suffix']=='GHAIB': resolved=set(ALL20)-resolved
            if unresolved or resolved != case['readers']:
                raise ValueError(f"page 248 audited reader group changed: {case['anchor']}")
            before=len(variants)
            yield_block(page,case['anchor'],[
                (None,'وجه حفص المطابق لرسم المصحف',set(ALL20)-case['readers']),
                (case['alternate'],case['description'],case['readers']),
            ],variants)
            added=[v for v in variants[before:] if v.get('surah')==12 and v.get('ayah')==case['ayah'] and
                   v.get('startToken')==loc['startWord']]
            if len(added)!=1:
                raise ValueError(f"page 248 audited variant partition failed: {case['anchor']} {case['suffix']}")
            variant=added[0]
            variant['id']=f"v-AUDIT-P248-{case['ayah']}-{case['suffix']}"
            variant['locusId']=f"AUDIT-P248-{case['ayah']}"
            for i,src in enumerate(variant.get('sources',[]),1):
                src['id']=f"s-AUDIT-P248-{case['ayah']}-{case['suffix']}-{i}"
                src['variantId']=variant['id']
            if variant.get('sources'):
                variant['sources'][0].update({
                    'sourceReference':'وثيقة استخراج القراءات العشر، صفحة المصحف 248، الكلمات الفرشية',
                    'sourceText':case['sourceLine'],
                    'verificationNotes':'قوبل نص المصدر ومجموعة القراء الصريحة بمرجع مستقل، وثبت نص حفص حرفياً من رمز الصفحة.',
                })
            url=case['externalUrl']
            variant.setdefault('sources',[]).append({
                'id':f"s-AL-BUDUR-P248-{case['ayah']}-{case['suffix']}",'variantId':variant['id'],
                'sourceName':'البدور الزاهرة في القراءات العشر المتواترة','sourceType':'printed-book',
                'sourceReference':url,'sourceText':case['externalText'],
                'verificationNotes':'مرجع مستقل يثبت اختلاف صورة القراءة وتعيين القارئ.',
            })
            variant['evidence']=[{'source':'البدور الزاهرة في القراءات العشر المتواترة','text':case['externalText'],'url':url}]
    if page == 249:
        # The explicit source says «للباقين» after naming all light readers. Add only Yaqub
        # to the pre-existing tashdid form; do not recreate the variant or alter its base.
        source_line='﴿يُغْشِي﴾: بالتخفيف لنافع، ابن كثير، أبو عمرو، ابن عامر، حفص، أبو جعفر؛ وبالتشديد ﴿يُغَشِّي﴾ للباقين.'
        if source_line not in {line.strip() for line in lines}:
            raise ValueError('page 249 audited yughshi source row missing')
        loc=T.find(page,'يُغْشِي',ayah=3)
        if (loc['surah'],loc['startAyah'],loc['startWord'],loc['baseText']) != (13,3,16,'يُغْشِى'):
            raise ValueError('page 249 audited yughshi token changed')
        matches=[x for x in existing_page if (x.get('surah'),x.get('ayah'),x.get('startToken'),x.get('hafsText'),x.get('variantText'))==(13,3,16,'يُغْشِى','يُغَشِّي')]
        if len(matches)!=1:
            raise ValueError('page 249 expected pre-existing tashdid variant is not unique')
        target=matches[0]
        for rid in ('Q09-R01','Q09-R02'):
            if rid not in target['readingIds']: target['readingIds'].append(rid)
        target['readingIds'].sort()
        source_id='s-DOCX-P249-YUGHSHI-YAQUB'
        if not any(s.get('id')==source_id for s in target.get('sources',[])):
            target.setdefault('sources',[]).append({'id':source_id,'variantId':target['id'],**SRC,
                'sourceReference':'وثيقة استخراج القراءات العشر، صفحة المصحف 249، الكلمات الفرشية',
                'sourceText':source_line,
                'verificationNotes':'أضيف يعقوب فقط، لأنه داخل الباقين بعد تصريح المصدر بالتخفيف لغيره؛ وافق ذلك مرجع النشر المستقل.'})
            source_links_added+=1
        target.setdefault('evidence',[]).append({'source':'النشر في القراءات العشر، سورة الرعد 13:3؛ وبيان يغشي في الأعراف','text':'في قائمة القراء: التشديد لشعبة وحمزة والكسائي ويعقوب وخلف؛ والنشر يذكر التشديد للباقين بعد استثناء ابن كثير والبصريين وعاصم.','url':'https://quranpedia.net/tafsir/ar-rad/3'})
    if page == 247:
        audited = [
            {
                'anchor': 'يَـٰٓأَبَتِ', 'ayah': 100, 'alternate': 'يَـٰٓأَبَتَ',
                'description': 'بفتح التاء لابن عامر وأبي جعفر',
                'readers': {'Q04-R01','Q04-R02','Q08-R01','Q08-R02'},
                'sourceLine': '﴿يَـٰٓأَبَتِ﴾: بالكسر للجمهور؛ وبالفتح ﴿يَـٰٓأَبَتَ﴾ لابن عامر وأبي جعفر.',
                'resolverText': 'ابن عامر، أبو جعفر',
                'externalName': 'النشر في القراءات العشر',
                'externalUrl': 'https://www.islamweb.net/ar/library/content/70/241/',
                'externalText': 'قرأ بفتح التاء في ياأبت حيث جاء أبو جعفر وابن عامر، والباقون بكسر التاء.',
            },
            {
                'anchor': 'لَدَيْهِمْ', 'ayah': 102, 'alternate': 'لَدَيْهُمُ',
                'description': 'بضم الهاء لحمزة ويعقوب',
                'readers': {'Q06-R01','Q06-R02','Q09-R01','Q09-R02'},
                'sourceLine': '﴿لَدَيْهِمْ﴾: بكسر الهاء للجمهور؛ وبضمها ﴿لَدَيْهُمُ﴾ لحمزة ويعقوب.',
                'resolverText': 'حمزة، يعقوب',
                'externalName': 'إتحاف فضلاء البشر وغيث النفع، نقلاً في جمهرة العلوم',
                'externalUrl': 'https://jamharah.net/showthread.php?p=176022',
                'externalText': 'وضم هاء لديهم حمزة ويعقوب؛ وقراءة الباقين لديهم بكسر الهاء.',
            },
        ]
        for case in audited:
            source_line = case['sourceLine']
            matches = [line.strip() for line in lines if line.strip() == source_line]
            if len(matches) != 1 or is_neg(source_line) or is_univ(source_line):
                raise ValueError(f"page 247 audited farsh row missing/unsafe: {case['anchor']}")
            try:
                loc = T.find(page, case['anchor'], ayah=case['ayah'])
            except T.NoMatch as exc:
                raise ValueError(f"page 247 audited token missing: {case['anchor']}") from exc
            if (loc['surah'], loc['startAyah'], loc['endAyah'], loc['baseText']) != (
                12, case['ayah'], case['ayah'], case['anchor']):
                raise ValueError(f"page 247 audited token span/base changed: {case['anchor']}")
            try:
                resolved, unresolved = resolve_readers(case['resolverText'], set())
            except Unresolved as exc:
                raise ValueError(f"page 247 audited reader group unresolved: {case['anchor']}") from exc
            if unresolved or resolved != case['readers']:
                raise ValueError(f"page 247 audited reader group changed: {case['anchor']}")
            before = len(variants)
            yield_block(page, case['anchor'], [
                (None, 'وجه حفص المطابق لرسم المصحف', set(ALL20) - case['readers']),
                (case['alternate'], case['description'], case['readers']),
            ], variants)
            added = [v for v in variants[before:] if v.get('surah') == 12 and
                     v.get('ayah') == case['ayah'] and v.get('startToken') == loc['startWord']]
            if len(added) != 1:
                raise ValueError(f"page 247 audited variant partition failed: {case['anchor']}")
            variant = added[0]
            variant['sources'][0].update({
                'sourceReference': 'وثيقة الاستخراج المبوّب، صفحة المصحف 247، الكلمات الفرشية',
                'sourceText': source_line,
                'verificationNotes': 'المتغير ومجموعة القراء تأكدا بمقابلة مرجع مستقل؛ ثبتت الكلمة الأساس حرفياً من رمز الصفحة.',
            })
            variant['sources'].append({
                'id': f"s-AUDIT-P247-{case['ayah']}", 'variantId': variant['id'],
                'sourceName': case['externalName'], 'sourceType': 'printed-book',
                'sourceReference': case['externalUrl'], 'sourceText': case['externalText'],
                'verificationNotes': 'تحقق خارجي من صورة القراءة ومجموعة القراء الصريحة.',
            })
            variant['evidence'] = [{
                'source': case['externalName'], 'text': case['externalText'],
                'url': case['externalUrl'],
            }]
    if page == 456:
        # These two package-indexed source rows were checked against al-Nashr and exact
        # Mushaf tokens. Do not take the package's confidence flags as authority: its
        # 38:53 record is marked high-confidence despite the unresolved bare «خلف».
        audited = [
            {
                'anchor': 'عِبَـٰدَنَآ', 'ayah': 45, 'alternate': 'عَبْدَنَا',
                'description': 'بالمفرد لابن كثير',
                'resolverText': 'ابن كثير',
                'readers': {'Q02-R01','Q02-R02'},
                'sourceLine': '﴿عِبَـٰدَنَآ﴾ (آية ٤٥): بالجمع للجمهور؛ وبالمفرد ﴿عَبْدَنَا﴾ لابن كثير.',
                'externalText': 'قرأ ابن كثير عَبْدَنَا بغير ألف على التوحيد، وقرأ الباقون بالألف على الجمع.',
            },
            {
                'anchor': 'وَءَاخَرُ', 'ayah': 58, 'alternate': 'وَأُخَرُ',
                'description': 'بضم الهمزة من غير مد على الجمع لأبي عمرو ويعقوب',
                'resolverText': 'أبو عمرو، يعقوب',
                'readers': {'Q03-R01','Q03-R02','Q09-R01','Q09-R02'},
                'sourceLine': '﴿وَءَاخَرُ﴾: جمعاً وألف مدية بعد الهمزة ﴿وَءَاخَرُ﴾ للجمهور؛ وبضم الهمزة وقصرها بلا ألف مفرداً ﴿وَأُخَرُ﴾ لأبي عمرو ويعقوب.',
                'externalText': 'قرأ البصريان بضم الهمزة من غير مد على الجمع، وقرأ الباقون بفتح الهمزة وألف بعدها على التوحيد.',
            },
        ]
        for case in audited:
            source_line = case['sourceLine']
            matches = [line.strip() for line in lines if line.strip() == source_line]
            if len(matches) != 1 or is_neg(source_line) or is_univ(source_line):
                raise ValueError(f"page 456 audited farsh row missing/unsafe: {case['anchor']}")
            try:
                loc = T.find(page, case['anchor'], ayah=case['ayah'])
            except T.NoMatch as exc:
                raise ValueError(f"page 456 audited token missing: {case['anchor']}") from exc
            if (loc['surah'], loc['startAyah'], loc['endAyah'], loc['baseText']) != (
                38, case['ayah'], case['ayah'], case['anchor']):
                raise ValueError(f"page 456 audited token span/base changed: {case['anchor']}")
            resolved, unresolved = resolve_readers(case['resolverText'], set())
            if unresolved or resolved != case['readers']:
                raise ValueError(f"page 456 audited reader group changed: {case['anchor']}")
            before = len(variants)
            yield_block(page, case['anchor'], [
                (None, 'وجه حفص المطابق لرسم المصحف', set(ALL20) - case['readers']),
                (case['alternate'], case['description'], case['readers']),
            ], variants)
            added = [v for v in variants[before:] if v.get('surah') == 38 and
                     v.get('ayah') == case['ayah'] and v.get('startToken') == loc['startWord']]
            if len(added) != 1:
                raise ValueError(f"page 456 audited variant partition failed: {case['anchor']}")
            variant = added[0]
            if case['ayah'] == 45:
                variant['differenceType'] = 'LETTER'
            variant['sources'][0].update({
                'sourceReference': 'وثيقة استخراج القراءات العشر، صفحة المصحف 456، الكلمات الفرشية',
                'sourceText': source_line,
                'verificationNotes': 'قوبل النص الخام من حزمة الاستخراج بالمرجع المستقل، وثبتت الكلمة الأساس حرفياً من رمز الصفحة.',
            })
            reference = 'النشر في القراءات العشر، سورة ص، الآية ' + str(case['ayah'])
            url = 'https://islamweb.net/ar/library/content/70/267/'
            variant['sources'].append({
                'id': f"s-AL-NASHR-P456-{case['ayah']}", 'variantId': variant['id'],
                'sourceName': reference, 'sourceType': 'printed-book',
                'sourceReference': url, 'sourceText': case['externalText'],
                'verificationNotes': 'المرجع المستقل يؤكد صورة القراءة ومجموعة القراء.',
            })
            variant['evidence'] = [{
                'source': reference, 'text': case['externalText'], 'url': url,
            }]
            if case['ayah'] == 58:
                variant['sources'][0]['verificationNotes'] = (
                    'قوبل النص الخام من حزمة الاستخراج بالمرجع المستقل. حُفظ وصف المصدر كما طبع؛ '
                    'وصيغ الوصف المطبّق على قراءة وَأُخَرُ وفق النشر الذي يصفها بالجمع.'
                )
    if page == 229:
        header = '﴿إِنَّ ثَمُودَاْ﴾:'
        fragment = 'بالتنوين ﴿إِنَّ ثَمُودًا﴾:'
        headers = [i for i, line in enumerate(lines) if line.strip() == header]
        if len(headers) != 1:
            raise ValueError('page 229 audited Thamud source header not unique')
        matching = [line for line in lines if line.strip().startswith(fragment)]
        if len(matching) != 1:
            raise ValueError('page 229 audited tanween source line not unique')
        source_line = matching[0].strip()
        reader_text = source_line.split(':', 1)[1].strip()
        if is_neg(source_line) or is_univ(source_line):
            raise ValueError('page 229 tanween source row failed negation/universal guard')
        reader_ids = readers_from(reader_text, set())
        if reader_ids != {
            'Q01-R01','Q01-R02','Q02-R01','Q02-R02','Q03-R01','Q03-R02',
            'Q04-R01','Q04-R02','Q05-R01','Q07-R01','Q07-R02','Q08-R01',
            'Q08-R02','Q10-R01','Q10-R02',
        }:
            raise ValueError('page 229 tanween reader group changed')
        try:
            loc = T.find(page, 'ثَمُودَا۟', 1, 68)
        except T.NoMatch as exc:
            raise ValueError('page 229 exact Thamud token not found') from exc
        if loc['startWord'] != 7 or loc['endWord'] != 7 or loc['baseText'] != 'ثَمُودَا۟':
            raise ValueError('page 229 Thamud token span/base text changed')
        existing_matches = [x for x in existing_page if
            (x['surah'], x['ayah'], x['startToken'], x['endToken'], x['hafsText'], x['variantText']) ==
            (11, 68, 7, 7, 'ثَمُودَا۟', 'ثَمُودًا')]
        if len(existing_matches) != 1 or set(existing_matches[0]['readingIds']) != reader_ids:
            raise ValueError('page 229 expected tanween variant is not uniquely covered already')
        target = existing_matches[0]
        source_id = 's-DOCX-P229-THAMUDA-TANWEEN'
        if not any(s.get('id') == source_id for s in target.get('sources', [])):
            target.setdefault('sources', []).append({
                'id': source_id,
                'variantId': target['id'],
                **SRC,
                'sourceReference': 'وثيقة الاستخراج المبوّب، صفحة المصحف 229، الكلمات الفرشية',
                'sourceText': f"{header}\n{source_line}",
                'verificationNotes': 'تتفق هذه المجموعة مع المتغير الموجود؛ رُبطت بالرمز الفعلي ثَمُودَا۟ ذي الرمز 7، لا بامتداد عنوان الاقتباس ذي الكلمتين.',
            })
            source_links_added += 1
        variants = [x for x in variants if x.get('locusId') != 'D229-ان_ثمودا']

    if page == 260:
        header = '﴿أَفْـِٔدَةً﴾:'
        source_fragment = 'بياء ساكنة ممدودة مفتوحة ﴿أَفْيِدَةً﴾: هشام في وجهه الثاني'
        headers = [i for i, line in enumerate(lines) if line.strip() == header]
        matching = [line.strip() for line in lines if source_fragment in line]
        if len(headers) != 1 or len(matching) != 1:
            raise ValueError('page 260 audited Hisham farsh row/header not unique')
        source_line = matching[0]
        if is_neg(source_line) or is_univ(source_line):
            raise ValueError('page 260 explicit Hisham row failed negation/universal guard')
        reader_ids, unresolved = resolve_readers('هشام', set())
        if unresolved.strip(' ،,؛.') or reader_ids != {'Q04-R01'}:
            raise ValueError('page 260 Hisham reader did not resolve uniquely')
        try:
            loc = T.find(page, 'أَفْـِٔدَةً', 1, 37)
        except T.NoMatch as exc:
            raise ValueError('page 260 exact Afidah token not found') from exc
        if (loc['surah'], loc['startAyah'], loc['startWord'], loc['endWord'], loc['baseText']) != (
            14, 37, 17, 17, 'أَفْـِٔدَةًۭ'):
            raise ValueError('page 260 Afidah token span/base text changed')
        variants = [x for x in variants if x.get('locusId') != 'D260-افده']
        before = len(variants)
        corrected_form = 'أَفْئِيدَةً'
        description = 'بياء ساكنة بعد الهمزة؛ في وجهه الثاني لهشام'
        yield_block(page, 'أَفْـِٔدَةً', [
            (None, 'وجه حفص المطابق لرسم المصحف', set(ALL20) - reader_ids),
            (corrected_form, description, reader_ids),
        ], variants)
        if len(variants) != before + 1:
            raise ValueError('page 260 corrected Hisham variant failed the 20-reading/base-text partition')
        variant = variants[-1]
        variant['sources'][0].update({
            'sourceReference': 'وثيقة الاستخراج المبوّب، صفحة المصحف 260، الكلمات الفرشية',
            'sourceText': f"{header}\n{source_line}",
            'verificationNotes': 'حُفظ الرسم المطبوع في sourceText كما ورد. صُحح variantText إلى الياء بعد الهمزة، موافقًا للوصف وللمرجع المستقل؛ الرسم المطبوع للبديل يضع الياء قبل الهمزة.',
        })
        reference_text = 'قرأ هشام بخلف عنه بياء ساكنة بعد الهمزة والباقون بغير ياء وهو الوجه الثاني لهشام.'
        variant['sources'].append({
            'id': 's-AL-BUDUR-P260-AFIDAH',
            'variantId': variant['id'],
            'sourceName': 'البدور الزاهرة في القراءات العشر المتواترة',
            'sourceType': 'printed-book',
            'sourceReference': 'سورة إبراهيم، الآية 37، إسلام ويب: https://www.islamweb.net/ar/library/content/229/120/',
            'sourceText': reference_text,
            'verificationNotes': 'يؤكد المرجع أن الياء الساكنة بعد الهمزة هي الوجه الثاني لهشام.',
        })
        variant['evidence'] = [{
            'source': 'البدور الزاهرة في القراءات العشر المتواترة',
            'text': reference_text,
            'url': 'https://www.islamweb.net/ar/library/content/229/120/',
        }]
    return variants, source_links_added

# ---------- USUL ----------
FIXED={'مد البدل':('MADD_BADAL','ورش','مد البدل'),'مد اللين':('MADD_LIN','ورش','مد اللين المهموز'),
       'ترقيق':('TARQIQ_RA','ورش','ترقيق الراء'),'تغليظ':('TAGHLIZ_LAM','ورش','تغليظ اللام'),
       'الإدغام الكبير':('IDGHAM_KABIR','السوسي','إدغام كبير'),
       'ترك الغنة':('TARK_GHUNNA','KHALAF_HAMZA','ترك الغنة')}
def q(name):
    return set(A.readings_of(A.resolve(name)))

# ---- الممال والمقلل: a line can carry several anchors under DIFFERENT reader groups ----
# ("﴿w1﴾: أمالها R1، وقللها ورش بخلف؛ وأمال ﴿w2﴾ R2.") — split into independent clauses on
# «؛» and on a fresh «وأمال/وأمالها»; each clause resolves its own anchor(s) and readers.
IMALAH_CONNECTORS = re.compile(r'^(?:وأمالهما|وأمالها|وأمال|أمالهما|أمالها|أمال)\s*')
TAQLIL_SPLIT_RE = re.compile(r'وقللهما|وقللها|وقلل|والتقليل|تقليل')

def imalah_readers_from(text, claimed):
    # Bare «خلف» means خلف عن حمزة; «خلف العاشر» is matched as a full reader name.
    readers, rest = resolve_readers(text.strip(), claimed)
    if rest.strip(' ،,؛.') or not readers:
        raise Unresolved('unresolved imalah reader text: '+rest.strip())
    return readers

def clause_anchor_zone(clause):
    """Anchors are declared BEFORE the reader-list colon; a brace appearing after it (in the
    description, e.g. a pausal/performed form shown as an aside) is not a second locus."""
    return clause.rsplit(':', 1)[0] if ':' in clause else clause

def split_imalah_clauses(line):
    clauses=[]
    for seg in re.split('[.؛]', line):
        for sub in re.split(r'(?=وأمالهما|وأمالها|وأمال)', seg):
            if sub.strip(): clauses.append(sub)
    return clauses

def parse_imalah_clause(page, clause, out):
    anchors = BRACE.findall(clause_anchor_zone(clause))
    reverse=False
    if not anchors:
        # Some رؤوس الآي rows put the reader clause before a final colon and list
        # anchors after it. In that form, braces after the last colon are the loci.
        anchors=BRACE.findall(clause)
        reverse=bool(anchors)
    if not anchors: return
    # An explicit «بخلف عنه في X» makes that anchor uncertain. Keep other words in the
    # clause, but do not turn the exceptional anchor into a certain imalah ruling.
    uncertain=[]
    for note in PARENS.findall(clause):
        if 'بخلف عنه' not in note: continue
        m=re.search(r'في\s+(.+)$',note.strip())
        if m:
            target=T.norm(m.group(1).strip())
            uncertain.extend(a for a in anchors if target and target in T.norm(a))
    anchors=[a for a in anchors if a not in uncertain]
    if not anchors: return
    text = BRACE.sub('', clause)
    text = re.sub(r'\([^)]*\)', '', text)
    if reverse and ':' in text:
        parts=text.split(':')
        text=':'.join(parts[1:-1]) if len(parts)>2 else parts[-1]
    elif ':' in text:
        text = text.rsplit(':', 1)[-1]
    text = IMALAH_CONNECTORS.sub('', text.strip())
    text = text.strip().rstrip('.').strip()
    m = TAQLIL_SPLIT_RE.search(text)
    imala_part = text[:m.start()] if m else text
    taqlil_part = text[m.end():] if m else ''
    imala_part = re.sub(r'[،,]\s*$', '', imala_part.strip()).strip()
    imala_part = re.sub(r'\s+(?:وقفاً|وقفا|وصلاً|وصلا)(?:\s+قولاً واحداً)?$', '', imala_part).strip()
    imala_part = re.sub(r'\s+قولاً واحداً$', '', imala_part).strip()
    groups=[]
    if imala_part:
        try: rs=imalah_readers_from(imala_part, set())
        except Unresolved: return
        if rs!=ALL20: groups.append((rs,'إمالة',False))
    if 'ورش' in taqlil_part:
        groups.append((q('ورش'),'تقليل','بخلف' in taqlil_part))
    if not groups: return
    # dedup readings across groups on this one anchor (إمالة wins over تقليل)
    seen=set(); clean=[]
    for rs,act,alt in groups:
        rs2={r for r in rs if r not in seen}
        if rs2: clean.append((rs2,act,alt)); seen|=rs2
    if not clean: return
    for anchor in anchors:
        emit_ruling(page,'IMALAH_TAQLIL',anchor,clean,out)

# ---- تغيير الهمز: only unambiguous per-clause attribution, never the default trio guessed
# onto a clause that names someone else ----
def taghyir_names(action_text):
    """Strip the action-describing filler before the reader list, and undo the Arabic
    orthographic elision when a preposition ل is glued to the first name («لورش» -> «ورش»,
    «للسوسي» = ل+ال+سوسي with the alef elided -> restore it as «السوسي»)."""
    t = re.sub(r'^(?:إبدال|أبدلها)\s*(?:الهمزة\s*)?(?:ياءً?\s*)?', '', action_text).strip()
    if t.startswith('لل'): t = 'ال'+t[2:]
    elif t.startswith('ل') and not t.startswith('الباقون'): t = t[1:]
    return t

def parse_taghyir_hamz_clause(clause):
    """Return (anchors, readers, action) or None — drop on any ambiguity, never guess."""
    anchors = BRACE.findall(clause_anchor_zone(clause))
    if not anchors: return None
    body = BRACE.sub('', clause)
    action_text = body.rsplit(':', 1)[-1].strip().rstrip('.').strip()
    if not action_text: return None
    if 'حذف' in action_text or 'تسهيل' in action_text:
        m = re.search(r'\sل(.+)$', action_text)
        if not m: return None
        names = m.group(1)
        action = 'حذف الهمزة' if 'حذف' in action_text else 'تسهيل الهمزة'
    elif 'إبدال' in action_text or 'أبدلها' in action_text:
        names = taghyir_names(action_text)
        action = 'إبدال الهمزة'
    else:
        return None
    names = names.replace('أبي جعفر', 'أبو جعفر')
    try: rs=readers_from(names, set())
    except Unresolved: return None
    if not rs or rs==ALL20: return None
    return anchors, rs, action

def parse_taghyir_hamz_line(page, line, out):
    for clause in re.split('[.؛]', line):
        clause=clause.strip()
        if not clause: continue
        r=parse_taghyir_hamz_clause(clause)
        if not r: continue
        anchors,rs,action=r
        anchor_matches=list(BRACE.finditer(clause_anchor_zone(clause)))
        for index,anchor in enumerate(anchors):
            segment_end=anchor_matches[index+1].start() if index+1<len(anchor_matches) else len(clause)
            segment=clause[anchor_matches[index].end():segment_end]
            occurrences=2 if re.search(r'\(\s*معاً?\s*\)',segment) else 1
            note=None
            for parenthetical in PARENS.findall(clause):
                if 'قصر مد البدل' in parenthetical and T.norm(anchor) in T.norm(parenthetical):
                    note=parenthetical.strip()
            for occurrence in range(1,occurrences+1):
                emit_ruling(page,'TAGHYIR_HAMZ',anchor,[(rs,action)],out,
                            notes=note,occurrence=occurrence)

# ---- explicit ياءات families ------------------------------------------------
ANCHOR_CLAUSE_START = re.compile(r'(?=﴿[^﴾]+﴾\s*:)')
PARENS = re.compile(r'\(([^()]*)\)')

def normalize_reader_names(text):
    """Normalize source inflections and the elided article after a leading ل."""
    t=text.strip()
    for old,new in [('أبي عمرو','أبو عمرو'),('أبا عمرو','أبو عمرو'),
                    ('أبي جعفر','أبو جعفر'),('أبا جعفر','أبو جعفر'),
                    ('أبي الحارث','أبو الحارث'),('أبا الحارث','أبو الحارث')]:
        t=t.replace(old,new)
    # The source writes e.g. «للبزي»; the preposition is consumed by the caller,
    # leaving «لبزي», where the article's alif is elided.
    if t.startswith('ل') and not t.startswith(('للباقين','للجمهور')):
        t='ال'+t[1:]
    return t

def resolve_explicit_group(text):
    """Strict resolver for a source-named group; unresolved trailing names drop the line."""
    t=normalize_reader_names(text)
    if any(x in t for x in ('الباقون','الباقين','للجمهور','الجمهور')): return None
    m=re.match(r'جميع القراء عدا\s+(.+)$',t)
    if m:
        excluded,rest=resolve_readers(m.group(1),set())
        rest=rest.strip(' ،,؛.')
        if rest or not excluded: raise Unresolved('unresolved excepted reader')
        return set(ALL20)-excluded
    rs,rest=resolve_readers(t,set())
    rest=rest.strip(' ،,؛.')
    if rest or not rs: raise Unresolved('unresolved reader text: '+rest)
    return rs

def explicit_reader_clause(clause):
    """Return (action, readers, alternate, note) from one explicitly attributed clause."""
    if any(x in clause for x in ('الباقون','الباقين','للباقون','للباقين','للجمهور','الجمهور')): return None
    notes=PARENS.findall(clause)
    flat=PARENS.sub('',clause)
    flat=re.sub(r'\s+',' ',flat).strip()
    for m in re.finditer(r'(?<=[\s،,])ل(?=\S)',flat):
        action=flat[:m.start()].strip(' ،,و')
        names=flat[m.end():].strip()
        alternate=bool(re.search(r'بخلف',names) or any('بخلف' in n for n in notes))
        names=re.sub(r'\s+بخلف(?:\s+عنه)?\s*$','',names).strip()
        try: readers=resolve_explicit_group(names)
        except Unresolved: raise
        if readers:
            note='؛ '.join(notes) or None
            return action,readers,alternate,note
    return None

def split_anchor_clauses(line):
    # Several words can share one colon («﴿a﴾، ﴿b﴾: ...»). Split only when a new
    # anchor-led clause follows a sentence/reader-clause separator, keeping the whole
    # initial anchor group together.
    boundary=re.compile(r'(?<=[؛.])\s*(?=(?:﴿[^﴾]+﴾\s*[,،]\s*)*﴿[^﴾]+﴾\s*:)')
    return [x.strip() for x in boundary.split(line) if x.strip()]

YAAT_GROUP_SPLIT = re.compile(r'[،,]\s*(?=(?:وفي الحالين|في الحالين|وإثبات|والإثبات|وحذف|والحذف))')

def split_yaat_clauses(text):
    """Split yāʾ clauses on prose punctuation, ignoring punctuation in quoted forms."""
    clauses=[]; start=0; quoted=False
    for i,ch in enumerate(text):
        if ch=='﴿': quoted=True
        elif ch=='﴾': quoted=False
        elif ch in '؛.' and not quoted:
            clauses.append(text[start:i])
            start=i+1
    clauses.append(text[start:])
    return clauses

def yaat_note_reader_scope(clause, readers, note):
    """Resolve a parenthetical placed immediately after a named-reader segment."""
    matches=list(PARENS.finditer(clause))
    if len(matches)!=1 or matches[0].group(1).strip()!=note:
        return None
    before=clause[:matches[0].start()]
    segment=re.split(r'[،,]',before)[-1].strip()
    if not segment:
        return None
    try:
        scoped=resolve_explicit_group(segment)
    except Unresolved:
        return None
    if scoped and scoped <= readers:
        return scoped
    return None

def normalize_yaat_action(category, action, inherited=None):
    action=BRACE.sub('',action).strip(' ،,و.')
    if category=='YAAT_IDAFA':
        if 'فتح' in action: return 'الفتح وصلاً'
        if 'إسكان' in action or 'اسكان' in action: return 'الإسكان وصلاً'
        if 'إثبات' in action and 'الحالين' in action: return 'إثبات الياء في الحالين'
        return None
    if any(x in action for x in ('حذف','يحذف')):
        return 'حذف الياء في الحالين' if 'الحالين' in action else 'حذف الياء وصلاً'
    if any(x in action for x in ('إثبات','يثبت','أثبت')):
        if 'الحالين' in action: return 'إثبات الياء في الحالين'
        if 'مفتوحة' in action and 'ساكنة' in action:
            return 'إثبات الياء وصلاً مفتوحة ووقفاً ساكنة'
        if 'وصلاً' in action or 'وصلا' in action:
            if 'وقفاً' in action: return 'إثبات الياء وصلاً ووقفاً'
            return 'إثبات الياء وصلاً'
    if 'الحالين' in action and inherited:
        return 'حذف الياء في الحالين' if inherited.startswith('حذف') else 'إثبات الياء في الحالين'
    return None

def parse_yaat_line(page, category, line, out):
    """Parse source-named reader groups; remainder clauses are intentionally not emitted."""
    pending=[]
    for chunk in split_anchor_clauses(line):
        pre,sep,body=chunk.partition(':')
        anchors=BRACE.findall(pre)
        if not sep or not anchors: continue
        groups=[]; notes=[]; inherited=None
        try:
            for clause in split_yaat_clauses(body):
                clause=clause.strip()
                if not clause: continue
                for group_clause in YAAT_GROUP_SPLIT.split(clause):
                    # Braces in the body quote a resulting form, not a second locus.
                    group_clause=BRACE.sub('',group_clause).strip()
                    parsed=explicit_reader_clause(group_clause)
                    if not parsed: continue
                    action,readers,alternate,note=parsed
                    normalized=normalize_yaat_action(category,action,inherited)
                    if not normalized or not readers: continue
                    # «وفي الحالين» inherits the immediately preceding explicit yā operation.
                    # If there is no such operation, leave the clause unresolved.
                    if category=='YAAT_ZAWAID' and 'الحالين' in action and not any(
                        x in action for x in ('إثبات','يثبت','أثبت','حذف','يحذف')) and not inherited:
                        continue
                    if category=='YAAT_ZAWAID' and any(x in normalized for x in ('إثبات','حذف')):
                        inherited=normalized
                    condition='بخلف عنه' if alternate else None
                    scoped_note_readers=(yaat_note_reader_scope(group_clause,readers,note)
                                         if category=='YAAT_IDAFA' and note else None)
                    if scoped_note_readers:
                        unscoped_readers=set(readers)-scoped_note_readers
                        if unscoped_readers:
                            groups.append((unscoped_readers,normalized,alternate,condition))
                        groups.append((scoped_note_readers,normalized,alternate,note))
                    else:
                        groups.append((readers,normalized,alternate,condition))
                        if note: notes.append(note)
        except Unresolved:
            # One unresolved name invalidates the whole source line, even if another clause parsed.
            return
        if groups:
            for anchor in anchors:
                scoped_groups=groups
                # An earlier independent check showed the extraction overgeneralizes Ibn
                # Kathir at 11:84 «إني أراكم»: al-Bazzi is present, but Qanbul is not supported.
                try: loc=T.find(page,anchor,1)
                except T.NoMatch: loc=None
                if category=='YAAT_IDAFA' and loc and (
                    loc['surah'],loc['startAyah'],loc['startWord'])==(11,84,18):
                    scoped_groups=[]
                    for readers,action,alternate,condition in groups:
                        remaining=set(readers)-{'Q02-R02'}
                        if remaining: scoped_groups.append((remaining,action,alternate,condition))
                if scoped_groups:
                    pending.append((anchor,scoped_groups,'؛ '.join(dict.fromkeys(notes)) or None))
    for anchor,groups,notes in pending:
        emit_ruling(page,category,anchor,groups,out,notes=notes)

def likely_reader_text(text):
    probe=re.sub(r'بخلف(?:\s+عنه)?','',text)
    names=tuple(A.READERS)+tuple(A.NARRATORS)+(
        'خلف','الدوري','الكوفيون','أهل سما','الحرميان','المدنيان','البصريان','صحبة','صحاب','جميع القراء عدا')
    return any(name in probe for name in names)

def hamzatan_reader_modes(text):
    """Resolve a reader list while keeping parenthetical face notes on that reader only."""
    text=normalize_reader_names(text).strip()
    modes=[]
    while text:
        text=text.lstrip(' \t،,؛.')
        if not text: break
        match=None
        for name in NAMES_BY_LEN:
            if text.startswith(name):
                match=name
                break
        if match is None and text.startswith('و'):
            tail=text[1:].lstrip()
            for name in NAMES_BY_LEN:
                if tail.startswith(name):
                    text=tail
                    match=name
                    break
        if match is None:
            raise Unresolved('unresolved hamzatan reader text: '+text)
        readers=set(NAMED[match])
        text=text[len(match):].lstrip()
        modifiers=[]
        while text.startswith('('):
            end=text.find(')')
            if end<0: raise Unresolved('unclosed hamzatan reader note')
            modifiers.append(text[1:end].strip())
            text=text[end+1:].lstrip()
        alternate=any('بخلف' in note or 'وجهه الثاني' in note for note in modifiers)
        modes.append((readers,alternate,'؛ '.join(modifiers) or None))
        second_face=re.match(r'في\s+وجهه\s+الثاني(?=$|[،,؛.]|\s+[وأ])',text)
        if text and not (text.startswith(('و','،',',')) or text[0].isspace() or second_face):
            raise Unresolved('unresolved hamzatan reader separator: '+text)
        # An attached trailing «بخلف عنه» has the same scope as a parenthetical on this name.
        trailing=re.match(r'بخلف(?:\s+عنه)?(?=$|[،,؛.]|\s+[وأ])',text)
        if trailing:
            modes[-1]=(readers,True,'بخلف عنه')
            text=text[trailing.end():]
            continue
        if second_face:
            modes[-1]=(readers,True,'في وجهه الثاني')
            text=text[second_face.end():]
    return modes

def hamzatan_explicit_clause(clause):
    """Return only explicit reader/action pairs, with alternate notes scoped per reader."""
    if any(x in clause for x in ('الباقون','الباقين','للباقون','للباقين','للجمهور','الجمهور')): return None
    # In this source, «لمن همز لنافع...» is a qualifier on the named-reader set, not a
    # reader named «من همز». Preserve the explicit names while removing that qualifier.
    clause=re.sub(r'لمن\s+همز\s+', '', clause)
    flat=PARENS.sub('',clause)
    m=re.search(r'(?<=[\s،,])ل(?=\S)',flat)
    if not m:
        parsed=explicit_reader_clause(clause)
        if not parsed: return None
        action,readers,alternate,note=parsed
        action=BRACE.sub('',action).strip()
        if not action: return None
        return [(action,readers,alternate,'بخلف عنه' if alternate else None,[note] if note else [])]
    # The reader list is the tail after the first grammatical reader-introducing lam.
    # Recover its source slice by scanning the original string while skipping parentheticals.
    visible=[]; source_offsets=[]; cursor=0
    for paren in PARENS.finditer(clause):
        for i in range(cursor,paren.start()):
            visible.append(clause[i]); source_offsets.append(i)
        cursor=paren.end()
    for i in range(cursor,len(clause)):
        visible.append(clause[i]); source_offsets.append(i)
    raw_start=source_offsets[m.end()] if m.end()<len(source_offsets) else len(clause)
    try: modes=hamzatan_reader_modes(clause[raw_start:])
    except Unresolved:
        raise
    action=BRACE.sub('',clause[:source_offsets[m.start()]]).strip(' ،,و')
    action=action.strip()
    action=re.sub(r'^لمن قرأ بالهمز[،,]\s*','',action)
    if not action: return None
    result=[]
    for readers,alternate,note in modes:
        condition=None
        if alternate:
            condition=('في وجهه الثاني' if note and 'وجهه الثاني' in note else
                       'بخلف عنه' if note and 'بخلف' in note else note or 'بخلف عنه')
        result.append((action,readers,alternate,condition,[note] if note else []))
    return result or None

def parse_hamzatan_line(page,category,line,out):
    pending=[]
    for chunk in split_anchor_clauses(line):
        pre,sep,body=chunk.partition(':')
        anchors=BRACE.findall(pre)
        if not sep or not anchors: continue
        # The extraction sometimes gives a parenthetical mode for only the second of two
        # anchors. Keep that line out until its per-anchor scope can be represented safely.
        if len(anchors)>1 and re.search(r'في\s+الموضع\s+الثاني',body): continue
        groups=[]; notes=[n.strip() for n in PARENS.findall(pre)]
        try:
            for semicolon_clause in re.split(r'[؛.]',body):
                clause=semicolon_clause.strip()
                if not clause: continue
                parsed=hamzatan_explicit_clause(clause)
                if not parsed: continue
                for action,readers,alternate,condition,clause_notes in parsed:
                    groups.append((readers,action,alternate,condition))
                    notes.extend(clause_notes)
        except Unresolved:
            # An unresolved name anywhere on the source line invalidates all its clauses.
            return
        if groups:
            for anchor in anchors: pending.append((anchor,groups,'؛ '.join(dict.fromkeys(notes)) or None))
    for anchor,groups,notes in pending:
        emit_ruling(page,category,anchor,groups,out,notes=notes)

def parse_hamzatan_continuation(page,category,anchors,line,out):
    """Parse one explicit action:reader row under a hamzatan anchor heading."""
    action,sep,reader_text=line.partition(':')
    if not sep or not anchors or is_univ(line): return
    action=action.strip()
    # Parentheticals which quote one of the heading's anchors scope only that anchor.
    # Keep their face text as a ruling note, rather than leaking it to sibling anchors.
    scoped_notes=collections.defaultdict(list)
    for match in list(PARENS.finditer(action)):
        note=match.group(1).strip()
        quoted=BRACE.findall(note)
        if not quoted: continue
        action=action.replace(match.group(0),' ').strip()
        clean_note=note.strip(' ،,؛.')
        for anchor in quoted:
            if anchor in anchors and clean_note:
                scoped_notes[anchor].append(clean_note)
    reader_text=reader_text.strip().rstrip(' .؛')
    if not action or not reader_text:
        return
    if any(x in reader_text for x in ('الباقون','الباقين','للجمهور','الجمهور')):
        return
    try:
        modes=hamzatan_reader_modes(reader_text)
    except Unresolved:
        # A bare ambiguous narrator invalidates the full continuation clause.
        return
    groups=[]
    for readers,alternate,note in modes:
        condition=None
        if alternate:
            condition=('في وجهه الثاني' if note and 'وجهه الثاني' in note else
                       'بخلف عنه' if note and 'بخلف' in note else note or 'بخلف عنه')
        groups.append((readers,action,alternate,condition))
    if not groups: return
    for anchor in anchors:
        notes=scoped_notes.get(anchor,[])
        emit_ruling(page,category,anchor,groups,out,
                    notes='؛ '.join(dict.fromkeys(notes)) or None)

def bare_hamzatan_anchors(line):
    """Return anchors from a heading row that has no attached explicit action."""
    anchors=[]
    for chunk in split_anchor_clauses(line):
        pre,sep,body=chunk.partition(':')
        if sep and not body.strip():
            anchors.extend(BRACE.findall(pre))
        else:
            return []
    return anchors

def parse_waqf_rasm_line(page,line,out):
    """Import only explicitly named بالهاء readers; remainder and other waqf forms are omitted."""
    pending=[]
    positions=r'(?:عليها|عليه|عليهما|عليهم|عليهن)'
    after=re.compile(r'يقف\s+'+positions+r'\s+بالهاء\s+(.+?)(?=؛|$)')
    before=re.compile(r'يقف\s+(.+?)\s+'+positions+r'\s+بالهاء')
    for chunk in split_anchor_clauses(line):
        pre,sep,body=chunk.partition(':')
        anchor_matches=list(BRACE.finditer(pre))
        if not sep or not anchor_matches: continue
        match=after.search(body)
        if match:
            group_text=match.group(1)
        else:
            match=before.search(body)
            if not match: continue
            group_text=match.group(1)
        group_notes=[n.strip() for n in PARENS.findall(group_text)]
        names=PARENS.sub('',group_text)
        names=BRACE.sub('',names).strip(' ،,؛.و')
        try: readers=resolve_explicit_group(names)
        except Unresolved: return
        if not readers: continue
        for i,match in enumerate(anchor_matches):
            next_start=anchor_matches[i+1].start() if i+1<len(anchor_matches) else len(pre)
            anchor_notes=[n.strip() for n in PARENS.findall(pre[match.end():next_start])]
            notes='؛ '.join(dict.fromkeys(anchor_notes+group_notes)) or None
            count=T.count(page,match.group(1))
            repeat=any(x in ' '.join(anchor_notes) for x in ('جميعاً','الموضعان','معاً'))
            occurrences=range(1,count+1) if repeat and count else (1,)
            pending.extend((match.group(1),readers,notes,occurrence) for occurrence in occurrences)
    for anchor,readers,notes,occurrence in pending:
        emit_ruling(page,'WAQF_RASM',anchor,[(readers,'الوقف بالهاء')],out,notes=notes,occurrence=occurrence)

HISHAM_CUE_RE=re.compile(
    r'(?:[،,؛;]\s*)?(?:(?:ويوافقه|يوافقه|ومعه|معه|وكذا)\s+هشام|(?:ومثله|مثله)\s+لهشام)'
    r'(?:\s+في\s+[^؛.;()]+)?')

def parse_waqf_hamza_line(page,line,out,header_hisham=False):
    """Hamza is fixed; add Hisham only where the source explicitly scopes his agreement."""
    pending=[]
    for chunk in split_anchor_clauses(line):
        pre,sep,body=chunk.partition(':')
        anchor_matches=list(BRACE.finditer(pre))
        if not sep or not anchor_matches: continue
        cues=list(HISHAM_CUE_RE.finditer(body))
        specific_targets=[]
        for cue in cues:
            m=re.search(r'\s+في\s+([^؛.;()]+)',cue.group(0))
            if m: specific_targets.append(T.norm(m.group(1).strip()))
        clean_action=HISHAM_CUE_RE.sub('',BRACE.sub('',body))
        clean_action=re.sub(r'\(\s*\)','',clean_action)
        clean_action=re.sub(r'\s+([،,؛])',r'\1',clean_action).strip(' ،,؛;. ')
        for match in anchor_matches:
            anchor=match.group(1)
            if header_hisham:
                readers=q('حمزة')|q('هشام')
            elif cues:
                if specific_targets:
                    norm_anchor=T.norm(anchor)
                    add_hisham=any(target and target in norm_anchor for target in specific_targets)
                    if not add_hisham and len(anchor_matches)==1:
                        # The cue names a feature of the sole anchor rather than its word text.
                        add_hisham=True
                else:
                    add_hisham=True
                readers=q('حمزة')|(q('هشام') if add_hisham else set())
            else:
                readers=q('حمزة')
            pending.append((anchor,readers,clean_action or 'وقف حمزة'))
    for anchor,readers,action in pending:
        emit_ruling(page,'WAQF_HAMZA',anchor,[(readers,action)],out)

def _arabic_base_positions(text):
    return [(i,ch) for i,ch in enumerate(text)
            if not T.TASHKEEL.fullmatch(ch) and ch!='ـ']

def _terminal_nun_or_tanween(text):
    """True only when nun-sukun/tanween is at the end of the previous word."""
    bases=_arabic_base_positions(text)
    if not bases: return False
    last_i,last_ch=bases[-1]
    tail=text[last_i+1:]
    if last_ch=='ن' and 'ْ' in tail: return True
    for i,ch in enumerate(text):
        if ch not in 'ًٌٍ': continue
        following=[(j,c) for j,c in bases if j>i]
        if not following: return True
        # Uthmani fathatan is written before its supporting alif in forms such as قوماً.
        if ch=='ً' and len(following)==1 and following[0][1]=='ا': return True
    return False

def _first_arabic_base(text):
    return next((ch for _,ch in _arabic_base_positions(text)), '')

def ikhfa_transition(previous,following):
    return (_terminal_nun_or_tanween(previous) and
            _first_arabic_base(following) in ('غ','خ'))

def ikhfa_loc_is_supported(page,loc):
    """Validate an explicitly quoted source anchor against its actual token context."""
    words=T.page_words(page)
    left=next((w for w in words if w['surahNumber']==loc['surah'] and
        w['ayahNumber']==loc['startAyah'] and w['wordIndexInAyah']==loc['startWord']),None)
    right=next((w for w in words if w['surahNumber']==loc['surah'] and
        w['ayahNumber']==loc['endAyah'] and w['wordIndexInAyah']==loc['endWord']),None)
    return bool(left and right and ikhfa_transition(left['textUthmani'],right['textUthmani']))

def emit_ikhfa_loc(page,loc,out,source_anchor=None):
    label,color=RCOLORS['IKHFA']
    suffix=((f"{T.norm(source_anchor).replace(' ','_')}-" if source_anchor else 'rule-') +
            f"{loc['surah']}-{loc['startAyah']}-{loc['startWord']}")
    out.append({'id':f'r-p{page:03d}-IKHFA-{suffix}','pageNumber':page,
        'category':'IKHFA','categoryAr':label,'color':color,'wordAnchored':True,
        'surah':loc['surah'],'ayah':loc['startAyah'],'startToken':loc['startWord'],
        'endToken':loc['endWord'],'endAyah':loc['endAyah'],'baseText':loc['baseText'],
        'verificationStatus':'REVIEWED',
        'attribution':[{'authorityId':'Q08','action':'إخفاء'}],
        'readings':[{'readingId':'Q08-R01','action':'إخفاء','isDefault':True},
                    {'readingId':'Q08-R02','action':'إخفاء','isDefault':True}],
        'hasAlternate':False,'createdAt':TS,'updatedAt':TS})

def parse_ikhfa_line(page,line,out):
    """The source family names Abu Jaafar once; accept only an actual ghayn/kha trigger."""
    for anchor in BRACE.findall(line):
        try: loc=T.find(page,anchor,1)
        except T.NoMatch: continue
        if ikhfa_loc_is_supported(page,loc): emit_ikhfa_loc(page,loc,out,anchor)

def derive_ikhfa_contexts(page):
    """Expand Abu Jaafar's sourced ghayn/kha rule over every adjacent token on this page."""
    out=[]; words=T.page_words(page)
    for previous,following in zip(words,words[1:]):
        if not ikhfa_transition(previous['textUthmani'],following['textUthmani']): continue
        if (previous['surahNumber'],previous['ayahNumber']) in {(4,135),(5,3),(17,51)}:
            # Ibn al-Jazari's Durr poem names these as established exceptions; drop on doubt.
            continue
        loc={'surah':previous['surahNumber'],'startAyah':previous['ayahNumber'],
            'startWord':previous['wordIndexInAyah'],'endAyah':following['ayahNumber'],
            'endWord':following['wordIndexInAyah'],
            'baseText':f"{previous['textUthmani']} {following['textUthmani']}"}
        emit_ikhfa_loc(page,loc,out)
    return out

def explicit_idgham_readers(text):
    """Resolve only a complete reader list; inflected Abu names are common in prose tables."""
    text=text.strip()
    aliases=(('أبي جعفر','أبو جعفر'),('أبا جعفر','أبو جعفر'),
             ('أبي عمرو','أبو عمرو'),('أبا عمرو','أبو عمرو'))
    for inflected,canonical in aliases:
        text=text.replace(inflected,canonical)
    excluded=re.fullmatch(r'ل?جميع القراء عدا\s+(.+)',text)
    if excluded:
        text=re.sub(r'[اً]$','',excluded.group(1).strip()).replace('نافعا','نافع')
        for inflected,canonical in aliases:
            text=text.replace(inflected,canonical)
        readers,rest=resolve_readers(text,set())
        if not readers or rest.strip(' ،,؛.\t'):
            raise Unresolved('unresolved excluded reader: '+rest.strip())
        return set(ALL20)-readers
    readers,rest=resolve_readers(text,set())
    if not readers or rest.strip(' ،,؛.\t'):
        raise Unresolved('unresolved idgham reader text: '+rest.strip())
    return readers

def parse_idgham_saghir_line(page, line, out):
    """Parse each anchored clause independently; adjacent anchors may name different readers."""
    anchors=list(BRACE.finditer(line))
    for i,match in enumerate(anchors):
        end=anchors[i+1].start() if i+1<len(anchors) else len(line)
        clause=line[match.end():end]
        m=re.search(r'أدغمها\s+([^؛.]+)', clause)
        if m:
            names=m.group(1).strip()
        else:
            # In an inline الإدغام الصغير section, a bare anchor: reader-list clause
            # inherits the section's explicit operation (for example: ﴿إِذ جَاءَنِي﴾: أبو عمرو، وهشام).
            _,sep,names=clause.partition(':')
            if not sep: continue
            names=names.strip()
            # Some source rows state the action before an explicit all-except group:
            # «بالإدغام لجميع القراء عدا ...». Strip only that action prefix, then
            # resolve the named exclusions; generic/universal reader clauses still drop.
            names=re.sub(r'^ب(?:ال)?(?:إدغام|ادغام)(?:\s+(?:الصغير|الكامل))?\s*','',names)
        try:
            if re.fullmatch(r'(?:الباقون|الباقين|للجمهور|الجمهور)',names):
                shown=None
                for part in re.split(r'[؛.]',clause):
                    visible=re.search(r'أظهرها\s+(.+)',part.strip())
                    if visible:
                        shown=explicit_idgham_readers(visible.group(1))
                        break
                if shown is None:
                    continue
                rs=set(ALL20)-shown
            else:
                rs=explicit_idgham_readers(names)
        except Unresolved:
            continue
        if rs and rs!=ALL20:
            emit_ruling(page,'IDGHAM_SAGHIR',match.group(1),[(rs,'إدغام صغير')],out)

def parse_audited_p246_hamzatan(lines, out):
    """Import the fully explicit, unbraced Yusuf 12:90 table once its source is exact.

    The DOCX presents this one hamzatan table as a heading followed by face rows, so the
    general anchored-table parser cannot discover its word span.  Keep this guard narrow:
    every row must be present verbatim before we emit a rule.
    """
    expected=(
        'الهمزتان من كلمة (في أَءِنَّكَ لَأَنتَ):',
        'تسهيل الثانية مع الإدخال: قالون، أبو عمرو.',
        'تسهيل الثانية بلا إدخال: ورش، رويس.',
        'تحقيق الثانية مع الإدخال وعدمه: هشام.',
        'تحقيق الثانية بلا إدخال: الباقون.',
        '(وقرأ ابن كثير وأبو جعفر بهمز واحد على الإخبار).',
    )
    source={line.strip() for line in lines}
    if not set(expected).issubset(source):
        return
    groups=(
        (q('قالون') | q('أبو عمرو'), 'تسهيل الثانية مع الإدخال'),
        (q('ورش') | q('رويس'), 'تسهيل الثانية بلا إدخال'),
        (q('هشام'), 'تحقيق الثانية مع الإدخال وعدمه'),
        (q('ابن كثير') | q('أبو جعفر'), 'بهمز واحد على الإخبار'),
    )
    emit_ruling(246, 'HAMZATAN_KALIMA', 'أَءِنَّكَ لَأَنتَ', groups, out,
        source_notes=[f'نص المصدر: «{row}»' for row in expected])

def parse_usul(page, lines):
    out=[]; section=None; target_section=None; target_hisham=False
    target_hamzatan_anchors=[]; idgham_section=False
    for raw in lines:
        line=raw.strip()
        # These two page-249 imalah excerpts collide with existing reader/action
        # assignments at the same loci (including a same-reader face conflict). Hold
        # them for manual reconciliation instead of merging potentially incompatible faces.
        if page==249 and ('﴿النَّاس' in line or '﴿النَّار' in line):
            continue
        if page==250 and '﴿بِمِقْدَارٍ﴾' in line and '﴿بِالنَّهَارِ﴾' in line:
            continue
        if page==251 and '﴿النَّار' in line:
            continue
        head=line.split(':')[0]
        if is_neg(line) or has_bare_ambiguous_reader(line): continue
        if line.startswith('الإدغام الصغير'):
            idgham_section=not bool(BRACE.search(line))
            if BRACE.search(line): parse_idgham_saghir_line(page,line,out)
            continue
        if idgham_section:
            other_headers=tuple(FIXED)+('الممال','تغيير الهمز','الهمز المفرد','إبدال',
                'السكت','صلة هاء','الوقف على مرسوم الخط','وقف حمزة','الهمزتان',
                'إخفاء أبي جعفر','صلة ميم الجمع','ميم الجمع')
            if line.startswith(other_headers):
                idgham_section=False
            elif BRACE.search(line):
                parse_idgham_saghir_line(page,line,out)
                continue
        # New source-labelled families may be inline or introduced by a bare heading followed
        # by one or more anchored lines.
        target_headers=[('الهمزتان من كلمتين','HAMZATAN_KALIMATAYN'),
                        ('الهمزتان من كلمة','HAMZATAN_KALIMA'),
                        ('الوقف على مرسوم الخط','WAQF_RASM'),
                        ('وقف حمزة وهشام','WAQF_HAMZA'),('وقف حمزة','WAQF_HAMZA'),
                        ('ياءات الإضافة','YAAT_IDAFA'),('ياءات الزوائد','YAAT_ZAWAID'),
                        ('إخفاء أبي جعفر','IKHFA')]
        matched_target=False
        for prefix,cat in target_headers:
            if line.startswith(prefix):
                target_section=cat
                target_hisham=cat=='WAQF_HAMZA' and prefix=='وقف حمزة وهشام'
                content=line.split(':',1)[1].strip() if ':' in line else ''
                target_hamzatan_anchors=(bare_hamzatan_anchors(content)
                    if cat in ('HAMZATAN_KALIMA','HAMZATAN_KALIMATAYN') else [])
                if content and not is_univ(line):
                    if cat.startswith('YAAT_'): parse_yaat_line(page,cat,content,out)
                    elif cat=='WAQF_RASM': parse_waqf_rasm_line(page,content,out)
                    elif cat=='WAQF_HAMZA': parse_waqf_hamza_line(page,content,out,target_hisham)
                    elif cat=='IKHFA': parse_ikhfa_line(page,content,out)
                    else: parse_hamzatan_line(page,cat,content,out)
                matched_target=True
                break
        if matched_target: continue
        # Leave the target section on any other named family before considering its continuation.
        known_other=(list(FIXED)+['الممال','صلة هاء','الإدغام الصغير','تغيير الهمز','الهمز المفرد',
                     'إبدال','الإدغام الكبير','الإدغام الصغير','ترك الغنة','السكت','الإخفاء',
                     'صلة ميم الجمع','ميم الجمع','الوقف على مرسوم الخط','وقف حمزة','الهمزتان',
                     'إخفاء أبي جعفر'])
        if target_section:
            if (target_section in ('HAMZATAN_KALIMA','HAMZATAN_KALIMATAYN')
                    and target_hamzatan_anchors and ':' in line):
                pre=line.split(':',1)[0]
                # Ignore braces quoted inside a parenthetical face note when deciding
                # whether this row has its own anchor or inherits the heading anchors.
                visible_pre=PARENS.sub('',pre)
                other_header=any(line.startswith(x) for x in known_other)
                if re.match(r'^إبدال\s+(?:الثانية|الهمزة الثانية)',line):
                    other_header=False
                if not BRACE.search(visible_pre) and not other_header:
                    parse_hamzatan_continuation(page,target_section,target_hamzatan_anchors,line,out)
                    continue
            if BRACE.search(line) and not any(line.startswith(x) for x in known_other):
                if not is_univ(line):
                    if target_section.startswith('YAAT_'): parse_yaat_line(page,target_section,line,out)
                    elif target_section=='WAQF_RASM': parse_waqf_rasm_line(page,line,out)
                    elif target_section=='WAQF_HAMZA': parse_waqf_hamza_line(page,line,out,target_hisham)
                    elif target_section=='IKHFA': parse_ikhfa_line(page,line,out)
                    else: parse_hamzatan_line(page,target_section,line,out)
                continue
            target_section=None
            target_hisham=False
            target_hamzatan_anchors=[]
        # section header for الممال
        if line.startswith('الممال') and line.rstrip().endswith(':') and not BRACE.search(line):
            section='imalah'; continue
        if line.startswith('تغيير الهمز') and line.rstrip().endswith(':') and not BRACE.search(line):
            section='taghyir_hamz'; continue
        if section=='taghyir_hamz' and BRACE.search(line) and ':' in line:
            parse_taghyir_hamz_line(page,line,out)
            continue
        if section=='taghyir_hamz' and any(line.startswith(x) for x in
                ('الممال','الهمزتان','الوقف على مرسوم الخط','وقف حمزة','ياءات','إخفاء أبي جعفر')):
            section=None
        # fixed-reader families
        matched=False
        for key,(cat,reader,action) in FIXED.items():
            if head.startswith(key):
                if is_univ(line): matched=True; break
                for anchor in BRACE.findall(line):
                    emit_ruling(page, cat, anchor, [(q(reader),action)], out)
                matched=True; break
        if matched: continue
        if head.startswith('إخفاء أبي جعفر') and not is_univ(line):
            parse_ikhfa_line(page,line,out)
            continue
        # صلة هاء الكناية — only distinctive ابن كثير case
        if head.startswith('صلة هاء') and 'ابن كثير' in line and not is_univ(line):
            for anchor in BRACE.findall(line):
                emit_ruling(page,'SILAT_HA',anchor,[(q('ابن كثير'),'صلة هاء الكناية')],out)
            continue
        # الإدغام الصغير: "﴿w﴾: أظهرها ...؛ وأدغمها READERS"
        if section is None and 'أدغمها' in line and 'الإدغام' in line:
            parse_idgham_saghir_line(page,line,out)
            continue
        # تغيير الهمز: clause-by-clause; a clause without an unambiguous per-anchor attribution
        # is dropped rather than guessed onto the family's default ورش/السوسي/أبو جعفر trio.
        if head.startswith('تغيير الهمز') or head.startswith('الهمز المفرد') or head.startswith('إبدال'):
            parse_taghyir_hamz_line(page, line, out)
            continue
        # الممال section per-word lines: "﴿w﴾ (…): READERS، وقللها ورش." — clause-split first so
        # multiple anchors with DIFFERENT reader groups on one line never share one attribution.
        if section=='imalah' or head.startswith('الممال') or (BRACE.search(line) and ('أمال' in line or 'قلل' in line or 'إمالة' in line)):
            for clause in split_imalah_clauses(line):
                parse_imalah_clause(page, clause, out)
            continue
    if page==246:
        parse_audited_p246_hamzatan(lines, out)
    return out

def emit_ruling(page, cat, anchor, groups, out, notes=None, occurrence=1, source_notes=None, ayah=None):
    """groups: (readers_set, action[, is_alternate[, condition]]) tuples."""
    try: loc=T.find(page, anchor, occurrence, ayah=ayah)
    except T.NoMatch: return
    label,color=RCOLORS[cat]
    attribution=[]; readings=[]; has_alt=False
    for g in groups:
        if len(g)==4: rs,action,alt,condition=g
        elif len(g)==3: rs,action,alt=g; condition=None
        else: rs,action=g; alt=False; condition=None
        if alt: has_alt=True
        for r in sorted(rs):
            attribution.append({'authorityId':r,'action':action,**({'condition':condition} if condition else {})})
            readings.append({'readingId':r,'action':action,'isDefault':not alt})
    if not readings: return
    out.append({'id':f'r-p{page:03d}-{cat}-{T.norm(anchor).replace(" ","_")}-{len(out)}',
        'pageNumber':page,'category':cat,'categoryAr':label,'color':color,'wordAnchored':True,
        'surah':loc['surah'],'ayah':loc['startAyah'],'startToken':loc['startWord'],
        'endToken':loc['endWord'],'endAyah':loc['endAyah'],'baseText':loc['baseText'],
        'verificationStatus':'REVIEWED','attribution':attribution,'readings':readings,
        'hasAlternate':has_alt,**({'notes':notes} if notes else {}),
        **({'sourceNotes':source_notes} if source_notes else {}),'createdAt':TS,'updatedAt':TS})

# ---------- driver ----------
def existing(kind, page):
    p=os.path.join(ROOT,f'packages/qiraat-core/fixtures/{kind}/page-{page:03d}.json')
    if os.path.exists(p):
        try: return json.load(open(p,encoding='utf-8'))
        except Exception: return []
    return []

def has_bare_ambiguous_reader(text):
    """Reject only reader names the user has left unresolved (currently bare الدوري)."""
    if re.search(r'الدوري(?!\s+عن\s+(?:أبو\s+عمرو|أبي\s+عمرو|الكسائي))', text):
        return True
    return False

def reconcile_audited_rulings(page, lines, rulings, existing_page):
    """Keep the independently confirmed al-Susi imalah addition isolated from a conflicting
    Warsh default/alternate status already stored at the same token.
    """
    if page == 551:
        record=PACKAGE_RECORDS.get('DOCX-P551-R03534')
        if record and record.get('raw_text') in lines and not is_neg(record['raw_text']) and not is_univ(record['raw_text']):
            for anchor,readers,condition in (
                ('وَٱسْتَغْفِرْ',{'Q03-R01'},'بخلف عن الدوري'),
                ('وَٱسْتَغْفِرْ',{'Q03-R02'},'إدغام بلا خلاف عن السوسي'),
            ):
                loc=T.find(page,anchor,ayah=12)
                key=(loc['surah'],loc['startAyah'],loc['startWord'],'IDGHAM_SAGHIR')
                old=next((x for x in existing_page if (x.get('surah'),x.get('ayah'),x.get('startToken'),x.get('category'))==key),None)
                have=set(old.get('readingId') for old in old.get('readings',[])) if old else set()
                readers=readers-have
                if readers:
                    emit_ruling(page,'IDGHAM_SAGHIR',anchor,[(readers,'إدغام صغير',True,condition)],rulings,
                        notes='بين وَٱسْتَغْفِرْ ولَهُنَّ؛ الدوري بخلف، والسوسي بلا خلاف.',
                        source_notes=[{'sourceReference':'NQuran، العشر الصغرى، الممتحنة 12','sourceText':record['raw_text']}])
    if page == 551:
        record=PACKAGE_RECORDS.get('DOCX-P551-R03537')
        if record and record.get('raw_text') in lines and not is_neg(record['raw_text']) and not is_univ(record['raw_text']):
            for ayah,occurrence in ((2,1),(5,1)):
                anchor='لِمَ'
                loc=T.find(page,anchor,occurrence=occurrence,ayah=ayah)
                key=(loc['surah'],loc['startAyah'],loc['startWord'],'WAQF_RASM')
                old=next((x for x in existing_page if (x.get('surah'),x.get('ayah'),x.get('startToken'),x.get('category'))==key),None)
                have=set(x.get('readingId') for x in old.get('readings',[])) if old else set()
                readers={'Q02-R01','Q09-R01','Q09-R02'}-have
                if readers:
                    emit_ruling(page,'WAQF_RASM',anchor,[(readers,'الوقف بهاء السكت: لِمَهْ')],rulings,
                        notes='البزي عن ابن كثير بخلف، ويعقوب؛ المصدر ذكر رويس والبزي، والمصدر المحقق يثبت يعقوب في الموضعين.',
                        occurrence=occurrence,ayah=ayah,
                        source_notes=[{'sourceReference':'NQuran، العشر الصغرى، الصف 2','sourceText':record['raw_text']}])
    if page == 552:
        record=PACKAGE_RECORDS.get('DOCX-P552-R03543')
        if record and record.get('raw_text') in lines and not is_neg(record['raw_text']) and not is_univ(record['raw_text']):
            anchor='عِيسَى'
            loc=T.find(page,anchor,occurrence=1,ayah=14)
            key=(loc['surah'],loc['startAyah'],loc['startWord'],'IMALAH_TAQLIL')
            old=next((x for x in existing_page if (x.get('surah'),x.get('ayah'),x.get('startToken'),x.get('category'))==key),None)
            have=set(x.get('readingId') for x in old.get('readings',[])) if old else set()
            readers={'Q06-R01','Q06-R02','Q07-R01','Q07-R02'}-have
            if readers:
                emit_ruling(page,'IMALAH_TAQLIL',anchor,[(readers,'إمالة وقفاً')],rulings,occurrence=1,ayah=14,
                    source_notes=[{'sourceReference':'NQuran، العشر الصغرى، الصف 14','sourceText':record['raw_text'],
                                   'verificationNotes':'المصدر المستقل يسمي حمزة والكسائي وخلف العاشر صراحة؛ السجل يقول عيسى (معاً وقفاً).'}])
    if page in (277,278):
        audited=(
            [('DOCX-P277-R00761','TAGHYIR_HAMZ','وَجِئْنَا',
              {'Q03-R02','Q08-R01','Q08-R02'},'تغيير الهمز',1),
             ('DOCX-P277-R00761','TAGHYIR_HAMZ','يَأْمُرُ',
              {'Q01-R02','Q03-R02','Q08-R01','Q08-R02'},'تغيير الهمز',1),
             ('DOCX-P277-R00762','WAQF_HAMZA','يَشَآءُ',
              {'Q04-R01','Q06-R01','Q06-R02'},'خمسة أوجه القياس؛ ويوافقه هشام',2)]
            if page==277 else
            [('DOCX-P278-R00774','WAQF_RASM','بَاقٍ',
              {'Q02-R01','Q02-R02'},'إثبات الياء في الوقف: بَاقِي',1)])
        for record_id,category,anchor,readers,action,occurrence in audited:
            record=PACKAGE_RECORDS.get(record_id)
            if (record is None or record.get('page_no')!=page or
                    record.get('raw_text') not in lines):
                raise ValueError(f'page {page} audited source record missing: {record_id}')
            source_line=record['raw_text']
            if is_neg(source_line) or is_univ(source_line) or has_bare_ambiguous_reader(source_line):
                raise ValueError(f'page {page} audited source record failed safety check: {record_id}')
            if not readers or not readers<=ALL20:
                raise ValueError(f'page {page} audited reader IDs invalid: {record_id}')
            loc=T.find(page,anchor,occurrence=occurrence)
            if category=='WAQF_HAMZA' and (loc['surah'],loc['startAyah'],loc['startWord'])!=(16,93,13):
                raise ValueError('page 277 second يشاء token no longer resolves to 16:93:13')
            if category=='WAQF_RASM' and (loc['surah'],loc['startAyah'],loc['startWord'],loc['baseText'])!=(16,96,7,'بَاقٍۢ ۗ'):
                raise ValueError('page 278 بَاقٍ token no longer resolves to 16:96:7')
            if category=='TAGHYIR_HAMZ' and loc['surah']!=16:
                raise ValueError(f'page {page} hamza source anchor is outside النحل')
            key=(loc['surah'],loc['startAyah'],loc['startWord'],category)
            in_old=[x for x in existing_page if
                    (x.get('surah'),x.get('ayah'),x.get('startToken'),x.get('category'))==key]
            if in_old:
                have={x.get('readingId') for x in in_old[0].get('readings',[])}
                readers=readers-have
            if not readers:
                continue
            emit_ruling(page,category,anchor,[(readers,action)],rulings,
                        notes=action if category in ('WAQF_HAMZA','WAQF_RASM') else None,
                        occurrence=occurrence)
            candidates=[x for x in rulings if
                (x.get('surah'),x.get('ayah'),x.get('startToken'),x.get('category'))==key]
            if not candidates:
                raise ValueError(f'page {page} audited ruling failed to resolve: {record_id}')
            candidates[-1]['sourceNotes']=[{'sourceReference':f"qiraat_records.jsonl، {record_id}",
                'sourceText':source_line,
                'verificationNotes':'وجه صريح في السجل المعالج، ومرساته كلمة فعلية من ملف المصحف.'}]
    audited_page_rules = {
        555: [
            ('DOCX-P555-R03570','IDGHAM_SAGHIR','يَسْتَغْفِرْ لَكُمْ',
             {'Q03-R01','Q03-R02'},'إدغام صغير',1,5,5,
             'Quranpedia 63:5 explicitly lists both Susi and Duri from Abu Amr: https://quranpedia.net/qiraat/al-munafiqun/5.'),
            ('DOCX-P555-R03570','IDGHAM_SAGHIR','تَسْتَغْفِرْ لَهُمْ',
             {'Q03-R01','Q03-R02'},'إدغام صغير',1,6,7,
             'Quranpedia 63:6 explicitly lists both Susi and Duri from Abu Amr: https://quranpedia.net/qiraat/al-munafiqun/6.'),
            ('DOCX-P555-R03571','TAGHYIR_HAMZ','وَلِلْمُؤْمِنِينَ',
             {'Q01-R02','Q03-R02','Q08-R01','Q08-R02'},'إبدال الهمزة',1,8,13,
             'مصدر وثيقة الاستخراج؛ الإسناد صريح.'),
            ('DOCX-P555-R03571','TAGHYIR_HAMZ','يَأْتِىَ',
             {'Q01-R02','Q03-R02','Q08-R01','Q08-R02'},'إبدال الهمزة',1,10,8,
             'مصدر وثيقة الاستخراج؛ الإسناد صريح.'),
            ('DOCX-P555-R03571','TAGHYIR_HAMZ','يُؤَخِّرَ',
             {'Q01-R02','Q08-R01','Q08-R02'},'إبدال الهمزة',1,11,2,
             'مصدر وثيقة الاستخراج؛ الإسناد صريح.'),
            ('DOCX-P555-R03572','HAMZATAN_KALIMATAYN','جَآءَ أَجَلُهَا',
             {'Q04-R01','Q04-R02','Q05-R01','Q05-R02','Q06-R01','Q06-R02',
              'Q07-R01','Q07-R02','Q09-R02','Q10-R01','Q10-R02'},
             'تحقيق الهمزتين',1,11,6,
             'الباقون بعد الأوجه المسماة في سطر المصدر؛ ويوافق التقسيمُ التفصيليُّ للأوجه المسمّاة في Quranpedia 63:11.'),
        ],
        557: [
            ('DOCX-P557-R03581','IMALAH_TAQLIL','فِتْنَةٌ',
             {'Q07-R01','Q07-R02'},'إمالة هاء التأنيث وقفاً',1,15,4,
             'مصدر وثيقة الاستخراج؛ حكم الوقف صريح.'),
            ('DOCX-P557-R03584','WAQF_RASM','هُوَ',
             {'Q09-R01','Q09-R02'},'هاء السكت وقفاً: هُوْهْ',1,13,5,
             'مصدر وثيقة الاستخراج؛ إسناد الوقف إلى يعقوب صريح.'),
        ],
        558: [
            ('DOCX-P558-R03592','IDGHAM_SAGHIR','فَقَدْ ظَلَمَ',
             {'Q10-R01','Q10-R02'},'إدغام الدال في الظاء',1,1,31,
             'إسحاق وإدريس عن خلف مسمّيان صراحةً في مصدر Quranpedia، القراءات العشر، سورة الطلاق 65:1: https://quranpedia.net/qiraat/at-talaq/1.'),
            ('DOCX-P558-R03592','IDGHAM_SAGHIR','قَدْ جَعَلَ',
             {'Q10-R01','Q10-R02'},'إدغام الدال في الجيم',1,3,16,
             'إسحاق وإدريس عن خلف مسمّيان صراحةً في مصدر Quranpedia، القراءات العشر، سورة الطلاق 65:3: https://quranpedia.net/qiraat/at-talaq/3.'),
            ('DOCX-P558-R03594','WAQF_RASM','حَمْلَهُنَّ',
             {'Q09-R01','Q09-R02'},'هاء السكت وقفاً',1,4,20,
             'مصدر وثيقة الاستخراج؛ إسناد الوقف إلى يعقوب صريح.'),
        ],
    }
    for record_id,category,anchor,readers,action,occurrence,ayah,word,verification in audited_page_rules.get(page,[]):
        record=PACKAGE_RECORDS.get(record_id)
        source_text=record.get('raw_text','') if record else ''
        explicit_duri_khilaf = record_id=='DOCX-P555-R03570' and 'أبو عمرو بخلف عن الدوري' in source_text
        if (record is None or record.get('page_no')!=page or source_text not in lines or
                is_neg(record['raw_text']) or is_univ(record['raw_text']) or
                (has_bare_ambiguous_reader(record['raw_text']) and not explicit_duri_khilaf)):
            raise ValueError(f'page {page} audited source fact failed exact source/safety check: {record_id}')
        if not readers or not readers<=ALL20:
            raise ValueError(f'page {page} audited reader IDs invalid: {record_id}')
        loc=T.find(page,anchor,occurrence=occurrence,ayah=ayah)
        if loc['startWord']!=word:
            raise ValueError(f'page {page} audited token changed: {record_id} {anchor}')
        key=(loc['surah'],loc['startAyah'],loc['startWord'],category)
        pending={x.get('readingId') for entry in rulings if
                 (entry.get('surah'),entry.get('ayah'),entry.get('startToken'),entry.get('category'))==key
                 for x in entry.get('readings',[])}
        have=set(pending)
        for entry in existing_page:
            if (entry.get('surah'),entry.get('ayah'),entry.get('startToken'),entry.get('category'))==key:
                have.update(x.get('readingId') for x in entry.get('readings',[]))
        readers=readers-have
        if not readers:
            continue
        emit_ruling(page,category,anchor,[(readers,action)],rulings,
                    notes=action if category=='WAQF_RASM' else None,
                    occurrence=occurrence)
        candidates=[x for x in rulings if
            (x.get('surah'),x.get('ayah'),x.get('startToken'),x.get('category'))==key]
        if not candidates:
            raise ValueError(f'page {page} audited ruling failed to resolve: {record_id}')
        candidates[-1].setdefault('sourceNotes',[]).append({
            'sourceReference':f'qiraat_records.jsonl، {record_id}',
            'sourceText':record['raw_text'],
            'verificationNotes':verification})
    if page == 273:
        record=PACKAGE_RECORDS.get('DOCX-P273-R00716')
        expected='ترقيق الراءات وتغليظ اللامات: ورش يرقق الراء في ﴿بُشِّرَ﴾ و﴿يُؤَخِّرُهُمْ﴾؛ ويغلظ اللام في ﴿ظَلَّ﴾ وصلاً، وله وقفاً الوجهان.'
        if (record is None or record.get('raw_text')!=expected or is_neg(expected) or is_univ(expected)
                or has_bare_ambiguous_reader(expected)):
            raise ValueError('page 273 audited tarqiq source row failed exact source/safety check')
        loc=T.find(273,'بُشِّرَ',occurrence=2)
        if (loc['surah'],loc['startAyah'],loc['startWord'],loc['baseText'])!=(16,59,7,'بُشِّرَ'):
            raise ValueError('page 273 second بشر occurrence token changed')
        emit_ruling(273,'TARQIQ_RA','بُشِّرَ',[(q('ورش'),'ترقيق الراء')],rulings,occurrence=2)
        new=[x for x in rulings if (x['surah'],x['ayah'],x['startToken'],x['category'])==(16,59,7,'TARQIQ_RA')]
        if len(new)!=1:
            raise ValueError('page 273 second Warsh tarqiq locus did not resolve uniquely')
        new[0]['notes']='ترقيق الراء عن ورش في بُشِّرَ بالآية 59؛ تؤيده إحالة المصدر المستقل إلى حكم الآية السابقة.'
        return rulings
    if page == 274:
        record=PACKAGE_RECORDS.get('DOCX-P274-R00732')
        expected='﴿لَعِبْرَةً﴾: أمال هاء التأنيث وقفاً الكسائي.'
        if (record is None or record.get('raw_text')!=expected or is_neg(expected) or is_univ(expected)
                or has_bare_ambiguous_reader(expected)):
            raise ValueError('page 274 audited waqf-imala source row failed exact source/safety check')
        loc=T.find(274,'لَعِبْرَةً',ayah=66)
        if (loc['surah'],loc['startAyah'],loc['startWord'],loc['baseText'])!=(16,66,5,'لَعِبْرَةًۭ ۖ'):
            raise ValueError('page 274 la-ibrata exact token/base changed')
        kisai,_=resolve_readers('الكسائي',set())
        emit_ruling(274,'IMALAH_TAQLIL','لَعِبْرَةً',[(kisai,'إمالة هاء التأنيث وقفاً')],rulings)
        new=[x for x in rulings if (x['surah'],x['ayah'],x['startToken'],x['category'])==(16,66,5,'IMALAH_TAQLIL')]
        if len(new)!=1:
            raise ValueError('page 274 Kisai waqf-imala locus did not resolve uniquely')
        new[0]['notes']='إمالة هاء التأنيث وقفاً للكسائي.'
        return rulings
    if page != 254:
        return rulings
    source_line = '﴿الْكَـٰفِرِينَ﴾: أبو عمرو، الدوري عن الكسائي، رويس، وقللها ورش.'
    if [line.strip() for line in lines if line.strip() == source_line] != [source_line]:
        raise ValueError('page 254 audited al-Kafirin source row missing/not unique')
    if is_neg(source_line) or is_univ(source_line) or has_bare_ambiguous_reader(source_line):
        raise ValueError('page 254 al-Kafirin source row failed ambiguity/negation/universal guard')
    loc = T.find(page, 'الْكَـٰفِرِينَ', ayah=35)
    if (loc['surah'],loc['startAyah'],loc['startWord'],loc['baseText']) != (
        13,35,18,'ٱلْكَـٰفِرِينَ'):
        raise ValueError('page 254 exact al-Kafirin token/span/base changed')
    abu_amr,_ = resolve_readers('أبو عمرو', set())
    if abu_amr != {'Q03-R01','Q03-R02'}:
        raise ValueError('page 254 Abu Amr reading group did not resolve exactly')
    targets=[x for x in existing_page if
        (x.get('surah'),x.get('ayah'),x.get('startToken'),x.get('category')) ==
        (13,35,18,'IMALAH_TAQLIL')]
    target_ids={x.get('readingId') for x in targets[0].get('readings',[])} if len(targets)==1 else set()
    if len(targets)!=1 or 'Q03-R01' not in target_ids:
        raise ValueError('page 254 al-Kafirin existing ruling is not the expected unique match')
    candidates=[x for x in rulings if
        (x.get('surah'),x.get('ayah'),x.get('startToken'),x.get('category')) ==
        (13,35,18,'IMALAH_TAQLIL')]
    if len(candidates)!=1:
        raise ValueError('page 254 al-Kafirin parsed ruling is missing/not unique')
    candidate=candidates[0]
    parsed_ids={x.get('readingId') for x in candidate.get('readings',[])}
    if not abu_amr <= parsed_ids:
        raise ValueError('page 254 al-Kafirin parsed Abu Amr group changed')
    candidate['readings']=[x for x in candidate['readings'] if x.get('readingId')=='Q03-R02']
    candidate['attribution']=[x for x in candidate.get('attribution',[]) if x.get('authorityId')=='Q03-R02']
    candidate['hasAlternate']=False
    candidate['notes']='المصدر DOCX-P254-R00480 صرّح بأبي عمرو؛ وثبتت الإمالة لأبي عمرو في العرض المستقل للعشر الصغرى، فاقتصر الإلحاق على السوسي عن أبي عمرو. تُرك حكم ورش كما هو لوجود تعارض بين كونه بغير خلف في المصدر وبين الحالة البديلة القائمة.'
    return rulings

def build(page_list, categories=None, complete_ikhfa=False):
    vstats=collections.Counter(); rstats=collections.Counter()
    vout={}; rout={}
    for page in page_list:
        pd=DOC.get(str(page))
        if not pd: continue
        v=collect_farsh(page, pd['farsh'])
        r=parse_usul(page, pd['usul'])
        if complete_ikhfa and (categories is None or 'IKHFA' in categories):
            r.extend(derive_ikhfa_contexts(page))
        if categories is not None:
            v=[]
            r=[x for x in r if x['category'] in categories]
        # DEDUP against existing
        ev=existing('pages',page); er=existing('rulings',page)
        if categories is None or 'IMALAH_TAQLIL' in categories:
            r=reconcile_audited_rulings(page,pd['usul'],r,er)
        source_links_added=0
        if categories is None:
            v,source_links_added=reconcile_audited_farsh(page,pd['farsh'],v,ev)
            vstats['sourceLinksAdded']+=source_links_added
        # A token can have multiple source-supported faces when their reader sets differ.
        # Track the form already assigned to each transmission: same-form readers may be
        # added, while a reader already attached to a different form is withheld.
        forms_by_reader=collections.defaultdict(dict)
        for e in ev:
            token_key=(e['surah'],e['ayah'],e['startToken'])
            form=face_key(e.get('variantText') or '')
            for reader_id in e.get('readingIds',[]):
                forms_by_reader[token_key][reader_id]=form
        v2=[]; seen_forms=collections.defaultdict(set)
        for e in ev:
            token_key=(e['surah'],e['ayah'],e['startToken'])
            form_key=(*token_key,face_key(e.get('variantText') or ''))
            seen_forms[form_key].update(e.get('readingIds',[]))
        for x in v:
            token_key=(x['surah'],x['ayah'],x['startToken'])
            form=face_key(x.get('variantText') or '')
            form_key=(*token_key,form)
            candidates=set(x.get('readingIds',[]))
            seen_readers=seen_forms.setdefault(form_key,set())
            # Remove duplicate source faces already present with the same form, and
            # refuse same-reader alternatives that disagree with an existing form.
            available={reader_id for reader_id in candidates
                       if reader_id not in seen_readers and
                       (reader_id not in forms_by_reader[token_key] or
                        forms_by_reader[token_key][reader_id]==form)}
            if not available: continue
            x['readingIds']=sorted(available)
            seen_readers.update(available)
            for reader_id in available:
                forms_by_reader[token_key][reader_id]=form
            v2.append(x)
        seenr={}; r2=[]
        for x in r:
            k=(x['surah'],x['ayah'],x['startToken'],x['category'])
            if k in seenr:
                added,dropped=merge_ruling_assignments(seenr[k],x)
                rstats['assignmentsAdded']+=added; rstats['conflictsDropped']+=dropped
                continue
            seenr[k]=x; r2.append(x)
        if v2 or source_links_added: vout[page]=ev+v2
        vstats['added']+=len(v2)
        existing_by_key={(x['surah'],x['ayah'],x['startToken'],x['category']):x for x in er}
        changed=False
        for candidate in r2:
            key=(candidate['surah'],candidate['ayah'],candidate['startToken'],candidate['category'])
            target=existing_by_key.get(key)
            if target is None:
                candidate,dropped=sanitize_yaat_candidate(candidate)
                rstats['conflictsDropped']+=dropped
                if not candidate.get('readings'): continue
                er.append(candidate); existing_by_key[key]=candidate
                changed=True
                rstats['added']+=1
                rstats['assignmentsAdded']+=len(candidate.get('readings',[]))
                continue
            old_notes=target.get('notes')
            old_source_notes=target.get('sourceNotes')
            added,dropped=merge_ruling_assignments(target,candidate)
            rstats['conflictsDropped']+=dropped
            notes_added=(target.get('notes') != old_notes or
                         target.get('sourceNotes') != old_source_notes)
            if notes_added: rstats['notesAdded']+=1
            if added or notes_added:
                changed=True; rstats['assignmentsAdded']+=added; rstats['merged']+=1
        if changed: rout[page]=er
    return vout,rout,vstats,rstats

def yaat_action_key(category, action):
    """Compare yā-family actions by their stated behavior, not orthographic wording."""
    text=T.norm(BRACE.sub('',action or '')).strip(' ،,؛.')
    if category=='YAAT_IDAFA':
        if 'فتح' in text: return 'open-wasl'
        if 'اسكان' in text: return 'sukun-wasl'
    if category=='YAAT_ZAWAID':
        if 'حذف' in text or 'يحذف' in text:
            return 'delete-both' if ('الحالين' in text or ('وصلا' in text and 'وقفا' in text)) else 'delete-wasl'
        if 'اثبات' in text or 'يثبت' in text or 'اثبت' in text:
            if 'مفتوحه' in text and 'ساكنه' in text: return 'establish-open-wasl-sakin-waqf'
            if 'الحالين' in text or ('وصلا' in text and 'وقفا' in text):
                return 'establish-both'
            if 'وصلا' in text: return 'establish-wasl'
    return None

def sanitize_yaat_candidate(candidate):
    """Drop internally conflicting same-reader assignments; return (candidate, dropped)."""
    category=candidate.get('category')
    if category not in ('YAAT_IDAFA','YAAT_ZAWAID'):
        return candidate,0
    by_id=collections.defaultdict(list)
    for item in candidate.get('readings',[]):
        signature=(yaat_action_key(category,item.get('action')) or item.get('action'),item.get('isDefault',True))
        by_id[item.get('readingId')].append((signature,item))
    bad={rid for rid,items in by_id.items() if len({sig for sig,_ in items})>1}
    seen=set(); kept=[]
    for rid,items in by_id.items():
        if rid in bad: continue
        for signature,item in items:
            identity=(rid,signature)
            if identity in seen: continue
            seen.add(identity); kept.append(item)
    dropped=sum(len(by_id[rid]) for rid in bad)+sum(len(items)-1 for rid,items in by_id.items() if rid not in bad)
    if dropped:
        candidate=dict(candidate)
        candidate['readings']=kept
        allowed={item.get('readingId') for item in kept}
        candidate['attribution']=[a for a in candidate.get('attribution',[]) if a.get('authorityId') in allowed]
        candidate['hasAlternate']=any(not item.get('isDefault',True) for item in kept)
    return candidate,dropped

def hamzatan_action_features(action):
    """Extract the explicitly stated hamza operations for conservative additive merging."""
    text=T.norm(action or '')
    features=set()
    ordinal='first' if any(x in text for x in ('الاولي','الهمزه الاولي')) else (
        'second' if any(x in text for x in ('الثانيه','الهمزه الثانيه')) else None)
    if ordinal and any(x in text for x in ('اسقاط','حذف')):
        features.add('drop:'+ordinal)
    if 'تسهيل' in text:
        if ordinal:
            features.add('ease:'+ordinal)
        else:
            features.add('ease:generic')
    if 'ادخال' in text and 'بلا ادخال' not in text:
        features.add('insertion:with')
    elif 'بلا ادخال' in text or 'بدون ادخال' in text:
        features.add('insertion:without')
    if ordinal and 'ابدال' in text:
        letter=('waw' if 'واو' in text else 'ya' if 'ياء' in text else
                'alif-madd' if 'الف' in text and ('مشبع' in text or 'مد مشبع' in text) else
                'alif' if 'الف' in text else 'madd' if 'حرف مد' in text else 'unspecified')
        features.add('substitute:'+ordinal+':'+letter)
    if 'تحقيق' in text:
        if 'ادخال' in text and 'عدمه' in text:
            features.update(('verify:input','verify:no-input'))
        elif 'ادخال' in text:
            features.add('verify:input')
        elif 'بلا ادخال' in text:
            features.add('verify:no-input')
        else:
            features.add('verify:unspecified')
    return features

def hamzatan_actions_are_distinct_insertion_faces(left,right):
    """A reader may be named for both insertion faces; preserve that explicit distinction."""
    a=hamzatan_action_features(left.get('action'))
    b=hamzatan_action_features(right.get('action'))
    ins_a=a & {'insertion:with','insertion:without'}
    ins_b=b & {'insertion:with','insertion:without'}
    core_a=a-ins_a; core_b=b-ins_b
    return bool(core_a and core_a==core_b and len(ins_a)==len(ins_b)==1 and ins_a!=ins_b)

def hamzatan_action_refines(new_item,old_item):
    """Allow source text to add insertion detail to an otherwise identical old action."""
    new=hamzatan_action_features(new_item.get('action'))
    old=hamzatan_action_features(old_item.get('action'))
    ins={'insertion:with','insertion:without'}
    new_ins=new & ins; old_ins=old & ins
    return bool(new and old and not old_ins and len(new_ins)==1 and new-new_ins==old)

def hamzatan_assignment_covered(new_item, old_item):
    """True only when an existing action already includes the source's stated operation."""
    if new_item.get('isDefault',True)!=old_item.get('isDefault',True):
        return False
    new=hamzatan_action_features(new_item.get('action'))
    old=hamzatan_action_features(old_item.get('action'))
    if new and old:
        return new <= old
    return (new_item.get('action')==old_item.get('action') and
            new_item.get('isDefault',True)==old_item.get('isDefault',True))

def merge_hamzatan_assignments(existing_record,candidate):
    """Merge only source-explicit compatible modes; same-face disagreements are dropped."""
    old_by_id=collections.defaultdict(list)
    for item in existing_record.get('readings',[]):
        old_by_id[item.get('readingId')].append(item)
    candidate_by_id_status=collections.defaultdict(list)
    for item in candidate.get('readings',[]):
        candidate_by_id_status[(item.get('readingId'),item.get('isDefault',True))].append(item)
    conflicting=set()
    for key,items in candidate_by_id_status.items():
        signatures={tuple(sorted(hamzatan_action_features(x.get('action')))) or
                    (x.get('action'),) for x in items}
        if (len(signatures)>1 and any(not (hamzatan_actions_are_distinct_insertion_faces(a,b) or
                                           hamzatan_action_refines(a,b) or
                                           hamzatan_action_refines(b,a))
                for i,a in enumerate(items) for b in items[i+1:])):
            conflicting.add(key)

    accepted=[]; dropped=0
    seen_new=set()
    for item in candidate.get('readings',[]):
        rid=item.get('readingId'); is_default=item.get('isDefault',True)
        if (rid,is_default) in conflicting:
            dropped+=1
            continue
        key=(rid,item.get('action'),is_default)
        if key in seen_new:
            continue
        seen_new.add(key)
        if not is_default and not existing_record.get('hasAlternate',False):
            dropped+=1
            continue
        old=old_by_id.get(rid,[])
        if any(hamzatan_assignment_covered(item,prior) for prior in old):
            continue
        same_status=[x for x in old if x.get('isDefault',True)==is_default]
        if same_status and not all(hamzatan_actions_are_distinct_insertion_faces(item,x) or
                                   hamzatan_action_refines(item,x)
                                   for x in same_status):
            dropped+=1
            continue
        # Distinct source-marked alternate/default faces may complement a stored opposite face;
        # the source parser sets isDefault=False only for an explicit «بخلف» or second face.
        accepted.append(item)
        old_by_id[rid].append(item)

    if not accepted:
        return 0,dropped
    current=existing_record.setdefault('readings',[])
    current.extend(accepted)
    accepted_pairs={(x.get('readingId'),x.get('action')) for x in accepted}
    attrs=existing_record.setdefault('attribution',[])
    seen_attrs={(x.get('authorityId'),x.get('action'),x.get('condition')) for x in attrs}
    for item in candidate.get('attribution',[]):
        if (item.get('authorityId'),item.get('action')) not in accepted_pairs:
            continue
        key=(item.get('authorityId'),item.get('action'),item.get('condition'))
        if key not in seen_attrs:
            attrs.append(item); seen_attrs.add(key)
    if candidate.get('notes'):
        old_notes=[x.strip() for x in existing_record.get('notes','').split('؛') if x.strip()]
        for note in (x.strip() for x in candidate['notes'].split('؛')):
            if note and note not in old_notes:
                old_notes.append(note)
        if old_notes:
            existing_record['notes']='؛ '.join(old_notes)
    return len(accepted),dropped

def waqf_rasm_action_key(action):
    """Treat old action-embedded imalah notes as the same base waqf action."""
    value=T.norm(action)
    return re.sub(r'\s*مع\s+الاماله(?:\s+بخلف)?', '', value).strip()

def merge_waqf_rasm_assignments(existing_record,candidate):
    """Merge source notes without duplicating readers already covered by this locus."""
    current=existing_record.setdefault('readings',[])
    old_by_id=collections.defaultdict(list)
    for item in current:
        old_by_id[item.get('readingId')].append(item)
    accepted=[]; accepted_ids=set(); dropped=0
    for item in candidate.get('readings',[]):
        rid=item.get('readingId'); status=item.get('isDefault',True)
        prior=[x for x in old_by_id.get(rid,[]) if x.get('isDefault',True)==status]
        if prior:
            if any(waqf_rasm_action_key(x.get('action','')) == waqf_rasm_action_key(item.get('action','')) for x in prior):
                continue
            dropped+=1
            continue
        if old_by_id.get(rid):
            dropped+=1
            continue
        accepted.append(item); accepted_ids.add(rid); old_by_id[rid].append(item)
    if accepted:
        current.extend(accepted)
        attrs=existing_record.setdefault('attribution',[])
        seen={(x.get('authorityId'),x.get('action'),x.get('condition')) for x in attrs}
        for item in candidate.get('attribution',[]):
            if item.get('authorityId') not in accepted_ids: continue
            key=(item.get('authorityId'),item.get('action'),item.get('condition'))
            if key not in seen:
                attrs.append(item); seen.add(key)
    # Keep source parentheticals such as (مع الإمالة) visible as notes, even when the
    # reader group is already represented by a more descriptive legacy action string.
    note=candidate.get('notes')
    covered=all(any(x.get('isDefault',True)==item.get('isDefault',True) and
                        waqf_rasm_action_key(x.get('action','')) == waqf_rasm_action_key(item.get('action',''))
                        for x in old_by_id.get(item.get('readingId'),[]))
                for item in candidate.get('readings',[]))
    if note and covered:
        old_notes=existing_record.get('notes','')
        note_parts=[x.strip() for x in old_notes.split('؛') if x.strip()]
        for part in (x.strip() for x in note.split('؛')):
            if part and part not in note_parts:
                note_parts.append(part)
        if '؛ '.join(note_parts) != old_notes:
            existing_record['notes']='؛ '.join(note_parts)
    return len(accepted),dropped

def merge_waqf_hamza_assignments(existing_record,candidate):
    """Keep the fixed Hamza/Hisham reader set and store source action refinements as notes."""
    current=existing_record.setdefault('readings',[])
    old_by_id=collections.defaultdict(list)
    for item in current:
        old_by_id[item.get('readingId')].append(item)
    accepted=[]; accepted_ids=set(); dropped=0; source_notes=[]
    for item in candidate.get('readings',[]):
        rid=item.get('readingId'); status=item.get('isDefault',True)
        prior=[x for x in old_by_id.get(rid,[]) if x.get('isDefault',True)==status]
        if prior:
            if any(T.norm(x.get('action','')) == T.norm(item.get('action','')) for x in prior):
                continue
            # Preserve an explicit source refinement without creating a second action
            # assignment for the same reader at this word.
            source_notes.append(f"نص المصدر لوقف حمزة: «{item.get('action','')}»")
            continue
        if old_by_id.get(rid):
            dropped+=1
            continue
        accepted.append(item); accepted_ids.add(rid); old_by_id[rid].append(item)
    if accepted:
        current.extend(accepted)
        attrs=existing_record.setdefault('attribution',[])
        seen={(x.get('authorityId'),x.get('action'),x.get('condition')) for x in attrs}
        for item in candidate.get('attribution',[]):
            if item.get('authorityId') not in accepted_ids: continue
            key=(item.get('authorityId'),item.get('action'),item.get('condition'))
            if key not in seen:
                attrs.append(item); seen.add(key)
    old_source_notes=existing_record.get('sourceNotes',[])
    if isinstance(old_source_notes,str):
        old_source_notes=[old_source_notes]
    note_parts=list(old_source_notes)
    for note in dict.fromkeys(source_notes):
        if note not in note_parts:
            note_parts.append(note)
    if candidate.get('notes'):
        for note in (x.strip() for x in candidate['notes'].split('؛')):
            if note and note not in note_parts:
                note_parts.append(note)
    if note_parts and note_parts != old_source_notes:
        existing_record['sourceNotes']=note_parts
    return len(accepted),dropped

def merge_ruling_assignments(existing_record, candidate):
    """Add compatible source-explicit assignments; same-reader disagreements are dropped."""
    candidate,dropped=sanitize_yaat_candidate(candidate)
    category=existing_record.get('category')
    if category in ('HAMZATAN_KALIMATAYN','HAMZATAN_KALIMA'):
        added,hamzatan_dropped=merge_hamzatan_assignments(existing_record,candidate)
        return added,dropped+hamzatan_dropped
    if category=='IDGHAM_SAGHIR':
        current=existing_record.setdefault('readings',[])
        old_by_id=collections.defaultdict(list)
        for item in current:
            old_by_id[item.get('readingId')].append(item)
        accepted=[]; accepted_ids=set(); seen=set()
        for item in candidate.get('readings',[]):
            rid=item.get('readingId'); status=item.get('isDefault',True)
            key=(rid,item.get('action'),status)
            if key in seen: continue
            seen.add(key)
            prior=[x for x in old_by_id.get(rid,[]) if x.get('isDefault',True)==status]
            if prior:
                idgham_word=T.norm('إدغام'); izhhar_word=T.norm('إظهار')
                if item.get('action')=='إدغام صغير' and any(
                    idgham_word in T.norm(x.get('action','')) and izhhar_word not in T.norm(x.get('action',''))
                    for x in prior):
                    continue  # Existing detailed action already expresses the source's generic idgham.
                dropped+=1
                continue
            accepted.append(item); accepted_ids.add(rid); old_by_id[rid].append(item)
        if not accepted:
            return 0,dropped
        current.extend(accepted)
        attrs=existing_record.setdefault('attribution',[])
        seen_attrs={(x.get('authorityId'),x.get('action'),x.get('condition')) for x in attrs}
        for item in candidate.get('attribution',[]):
            if item.get('authorityId') not in accepted_ids: continue
            key=(item.get('authorityId'),item.get('action'),item.get('condition'))
            if key not in seen_attrs:
                attrs.append(item); seen_attrs.add(key)
        return len(accepted),dropped
    if category=='IKHFA':
        # The sourced ghayn/kha rule is a single fixed action for both Abu Jaafar
        # narrations. Existing fixtures may spell it «الإخفاء» or «إخفاء»; the
        # explicit reader IDs already establish coverage, so never duplicate them
        # merely because the prose action spelling differs.
        current=existing_record.setdefault('readings',[])
        old_by_id=collections.defaultdict(list)
        for item in current:
            old_by_id[item.get('readingId')].append(item)
        accepted=[]; accepted_ids=set()
        for item in candidate.get('readings',[]):
            rid=item.get('readingId'); status=item.get('isDefault',True)
            prior=old_by_id.get(rid,[])
            if any(x.get('isDefault',True)==status for x in prior):
                continue
            if prior:
                dropped+=1
                continue
            accepted.append(item); accepted_ids.add(rid); old_by_id[rid].append(item)
        if not accepted:
            return 0,dropped
        current.extend(accepted)
        attrs=existing_record.setdefault('attribution',[])
        seen_attrs={(x.get('authorityId'),x.get('action'),x.get('condition')) for x in attrs}
        for item in candidate.get('attribution',[]):
            if item.get('authorityId') not in accepted_ids: continue
            key=(item.get('authorityId'),item.get('action'),item.get('condition'))
            if key not in seen_attrs:
                attrs.append(item); seen_attrs.add(key)
        return len(accepted),dropped
    if category=='WAQF_RASM':
        return merge_waqf_rasm_assignments(existing_record,candidate)
    if category=='WAQF_HAMZA':
        return merge_waqf_hamza_assignments(existing_record,candidate)
    if category not in ('YAAT_IDAFA','YAAT_ZAWAID'):
        added=0
        current=existing_record.setdefault('readings',[])
        seen={(item.get('readingId'),T.norm(item.get('action',''))) for item in current}
        accepted_ids=set()
        accepted_items=[]
        for item in candidate.get('readings',[]):
            key=(item.get('readingId'),T.norm(item.get('action','')))
            if key in seen: continue
            current.append(item); seen.add(key)
            accepted_ids.add(item.get('readingId')); accepted_items.append(item); added+=1
        attrs=existing_record.setdefault('attribution',[])
        seen_attrs={(item.get('authorityId'),T.norm(item.get('action','')),item.get('condition'))
                    for item in attrs}
        for item in candidate.get('attribution',[]):
            if item.get('authorityId') not in accepted_ids: continue
            key=(item.get('authorityId'),T.norm(item.get('action','')),item.get('condition'))
            if key in seen_attrs: continue
            attrs.append(item); seen_attrs.add(key)
        if added:
            existing_record['hasAlternate']=bool(existing_record.get('hasAlternate') or
                                                 any(not item.get('isDefault',True) for item in accepted_items))
            if candidate.get('notes'):
                old=existing_record.get('notes')
                notes=[x for x in (old,candidate['notes']) if x]
                if notes: existing_record['notes']='؛ '.join(dict.fromkeys(notes))
        return added,dropped
    added=0; accepted_ids=set()
    current=existing_record.setdefault('readings',[])
    by_id=collections.defaultdict(list)
    for item in current: by_id[item.get('readingId')].append(item)
    for item in candidate.get('readings',[]):
        rid=item.get('readingId')
        old=by_id.get(rid,[])
        new_key=yaat_action_key(category,item.get('action')) if category in ('YAAT_IDAFA','YAAT_ZAWAID') else item.get('action')
        new_sig=(new_key or item.get('action'),item.get('isDefault',True))
        old_sigs={(yaat_action_key(category,x.get('action')) or x.get('action'),x.get('isDefault',True)) for x in old}
        if new_sig in old_sigs: continue
        if old:
            dropped+=1
            continue
        current.append(item); by_id[rid].append(item); accepted_ids.add(rid); added+=1
    if not added: return added,dropped
    attrs=existing_record.setdefault('attribution',[])
    seen_attrs=set()
    for item in attrs:
        aid=item.get('authorityId')
        key=(aid,yaat_action_key(category,item.get('action')) or item.get('action'),item.get('condition'))
        seen_attrs.add(key)
    for item in candidate.get('attribution',[]):
        if item.get('authorityId') not in accepted_ids: continue
        key=(item.get('authorityId'),yaat_action_key(category,item.get('action')) or item.get('action'),item.get('condition'))
        if key not in seen_attrs: attrs.append(item); seen_attrs.add(key)
    existing_record['hasAlternate']=bool(existing_record.get('hasAlternate') or any(not x.get('isDefault',True) for x in candidate.get('readings',[]) if x.get('readingId') in accepted_ids))
    if candidate.get('notes'):
        old=existing_record.get('notes')
        notes=[x for x in (old,candidate['notes']) if x]
        if notes: existing_record['notes']='؛ '.join(dict.fromkeys(notes))
    return added,dropped

def collect_farsh(page, lines):
    out=[]; i=0; n=len(lines)
    while i<n:
        line=lines[i]
        if HDR.match(line):
            anchor=BRACE.search(line).group(1)
            wujuh=[]; claimed=set(); j=i+1
            while j<n and not HDR.match(lines[j]) and (':' in lines[j]):
                pre,post=lines[j].split(':',1)
                bm=BRACE.search(pre); text=bm.group(1) if bm else None
                try: rs=readers_from(post, claimed)
                except Unresolved: wujuh=None; break
                wujuh.append((text,pre.strip(),rs)); claimed|=rs; j+=1
            i=j
            if wujuh and len(wujuh)>=2: yield_block(page,anchor,wujuh,out)
            continue
        i+=1
    out.extend(checked_page303_farsh(page, lines))
    out.extend(checked_inline_farsh(page, lines))
    out.extend(checked_audited_p277_278_farsh(page, lines))
    return out

def checked_audited_p277_278_farsh(page, lines):
    """Resolve reviewed inline source rows whose two forms are described, not quoted."""
    cases={
        277:[{'record_id':'DOCX-P277-R00753','anchor':'عَلَيْهِم','ayah':89,
              'base':'عَلَيْهِم','variant':'عَلَيْهُم','readers':'حمزة ويعقوب',
              'description':'بضم الهاء'}],
        278:[{'record_id':'DOCX-P278-R00765','anchor':'وَهُوَ','ayah':97,
              'base':'وَهُوَ','variant':'وَهْوَ','readers':'قالون، أبو عمرو، الكسائي، أبو جعفر',
              'description':'بإسكان الهاء'},
             {'record_id':'DOCX-P278-R00766','anchor':'الْقُرْءَانَ','ayah':98,
              'base':'ٱلْقُرْءَانَ','variant':'ٱلْقُرَانَ','readers':'ابن كثير',
              'description':'بنقل الهمزة'}],
    }
    out=[]
    for case in cases.get(page,[]):
        packaged=PACKAGE_RECORDS.get(case['record_id'])
        if packaged is None or packaged.get('page_no')!=page or packaged.get('section')!='farsh':
            raise ValueError(f"page {page} audited source record missing: {case['record_id']}")
        source=packaged.get('raw_text','')
        if source not in lines or is_neg(source) or is_univ(source) or has_bare_ambiguous_reader(source):
            raise ValueError(f"page {page} audited source row failed safety/exact-text check: {case['record_id']}")
        try:
            readers,unresolved=resolve_readers(case['readers'],set())
        except Unresolved as exc:
            raise ValueError(f"page {page} audited reader group unresolved: {case['record_id']}") from exc
        if unresolved.strip(' ،,؛.') or not readers or 'Q05-R02' in readers:
            raise ValueError(f"page {page} audited reader group invalid: {case['record_id']}")
        loc=T.find(page,case['anchor'],ayah=case['ayah'])
        if loc['baseText']!=case['base'] or case['variant']==loc['baseText']:
            raise ValueError(f"page {page} audited token/form mismatch: {case['record_id']}")
        before=len(out)
        yield_block(page,case['anchor'],[
            (None,'وجه حفص المطابق لرسم المصحف',ALL20-readers),
            (case['variant'],f"{case['description']}؛ {case['readers']}",readers),
        ],out,ayah=case['ayah'])
        if len(out)!=before+1:
            raise ValueError(f"page {page} audited partition did not resolve: {case['record_id']}")
        variant=out[-1]
        variant['sources'][0].update({'sourceReference':f"qiraat_records.jsonl، {case['record_id']}",
                                      'sourceText':source,
                                      'verificationNotes':'المصدر يصرّح بالقراء، ورُبط الوجه برمز الكلمة المحقق في مصحف رواية حفص.'})
    return out

def checked_page303_farsh(page, lines):
    """Recover the page-303 forms the generic block parser cannot safely segment.

    The source combines several alternative forms on one prose line, and one header uses the
    non-Hafs form as its anchor. Keep this correction local to that page, use only explicit
    reader groups, and resolve every stored baseText through the real Mushaf token fixtures.
    Rows use the project convention for bare «خلف» and reserve «خلف العاشر» for the tenth reader.
    """
    if page != 303:
        return []

    base_hamiah, rest = resolve_readers('نافع، ابن كثير، أبو عمرو، حفص، يعقوب', set())
    if rest.strip(' ،,؛.') or 'Q05-R02' not in base_hamiah:
        raise ValueError('page 303 حامية base group did not resolve with Hafs')

    cases = [
        {
            'anchor': 'حَمِئَةٍ', 'ayah': 86, 'variantText': 'حَامِيَةٍ',
            'readingIds': ALL20 - base_hamiah, 'differenceType': 'LETTER',
            'description': 'بألف بعد الحاء مع كسر الميم وهمزة ياء',
            'sourceFragment': 'بألف بعد الحاء',
        },
        {
            'anchor': 'يُسْرٗا', 'ayah': 88, 'variantText': 'يُسُرًا',
            'readerGroup': 'أبو جعفر', 'differenceType': 'HARAKAH',
            'description': 'بضم السين', 'sourceFragment': 'بضم السين ﴿يُسُرًا﴾',
        },
        {
            # The printed header quotes Ibn Kathir's alternate form, while the same source line
            # explicitly gives the Hafs/bāqīn form that matches the real Mushaf token.
            'anchor': 'مَكَّنِّي', 'ayah': 95, 'variantText': 'مَكَّنَنِي',
            'readerGroup': 'ابن كثير', 'differenceType': 'LETTER',
            'description': 'بنونين مظهرتين', 'sourceFragment': 'بنونين مظهرتين',
            'anchorNote': 'رُبط باللفظ المطبوع للمصحف المذكور في سطر الباقين؛ عنوان الكتلة هو وجه ابن كثير.',
        },
        {
            # The source quotes the full phrase, but only the second real token changes.
            'anchor': 'ءَاتُونِىٓ', 'ayah': 96, 'variantText': 'ائْتُونِي',
            'readerGroup': 'شعبة', 'differenceType': 'HAMZ',
            'description': 'بهمزة وصل لشعبة', 'sourceFragment': 'بهمزة وصل ﴿رَدْمًا ائْتُونِي﴾',
        },
        {
            'anchor': 'ٱسْطَـٰعُوٓاْ', 'ayah': 97, 'variantText': 'اسْطَّاعُوا',
            'readerGroup': 'حمزة', 'differenceType': 'LETTER',
            'description': 'بتشديد الطاء لحمزة', 'sourceFragment': 'بتشديد الطاء',
        },
    ]

    out=[]
    for case in cases:
        source_matches=[line for line in lines if case['sourceFragment'] in line]
        if len(source_matches) != 1:
            raise ValueError(f"page 303 source row not unique: {case['sourceFragment']}")
        source_text=source_matches[0]
        if case['variantText'] not in source_text:
            raise ValueError(f"page 303 source row does not contain variant: {case['variantText']}")
        reading_ids=case.get('readingIds')
        if reading_ids is None:
            reading_ids, unresolved=resolve_readers(case['readerGroup'], set())
            if unresolved.strip(' ،,؛.'):
                raise Unresolved(f"page 303 explicit group not fully resolved: {unresolved}")
        if not reading_ids or reading_ids == ALL20 or 'Q05-R02' in reading_ids:
            raise ValueError(f"page 303 variant group is empty, universal, or includes Hafs: {case}")
        loc=T.find(page, case['anchor'], 1, case['ayah'])
        if case['variantText'] == loc['baseText']:
            raise ValueError(f"page 303 source form does not differ from base token: {case}")
        lid=f"D303-{loc['surah']}-{loc['startAyah']}-{loc['startWord']}"
        variant_id=f'v-{lid}-w2'
        source={**SRC,
            'sourceReference':'وثيقة الاستخراج المبوّب، صفحة المصحف 303، الكلمات الفرشية',
            'sourceText':source_text}
        if case.get('anchorNote'):
            source['verificationNotes'] += ' ' + case['anchorNote']
        out.append({
            'id':variant_id,'surah':loc['surah'],'ayah':loc['startAyah'],
            'startToken':loc['startWord'],'endToken':loc['endWord'],'operation':'REPLACE',
            'hafsText':loc['baseText'],'variantText':case['variantText'],
            'differenceType':case['differenceType'],'verificationStatus':'REVIEWED',
            'createdAt':TS,'updatedAt':TS,'readingIds':sorted(reading_ids),
            'locusId':lid,'locusType':'word_variant',
            'sources':[{'id':f's-{lid}-w2','variantId':variant_id,**source}],
            'description':case['description'],'wajhIndex':2,'evidence':[],
        })
    return out

def checked_inline_farsh(page, lines):
    """Import the externally audited, one-explicit-alternate inline farsh rows.

    These rows put the default/remainder and the named alternate on one line rather than in
    separate header blocks. Keep the scope explicit and narrow: each case records its exact
    anchor, alternate form, reader group, and source fragment. The source must still resolve to
    a real page token and form a clean 20-reading partition before yield_block emits anything.
    """
    cases = {
        268: [{
            'anchor': 'يُنبِتُ', 'ayah': 11, 'variantText': 'نُنبِتُ',
            'readerGroup': 'شعبة', 'sourceFragment': 'وبالنون ﴿نُنبِتُ﴾ لشعبة',
        }],
        274: [{
            'anchor': 'يَجْحَدُونَ', 'ayah': 71, 'variantText': 'تَجْحَدُونَ',
            'readerGroup': 'شعبة ورويس', 'sourceFragment': 'وبتاء الخطاب ﴿تَجْحَدُونَ﴾ لشعبة ورويس',
        }],
        287: [{
            'anchor': 'النَّبِيِّـۧنَ', 'ayah': 55, 'variantText': 'النَّبِيئِينَ',
            'readerGroup': 'نافع', 'sourceFragment': 'وبالهمز والمد المتصل ﴿النَّبِيئِينَ﴾ لنافع',
        }],
        296: [{
            'anchor': 'وَلَا يُشْرِكُ', 'ayah': 26, 'variantText': 'وَلَا تُشْرِكْ',
            'readerGroup': 'ابن عامر', 'sourceFragment': 'وبتاء الخطاب وجزم الكاف ﴿وَلَا تُشْرِكْ﴾ لابن عامر',
        }],
        297: [{
            'anchor': 'بِٱلْغَدَوٰةِ', 'ayah': 28, 'variantText': 'بِالْغُدْوَةِ',
            'readerGroup': 'ابن عامر', 'sourceFragment': 'وبواو مضمومة ﴿بِالْغُدْوَةِ﴾ لابن عامر',
        }],
        298: [{
            'anchor': 'مِّنْهَا', 'ayah': 36, 'variantText': 'مِنْهُمَا',
            'readerGroup': 'نافع، ابن كثير، ابن عامر، أبو جعفر',
            'sourceFragment': 'وبالتثنية ﴿مِنْهُمَا﴾ لنافع، وابن كثير، وابن عامر، وأبي جعفر',
        }],
        410: [{
            'anchor': 'يَسْتَخِفَّنَّكَ', 'ayah': 60, 'variantText': 'يَسْتَخِفَّنكَ',
            'readerGroup': 'رويس', 'sourceFragment': 'وبنون خفيفة مخففة ﴿يَسْتَخِفَّنكَ﴾ لرويس',
        }],
        411: [{
            'anchor': 'أُذُنَيْهِ', 'ayah': 7, 'variantText': 'أُذْنَيْهِ',
            'readerGroup': 'نافع', 'sourceFragment': 'وبإسكان الذال ﴿أُذْنَيْهِ﴾ لنافع',
        }],
        412: [{
            'anchor': 'مِثْقَالَ', 'ayah': 16, 'variantText': 'مِثْقَالُ',
            'readerGroup': 'نافع، أبو جعفر', 'sourceFragment': 'وبالرفع ﴿مِثْقَالُ﴾ لنافع وأبي جعفر',
        }],
        422: [{
            'anchor': 'وَلَا تَبَرَّجْنَ', 'ayah': 33, 'variantText': 'وَلَا تَّبَرَّجْنَ',
            'readerGroup': 'البزي', 'sourceFragment': 'وبتشديد التاء وصلاً ﴿وَلَا تَّبَرَّجْنَ﴾ للبزي',
        }],
        572: [{
            'anchor': 'تَقُولَ', 'ayah': 5, 'variantText': 'تَقَوَّلَ',
            'readerGroup': 'يعقوب', 'sourceFragment': 'بفتح التاء والقاف وتشديد الواو المفتوحة ﴿تَقَوَّلَ﴾ ليعقوب',
        }],
        573: [{
            'anchor': 'لِبَدٗا', 'ayah': 19, 'variantText': 'لُبَدًا',
            'readerGroup': 'هشام', 'condition': 'في وجهه الثاني',
            'sourceFragment': 'بضم اللام ﴿لُبَدًا﴾ لهشام في وجهه الثاني',
        }, {
            'anchor': 'لِّيَعْلَمَ', 'ayah': 28, 'variantText': 'لِيُعْلَمَ',
            'readerGroup': 'رويس', 'readerTail': 'لرويس',
            'sourceFragment': 'بضم الياء مبنياً للمجهول ﴿لِيُعْلَمَ﴾ لرويس',
        }],
        576: [{
            'anchor': 'تِسْعَةَ عَشَرَ', 'ayah': 30, 'variantText': 'تِسْعَةَ عْشَرَ',
            'readerGroup': 'أبو جعفر', 'sourceFragment': 'بإسكان العين ﴿تِسْعَةَ عْشَرَ﴾ لأبي جعفر',
        }],
        580: [{
            'anchor': 'عُذْرًا', 'ayah': 6, 'variantText': 'عُذُرًا',
            'readerGroup': 'روح', 'sourceFragment': 'بضم الذال ﴿عُذُرًا﴾ لروح',
        }, {
            'anchor': 'نُذْرًا', 'ayah': 6, 'variantText': 'نُذُرًا',
            'readerGroup': 'نافع، ابن كثير، ابن عامر، شعبة، أبو جعفر، يعقوب',
            'sourceFragment': 'بضم الذال ﴿نُذُرًا﴾ لنافع، وابن كثير، وابن عامر، وشعبة، وأبي جعفر، ويعقوب',
        }],
        584: [{
            'anchor': 'تَزَكَّىٰٓ', 'ayah': 18, 'variantText': 'تَزَّكَّى',
            'readerGroup': 'نافع، ابن كثير، أبو جعفر، يعقوب',
            'sourceFragment': 'بتشديد الزاي ﴿تَزَّكَّى﴾ لنافع، وابن كثير، وأبي جعفر، ويعقوب',
        }],
    }
    out=[]
    for case in cases.get(page, []):
        matches=[line for line in lines if case['sourceFragment'] in line]
        if len(matches) != 1:
            raise ValueError(f"page {page} audited farsh row not unique: {case['sourceFragment']}")
        source_text=matches[0]
        if is_neg(source_text) or is_univ(source_text):
            continue
        pre,sep,body=source_text.partition(':')
        if not sep or BRACE.findall(pre) != [case['anchor']]:
            continue
        clauses=[x.strip() for x in body.split('؛') if x.strip()]
        if len(clauses) != 2:
            continue
        alternate_clauses=[x for x in clauses if case['sourceFragment'] in x]
        remainder_clauses=[x for x in clauses if any(
            marker in x for marker in ('للجمهور','الجمهور','الباقون','الباقين','للباقون','للباقين'))]
        if len(alternate_clauses) != 1 or len(remainder_clauses) != 1:
            continue
        alternate_clause=alternate_clauses[0]
        if BRACE.findall(alternate_clause) != [case['variantText']]:
            continue
        condition=case.get('condition')
        parse_clause=alternate_clause.replace(condition,'') if condition else alternate_clause
        try:
            parsed=explicit_reader_clause(parse_clause)
        except Unresolved:
            parsed=None
        if not parsed and case.get('readerTail'):
            tail=case['readerTail']
            tail_at=parse_clause.rfind(tail)
            suffix=parse_clause[tail_at+len(tail):] if tail_at>=0 else ''
            readers,unresolved=resolve_readers(case['readerGroup'],set())
            if tail_at>=0 and not suffix.strip(' .،,؛') and not unresolved.strip(' ،,؛.'):
                description=parse_clause[:tail_at].strip(' و،,؛.')
                parsed=(description,readers,False,None)
        if not parsed:
            continue
        description,reading_ids,alternate,note=parsed
        if alternate or note:
            continue
        if condition:
            description=f'{description}؛ {condition}'
        expected,unresolved=resolve_readers(case['readerGroup'],set())
        if unresolved.strip(' ،,؛.') or reading_ids != expected:
            continue
        base_ids=ALL20-reading_ids
        if not base_ids or 'Q05-R02' not in base_ids or reading_ids & base_ids:
            continue
        try:
            loc=T.find(page,case['anchor'],1,case['ayah'])
        except T.NoMatch:
            continue
        if case['variantText'] == loc['baseText']:
            continue
        before=len(out)
        yield_block(page,case['anchor'],[
            (None,remainder_clauses[0],base_ids),
            (case['variantText'],description,reading_ids),
        ],out)
        if len(out) != before+1:
            continue
        variant=out[-1]
        variant['sources'][0].update({
            'sourceReference':f"وثيقة الاستخراج المبوّب، صفحة المصحف {page}، الكلمات الفرشية",
            'sourceText':source_text,
        })
    out.extend(checked_audited_inline_faces(page, lines))
    out.extend(checked_audited_507_510_farsh(page, lines))
    out.extend(checked_audited_515_518_farsh(page, lines))
    out.extend(checked_audited_495_498_farsh(page, lines))
    out.extend(checked_audited_471_474_farsh(page, lines))
    out.extend(checked_audited_459_462_farsh(page, lines))
    return out

def checked_audited_459_462_farsh(page, lines):
    """Recover the explicit, source-partitioned farsh faces on pages 459--462.

    These compact rows do not use the generic two-clause shape (and some describe
    performance faces with the same rasm).  Keep the additions fail-closed: every
    row is identified by its processed-package record and every anchor is resolved
    against the real page token.  A bare ``خلف`` is resolved as Khalaf from Hamza
    (Q06); Q10 is never inferred.
    """
    cases = {
      459: [
        ('DOCX-P459-R02653','يَرْضَهُ','يَرْضَهُ','نافع، هشام، عاصم، حمزة، يعقوب',7,'بضم الهاء وقصرها',False),
        ('DOCX-P459-R02654','يَرْضَهُ','يَرْضَهُ','ابن كثير، الدوري عن أبي عمرو، ابن ذكوان، الكسائي، ابن وردان، خلف',7,'بضم الهاء وإشباع صلتها',False),
        ('DOCX-P459-R02655','يَرْضَهُ','يَرْضَهُ','أبو عمرو، هشام، ابن جماز',7,'بإسكان الهاء',False),
        ('DOCX-P459-R02656','لِّيُضِلَّ','لِيَضِلَّ','ابن كثير، أبو عمرو، رويس',8,'بفتح الياء',False),
        ('DOCX-P459-R02657','أَمَّنْ هُوَ','أَمَنْ هُوَ','الباقين',9,'بتخفيف الميم',False),
      ],
      460: [
        ('DOCX-P460-R02664','وَأَهْلِيهِمْ','وَأَهْلِيهُمُ','يعقوب',15,'بضم الهاء',False),
        ('DOCX-P460-R02665','لَـٰكِنِ الَّذِينَ','لَـٰكِنَّ الَّذِينَ','أبو جعفر',20,'بتشديد النون وفتحها وصلاً',False),
      ],
      461: [
        ('DOCX-P461-R02672','فَهُوَ','فَهُوَ','قالون، أبو عمرو، الكسائي، أبو جعفر',22,'بإسكان الهاء',True),
        ('DOCX-P461-R02673','وَقِيلَ','وَقِيلَ','هشام، الكسائي، رويس',24,'بالإشمام',True),
        ('DOCX-P461-R02674','الْقُرْءَانِ','الْقُرَانِ','ابن كثير',27,'بنقل الهمزة',False),
        ('DOCX-P461-R02674','قُرْءَانًا','قُرَانًا','ابن كثير',28,'بنقل الهمزة',False),
        ('DOCX-P461-R02675','سَلَمٗا','سَالِمًا','الباقين',29,'بكسر السين وألف بعد اللام',False),
      ],
      462: [
        ('DOCX-P462-R02679','عَبْدَهُۥ','عِبَادَهُ','حمزة، الكسائي، أبو جعفر، خلف',36,'بالجمع',False),
        ('DOCX-P462-R02681','كَـٰشِفَـٰتُ ضُرِّهِۦٓ','كَاشِفَاتٌ ضُرَّهُ','أبو عمرو، يعقوب',38,'بتنوين الاسمين ونصب ضره',False),
        ('DOCX-P462-R02681','مُمْسِكَـٰتُ رَحْمَتِهِۦٓ','مُمْسِكَاتٌ رَحْمَتَهُ','أبو عمرو، يعقوب',38,'بتنوين الاسمين ونصب رحمته',False),
        ('DOCX-P462-R02682','مَكَانَتِكُمْ','مَكَانَاتِكُمْ','شعبة',39,'بالجمع',False),
      ],
    }
    out=[]
    for sid,anchor,alternate,reader_text,ayah,description,performance in cases.get(page,[]):
        row=PACKAGE_RECORDS.get(sid)
        if not row or row.get('page_no')!=page or row.get('raw_text') not in lines:
            continue
        source=row['raw_text']
        if is_neg(source) or is_univ(source):
            continue
        try:
            readers, unresolved=resolve_readers(reader_text,set())
            loc=T.find(page,anchor,1,ayah=ayah)
        except (Unresolved,T.NoMatch):
            continue
        if unresolved.strip(' ،,؛.') or not readers:
            continue
        base_ids=ALL20-readers
        if not base_ids or 'Q05-R02' not in base_ids or readers & base_ids:
            continue
        before=len(out)
        yield_block(page,anchor,[(None,'بالوجه المطبوع في حفص',base_ids),
            (alternate,description,readers)],out,ayah=ayah)
        if len(out)!=before+1:
            continue
        v=out[-1]
        # Each compact source row is its own face, even when two faces share the
        # same token text (for example hāʾ sukūn versus hāʾ ṣila).  Keep fixture
        # IDs/source IDs unique so additive reruns cannot alias those faces.
        safe_sid=re.sub(r'[^A-Za-z0-9_-]+','-',sid)
        old_id=v['id']; v['id']=f'{old_id}-{safe_sid}'
        v['locusId']=f'{v["locusId"]}-{safe_sid}'
        for source_item in v.get('sources',[]):
            source_item['id']=f'{source_item["id"]}-{safe_sid}'
            source_item['variantId']=v['id']
        v['sources'][0].update({'sourceReference':f'وثيقة الاستخراج المبوّب، صفحة المصحف {page}، {sid}',
            'sourceText':source,'verificationNotes':'وجه صريح طوبق على رمز الصفحة، مع حل خلف إلى خلف عن حمزة (Q06).'})
        if performance:
            v['locusType']='performance_variant'; v['performanceNote']=description
    return out

def checked_audited_471_474_farsh(page, lines):
    """Recover explicit, token-safe farsh rows on pages 471--474.

    The source rows use prose partitions rather than the two-face block shape.  Keep
    these additions deliberately small and fail closed through the normal token and
    reader resolvers; the two multi-word/orthographic rows are left to later review.
    """
    cases = {
        471: [
            ('DOCX-P471-FARSH-FAATLI3', 'فَأَطَّلِعَ', 'فَأَطَّلِعُ', 'حفص', 37, 'برفع العين', True),
            ('DOCX-P471-FARSH-SUDD', 'وَصُدَّ', 'وَصَدَّ', 'عاصم، حمزة، الكسائي، يعقوب، خلف', 37, 'بفتح الصاد', True),
            ('DOCX-P471-FARSH-WAHUWA', 'وَهُوَ', 'وَهْوَ', 'قالون، أبو عمرو، الكسائي، أبو جعفر', 40, 'بإسكان الهاء'),
            ('DOCX-P471-FARSH-YADKHULUN', 'يَدْخُلُونَ', 'يُدْخَلُونَ', 'نافع، ابن عامر، حفص، حمزة، الكسائي، خلف', 40, 'بضم الياء وفتح الخاء', True),
        ],
        472: [
            ('DOCX-P472-FARSH-ADKHILU', 'أَدْخِلُوٓاْ', 'ٱدْخُلُوا', 'نافع، حفص، حمزة، الكسائي، أبو جعفر، يعقوب، خلف', 46, 'بهمزة وصل تضم ابتداءً وضم الخاء', True),
        ],
        473: [
            ('DOCX-P473-FARSH-RUSULUKUM', 'رُسُلُكُم', 'رُسْلُكُمْ', 'أبو عمرو', 50, 'بإسكان السين'),
            ('DOCX-P473-FARSH-RUSULANA', 'رُسُلَنَا', 'رُسْلَنَا', 'أبو عمرو', 51, 'بإسكان السين'),
            ('DOCX-P473-FARSH-LAYANFA', 'يَنفَعُ', 'تَنفَعُ', 'نافع، عاصم، حمزة، الكسائي، خلف', 52, 'بتاء التأنيث', True),
            ('DOCX-P473-FARSH-TATADHAKKARUN', 'تَتَذَكَّرُونَ', 'يَتَذَكَّرُونَ', 'عاصم، حمزة، الكسائي، خلف', 58, 'بياء الغيب', True),
        ],
        474: [
            ('DOCX-P474-FARSH-SAYADKHULUN', 'سَيَدْخُلُونَ', 'سَيُدْخَلُونَ', 'نافع، أبو عمرو، ابن عامر، حفص، حمزة، الكسائي، روح، خلف', 60, 'بضم الياء وفتح الخاء مبنياً للمجهول', True),
        ],
    }
    out = []
    for case in cases.get(page, []):
        record_id, anchor, alternate, reader_group, ayah, description, *rest = case
        complement = bool(rest and rest[0])
        try:
            reading_ids, unresolved = resolve_readers(reader_group, set())
        except Unresolved:
            continue
        if unresolved.strip(' ،,؛.') or not reading_ids:
            continue
        if complement:
            reading_ids = ALL20 - reading_ids
        base_ids = ALL20 - reading_ids
        if not base_ids or 'Q05-R02' not in base_ids or reading_ids & base_ids:
            continue
        before = len(out)
        yield_block(page, anchor, [
            (None, 'بالوجه المطبوع في حفص', base_ids),
            (alternate, description, reading_ids),
        ], out, ayah=ayah)
        if len(out) == before + 1:
            out[-1]['sources'][0].update({
                'sourceReference': f'وثيقة الاستخراج المبوّب، صفحة المصحف {page}، الكلمات الفرشية ({record_id})',
                'sourceText': 'سطر صريح من استخراج القراءات العشر؛ حُفظت الأوجه المتعينة فقط.',
            })
    return out

def checked_audited_495_498_farsh(page, lines):
    """Recover compact farsh rows on pages 495--498 with explicit reader partitions."""
    cases={
      495:[
       ('DOCX-P495-R02983','لَدَيْهِمْ','لَدَيْهُمُ','حمزة، يعقوب','بضم الهاء',1),
       ('DOCX-P495-R02984','وَلَدٌ','وُلْدٌ','حمزة، الكسائي','بضم الواو وسكون اللام',1),
       ('DOCX-P495-R02986','يُلَـٰقُواْ','يَلْقَوْا','أبو جعفر','بحذف الألف مع فتح الياء واللام',1),
       ('DOCX-P495-R02987','وَهُوَ','وَهْوَ','قالون، أبو عمرو، الكسائي، أبو جعفر','بإسكان الهاء',1),
       ('DOCX-P495-R02987','وَهُوَ','وَهْوَ','قالون، أبو عمرو، الكسائي، أبو جعفر','بإسكان الهاء',2),
       ('DOCX-P495-R02990','تُرْجَعُونَ','يُرْجَعُونَ','ابن كثير، حمزة، الكسائي، خلف','بياء الغيب وضمها وفتح الجيم',1),
       ('DOCX-P495-R02991','تُرْجَعُونَ','يَرْجِعُونَ','رويس','بياء الغيب وفتحها وكسر الجيم',1),
       ('DOCX-P495-R02992','تُرْجَعُونَ','تَرْجِعُونَ','روح','بتاء الخطاب وفتحها وكسر الجيم',1),
       ('DOCX-P495-R02993','وَقِيلِهِۦ','وَقِيلَهُۥ','عاصم، حمزة','بنصب اللام وضم الهاء',1),
       ('DOCX-P495-R02994','يَعْلَمُونَ','تَعْلَمُونَ','الباقين','بتاء الخطاب',1),
      ],
      496:[
       ('DOCX-P496-R02998','حمٓ','حمٓ','أبو جعفر','بالسكت',1),
       ('DOCX-P496-R02999','رَبِّ السَّمَـٰوَٰتِ','رَبُّ السَّمَـٰوَٰتِ','الباقين','برفع الباء',1),
       ('DOCX-P496-R03000','نَبْطِشُ','نَبْطُشُ','أبو جعفر','بضم الطاء',1),
      ],
      497:[
       ('DOCX-P497-R03008','فَأَسْرِ','فَاسْرِ','الباقين','بهمزة وصل',1),
       ('DOCX-P497-R03009','وَعُيُونٍ','وَعُيُونٍ','الباقين','بكسر العين',1),
       ('DOCX-P497-R03010','فَـٰكِهِينَ','فَكِهِينَ','أبو جعفر','بحذف الألف',1),
      ],
      498:[
       ('DOCX-P498-R03021','يَغْلِي','تَغْلِي','الباقين','بتاء التأنيث',1),
       ('DOCX-P498-R03022','فَٱعْتِلُوهُ','فَاعْتُلُوهُ','الباقين','بضم التاء',1),
       ('DOCX-P498-R03023','ذُقْ إِنَّكَ','ذُقْ أَنَّكَ','الكسائي','بفتح الهمزة المشددة',1),
       ('DOCX-P498-R03024','مَقَامٍ أَمِينٍ','مُقَامٍ أَمِينٍ','الباقين','بضم الميم',1),
       ('DOCX-P498-R03025','وَعُيُونٍ','وَعُيُونٍ','الباقين','بكسر العين',1),
      ],
    }
    explicit={
      (495,'DOCX-P495-R02994'):{'ابن كثير، أبو عمرو، عاصم، حمزة، الكسائي، يعقوب، خلف'},
      (496,'DOCX-P495-R02999'):set(),
      (496,'DOCX-P496-R02999'):{'عاصم، حمزة، الكسائي، خلف'},
      (497,'DOCX-P497-R03008'):{'أبو عمرو، ابن عامر، عاصم، حمزة، الكسائي، يعقوب، خلف'},
      (497,'DOCX-P497-R03009'):{'نافع، أبو عمرو، هشام، حفص، أبو جعفر، يعقوب، خلف'},
      (498,'DOCX-P498-R03021'):{'ابن كثير، حفص، رويس'},
      (498,'DOCX-P498-R03022'):{'أبو عمرو، عاصم، حمزة، الكسائي، أبو جعفر، خلف'},
      (498,'DOCX-P498-R03024'):{'ابن كثير، أبو عمرو، عاصم، حمزة، الكسائي، يعقوب، خلف'},
      (498,'DOCX-P498-R03025'):{'نافع، أبو عمرو، هشام، حفص، أبو جعفر، يعقوب، خلف'},
    }
    out=[]
    for sid,anchor,variant,reader_text,desc,occ in cases.get(page,[]):
      row=PACKAGE_RECORDS.get(sid)
      if not row or row.get('page_no')!=page or row.get('raw_text') not in lines: continue
      if is_neg(row['raw_text']) or is_univ(row['raw_text']): continue
      try: loc=T.find(page,anchor,occ)
      except T.NoMatch: continue
      if reader_text=='الباقين':
        claimed=set()
        names=explicit.get((page,sid),set())
        for name in names:
          rs,_=resolve_readers(name,set()); claimed |= rs
        readers=ALL20-claimed
      else: readers,_=resolve_readers(reader_text,set())
      if not readers or 'Q05-R02' in readers: continue
      before=len(out); yield_block(page,anchor,[(None,'وجه حفص المطابق لرسم المصحف',ALL20-readers),(variant,desc,readers)],out,occurrence=occ)
      if len(out)==before+1:
        out[-1]['sources'][0].update({'sourceReference':f'qiraat_records.jsonl، {sid}','sourceText':row['raw_text'],'verificationNotes':'إسناد صريح، وربط بالرمز الحقيقي في صفحة المصحف.'})
        if variant==loc['baseText']:
          out[-1]['locusType']='performance_variant';out[-1]['performanceNote']=desc
    return out

def checked_audited_507_510_farsh(page, lines):
    """Import compact farsh rows for pages 507--510.

    The processed package stores these rows as one paragraph per face, so the generic
    block parser cannot prove the remainder partition.  Each case below is fail-closed:
    it requires the exact packaged row, a real page token, an explicit reader set, and a
    Quranpedia apparatus URL.  Same-written-form faces are retained as performance
    variants because they are distinct approved wajh for the named transmissions.
    """
    qp = 'https://quranpedia.net/qiraat/muhammad/'
    A = set(ALL20)
    cases = {
        507: [
            ('DOCX-P507-R03108','وَهُوَ','وَهْوَ','قالون، أبو عمرو، الكسائي، أبو جعفر',2,'بإسكان الهاء',True,qp+'2'),
            ('DOCX-P507-R03110','سَيَهْدِيهِمْ','سَيَهْدِيهُمُ','يعقوب',5,'بضم الهاء',False,qp+'5'),
            ('DOCX-P507-R03111','عَلَيْهِمْ','عَلَيْهُم','حمزة، يعقوب',10,'بضم الهاء',False,qp+'10'),
        ],
        508: [
            ('DOCX-P508-R03116','ءَانِفًا','أَنِفًا','البزي',16,'بقصر الهمزة؛ للبزي بخلف عنه',False,qp+'16'),
        ],
        509: [
            ('DOCX-P509-R03135','وَأَمْلَىٰ','وَأُمْلِي','أبو عمرو',25,'بضم الهمزة وكسر اللام مع إشباع الياء',False,qp+'25'),
            ('DOCX-P509-R03136','وَأَمْلَىٰ','وَأُمْلِيَ','يعقوب',25,'بضم الهمزة وكسر اللام وفتح الياء',False,qp+'25'),
            ('DOCX-P509-R03137','إِسْرَارَهُمْ','أَسْرَارَهُمْ','جميع القراء عدا حفص وحمزة والكسائي وخلف',26,'بفتح الهمزة',False,qp+'26'),
        ],
        510: [
            ('DOCX-P510-R03145','نَعْلَمَ','يَعْلَمَ','شعبة',31,'بياء الغيب في الفعل الثاني',False,qp+'31'),
            ('DOCX-P510-R03146','وَنَبْلُوَاْ','وَنَبْلُو','رويس',31,'بإسكان الواو الأخيرة',False,qp+'31'),
            ('DOCX-P510-R03144','وَنَبْلُوَاْ','وَنَبْلُوَ','جميع القراء عدا شعبة ورويس',31,'بالنون وفتح الواو الأخيرة',False,qp+'31'),
            ('DOCX-P510-R03147','السَّلْمِ','ٱلسِّلْمِ','شعبة، حمزة، خلف العاشر',35,'بكسر السين',False,qp+'35'),
            ('DOCX-P510-R03149','هَـٰٓأَنتُمْ','هَاأَنْتُمْ','البزي، ابن عامر، عاصم، حمزة، الكسائي، يعقوب، خلف',38,'بإثبات الألف وتحقيق الهمزة',True,qp+'38'),
            ('DOCX-P510-R03150','هَـٰٓأَنتُمْ','هَاأَنْتُمْ','قالون، أبو عمرو، أبو جعفر',38,'بإثبات الألف وتسهيل الهمزة',True,qp+'38'),
            ('DOCX-P510-R03151','هَـٰٓأَنتُمْ','هَـٰٓأَنتُمْ','ورش',38,'بحذف الألف وتسهيل الهمزة أو إبدالها ألفاً مشبعة',True,qp+'38'),
            ('DOCX-P510-R03152','هَـٰٓأَنتُمْ','هَأَنْتُمْ','قنبل',38,'بحذف الألف وتحقيق الهمزة',False,qp+'38'),
        ],
    }
    out=[]
    for source_id,anchor,variant,reader_text,ayah,description,performance,url in cases.get(page,[]):
        record=PACKAGE_RECORDS.get(source_id)
        if (record is None or record.get('page_no')!=page or record.get('section')!='farsh' or
                record.get('raw_text') not in lines):
            raise ValueError(f'page {page} audited source row missing: {source_id}')
        source=record['raw_text']
        if is_neg(source) or is_univ(source):
            raise ValueError(f'page {page} audited source row failed safety check: {source_id}')
        if reader_text == 'الباقين':
            readers=A-{'Q05-R02'}
        elif reader_text == 'جميع القراء عدا شعبة ورويس':
            readers=A-{'Q05-R01','Q09-R01'}
        elif reader_text.startswith('جميع القراء عدا'):
            readers=readers_from(reader_text,set())
        else:
            readers,unresolved=resolve_readers(reader_text,set())
            if unresolved.strip(' ،,؛.'):
                raise Unresolved(f'page {page} audited reader group unresolved: {source_id}: {unresolved}')
        if not readers or (not performance and 'Q05-R02' in readers and reader_text not in ('الباقين',)):
            # A named non-Hafs face must never be emitted as the Hafs baseline.  The
            # three-way p509 row is handled by its remainder branch above.
            if source_id not in ('DOCX-P509-R03134','DOCX-P510-R03144'):
                raise ValueError(f'page {page} audited face includes Hafs: {source_id}')
        try:
            loc=T.find(page,anchor,ayah=ayah)
        except T.NoMatch as exc:
            raise ValueError(f'page {page} audited token did not resolve: {source_id}') from exc
        # A same-written-form wajh is not a 20-way partition: its reader set
        # intentionally overlaps the Hafs baseline.  Store it directly as a
        # performance variant rather than forcing yield_block's disjoint partition.
        if performance:
            if source_id == 'DOCX-P510-R03149':
                # The source's bare «خلف» is Q06 by project rule.  Quranpedia's
                # independent apparatus separately names إسحاق/إدريس عن خلف for
                # this same written face, so retain Q10 as an independently verified
                # additional transmission.
                readers |= {'Q10-R01','Q10-R02'}
            vid=f'v-AUDIT-P{page}-{loc["surah"]}-{ayah}-{loc["startWord"]}-P{len(out)+1}'
            lid=f'AUDIT-P{page}-{loc["surah"]}-{ayah}-{loc["startWord"]}-P{len(out)+1}'
            out.append({'id':vid,'surah':loc['surah'],'ayah':loc['startAyah'],
                'startToken':loc['startWord'],'endToken':loc['endWord'],'operation':'REPLACE',
                'hafsText':loc['baseText'],'variantText':loc['baseText'],
                'differenceType':'HARAKAH','verificationStatus':'REVIEWED',
                'createdAt':TS,'updatedAt':TS,'readingIds':sorted(readers),'locusId':lid,
                'locusType':'performance_variant','performanceNote':description,
                'sources':[{'id':f's-{lid}','variantId':vid,**SRC,
                    'sourceReference':f'qiraat_records.jsonl، {source_id}',
                    'sourceText':source,
                    'verificationNotes':f'إسناد صريح من المصدر، وربط بالرمز الحقيقي للكلمة؛ راجع جهاز القراءات المستقل: {url}'}],
                'description':description,'wajhIndex':len(out)+1,'evidence':[]})
            continue
        before=len(out)
        yield_block(page,anchor,[
            (None,'وجه حفص المطابق لرسم المصحف',A-readers),
            (variant,description,readers),
        ],out,ayah=ayah)
        if len(out)!=before+1:
            # Existing rows may already carry this exact face.  Leave dedupe to build().
            continue
        v=out[-1]
        v['locusType']='performance_variant' if performance else 'word_variant'
        if performance:
            v['performanceNote']=description
        v['sources'][0].update({
            'sourceReference':f'qiraat_records.jsonl، {source_id}',
            'sourceText':source,
            'verificationNotes':f'إسناد صريح من المصدر، وربط بالرمز الحقيقي للكلمة؛ راجع جهاز القراءات المستقل: {url}',
        })
    return out

def checked_audited_515_518_farsh(page, lines):
    """Import the compact inline farsh rows for pages 515--518.

    These rows contain several clauses on one line (and page 515 includes three mīm/hā
    faces), so the generic block parser cannot prove a 20-reading partition.  Each entry
    below is still fail-closed: the exact packaged source row, real Mushaf token and an
    explicit reader set are required before emitting a face.  Bare ``خلف`` is Q06 per the
    project convention; Q10 is only used when named separately.
    """
    cases = {
        515: [
            ('DOCX-P515-R03186','وَرِضْوَٰنٗا','وَرُضْوَانًا','شعبة','بضم الراء'),
            ('DOCX-P515-R03187','شَطْـَٔهُۥ','شَطَاهُ','ابن كثير','بفتح الطاء وألف بعدها بلا همز'),
            ('DOCX-P515-R03188','فَـَٔازَرَهُۥ','فَأَزَرَهُ','ابن ذكوان','بقصر الهمزة وسكون الهمزة'),
            ('DOCX-P515-R03189','سُوقِهِۦ','سُؤْقِهِ','قنبل','بهمز ساكن واواً'),
            ('DOCX-P515-R03189','سُوقِهِۦ','سُئُوقِهِ','قنبل','بهمزة مضمومة بعد السين وبعدها واو ساكنة؛ الوجه الثاني لقنبل'),
            ('DOCX-P515-R03190','بِهِمُ الْكُفَّارَ','بِهِمِ الْكُفَّارَ','أبو عمرو، يعقوب','بكسر الهاء والميم'),
            ('DOCX-P515-R03190','بِهِمُ الْكُفَّارَ','بِهُمُ الْكُفَّارَ','حمزة، الكسائي، خلف','بضم الهاء والميم'),
            ('DOCX-P515-R03191','لَا تُقَدِّمُواْ','لَا تَقَدَّمُوا','يعقوب','بفتح التاء والدال مشددة'),
            ('DOCX-P515-R03192','النَّبِيِّ','النَّبِيءِ','نافع','بالهمز'),
            ('DOCX-P515-R03193','الْحُجُرَٰتِ','الْحَجَرَاتِ','أبو جعفر','بفتح الجيم'),
        ],
        516: [
            ('DOCX-P516-R03199','إِلَيْهِمْ','إِلَيْهُم','حمزة، يعقوب','بضم الهاء'),
            ('DOCX-P516-R03200','فَتَبَيَّنُوٓاْ','فَتَثَبَّتُوا','حمزة، الكسائي، خلف','بالثاء المثلثة والتاء المشددة'),
            ('DOCX-P516-R03201','أَخَوَيْكُمْ','إِخْوَتِكُمْ','يعقوب','بالجمع وكسر الهمزة وسكون الخاء'),
            ('DOCX-P516-R03202','تَلْمِزُوٓاْ','تَلْمُزُوا','يعقوب','بضم الميم'),
            ('DOCX-P516-R03203','وَلَا تَنَابَزُواْ','وَلَا تَّنَابَزُوا','البزي','بتشديد التاء وصلاً'),
        ],
        517: [
            ('DOCX-P517-R03209','وَلَا تَجَسَّسُواْ','وَلَا تَّجَسَّسُوا','البزي','بتشديد التاء وصلاً'),
            ('DOCX-P517-R03209','لِتَعَارَفُوٓاْ','لِتَّعَارَفُوا','البزي','بتشديد التاء وصلاً'),
            ('DOCX-P517-R03210','مَّيْتٗا','مَيِّتًا','نافع، أبو جعفر، رويس','بتشديد الياء المكسورة'),
            ('DOCX-P517-R03211','لَا يَلِتْكُم','لَا يَأْلِتْكُمْ','الدوري عن أبي عمرو، يعقوب','بهمز ساكن بعد الياء وكسر اللام'),
            ('DOCX-P517-R03211','لَا يَلِتْكُم','لَا يَالِتْكُمْ','السوسي','بإبدال الهمزة'),
            ('DOCX-P517-R03212','تَعْمَلُونَ','يَعْمَلُونَ','ابن كثير','بياء الغيب'),
        ],
        518: [
            ('DOCX-P518-R03215','قٓ وَالْقُرْءَانِ','قٓ وَالْقُرْءَانِ','أبو جعفر','بالسكت'),
            ('DOCX-P518-R03216','مِتْنَا','مُتْنَا','الباقين','بضم الميم'),
            ('DOCX-P518-R03217','مَّيْتٗا','مَيِّتًا','أبو جعفر','بتشديد الياء المكسورة'),
        ],
    }
    out=[]
    authority_by_page = {
        515:'https://quranpedia.net/qiraat/al-fath/29',
        516:'https://quranpedia.net/qiraat/al-hujurat/5',
        517:'https://quranpedia.net/qiraat/al-hujurat/12',
        518:'https://quranpedia.net/qiraat/qaf/1',
    }
    for source_id,anchor,variant,reader_text,description in cases.get(page,[]):
        packaged=PACKAGE_RECORDS.get(source_id)
        if packaged is None or packaged.get('page_no')!=page or packaged.get('section')!='farsh':
            raise ValueError(f'page {page} audited source row missing: {source_id}')
        source_text=packaged.get('raw_text','')
        if source_text not in lines or is_neg(source_text) or is_univ(source_text):
            raise ValueError(f'page {page} audited source row failed safety check: {source_id}')
        try:
            loc=T.find(page,anchor)
        except T.NoMatch:
            continue
        if reader_text == 'الباقين':
            readers=set(ALL20)-{'Q01-R01','Q01-R02','Q05-R01','Q05-R02','Q06-R01','Q06-R02','Q07-R01','Q07-R02'}
            unresolved=''
        else:
            readers,unresolved=resolve_readers(reader_text,set())
        if unresolved.strip(' ،,؛.') or not readers or 'Q05-R02' in readers:
            raise Unresolved(f'page {page} audited reader group unresolved: {source_id}')
        before=len(out)
        yield_block(page,anchor,[
            (None,'وجه حفص المطابق لرسم المصحف',set(ALL20)-readers),
            (variant,description,readers),
        ],out)
        if len(out)==before+1:
            out[-1]['sources'][0].update({
                'sourceReference':f'qiraat_records.jsonl، {source_id}',
                'sourceText':source_text,
                'verificationNotes':('إسناد صريح من السطر المصدر، ورُبط الوجه برمز الكلمة الحقيقي في صفحة المصحف. '
                                     'المراجعة المستقلة للآية: '+authority_by_page[page])
            })
            if source_id == 'DOCX-P515-R03189':
                out[-1]['locusType']='performance_variant'
                out[-1]['performanceNote']=description
                out[-1]['sources'][0]['sourceReference']='https://quranpedia.net/qiraat/al-fath/29؛ '+out[-1]['sources'][0]['sourceReference']
                out[-1]['sources'][0]['verificationNotes'] += ' المرجع المستقل يثبت الوجهين لقنبل: https://quranpedia.net/qiraat/al-fath/29'
    return out

def checked_audited_inline_faces(page, lines):
    """Import explicitly attributed inline faces verified against source rows and page tokens.

    Multiple source records may describe disjoint faces at one token. Reader overlaps between
    different forms are dropped, while separate, non-overlapping forms are kept together.
    """
    cases = {
        464: [
            # The two Abu Ja'far faces are distinct: Ibn Wardān's alternate has the
            # fully extended final alif, while the other Abu Ja'far face has the
            # ordinary yāʾ substitution.  Keep them separate so the reader key
            # admits both faces instead of collapsing one into the other.
            ('DOCX-P464-R02693','يَـٰحَسْرَتَىٰ','يَاحَسْرَتَيَ','ابن جماز',56,
             'بإبدال الألف ياءً مفتوحة'),
            ('DOCX-P464-R02693','يَـٰحَسْرَتَىٰ','يَاحَسْرَتَايَ','ابن وردان',56,
             'بالمد المشبع'),
        ],
        475: [
            ('DOCX-P475-R02798','فَيَكُونُ','فَيَكُونَ','ابن عامر',68,'بنصب النون'),
            ('DOCX-P475-R02799','رُسُلَنَا','رُسْلَنَا','أبو عمرو',70,'بإسكان السين'),
            ('DOCX-P475-R02801','يُرۡجَعُونَ','يَرْجِعُونَ','يعقوب',77,'بفتح الياء'),
        ],
        476: [
            ('DOCX-P476-R02806','رُسُلُهُم','رُسْلُهُمْ','أبو عمرو',83,'بإسكان السين'),
        ],
        483: [
            ('DOCX-P483-R02875','يُوحِيٓ','يُوحَى','ابن كثير',3,'بفتح الحاء مبنياً للمجهول'),
            ('DOCX-P483-R02876','وَهُوَ','وَهْوَ','قالون، أبو عمرو، الكسائي، أبو جعفر',4,'بإسكان الهاء'),
            ('DOCX-P483-R02878','تَكَادُ السَّمَـٰوَٰتُ يَتَفَطَّرْنَ','تَكَادُ السَّمَاوَاتُ يَتَفَطَّرْنَ','ابن كثير، ابن عامر، حفص، حمزة، أبو جعفر، خلف',5,'بتاء التأنيث وتشديد الطاء'),
            ('DOCX-P483-R02879','تَكَادُ السَّمَـٰوَٰتُ يَتَفَطَّرْنَ','يَكَادُ السَّمَاوَاتُ يَتَفَطَّرْنَ','نافع، الكسائي',5,'بياء التذكير وتشديد الطاء'),
            ('DOCX-P483-R02880','تَكَادُ السَّمَـٰوَٰتُ يَتَفَطَّرْنَ','تَكَادُ السَّمَاوَاتُ يَنفَطِرْنَ','أبو عمرو، شعبة، يعقوب',5,'بتاء التأنيث مع نون ساكنة وتخفيف الطاء'),
            ('DOCX-P483-R02881','عَلَيْهِمْ','عَلَيْهُمُ','حمزة، يعقوب',6,'بضم الهاء'),
            ('DOCX-P483-R02882','قُرْءَانًا','قُرَانًا','ابن كثير',7,'بنقل الهمزة'),
        ],
        484: [
            ('DOCX-P484-R02885','وَهُوَ','وَهْوَ','قالون، أبو عمرو، الكسائي، أبو جعفر',11,'بإسكان الهاء'),
            ('DOCX-P484-R02886','إِبْرَٰهِيمَ','إِبْرَاهَامَ','هشام',13,'بألف بعد الهاء'),
        ],
        485: [
            ('DOCX-P485-R02890','وَعَلَيْهِمْ','وَعَلَيْهُمُ','حمزة، يعقوب',16,'بضم الهاء'),
            ('DOCX-P485-R02891','وَهُوَ','وَهْوَ','قالون، أبو عمرو، الكسائي، أبو جعفر',19,'بإسكان الهاء',1),
            ('DOCX-P485-R02893','نُّؤْتِهِۦ','نُؤْتِهِۦ','ورش، ابن كثير، ابن عامر، حفص، الكسائي، خلف',20,'بإشباع صلة الهاء'),
            ('DOCX-P485-R02894','نُّؤْتِهِۦ','نُؤْتِهِ','قالون، هشام، يعقوب',20,'بقصر الهاء'),
            ('DOCX-P485-R02895','نُّؤْتِهِۦ','نُؤْتِهْ','أبو عمرو، شعبة، حمزة، أبو جعفر',20,'بإسكان الهاء'),
        ],
        486: [
            ('DOCX-P486-R02898','يُبَشِّرُ','يَبْشُرُ','نافع، ابن عامر، عاصم، أبو جعفر، يعقوب، خلف',23,'بفتح الياء وإسكان الباء وضم الشين مخففة'),
            ('DOCX-P486-R02899','وَهُوَ','وَهْوَ','قالون، أبو عمرو، الكسائي، أبو جعفر',25,'بإسكان الهاء',1),
            ('DOCX-P486-R02900','تَفْعَلُونَ','يَفْعَلُونَ','جميع القراء عدا حفص، حمزة، الكسائي، خلف',25,'بياء الغيب'),
            ('DOCX-P486-R02901','يُنَزِّلُ بِقَدَرٍ','يُنْزِلُ بِقَدَرٍ','ابن كثير، أبو عمرو، يعقوب',27,'بتخفيف الزاي'),
            ('DOCX-P486-R02902','يُنَزِّلُ الْغَيْثَ','يُنْزِلُ الْغَيْثَ','ابن كثير، أبو عمرو، ابن عامر، حمزة، الكسائي، أبو جعفر، يعقوب، خلف',28,'بتخفيف الزاي'),
            ('DOCX-P486-R02903','فِيهِمَا','فِيهُمَا','يعقوب',29,'بضم الهاء'),
            ('DOCX-P486-R02904','فَبِمَا كَسَبَتْ','بِمَا كَسَبَتْ','نافع، ابن عامر، أبو جعفر',30,'بحذف الفاء'),
        ],
        387: [
            ('DOCX-P387-R01963','يَبْطِشَ','يَبْطُشَ','أبو جعفر',19,
             'بضم الطاء'),
        ],
        388: [
            ('DOCX-P388-R01974','يَـٰٓأَبَتِ','يَـٰٓأَبَتَ','ابن عامر، أبو جعفر',26,
             'بالفتح'),
            ('DOCX-P388-R01975','هَـٰتَيْنِ','هَاتَيْنِّ','ابن كثير',27,
             'بتشديد النون مع المد المشبع'),
        ],
        389: [
            ('DOCX-P389-R01984','لِّأَهْلِهِ ٱمْكُثُوٓاْ','لِأَهْلِهُ امْكُثُوا','حمزة',29,
             'بضم الهاء وصلاً'),
        ],
        390: [
            ('DOCX-P390-R02003','وَمَن تَكُونُ','وَمَن يَكُونُ','حمزة، الكسائي، خلف',37,
             'بياء التذكير'),
        ],
        383: [
            ('DOCX-P383-R01938','ٱلْقُرْءَانَ','ٱلْقُرَانَ','ابن كثير',76,
             'بنقل الهمزة'),
        ],
        384: [
            ('DOCX-P384-R01941','تُسْمِعُ الصُّمَّ','يَسْمَعُ الصُّمُّ','ابن كثير',80,
             'بياء الغيب ورفع الصم فاعلاً'),
            ('DOCX-P384-R01942','بِهَـٰدِى ٱلْعُمْىِ','تَهْدِي الْعُمْيَ','حمزة',81,
             'بفعل مضارع ونصب العمي'),
            ('DOCX-P384-R01945','أَتَوْهُ','ءَاتَوْهُ','نافع، ابن كثير، أبو عمرو، ابن عامر، الكسائي، أبو جعفر، يعقوب',87,
             'بمد الهمزة وفتح التاء'),
            ('DOCX-P384-R01947','تَفْعَلُونَ','يَفْعَلُونَ','ابن كثير، أبو عمرو، يعقوب',88,
             'بياء الغيب'),
        ],
        385: [
            ('DOCX-P385-R01953','ٱلْقُرْءَانَ','ٱلْقُرَانَ','ابن كثير',92,
             'بنقل الهمزة'),
            ('DOCX-P385-R01954','تَعْمَلُونَ','يَعْمَلُونَ','ابن كثير، أبو عمرو، حمزة، الكسائي، خلف العاشر',93,
             'بياء الغيب'),
        ],
        386: [
            ('DOCX-P386-R01959','وَحَزَنًا','وَحُزْنًا','حمزة، الكسائي، خلف العاشر',8,
             'بضم الحاء وسكون الزاي'),
        ],
        367: [
            ('DOCX-P367-R01789','نُنَزِّلْ عَلَيْهِم','تُنْزِلْ عَلَيْهِم','ابن كثير، أبو عمرو',4,
             'بتاء التأنيث وتخفيف الزاي'),
        ],
        368: [
            ('DOCX-P368-R01802','أَرْجِهْ','أَرْجِئْهُۥ','ابن كثير، هشام',36,
             'بهمزة ساكنة وإشباع ضمة الهاء'),
            ('DOCX-P368-R01803','أَرْجِهْ','أَرْجِئْهُ','أبو عمرو، يعقوب',36,
             'بهمزة ساكنة وقصر ضمة الهاء'),
        ],
        369: [
            ('DOCX-P369-R01812','حَـٰذِرُونَ','حَذِرُونَ','نافع، ابن كثير، أبو عمرو، أبو جعفر، يعقوب',56,
             'بحذف الألف'),
        ],
        352: [
            ('DOCX-P352-R01610','يَأْتَلِ','يَتَأَلَّ','أبو جعفر',22,
             'بياء وتاء مفتوحة بعدها همزة مفتوحة ولام مشددة'),
            ('DOCX-P352-R01612','تَشْهَدُ','يَشْهَدُ','حمزة، الكسائي، خلف العاشر',24,
             'بياء التذكير'),
        ],
        354: [
            ('DOCX-P354-R01637','دُرِّىٌّۭ يُوقَدُ','دُرِّيٌّ تَوَقَّدُ','ابن كثير، أبو جعفر، يعقوب',35,
             'بتاء التأنيث وفتح الواو والقاف مشددة'),
        ],
        399: [
            ('DOCX-P399-R02075','ٱلنُّبُوَّةَ','ٱلنُّبُوءَةَ','نافع',27,
             'بالهمز والمد المتصل'),
        ],
        400: [
            ('DOCX-P400-R02084','إِبْرَٰهِيمَ','إِبْرَاهَامَ','هشام',31,
             'بألف بعد الهاء'),
            ('DOCX-P400-R02085','لَنُنَجِّيَنَّهُۥ','لَنُنْجِيَنَّهُ','حمزة، الكسائي، يعقوب، خلف العاشر',32,
             'بتخفيف الجيم وسكون النون'),
            ('DOCX-P400-R02087','مُنَجُّوكَ','مُنْجُوكَ','ابن كثير، حمزة، الكسائي، رويس، خلف العاشر',33,
             'بتخفيف الجيم'),
            ('DOCX-P400-R02088','مُنزِلُونَ','مُنَزِّلُونَ','ابن عامر',34,
             'بتشديد الزاي'),
        ],
        401: [
            ('DOCX-P401-R02092','يَدْعُونَ','تَدْعُونَ','نافع، ابن كثير، ابن عامر، حمزة، الكسائي، أبو جعفر، خلف العاشر',42,
             'بتاء الخطاب'),
        ],
        402: [
            ('DOCX-P402-R02097','ءَايَـٰتٌۭ','ءَايَةٌ','ابن كثير، حمزة، الكسائي، خلف العاشر',50,
             'بالمفرد'),
        ],
        415: [
            ('DOCX-P415-R02216','خَلَقَهُۥ','خَلْقَهُ','ابن كثير، أبو عمرو، ابن عامر، أبو جعفر، يعقوب',7,
             'باسم مضاف وسكون اللام وضم القاف'),
            ('DOCX-P415-R02221','تُرْجَعُونَ','تَرْجِعُونَ','يعقوب',11,
             'بفتح التاء'),
        ],
        416: [
            ('DOCX-P416-R02224','أُخْفِيَ','أُخْفِي','حمزة، يعقوب',17,
             'بإسكان الياء'),
        ],
        417: [
            ('DOCX-P417-R02230','لَمَّا','لِمَا','حمزة، الكسائي، رويس',24,
             'بكسر اللام وتخفيف الميم'),
        ],
        418: [
            ('DOCX-P418-R02234','ٱلنَّبِىُّ','ٱلنَّبِىءُ','نافع',1,
             'بالهمز والمد'),
            ('DOCX-P418-R02235','تَعْمَلُونَ','يَعْمَلُونَ','أبو عمرو',2,
             'بياء الغيب'),
            ('DOCX-P418-R02243','تُظَـٰهِرُونَ','تَظَّهَّرُونَ','نافع، ابن كثير، أبو عمرو، أبو جعفر، يعقوب',4,
             'بفتح التاء والظاء والهاء مشددات بلا ألف'),
            ('DOCX-P418-R02244','تُظَـٰهِرُونَ','تَظْهَرُونَ','ابن عامر',4,
             'بفتح التاء وإسكان الظاء وتخفيف الهاء'),
            ('DOCX-P418-R02245','تُظَـٰهِرُونَ','تَظَّاهَرُونَ','حمزة، الكسائي، خلف العاشر',4,
             'بفتح التاء والظاء مشددة وتخفيف الهاء'),
        ],
        431: [
            ('DOCX-P431-R02374','أَذِنَ','أُذِنَ','أبو عمرو، حمزة، الكسائي، خلف، خلف العاشر',23,
             'بضم الهمزة وكسر الذال مبنياً للمجهول'),
        ],
        433: [
            ('DOCX-P433-R02387','يَحْشُرُهُمْ','نَحْشُرُهُمْ','يعقوب',40,
             'بياء الغيب'),
            ('DOCX-P433-R02387','يَقُولُ','نَقُولُ','يعقوب',40,
             'بياء الغيب'),
            ('DOCX-P433-R02388','عَلَيْهِمْ','عَلَيْهُمُ','حمزة، يعقوب',43,
             'بضم الهاء'),
            ('DOCX-P433-R02388','إِلَيْهِمْ','إِلَيْهُمُ','حمزة، يعقوب',44,
             'بضم الهاء'),
            ('DOCX-P433-R02389','ثُمَّ تَتَفَكَّرُواْ','ثُمَّ تَّفَكَّرُوا','رويس',46,
             'بإدغام التاء في التاء وصلاً'),
            ('DOCX-P433-R02390','فَهُوَ','فَهْوَ','قالون، أبو عمرو، الكسائي، أبو جعفر',47,
             'بإسكان الهاء',1),
            ('DOCX-P433-R02390','وَهُوَ','وَهْوَ','قالون، أبو عمرو، الكسائي، أبو جعفر',47,
             'بإسكان الهاء',1),
        ],
        396: [
            ('DOCX-P396-R02056','الْقُرْءَانَ','الْقُرَانَ','ابن كثير',85,
             'بنقل الهمزة'),
            ('DOCX-P396-R02059','وَهُوَ','وَهْوَ','قالون، أبو عمرو، الكسائي، أبو جعفر',5,
             'بإسكان الهاء'),
        ],
        397: [
            ('DOCX-P397-R02063','فِيهِمْ','فِيهُمُ','يعقوب',14,
             'بضم الهاء'),
        ],
        423: [
            ('DOCX-P423-R02292','وَخَاتَمَ','وَخَاتِمَ','نافع، ابن كثير، أبو عمرو، ابن عامر، حمزة، الكسائي، أبو جعفر، يعقوب، خلف العاشر',40,
             'بكسر التاء'),
        ],
        424: [
            ('DOCX-P424-R02299','عَلَيْهِمْ','عَلَيْهُمُ','حمزة، يعقوب',50,
             'بضم الهاء'),
        ],
        425: [
            ('DOCX-P425-R02305','لَا يَحِلُّ','لَا تَحِلُّ','أبو عمرو، يعقوب',52,
             'بتاء التأنيث'),
            ('DOCX-P425-R02306','أَن تَبَدَّلَ','أَن تَّبَدَّلَ','البزي',52,
             'بتشديد التاء وصلاً'),
        ],
        426: [
            ('DOCX-P426-R02315','عَلَيْهِنَّ','عَلَيْهُنَّ','يعقوب',55,
             'بضم الهاء'),
        ],
        411: [
            ('DOCX-P411-R02183','وَرَحْمَةً','وَرَحْمَةٌ','حمزة',3,
             'بالرفع'),
            ('DOCX-P411-R02184','لِّيُضِلَّ','لِيَضِلَّ','ابن كثير، أبو عمرو',6,
             'بفتح الياء'),
        ],
        412: [
            ('DOCX-P412-R02200','مِثْقَالَ','مِثْقَالُ','نافع، أبو جعفر',16,
             'بالرفع'),
            ('DOCX-P412-R02201','وَلَا تُصَعِّرْ','وَلَا تُصَاعِرْ','نافع، أبو عمرو، حمزة، الكسائي، أبو جعفر، يعقوب، خلف العاشر',18,
             'بألف بعد الصاد وتخفيف العين'),
        ],
        413: [
            ('DOCX-P413-R02207','فَلَا يَحْزُنكَ','فَلَا يُحْزِنكَ','نافع',23,
             'بضم الياء وكسر الزاي'),
            ('DOCX-P413-R02208','وَالْبَحْرُ','وَالْبَحْرَ','أبو عمرو، يعقوب',27,
             'بالنصب'),
        ],
        414: [
            ('DOCX-P414-R02212','وَيُنَزِّلُ الْغَيْثَ','وَيُنْزِلُ الْغَيْثَ','نافع، ابن كثير، أبو عمرو، ابن عامر، حمزة، الكسائي، أبو جعفر، يعقوب، خلف العاشر',34,
             'بتخفيف الزاي'),
        ],
        407: [
            ('DOCX-P407-R02145','لَدَيْهِمْ','لَدَيْهُمُ','حمزة، يعقوب',32,
             'بضم الهاء'),
        ],
        408: [
            ('DOCX-P408-R02149','عَلَيْهِمْ','عَلَيْهُمُ','حمزة، يعقوب',35,
             'بضم الهاء'),
            ('DOCX-P408-R02151','أَيْدِيهِمْ','أَيْدِيهُمُ','يعقوب',36,
             'بضم الهاء'),
        ],
        409: [
            ('DOCX-P409-R02164','عَلَيْهِم','عَلَيْهُمُ','حمزة، يعقوب',49,
             'بضم الهاء'),
            ('DOCX-P409-R02165','ءَاثَـٰرِ','أَثَرِ','نافع، ابن كثير، أبو عمرو، أبو جعفر، يعقوب',50,
             'بالمفرد'),
        ],
        410: [
            ('DOCX-P410-R02173','وَلَا تُسْمِعُ الصُّمَّ','وَلَا يَسْمَعُ الصُّمُّ','ابن كثير',52,
             'بياء الغيب ورفع الصم'),
            ('DOCX-P410-R02178','الْقُرْءَانِ','الْقُرَانِ','ابن كثير',58,
             'بنقل الهمزة'),
        ],
        404: [
            ('DOCX-P404-R02116','سُبُلَنَا','سُبْلَنَا','أبو عمرو',69,
             'بإسكان الباء'),
        ],
        405: [
            ('DOCX-P405-R02125','رُسُلُهُم','رُسْلُهُمْ','أبو عمرو',9,
             'بإسكان السين'),
        ],
        392: [
            ('DOCX-P392-R02023','فِيٓ أُمِّهَا','فِي إِمِّهَا','حمزة، الكسائي',59,
             'بكسر الهمزة وصلاً'),
        ],
        393: [
            ('DOCX-P393-R02031','يُنَادِيهِمْ','يُنَادِيهُمُ','يعقوب',65,
             'بضم الهاء'),
        ],
        394: [
            ('DOCX-P394-R02040','بِضِيَآءٍ','بِضِنَاءٍ','قنبل',71,
             'بنون مفتوحة وهمزة'),
            ('DOCX-P394-R02041','يُنَادِيهِمْ','يُنَادِيهُمُ','يعقوب',74,
             'بضم الهاء'),
        ],
        377: [
            ('DOCX-P377-R01870','الْقُرْءَانِ','الْقُرَانَ','ابن كثير',6,
             'بنقل الهمزة'),
            ('DOCX-P377-R01871','بِشِهَابٍ قَبَسٍ','بِشِهَابِ قَبَسٍ','نافع، ابن كثير، أبو عمرو، ابن عامر، أبو جعفر',7,
             'بحذف التنوين على الإضافة'),
        ],
        378: [
            ('DOCX-P378-R01879','لَا يَحْطِمَنَّكُمْ','لَا يَحْطِمَنكُم','رويس',18,
             'بتخفيف الطاء'),
            ('DOCX-P378-R01882','سَبَإٍ','سَبَأَ','البزي، أبو عمرو',22,
             'بفتح الهمزة بلا تنوين'),
        ],
        362: [
            ('DOCX-P362-R01728','الْقُرْءَانَ','الْقُرَانُ','ابن كثير',32,
             'بنقل الهمزة'),
            ('DOCX-P362-R01729','نَبِيٍّ','نَبِيءٍ','نافع',31,
             'بالهمز'),
        ],
        355: [
            ('DOCX-P355-R01655','لَّا تُلْهِيهِمْ','لَا تُلْهِيهُمُ','يعقوب',37,
             'بضم الهاء وصلة الميم'),
        ],
        357: [
            ('DOCX-P357-R01683','فَإِن تَوَلَّوْاْ','فَإِن تَّوَلَّوْا','البزي',54,
             'بتشديد التاء وصلاً'),
        ],
        344: [
            ('DOCX-P344-R01519','فِيهِمْ','فِيهُمُ','يعقوب',32,
             'بضم الهاء'),
        ],
        345: [
            ('DOCX-P345-R01538','لَدَيْهِمْ','لَدَيْهُمُ','حمزة، يعقوب',53,
             'بضم الهاء'),
            ('DOCX-P345-R01539','أَيَحْسَبُونَ','أَيَحْسِبُونَ','نافع، ابن كثير، أبو عمرو، الكسائي، يعقوب، خلف العاشر',55,
             'بكسر السين'),
        ],
        346: [
            ('DOCX-P346-R01546','مُتْرَفِيهِمْ','مُتْرَفِيهُمُ','يعقوب',64,
             'بضم الهاء'),
            ('DOCX-P346-R01548','فِيهِنَّ','فِيهُنَّ','يعقوب',71,
             'بضم الهاء'),
        ],
        371: [
            ('DOCX-P371-R01827','وَٱتَّبَعَكَ','وَأَتْبَعُكَ','يعقوب',111,
             'بهمزة قطع مفتوحة وكسر الباء'),
        ],
        373: [
            ('DOCX-P373-R01840','خُلُقُ','خَلْقُ','ابن كثير، أبو عمرو، أبو جعفر، يعقوب',137,
             'بضم الخاء وسكون اللام'),
        ],
        388: [
            ('DOCX-P388-R01972','يُصْدِرَ','يَصْدُرَ','أبو عمرو، ابن عامر، أبو جعفر',23,
             'بفتح الياء وضم الدال'),
        ],
        389: [
            ('DOCX-P389-R01986','الرَّهْبِ','الرَّهَبِ','نافع، ابن كثير، أبو عمرو، أبو جعفر، يعقوب',32,
             'بفتحتين'),
            ('DOCX-P389-R01991','رِدْءٗا','رِدَا','أبو جعفر',34,
             'بإبدال الهمزة ألفاً'),
        ],
        390: [
            ('DOCX-P390-R02004','لَا يُرْجَعُونَ','لَا يَرْجِعُونَ','نافع، حمزة، الكسائي، يعقوب، خلف العاشر',39,
             'بفتح الياء وكسر الجيم'),
        ],
        427: [
            ('DOCX-P427-R02324','سَادَتَنَا','سَادَاتِنَا','ابن عامر، يعقوب',67,
             'بالجمع'),
            ('DOCX-P427-R02325','ءَاتِهِمْ','ءَاتِهُمُ','رويس',68,
             'بضم الهاء'),
            ('DOCX-P427-R02326','كَبِيرٗا','كَثِيرًا','نافع، ابن كثير، أبو عمرو، ابن عامر، حمزة، الكسائي، أبو جعفر، يعقوب، خلف العاشر',68,
             'بالثاء المثلثة'),
        ],
        429: [
            ('DOCX-P429-R02351','تَبَيَّنَتِ','تُبُيِّنَتِ','رويس',14,
             'بضم التاء الأولى وكسر الياء'),
        ],
        430: [
            ('DOCX-P430-R02357','لِسَبَإٍ','لِسَبَأَ','البزي، أبو عمرو',15,
             'بفتح الهمزة بلا تنوين'),
            ('DOCX-P430-R02369','رَبَّنَا بَـٰعِدْ','رَبُّنَا بَعَّدَ','يعقوب',19,
             'برفع ربنا وفعل ماضٍ مشدد العين'),
            ('DOCX-P430-R02370','صَدَّقَ','صَدَقَ','نافع، ابن كثير، أبو عمرو، ابن عامر، أبو جعفر، يعقوب',20,
             'بتخفيف الدال'),
        ],
        467: [
            ('DOCX-P467-R02723','كَلِمَتُ رَبِّكَ','كَلِمَاتُ','نافع، ابن عامر، أبو جعفر',6,'بالجمع'),
            ('DOCX-P467-R02724','وَقِهِمْ','وَقِهُمُ','رويس',7,'بضم الهاء'),
        ],
        468: [
            ('DOCX-P468-R02735','وَيُنَزِّلُ','وَيُنْزِلُ','قالون، ابن كثير، أبو عمرو، ابن عامر، أبو جعفر، يعقوب، خلف',13,'بتخفيف الزاي'),
        ],
        469: [
            ('DOCX-P469-R02741','وَالَّذِينَ يَدْعُونَ','تَدْعُونَ','نافع، هشام',20,'بتاء الخطاب'),
            ('DOCX-P469-R02742','أَشَدَّ مِنْهُمْ','أَشَدَّ مِنكُم','ابن عامر',21,'بكاف الخطاب'),
            ('DOCX-P469-R02743','تَأْتِيهِمْ','تَأْتِيهُم','يعقوب',22,'بضم الهاء'),
            ('DOCX-P469-R02744','رُسُلُهُم','رُسْلُهُمْ','أبو عمرو',22,'بإسكان السين'),
        ],
        350: [
            ('DOCX-P350-R01587','رَأْفَةٌ','رَآفَةٌ','ابن كثير',2,'بفتح الهمزة ممدودة'),
            ('DOCX-P350-R01588','الْمُحْصَنَـٰتِ','الْمُحْصِنَاتِ','الكسائي',4,'بكسر الصاد'),
            ('DOCX-P350-R01589','أَرْبَعُ شَهَـٰدَٰتٍ','أَرْبَعَ شَهَادَاتٍ','حفص، حمزة، الكسائي، خلف',6,'برفع العين'),
        ],
        364: [
            ('DOCX-P364-R01756','بُشْرَۢا','نُشُرًا','نافع، ابن كثير، أبو عمرو، أبو جعفر، يعقوب',48,'بنون مضمومة وضم الشين'),
        ],
        365: [
            ('DOCX-P365-R01765','فَسْـَٔلْ','فَسَلْ','ابن كثير، الكسائي، خلف',59,'بنقل حركة الهمزة وحذفها'),
            ('DOCX-P365-R01767','تَأْمُرُنَا','يَأْمُرُنَا','حمزة، الكسائي',60,'بياء الغيب'),
            ('DOCX-P365-R01773','يَقْتُرُواْ','يُقْتِرُوا','نافع، ابن عامر، أبو جعفر',67,'بضم الياء وكسر التاء'),
        ],
        366: [
            ('DOCX-P366-R01778','يُضَـٰعَفْ','يُضَاعَفْ','نافع، أبو عمرو، حفص، حمزة، الكسائي، خلف',69,'بألف مدية'),
            ('DOCX-P366-R01780','يُضَـٰعَفْ','يُضَعَّفُ','ابن كثير، أبو جعفر، يعقوب',69,'بتشديد العين ورفع الفعل'),
        ],
        379: [
            ('DOCX-P379-R01887','أَلَّا يَسْجُدُواْ','أَلَا يَا اسْجُدُوا','الكسائي، أبو جعفر، رويس',25,'بالفصل وقراءة الأمر'),
            ('DOCX-P379-R01888','تُخْفُونَ وَمَا تُعْلِنُونَ','يُخْفُونَ وَمَا يُعْلِنُونَ','جميع القراء عدا حفص، الكسائي',25,'بياء الغيب فيهما'),
        ],
        380: [
            ('DOCX-P380-R01899','أَتُمِدُّونَنِ','أَتُمِدُّونَنِي','نافع، أبو عمرو، أبو جعفر، ابن كثير',36,'بنونين'),
            ('DOCX-P380-R01900','أَتُمِدُّونَنِ','أَتُمِدُّوٓنِّ','حمزة، يعقوب',36,'بإدغام النون ومدها'),
            ('DOCX-P380-R01904','سَاقَيْهَا','سَأْقَيْهَا','قنبل',44,'بإبدال الألف همزة ساكنة'),
        ],
        381: [
            ('DOCX-P381-R01913','لَنُبَيِّتَنَّهُۥ','لَتُبَيِّتُنَّهُ','حمزة، الكسائي، خلف',49,'بتاء الخطاب'),
            ('DOCX-P381-R01913','لَنَقُولَنَّ','لَتَقُولُنَّ','حمزة، الكسائي، خلف',49,'بتاء الخطاب'),
            ('DOCX-P381-R01915','مَهْلِكِ','مَهْلَكِ','شعبة',49,'بفتح الميم واللام'),
            ('DOCX-P381-R01916','مَهْلِكِ','مُهْلَكِ','نافع، ابن كثير، أبو عمرو، ابن عامر، حمزة، الكسائي، أبو جعفر، يعقوب، خلف',49,'بضم الميم وفتح اللام'),
            ('DOCX-P381-R01917','أَنَّا دَمَّرْنَـٰهُمْ','إِنَّا دَمَّرْنَـٰهُمْ','نافع، ابن كثير، أبو عمرو، ابن عامر، أبو جعفر',51,'بكسر الهمزة'),
        ],
        382: [
            ('DOCX-P382-R01920','قَدَّرْنَـٰهَا','قَدَرْنَاهَا','شعبة',57,'بتخفيف الدال'),
            ('DOCX-P382-R01924','تَذْكُرُونَ','تَذَّكَّرُونَ','نافع، ابن كثير، ابن ذكوان، شعبة، أبو جعفر، رويس',62,'بتشديد الذال والتاء'),
            ('DOCX-P382-R01925','تَذْكُرُونَ','يَذَّكَّرُونَ','أبو عمرو، هشام، روح',62,'بياء الغيب وتشديد الذال'),
            ('DOCX-P382-R01927','بُشْرَۢا','نَشْرًا','حمزة، الكسائي، خلف',63,'بنون مضمومة وفتح الشين'),
            ('DOCX-P382-R01927','بُشْرَۢا','نُشْرًا','ابن عامر',63,'بنون مضمومة وسكون الشين'),
        ],
        419: [
            ('DOCX-P419-R02248','النَّبِيِّـۧنَ','النَّبِيئِينَ','نافع',7,'بالهمز'),
            ('DOCX-P419-R02248','النَّبِيَّ','النَّبِيءَ','نافع',13,'بالهمز'),
            ('DOCX-P419-R02250','بِمَا تَعْمَلُونَ بَصِيرًا','بِمَا يَعْمَلُونَ','أبو عمرو',9,'بياء الغيب'),
            ('DOCX-P419-R02254','لَّا مُقَامَ','لَا مَقَامَ','جميع القراء عدا حفص',13,'بفتح الميم'),
            ('DOCX-P419-R02255','بُيُوتَنَا','بِيُوتَنَا','ورش، أبو عمرو، حفص، أبو جعفر، يعقوب',13,'بكسر الباء'),
        ],
        420: [
            ('DOCX-P420-R02258','يَحْسَبُونَ','يَحْسَبُونَ','ابن عامر، عاصم، حمزة، أبو جعفر',20,'بفتح السين'),
            ('DOCX-P420-R02259','يَسْـَٔلُونَ','يَسَّاءَلُونَ','رويس',20,'بألف بعد السين مشددة'),
            ('DOCX-P420-R02260','أُسْوَةٌ','إِسْوَةٌ','جميع القراء عدا عاصم',21,'بكسر الهمزة'),
        ],
        421: [
            ('DOCX-P421-R02267','صَيَاصِيهِمْ','صَيَاصِيهُمُ','يعقوب',26,'بضم الهاء'),
            ('DOCX-P421-R02276','مُّبَيِّنَةٍ','مُبَيِّنِةٍ','ابن كثير، شعبة',30,'بكسر الياء المشددة'),
            ('DOCX-P421-R02278','يُضَـٰعَفْ لَهَا الْعَذَابُ','يُضَاعَفْ لَهَا الْعَذَابُ','نافع، عاصم، حمزة، الكسائي، خلف',30,'بياء التذكير وألف مدية'),
            ('DOCX-P421-R02279','يُضَـٰعَفْ لَهَا الْعَذَابُ','تُضَعَّفْ لَهَا الْعَذَابُ','ابن كثير، ابن عامر',30,'بتاء التأنيث وتشديد العين'),
            ('DOCX-P421-R02280','يُضَـٰعَفْ لَهَا الْعَذَابُ','يُضَعَّفْ لَهَا الْعَذَابُ','أبو عمرو، أبو جعفر، يعقوب',30,'بياء التذكير وتشديد العين'),
        ],
        422: [
            ('DOCX-P422-R02283','وَتَعْمَلْ صَـٰلِحٗا نُّؤْتِهَآ','وَيَعْمَلْ صَالِحًا يُؤْتِهَا','حمزة، الكسائي، خلف',31,'بياء الغيب فيهما'),
        ],
        396: [
            ('DOCX-P396-R02057','تُرْجَعُونَ','تَرْجِعُونَ','يعقوب',88,'بفتح التاء'),
        ],
        398: [
            ('DOCX-P398-R02067','تُرْجَعُونَ','تَرْجِعُونَ','يعقوب',17,'بفتح التاء'),
            ('DOCX-P398-R02069','النَّشْأَةَ','النَّشَاءَةَ','ابن كثير، أبو عمرو',20,'بفتح الشين والمد والهمز'),
        ],
        435: [
            ('DOCX-P435-R02411','فَلَا تَذْهَبْ نَفْسُكَ','فَلَا تُذْهِبْ نَفْسَكَ','أبو جعفر',8,
             'بضم التاء وكسر الهاء'),
            ('DOCX-P435-R02412','عَلَيْهِمْ','عَلَيْهُمُ','حمزة، يعقوب',8,
             'بضم الهاء'),
            # Quranpedia and the supplied table both assign the singular form to
            # Ibn Kathir (the source's bare "الباقين" is not a reader name).
            ('DOCX-P435-R02413','الرِّيَـٰحَ','الرِّيحَ','ابن كثير',9,
             'بالإفراد'),
            ('DOCX-P435-R02415','وَلَا يُنقَصُ','وَلَا يَنْقُصُ','يعقوب',11,
             'بفتح الياء وضم القاف'),
        ],
        437: [
            ('DOCX-P437-R02424','رُسُلُهُم','رُسْلُهُمْ','أبو عمرو',25,
             'بإسكان السين'),
        ],
        438: [
            ('DOCX-P438-R02432','عَلَيْهِمْ','عَلَيْهُمُ','حمزة، يعقوب',36,
             'بضم الهاء'),
            ('DOCX-P438-R02430','يَدْخُلُونَهَا','يُدْخَلُونَهَا','أبو عمرو',33,
             'بضم الياء وفتح الخاء مبنياً للمجهول'),
            ('DOCX-P438-R02431','وَلُؤْلُؤٗا','وَلُؤْلُؤًا','نافع، عاصم، أبو جعفر، يعقوب',33,
             'بالنصب'),
            ('DOCX-P438-R02431','وَلُؤْلُؤٗا','وَلُؤْلُؤٍ','ابن كثير، أبو عمرو، ابن عامر، حمزة، الكسائي، خلف',33,
             'بالجر'),
            ('DOCX-P438-R02433','نَجْزِي كُلَّ','يُجْزَى كُلُّ','أبو عمرو',36,
             'بياء الغيب ورفع كل'),
        ],
        443: [
            ('DOCX-P443-R02488','ذُرِّيَّتَهُمْ','ذُرِّيَّاتِهِمْ','أبو جعفر',41,
             'بالجمع'),
            ('DOCX-P443-R02498','صَيْحَةٗ وَٰحِدَةٗ','صَيْحَةٌ وَاحِدَةٌ','أبو جعفر',53,
             'برفع الكلمتين'),
        ],
        444: [
            ('DOCX-P444-R02501','شُغُلٍ','شُغْلٍ','نافع، ابن كثير، أبو عمرو، خلف',55,
             'بإسكان الغين'),
            ('DOCX-P444-R02502','فَـٰكِهُونَ','فَكِهُونَ','أبو جعفر',55,
             'بحذف الألف'),
            ('DOCX-P444-R02504','وَأَنِ ٱعْبُدُونِي','وَأَنُ اعْبُدُونِي','نافع، ابن كثير، ابن عامر، الكسائي، أبو جعفر',61,
             'بضم النون وصلاً'),
            ('DOCX-P444-R02506','جِبِلّٗا','جُبُلًّا','ابن كثير، حمزة، الكسائي، خلف',62,
             'بضم الجيم والباء وتشديد اللام'),
            ('DOCX-P444-R02511','أَيْدِيهِمْ','أَيْدِيهُمُ','يعقوب',65,
             'بضم الهاء'),
        ],
        446: [
            ('DOCX-P446-R02528','بِزِينَةٍ ٱلْكَوَاكِبِ','بِزِينَةٍ الْكَوَاكِبِ','حمزة',6,
             'بتنوين زينة وخفض الكواكب'),
        ],
        451: [
            ('DOCX-P451-R02592','عَلَيْهِمْ','عَلَيْهُمُ','حمزة، يعقوب',137,'بضم الهاء'),
            ('DOCX-P451-R02593','وَهُوَ','وَهْوَ','قالون، أبو عمرو، الكسائي، أبو جعفر',142,'بإسكان الهاء'),
            ('DOCX-P451-R02593','وَهُوَ','وَهْوَ','قالون، أبو عمرو، الكسائي، أبو جعفر',145,'بإسكان الهاء'),
            ('DOCX-P451-R02594','فَٱسْتَفْتِهِمْ','فَاسْتَفْتِهُمُ','رويس',149,'بضم الهاء وصلة الميم'),
            ('DOCX-P451-R02595','أَصْطَفَى','اصْطَفَى','أبو جعفر',153,'بهمزة وصل تسقط وصلاً وتكسر ابتداءً'),
        ],
        453: [
            ('DOCX-P453-R02604','لْـَٔيْكَةِ','لَيْكَةَ','نافع، ابن كثير، ابن عامر، أبو جعفر',13,'بفتح اللام والتاء بلا همز'),
            ('DOCX-P453-R02605','فَوَاقٍ','فُوَّاقٍ','حمزة، الكسائي، خلف',15,'بضم الفاء'),
        ],
        454: [
            ('DOCX-P454-R02611','الصِّرَٰطِ','السِّرَٰطِ','قنبل، رويس',22,'بالسين'),
        ],
        447: [
            ('DOCX-P447-R02545','لَا تَنَاصَرُونَ','لَا تَّنَاصَرُونَ','أبو جعفر',25,
             'بتشديد التاء وصلاً مع المد المشبع'),
            ('DOCX-P447-R02547','الْمُخْلَصِينَ','الْمُخْلِصِينَ','يعقوب',40,
             'بكسر اللام'),
        ],
        448: [
            ('DOCX-P448-R02557','الْمُخْلَصِينَ','الْمُخْلِصِينَ','يعقوب',74,
             'بكسر اللام'),
            ('DOCX-P448-R02554','مِتْنَا','مُتْنَا','أبو جعفر',53,
             'بضم الميم'),
        ],
        449: [
            ('DOCX-P449-R02568','يَـٰبُنَيَّ','يَابُنَيِّ','نافع، ابن كثير، أبو عمرو، ابن عامر، شعبة، حمزة، الكسائي، أبو جعفر، يعقوب، خلف العاشر',102,
             'بكسر الياء'),
            ('DOCX-P449-R02569','مَاذَا تَرَىٰ','مَاذَا تُرِي','حمزة، الكسائي، خلف',102,
             'بضم التاء وكسر الراء'),
            ('DOCX-P449-R02570','يَـٰٓأَبَتِ','يَـٰٓأَبَتَ','ابن عامر، أبو جعفر',102,
             'بالفتح'),
        ],
        450: [
            ('DOCX-P450-R02581','نَبِيّٗا','نَبِيئًا','نافع',112,
             'بالهمز'),
            ('DOCX-P450-R02584','وَإِنَّ إِلْيَاسَ','وَإِنَّ الِيَاسَ','ابن ذكوان',123,
             'بهمزة وصل مكسورة ابتداءً'),
        ],
        455: [
            ('DOCX-P455-R02620','لِّيَدَّبَّرُوٓاْ','لِتَدَبَّرُوا','أبو جعفر',29,
             'بتاء الخطاب وتخفيف الدال'),
            ('DOCX-P455-R02622','ٱلرِّيحَ','ٱلرِّيَاحَ','أبو جعفر',36,
             'بالجمع'),
        ],
        456: [
            ('DOCX-P456-R02633','وَٱلْيَسَعَ','وَاللَّيْسَعَ','حمزة، الكسائي، خلف',48,
             'بلامين وتشديد الياء'),
            ('DOCX-P456-R02634','تُوعَدُونَ','يُوعَدُونَ','ابن كثير، أبو عمرو',53,
             'بياء الغيب'),
            ('DOCX-P456-R02635','وَغَسَّاقٌ','وَغَسَاقٌ','نافع، ابن كثير، أبو عمرو، ابن عامر، شعبة، يعقوب، أبو جعفر',57,
             'بتخفيف السين'),
        ],
        457: [
            ('DOCX-P457-R02644','أَنَّمَآ أَنَا۠','إِنَّمَا أَنَا','أبو جعفر',65,
             'بكسر الهمزة المشددة'),
        ],
        458: [
            ('DOCX-P458-R02649','فَالْحَقُّ','فَالْحَقَّ','عاصم، حمزة، خلف',84,
             'بنصب القاف'),
        ],
        477: [
            ('DOCX-P477-R02814','قُرْءَانًا','قُرَانًا','ابن كثير',3,
             'بنقل الهمزة'),
            ('DOCX-P477-R02815','سَوَآءً','سَوَاءٌ','أبو جعفر',10,
             'بالرفع تنويناً'),
            ('DOCX-P477-R02815','سَوَآءً','سَوَاءٍ','يعقوب',10,
             'بالجر تنويناً'),
            ('DOCX-P477-R02816','وَهِيَ','وَهْيَ','قالون، أبو عمرو، الكسائي، أبو جعفر',11,
             'بإسكان الهاء'),
        ],
        478: [
            ('DOCX-P478-R02822','أَيْدِيهِمْ','أَيْدِيهُمُ','يعقوب',14,
             'بضمها'),
            ('DOCX-P478-R02823','عَلَيْهِمْ','عَلَيْهُمُ','حمزة، يعقوب',16,
             'بضم الهاء'),
            ('DOCX-P478-R02825','يُحْشَرُ أَعْدَآءُ','نَحْشُرُ أَعْدَاءَ','نافع، يعقوب',19,
             'بنون العظمة'),
        ],
        479: [
            ('DOCX-P479-R02831','وَهُوَ','وَهْوَ','قالون، أبو عمرو، الكسائي، أبو جعفر',21,
             'بإسكان الهاء'),
            ('DOCX-P479-R02832','تُرْجَعُونَ','تَرْجِعُونَ','يعقوب',21,
             'بفتح التاء'),
            ('DOCX-P479-R02833','أَيْدِيهِمْ','أَيْدِيهُمُ','يعقوب',25,
             'بضمها'),
            ('DOCX-P479-R02837','الْقُرْءَانِ','الْقُرَانِ','ابن كثير',26,
             'بنقل الهمزة'),
            ('DOCX-P479-R02838','أَرِنَا','أَرْنَا','ابن كثير، السوسي، ابن عامر، شعبة، يعقوب',29,
             'بإسكان الراء'),
            ('DOCX-P479-R02839','الَّذَيْنِ','اللَّذَيْنِّ','ابن كثير',29,
             'بتشديد الياء مع المد المشبع'),
        ],
        481: [
            ('DOCX-P481-R02846','وَرَبَتْ','وَرَبَأَتْ','أبو جعفر',39,
             'بهمزة ساكنة بعد الباء'),
            ('DOCX-P481-R02847','يُلْحِدُونَ','يَلْحَدُونَ','حمزة',40,
             'بفتح الياء والحاء'),
            ('DOCX-P481-R02849','قُرْءَانًا','قُرَانًا','ابن كثير',44,
             'بنقل الهمزة'),
            ('DOCX-P481-R02850','وَهُوَ','وَهْوَ','قالون، أبو عمرو، الكسائي، أبو جعفر',44,
             'بإسكان الهاء'),
        ],
        482: [
            ('DOCX-P482-R02865','ثَمَرَٰتٍ','ثَمَرَةٍ','ابن كثير، أبو عمرو، حمزة، الكسائي، يعقوب، خلف العاشر',47,
             'بالمفرد'),
            ('DOCX-P482-R02866','يُنَادِيهِمْ','يُنَادِيهُمُ','يعقوب',47,
             'بضم الهاء'),
            ('DOCX-P482-R02867','وَنَـَٔا','وَنَاءَ','ابن ذكوان، أبو جعفر',51,
             'بتقديم الألف على الهمزة مع المد المتصل'),
        ],
        499: [
            ('DOCX-P499-R03030','ءَايَـٰتٌ لِّقَوْمٍ','ءَايَاتٍ','حمزة، الكسائي، يعقوب',4,
             'بنصب التاء منونة'),
            ('DOCX-P499-R03030','ءَايَـٰتٌ لِّقَوْمٍ','ءَايَاتٍ','حمزة، الكسائي، يعقوب',5,
             'بنصب التاء منونة'),
        ],
        500: [
            ('DOCX-P500-R03043','تُرْجَعُونَ','تَرْجِعُونَ','يعقوب',15,
             'بفتح التاء'),
            ('DOCX-P500-R03044','وَالنُّبُوَّةَ','وَالنُّبُوءَةَ','نافع',16,
             'بالهمز'),
            ('DOCX-P500-R03045','سَوَآءً','سَوَاءٌ','نافع، ابن كثير، أبو عمرو، ابن عامر، شعبة، أبو جعفر، يعقوب، خلف العاشر',21,
             'بالرفع تنويناً'),
        ],
        501: [
            ('DOCX-P501-R03048','غِشَـٰوَةٗ','غَشْوَةً','حمزة، الكسائي، خلف',23,
             'بفتح الغين وإسكان الشين وقصرها'),
            ('DOCX-P501-R03051','كُلُّ أُمَّةٍ تُدْعَىٰ','كُلَّ أُمَّةٍ تُدْعَى','يعقوب',28,
             'بنصب كل'),
            ('DOCX-P501-R03053','وَالسَّاعَةُ لَا رَيْبَ','وَالسَّاعَةَ','حمزة',32,
             'بنصب التاء'),
        ],
        502: [
            ('DOCX-P502-R03061','لَا يُخْرَجُونَ','لَا يَخْرُجُونَ','حمزة، الكسائي، خلف',35,
             'بفتح الياء وضم الراء'),
        ],
        504: [
            ('DOCX-P504-R03081','وَفِصَـٰلُهُۥ','وَفَصْلُهُ','يعقوب',15,
             'بفتح الفاء وإسكان الصاد بلا ألف'),
            ('DOCX-P504-R03084','أَتَعِدَانِنِيٓ','أَتَعِدَّانِّي','هشام',17,
             'بنون واحدة مشددة مع المد المشبع'),
            ('DOCX-P504-R03087','أَذْهَبْتُمْ','أَءَذْهَبْتُمْ','ابن كثير، ابن عامر، أبو جعفر، يعقوب',20,
             'بهمزتين على الاستفهام'),
        ],
        505: [
            ('DOCX-P505-R03092','وَأُبَلِّغُكُم','وَأَبْلُغُكُمْ','أبو عمرو',23,
             'بتخفيف الباء'),
        ],
        506: [
            ('DOCX-P506-R03103','الْقُرْءَانَ','الْقُرَانَ','ابن كثير',29,
             'بنقل الهمزة'),
            ('DOCX-P506-R03104','بِقَـٰدِرٍ','يَقْدِرُ','يعقوب',33,
             'بفعل مضارع مرفوع'),
        ],
        507: [
            ('DOCX-P507-R03109','قُتِلُواْ','قَاتَلُوا','نافع، ابن كثير، أبو عمرو، ابن عامر، شعبة، حمزة، الكسائي، أبو جعفر، خلف العاشر',4,
             'بفتح القاف والتاء مع ألف'),
        ],
        508: [
            ('DOCX-P508-R03114','وَكَأَيِّن','وَكَائِن','ابن كثير',13,
             'بالمد والهمز'),
            ('DOCX-P508-R03115','ءَاسِنٍ','أَسِنٍ','ابن كثير',15,
             'بقصر الهمزة'),
        ],
        509: [
            ('DOCX-P509-R03129','عَسَيْتُمْ','عَسِيتُمْ','نافع',22,
             'بكسر السين'),
            ('DOCX-P509-R03130','تَوَلَّيْتُمْ','تُوُلِّيتُمْ','رويس',22,
             'بضم التاء وكسر الواو'),
            ('DOCX-P509-R03131','وَتُقَطِّعُوٓاْ','وَتَقْطَعُوا','يعقوب',22,
             'بفتح التاء وإسكان القاف وفتح الطاء مخففة'),
            ('DOCX-P509-R03132','الْقُرْءَانَ','الْقُرَانَ','ابن كثير',24,
             'بنقل الهمزة'),
            ('DOCX-P509-R03138','رِضْوَٰنَهُۥ','رُضْوَانَهُ','شعبة',28,
             'بضم الراء'),
        ],
        512: [
            ('DOCX-P512-R03164','ضَرًّا','ضُرًّا','حمزة، الكسائي، خلف',11,
             'بضم الضاد'),
            ('DOCX-P512-R03165','كَلَـٰمَ اللَّهِ','كِلْمَ اللَّهِ','حمزة، الكسائي، خلف',15,
             'بكسر الكاف وسكون اللام بلا ألف'),
        ],
        551: [
            ('DOCX-P551-R03529','ٱلنَّبِيُّ','ٱلنَّبِيءُ','نافع',12,'بالهمز'),
            ('DOCX-P551-R03530','أَيْدِيهِنَّ','أَيْدِيهُنَّ','يعقوب',12,'بضمها'),
            ('DOCX-P551-R03531','عَلَيْهِمْ','عَلَيْهُمُ','حمزة، يعقوب',13,'بضم الهاء'),
            ('DOCX-P551-R03532','وَهُوَ','وَهْوَ','قالون، أبو عمرو، الكسائي، أبو جعفر',1,'بإسكان الهاء'),
        ],
        552: [
            # NQuran, Saff 6, explicitly names Khalaf al-Ashar for ساحر; raw bare خلف remains Q06-R01.
            ('DOCX-P552-R03538','سِحْرٌ','سَاحِرٌ','حمزة، الكسائي، خلف، خلف العاشر',6,'بفتح السين وألف مدية وكسر الحاء'),
            ('DOCX-P552-R03540','مُتِمُّ نُورِهِۦ','مُتِمٌّ نُورَهُ','جميع القراء عدا ابن كثير، حفص، حمزة، الكسائي، خلف',8,'بتنوين متم ونصب نوره'),
        ],
        553: [
            ('DOCX-P553-R03552','عَلَيْهِمْ','عَلَيْهُمُ','حمزة، يعقوب',2,'بضم الهاء'),
            ('DOCX-P553-R03553','وَيُزَكِّيهِمْ','وَيُزَكِّيهُمُ','يعقوب',2,'بضم الهاء'),
            ('DOCX-P553-R03553','أَيْدِيهِمْ','أَيْدِيهُمُ','يعقوب',7,'بضم الهاء'),
            ('DOCX-P553-R03554','وَهُوَ','وَهْوَ','قالون، أبو عمرو، الكسائي، أبو جعفر',3,'بإسكان الهاء'),
        ],
        554: [
            ('DOCX-P554-R03559','خُشُبٌ','خُشْبٌ','قنبل، أبو عمرو، الكسائي',4,
             'بإسكان الشين'),
            ('DOCX-P554-R03560','يَحْسَبُونَ','يَحْسِبُونَ','جميع القراء عدا ابن عامر، عاصم، حمزة، أبو جعفر',4,'بكسر السين'),
            ('DOCX-P554-R03561','عَلَيْهِمْ','عَلَيْهُمُ','حمزة، يعقوب',4,'بضم الهاء'),
        ],
        559: [
            ('DOCX-P559-R03595','وُجْدِكُمْ','وِجْدِكُمْ','روح عن يعقوب',6,
             'بكسر الواو'),
            *[('DOCX-P559-R03596','عَلَيْهِنَّ','عَلَيْهُنَّ','يعقوب',6,
               'بضم الهاء',occ) for occ in (1,2)],
            ('DOCX-P559-R03597','عُسْرٍ يُسْرًا','عُسُرٍ يُسُرًا','أبو جعفر',7,
             'بضم السين في الكلمتين'),
            ('DOCX-P559-R03599','نُّكْرًا','نُكُرًا','نافع، ابن عامر، أبو جعفر، يعقوب',8,
             'بضم الكاف'),
            ('DOCX-P559-R03600','مُّبَيِّنَـٰتٍ','مُبَيَّنَاتٍ','قالون، ورش، قنبل، البزي، الدوري عن أبي عمرو، السوسي، ابن وردان، ابن جماز، شعبة، روح، رويس',11,
             'بفتح الياء المشددة'),
            ('DOCX-P559-R03601','يُدْخِلْهُ','نُدْخِلْهُ','نافع، ابن عامر، أبو جعفر',11,
             'بنون العظمة'),
        ],
        560: [
            ('DOCX-P560-R03605','النَّبِيُّ','النَّبِيءُ','نافع',1,
             'بالهمز والمد'),
            ('DOCX-P560-R03605','النَّبِيُّ','النَّبِيءُ','نافع',3,
             'بالهمز والمد'),
            ('DOCX-P560-R03606','وَهُوَ','وَهْوَ','قالون، أبو عمرو، الكسائي، أبو جعفر',2,
             'بإسكان الهاء'),
            ('DOCX-P560-R03607','عَرَّفَ','عَرَفَ','الكسائي',3,
             'بتخفيف الراء'),
            ('DOCX-P560-R03608','تَظَـٰهَرَا','تَظَّاهَرَا','نافع، ابن كثير، أبو عمرو، ابن عامر، أبو جعفر، يعقوب',4,
             'بتشديد الظاء بلا ألف'),
            ('DOCX-P560-R03611','وَجِبْرِيلُ','وَجَبْرِيلَ','ابن كثير',4,
             'بفتح الجيم وكسر الراء بلا همز'),
            ('DOCX-P560-R03612','وَجِبْرِيلُ','وَجَبْرَئِلُ','شعبة',4,
             'بفتح الجيم والراء وهمزة مكسورة وحذف الياء'),
            ('DOCX-P560-R03613','وَجِبْرِيلُ','وَجَبْرَئِيلَ','حمزة، الكسائي، خلف العاشر',4,
             'بفتح الجيم والراء وهمزة مكسورة بعدها ياء مدية'),
            ('DOCX-P560-R03614','يُبْدِلَهُۥٓ','يُبَدِّلَهُ','نافع، أبو عمرو، أبو جعفر',5,
             'بتشديد الدال المفتوحة'),
        ],
        561: [
            ('DOCX-P561-R03618','نَّصُوحًا','نُصُوحًا','شعبة',8,
             'بضم النون'),
            ('DOCX-P561-R03619','النَّبِيَّ','النَّبِيءَ','نافع',8,
             'بالهمز'),
            ('DOCX-P561-R03619','النَّبِيَّ','النَّبِيءَ','نافع',9,
             'بالهمز'),
            ('DOCX-P561-R03620','أَيْدِيهِمْ','أَيْدِيهُمُ','يعقوب',8,
             'بضم الهاء'),
            ('DOCX-P561-R03621','عَلَيْهِمْ','عَلَيْهُمْ','حمزة، يعقوب',9,
             'بضم الهاء'),
            ('DOCX-P561-R03622','وَقِيلَ','وَقِيلَ','هشام، الكسائي، رويس',10,
             'بالإشمام'),
            ('DOCX-P561-R03623','وَكُتُبِهِۦ','وَكِتَابِهِ','نافع، ابن كثير، ابن عامر، شعبة، حمزة، الكسائي، أبو جعفر، خلف العاشر',12,
             'بالمفرد وفتح الكاف وإسكان التاء وألف بعدها'),
        ],
        562: [
            ('DOCX-P562-R03628','وَهُوَ','وَهْوَ','قالون، أبو عمرو، الكسائي، أبو جعفر',1,
             'بإسكان الهاء'),
            ('DOCX-P562-R03628','وَهُوَ','وَهْوَ','قالون، أبو عمرو، الكسائي، أبو جعفر',2,
             'بإسكان الهاء'),
            ('DOCX-P562-R03628','وَهُوَ','وَهْوَ','قالون، أبو عمرو، الكسائي، أبو جعفر',4,
             'بإسكان الهاء'),
            ('DOCX-P562-R03628','وَهِيَ','وَهْيَ','قالون، أبو عمرو، الكسائي، أبو جعفر',7,
             'بإسكان الهاء'),
            ('DOCX-P562-R03629','تَفَاوُتٍ','تَفَوُّتٍ','حمزة، الكسائي',3,
             'بحذف الألف وتشديد الواو المفتوحة'),
            ('DOCX-P562-R03630','تَمَيَّزُ','تَّمَيَّزُ','البزي',8,
             'بتشديد التاء وصلاً'),
            ('DOCX-P562-R03631','فَسُحْقًا','فَسُحُقًا','الكسائي، أبو جعفر',11,
             'بضم الحاء'),
        ],
        547: [
            # Explicit forms in R03487. Bare «خلف» resolves to Q06-R01. The accepted
            # ten-reader apparatus independently names Q10 (Idris/Ishaq) for this same form.
            ('DOCX-P547-R03487','لِّإِخْوَٰنِهِمُ','لِإِخْوَٰنِهِمِ',
             'أبو عمرو، يعقوب',11,'بكسر الهاء والميم'),
            ('DOCX-P547-R03487','لِّإِخْوَٰنِهِمُ','لِإِخْوَٰنِهِمُ',
             'نافع، ابن كثير، ابن عامر، عاصم، أبو جعفر',11,
             'بكسر الهاء وضم الميم وصلاً'),
            ('DOCX-P547-R03487','لِّإِخْوَٰنِهِمُ','لِإِخْوَٰنِهُمُ',
             'حمزة، الكسائي، خلف، خلف العاشر',11,'بضم الهاء والميم'),
        ],
        549: [
            ('DOCX-P549-R03508','يَفْصِلُ','يُفْصَلُ',
             'نافع، ابن كثير، أبو عمرو، أبو جعفر',3,
             'بضم الياء وفتح الصاد مخففة مبنياً للمجهول'),
            ('DOCX-P549-R03511','أُسْوَةٌ','إِسْوَةٌ',
             'جميع القراء عدا عاصم',4,'بكسرها'),
            ('DOCX-P549-R03512','إِبْرَٰهِيمَ','إِبْرَاهَامَ',
             'هشام',4,'بألف بعد الهاء',1),
        ],
        550: [
            ('DOCX-P550-R03520','وَلَا تُمْسِكُوا','وَلَا تُمَسِّكُوا',
             'أبو عمرو، يعقوب',10,'بضم الميم وتشديد السين المكسورة'),
        ],
        555: [
            ('DOCX-P555-R03565','لَوَّوْاْ','لَوْوْا','نافع، روح',5,
             'بتخفيف الواو الأولى ساكنة'),
            ('DOCX-P555-R03566','عَلَيْهِمْ','عَلَيْهُمْ','حمزة، يعقوب',6,
             'بضم الهاء'),
            ('DOCX-P555-R03567','وَأَكُن','وَأَكُونَ','أبو عمرو',10,
             'بنصب النون وإثبات الواو'),
            ('DOCX-P555-R03568','تَعْمَلُونَ','يَعْمَلُونَ','شعبة',11,
             'بياء الغيب'),
        ],
        556: [
            ('DOCX-P556-R03573','وَهُوَ','وَهْوَ','قالون، أبو عمرو، الكسائي، أبو جعفر',1,
             'بإسكان الهاء'),
            ('DOCX-P556-R03574','تَأْتِيهِمْ','تَأْتِيهُم','يعقوب',6,
             'بضم الهاء'),
            ('DOCX-P556-R03575','رُسُلُهُم','رُسْلُهُمْ','أبو عمرو',6,
             'بإسكان السين'),
            ('DOCX-P556-R03576','يَجْمَعُكُمْ','نَجْمَعُكُمْ','يعقوب',9,
             'بنون العظمة'),
            ('DOCX-P556-R03577','يُكَفِّرْ','نُكَفِّرْ','نافع، ابن عامر، أبو جعفر، خلف العاشر',9,
             'بنون العظمة'),
            ('DOCX-P556-R03577','وَيُدْخِلْهُ','وَنُدْخِلْهُ','نافع، ابن عامر، أبو جعفر، خلف العاشر',9,
             'بنون العظمة'),
        ],
        558: [
            ('DOCX-P558-R03585','النَّبِيُّ','النَّبِيءُ','نافع',1,
             'بالهمز والمد'),
            ('DOCX-P558-R03588','فَهُوَ','فَهْوَ','قالون، أبو عمرو، الكسائي، أبو جعفر',3,
             'بإسكان الهاء'),
            ('DOCX-P558-R03589','بَـٰلِغُ أَمْرِهِۦ','بَالِغٌ أَمْرَهُ','جميع القراء عدا حفص',3,
             'بتنوين بالغٌ ونصب أمرَهُ'),
            ('DOCX-P558-R03591','يُسْرٗا','يُسُرًا','أبو جعفر',4,
             'بضم السين'),
        ],
        312: [
            ('DOCX-P312-R01187','لِتُبَشِّرَ','لِتَبْشُرَ','حمزة',97,
             'بالتخفيف'),
            ('DOCX-P312-R01188','الْقُرْءَانَ','الْقُرَانَ','ابن كثير',2,
             'بنقل الهمزة'),
            ('DOCX-P312-R01189','لِّأَهْلِهِ ٱمْكُثُوٓاْ','لِأَهْلِهُ امْكُثُوا','حمزة',10,
             'بضم الهاء وصلاً'),
            ('DOCX-P312-R01190','إِنِّيٓ أَنَا۠','أَنِّي أَنَا','ابن كثير، أبو عمرو، أبو جعفر',12,
             'بفتح الهمزة'),
        ],
        316: [
            ('DOCX-P316-R01242','سَـٰحِرٍ','سِحْرٍ','حمزة، الكسائي، خلف',69,
             'مصدراً'),
        ],
        319: [
            ('DOCX-P319-R01277','أَيْدِيهِمْ','أَيْدِيهُمُ','يعقوب',110,
             'بضمها'),
            ('DOCX-P319-R01278','وَهُوَ','وَهْوَ','قالون، أبو عمرو، الكسائي، أبو جعفر',112,
             'بإسكان الهاء'),
        ],
        320: [
            ('DOCX-P320-R01284','بِالْقُرْءَانِ','بِالْقُرَانِ','ابن كثير',114,
             'بنقل الهمزة'),
        ],
        321: [
            ('DOCX-P321-R01293','تَرْضَىٰ','تُرْضَى','شعبة، الكسائي',130,
             'بضم التاء مبنياً للمفعول'),
        ],
        322: [
            ('DOCX-P322-R01302','مَا يَأْتِيهِم','مَا يَأْتِيهُم','يعقوب',2,
             'بضم الهاء'),
            ('DOCX-P322-R01304','وَهُوَ','وَهْوَ','قالون، أبو عمرو، الكسائي، أبو جعفر',4,
             'بإسكان الهاء'),
        ],
        323: [
            ('DOCX-P323-R01314','فِيهِمَآ','فِيهُمَا','يعقوب',22,
             'بضم الهاء'),
        ],
        325: [
            ('DOCX-P325-R01337','تَأْتِيهِم','تَأْتِيهُم','يعقوب',40,
             'بضم الهاء'),
        ],
        326: [
            ('DOCX-P326-R01351','مِثْقَالَ','مِثْقَالُ','نافع، أبو جعفر',47,
             'وبالرفع'),
            ('DOCX-P326-R01352','وَضِيَآءٗ','وَضِنَاءً','قنبل',48,
             'بنون مفتوحة وهمزة بعدها'),
        ],
        295: [
            ('DOCX-P295-R00967','عَلَيْهِم','عَلَيْهُم','حمزة، يعقوب',18,
             'بضم الهاء'),
            ('DOCX-P295-R00970','بِوَرِقِكُمْ','بِوَرْقِكُمْ','أبو عمرو، شعبة، حمزة، روح',19,
             'بإسكان الراء'),
        ],
        296: [
            *[('DOCX-P296-R00975','عَلَيْهِم','عَلَيْهُم','حمزة، يعقوب',21,
               'بضم الهاء',occ) for occ in range(1,4)],
            *[('DOCX-P296-R00976','فِيهِم','فِيهُمُ','يعقوب',22,
               'بضم الهاء',occ) for occ in range(1,3)],
        ],
        297: [
            ('DOCX-P297-R00987','أُكُلَهَا','أُكْلَهَا','نافع، ابن كثير، أبو عمرو',33,
             'بإسكان الكاف'),
            ('DOCX-P297-R00992','وَهُوَ','وَهْوَ','قالون، أبو عمرو، الكسائي، أبو جعفر',34,
             'بإسكان الهاء'),
        ],
        298: [
            ('DOCX-P298-R00999','وَهُوَ','وَهْوَ','قالون، أبو عمرو، الكسائي، أبو جعفر',35,
             'بإسكان الهاء'),
            ('DOCX-P298-R00999','وَهِيَ','وَهْيَ','قالون، أبو عمرو، الكسائي، أبو جعفر',42,
             'بإسكان الهاء'),
        ],
        299: [
            ('DOCX-P299-R01016','نُسَيِّرُ ٱلْجِبَالَ','تُسَيَّرُ ٱلْجِبَالُ',
             'ابن كثير، أبو عمرو، ابن عامر',47,'بالتاء والياء'),
            ('DOCX-P299-R01017','لِلْمَلَـٰٓئِكَةِ','لِلْمَلَائِكَةُ','أبو جعفر',50,
             'بضم التاء وصلاً'),
            ('DOCX-P299-R01018','مَّآ أَشْهَدتُّهُمْ','مَا أَشْهَدْنَاهُمْ','أبو جعفر',51,
             'بنون العظمة'),
            ('DOCX-P299-R01019','وَمَا كُنتُ','وَمَا كُنْتَ','أبو جعفر',51,
             'بخطاب التاء'),
        ],
        300: [
            ('DOCX-P300-R01027','ٱلْقُرْءَانِ','ٱلْقُرَانِ','ابن كثير',54,
             'بنقل الهمزة'),
            ('DOCX-P300-R01028','قُبُلًا','قِبَلًا','نافع، ابن كثير، أبو عمرو، ابن عامر، شعبة، يعقوب',55,
             'بكسر القاف وفتح الباء'),
            ('DOCX-P300-R01031','لِمَهْلِكِهِم','لِمُهْلَكِهِم',
             'نافع، ابن كثير، أبو عمرو، ابن عامر، حمزة، الكسائي، أبو جعفر، يعقوب',59,
             'بضم الميم وفتح اللام'),
            ('DOCX-P300-R01032','لِمَهْلِكِهِم','لِمَهْلَكِهِم','شعبة',59,
             'بفتح اللام'),
        ],
        301: [
            ('DOCX-P301-R01037','أَنسَىٰنِيهُ','أَنسَانِيهِ','جميع القراء عدا حفص',63,
             'بكسر الهاء وحذف ألف الوسط'),
            ('DOCX-P301-R01038','رُشْدًا','رَشَدًا','أبو عمرو، يعقوب',66,
             'بفتح الشين'),
            ('DOCX-P301-R01043','عُسْرًا','عُسُرًا','أبو جعفر',73,
             'بضم السين'),
            ('DOCX-P301-R01044','زَكِيَّةً','زَاكِيَةً','نافع، ابن كثير، أبو عمرو، أبو جعفر، رويس',74,
             'بالألف بعد الزاي'),
        ],
        302: [
            ('DOCX-P302-R01056','رُحْمًا','رُحُمًا','ابن عامر، أبو جعفر، يعقوب',81,
             'بضم الحاء'),
        ],
        304: [
            ('DOCX-P304-R01081','أَن تَنفَدَ','أَن يَنفَدَ','حمزة، الكسائي',109,
             'بياء الغيب'),
        ],
    }
    out=[]
    external_face_notes={
        'DOCX-P454-R02611':('https://quranpedia.net/qiraat/sad/22',
            'ينص السطر المصدر صراحة على وجهي السين وإشمام الصاد زايًا في الصراط؛ أُبقي الوجهين منفصلين بحسب القارئ.'),
        'DOCX-P560-R03600':('https://quranpedia.net/qiraat/at-talaq/11',
            'يصحح هذا الإسناد المستقل توزيع السطر المقلوب: فتح الياء لقالون وورش وقنبل والبزي والدوري والسوسي وابن وردان وابن جماز وشعبة ورويس.'),
        'DOCX-P560-R03608':('https://quranpedia.net/qiraat/at-tahrim/4',
            'يعتمد هذا الوجه على التقسيم التفصيلي المستقل: التشديد لنافع وابن كثير وأبي عمرو وابن عامر وأبي جعفر ويعقوب؛ وخلف العاشر مع حفص وشعبة وحمزة والكسائي في وجه التخفيف.'),
        'DOCX-P560-R03612':('https://quranpedia.net/qiraat/at-tahrim/4',
            'يصحح هذا الإسناد المستقل قراءة شعبة: وَجَبْرَئِلُ، بفتح الجيم والراء والهمز مع حذف الياء.'),
        'DOCX-P560-R03613':('https://quranpedia.net/qiraat/at-tahrim/4',
            'أُضيف خلف العاشر هنا لأن جهاز الآية يسمي إسحاق وإدريس صراحةً مع حمزة والكسائي؛ أما «خلف» المجرد في سطر المصدر فخلف عن حمزة Q06-R01.'),
    }
    # Explicit phonetic faces that share the same written Uthmani token still belong in
    # the word-variant fixture: the UI/API carries them as performance_variant records.
    # Reader-level distinctions below are supported by the cited ten-reader apparatus.
    performance_faces={
        555: [
            ('DOCX-P555-R03564','قِيلَ','هشام، الكسائي، رويس',5,'بالإشمام',
             'https://quranpedia.net/qiraat/al-munafiqun/5',
             'الإشمام لهشام والكسائي ورويس؛ رويس هو Q09-R01.'),
            ('DOCX-P555-R03564','قِيلَ','السوسي',5,'كسر خالص مع الإدغام الكبير',
             'https://quranpedia.net/qiraat/al-munafiqun/5',
             'السوسي عن أبي عمرو يقرأ بكسر خالص مع الإدغام الكبير.'),
        ],
        561: [
            ('DOCX-P561-R03622','وَقِيلَ','هشام، الكسائي، رويس',10,'بالإشمام',
             'https://quranpedia.net/qiraat/at-tahrim/10',
             'الإشمام لهشام والكسائي ورويس؛ رويس هو Q09-R01.'),
        ],
    }
    for record_id,anchor,reader_text,ayah,description,authority_url,verification in performance_faces.get(page,[]):
        record=PACKAGE_RECORDS.get(record_id)
        if (not record or record.get('page_no')!=page or record.get('section')!='farsh' or
                record.get('raw_text') not in lines or is_neg(record['raw_text']) or
                is_univ(record['raw_text']) or has_bare_ambiguous_reader(record['raw_text'])):
            raise ValueError(f'page {page} performance face failed exact source/safety check: {record_id}')
        readers=readers_from(reader_text,set())
        loc=T.find(page,anchor,ayah=ayah)
        if not readers or not readers<=ALL20:
            raise ValueError(f'page {page} performance reader group invalid: {record_id}')
        lid=f'D{page:03d}-{T.norm(anchor).replace(" ","_")}'
        wid=len(out)+1
        vid=f'v-{lid}-performance{wid}'
        out.append({'id':vid,'surah':loc['surah'],'ayah':loc['startAyah'],
            'startToken':loc['startWord'],'endToken':loc['endWord'],'operation':'REPLACE',
            'hafsText':loc['baseText'],'variantText':loc['baseText'],
            'differenceType':'HARAKAH','verificationStatus':'REVIEWED',
            'createdAt':TS,'updatedAt':TS,'readingIds':sorted(readers),'locusId':lid,
            'locusType':'performance_variant','performanceNote':description,
            'sources':[{'id':f's-{lid}-performance{wid}','variantId':vid,**SRC,
                'sourceReference':f"qiraat_records.jsonl، {record_id}",'sourceText':record['raw_text'],
                'verificationNotes':f'{verification} المرجع المستقل: {authority_url}.'}],
            'description':description,'wajhIndex':wid,'evidence':[]})
    selected=cases.get(page, [])
    if not selected:
        return out
    grouped=collections.defaultdict(list)
    for item in selected:
        record_id,anchor,form,reader_text,ayah,description,*occurrence=item
        occurrence=occurrence[0] if occurrence else 1
        record=PACKAGE_RECORDS.get(record_id)
        if (not record or record.get('page_no')!=page or record.get('section')!='farsh' or
                record.get('raw_text') not in lines):
            raise ValueError(f'page {page} audited face source row missing: {record_id}')
        source=record['raw_text']
        source_has_unqualified_universal = is_univ(source) and not re.search(
            r'جميع القراء\s+عدا\s+', source)
        if is_neg(source) or source_has_unqualified_universal or has_bare_ambiguous_reader(source):
            raise ValueError(f'page {page} audited face failed source guards: {record_id}')
        try:
            readers=readers_from(reader_text,set())
            loc=T.find(page,anchor,occurrence,ayah)
        except (Unresolved,T.NoMatch) as exc:
            raise ValueError(f'page {page} audited face reader/token unresolved: {record_id}') from exc
        if not readers or not readers <= ALL20:
            raise ValueError(f'page {page} audited alternate group invalid: {record_id}')
        if T.norm(form) not in T.norm(source):
            # Some page rows name a fully predictable vowel/shadda change in prose without
            # repeating the alternate spelling. Permit only that same-letter case when both
            # the anchor and the exact vocalic operation occur in the verified source row.
            normalized_form=T.norm(form)
            normalized_anchor=T.norm(anchor)
            spelled_without_prefix=(normalized_anchor.startswith('و') and
                                    normalized_form.startswith('و') and
                                    normalized_form[1:] in T.norm(source) and
                                    description in source)
            described_same_letters=(normalized_form==normalized_anchor and description in source)
            if not (described_same_letters or spelled_without_prefix or record_id in external_face_notes):
                raise ValueError(f'page {page} source lacks alternate spelling {form}: {record_id}')
        grouped[(loc['surah'],loc['startAyah'],loc['startWord'],loc['endAyah'],loc['endWord'])].append(
            (record_id,anchor,form,readers,description,source,loc,occurrence))
    for key,faces in grouped.items():
        # Merge identical forms, but remove every reader involved in a same-token conflict.
        forms={}
        for _,_,form,readers,_,_,_,_ in faces:
            normalized=face_key(form)
            if normalized not in forms:
                forms[normalized]={'readers':set(),'text':form}
            forms[normalized]['readers'].update(readers)
        conflicting=set()
        form_items=list(forms.items())
        for i,(form_a,data_a) in enumerate(form_items):
            for form_b,data_b in form_items[i+1:]:
                if form_a!=form_b:
                    conflicting |= data_a['readers'] & data_b['readers']
        loc=faces[0][6]
        groups=[]
        occupied=set()
        for normalized,data in forms.items():
            safe=data['readers']-conflicting
            if not safe:
                continue
            if safe & occupied:
                raise ValueError(f'page {page} audited faces overlap after conflict filtering: {key}')
            occupied.update(safe)
            source_row=next(x for x in faces if face_key(x[2])==normalized)
            # The source may quote the Hafs spelling for a named group; the real page token is
            # the baseline and only non-baseline spellings become variant rows.
            groups.append((source_row[1],data['text'],safe,source_row[4],source_row[5],source_row[7]))
        if not groups:
            continue
        wujuh=[(loc['baseText'],'وجه حفص المطابق لرسم المصحف',ALL20-occupied)]
        for anchor,form,readers,description,_,_ in groups:
            if face_key(form)==face_key(loc['baseText']):
                wujuh[0]=(loc['baseText'],description,ALL20-occupied | readers)
            else:
                wujuh.append((form,description,readers))
        if not any(face_key(form)!=face_key(loc['baseText']) for _,form,_,_,_,_ in groups):
            continue
        before=len(out)
        yield_block(page,faces[0][1],wujuh,out,ayah=loc['startAyah'],occurrence=faces[0][7])
        emitted=out[before:]
        for variant in emitted:
            match=next((face for face in faces if face_key(face[2])==face_key(variant['variantText']) and
                        set(variant['readingIds']) <= (forms[face_key(face[2])]['readers']-conflicting)),None)
            if match:
                variant['sources'][0].update({
                    'sourceReference':f"qiraat_records.jsonl، {match[0]}",
                    'sourceText':match[5],
                    'verificationNotes':'إسناد صريح من السطر المصدر، ورُبط الوجه برمز الكلمة الحقيقي في صفحة المصحف.'})
                if match[0] in external_face_notes:
                    authority_url,authority_note=external_face_notes[match[0]]
                    variant['sources'][0]['verificationNotes']=authority_note+' المرجع: '+authority_url
                if match[0]=='DOCX-P547-R03487' and 'Q10-R01' in variant['readingIds']:
                    variant['sources'][0]['verificationNotes']=(
                        'ينص المصدر على خلف؛ أُسند خلف عن حمزة وفق قاعدة المشروع، وأضيف خلف العاشر '
                        'لأن جهاز القراءات العشر يذكر إدريس وإسحاق صراحةً لهذا الوجه: '
                        'https://quranpedia.net/tafsir/al-hashr/11')
        expected_forms=sum(1 for _,form,readers,_,_,_ in groups if
                           face_key(form)!=face_key(loc['baseText']) and readers-conflicting)
        if len(emitted)!=expected_forms:
            raise ValueError(f'page {page} audited face partition failed at {key}')
    return out

if __name__=='__main__':
    raw=sys.argv[1:]
    categories=None
    complete_ikhfa='--complete-ikhfa' in raw
    variants_only='--variants-only' in raw
    if '--category' in raw:
        ix=raw.index('--category')
        if ix+1>=len(raw): raise SystemExit('--category needs a category name')
        categories={raw[ix+1]}
    if variants_only and categories is not None:
        raise SystemExit('--variants-only cannot be combined with --category')
    args=[a for a in raw if not a.startswith('--')]
    if categories is not None: args.remove(next(iter(categories)))
    if '-' in (args[0] if args else ''):
        a,b=args[0].split('-'); pages=list(range(int(a),int(b)+1))
    elif args:
        pages=[int(x) for x in args]
    else:
        pages=list(range(268,305))
    vout,rout,vs,rs=build(pages,categories=categories,complete_ikhfa=complete_ikhfa)
    if variants_only:
        rout={}
        rs=collections.Counter()
    print('pages touched:',sorted(set(vout)|set(rout)))
    print('variants added:',vs['added'])
    print('existing variant source links added:',vs['sourceLinksAdded'])
    print('new ruling loci:',rs['added'],' merged ruling loci:',rs['merged'],
          ' reader assignments added:',rs['assignmentsAdded'],
          ' source notes added:',rs['notesAdded'],
          ' conflicting/duplicate assignments dropped:',rs['conflictsDropped'])
    if '--write' in sys.argv:
        vd=os.path.join(ROOT,'packages/qiraat-core/fixtures/pages')
        rd=os.path.join(ROOT,'packages/qiraat-core/fixtures/rulings')
        for p in sorted(vout):
            path=os.path.join(vd,f'page-{p:03d}.json')
            json.dump(vout[p],open(path,'w'),ensure_ascii=False,indent=2)
            open(path,'a').write('\n')
        for p in sorted(rout):
            path=os.path.join(rd,f'page-{p:03d}.json')
            json.dump(rout[p],open(path,'w'),ensure_ascii=False,indent=2)
            open(path,'a').write('\n')
        print('WROTE',len(vout),'variant page files and',len(rout),'ruling page files')
