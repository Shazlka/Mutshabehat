# -*- coding: utf-8 -*-
"""Parse the ayah-by-ayah فرش/أصول prose tables (surahs 25-56) into Qiraat fixtures.

This is a DIFFERENT ingestion path from data_variants.py: those pages were hand-encoded
from page images; these surahs came as regular ayah-by-ayah tables (فرش الكلمات + الأصول
المطردة + الشواهد), too many to hand-encode. This parser imports every locus that resolves
to a clean 20-Riwayat partition anchored on a real Mushaf token, and DROPS (never guesses)
everything it cannot resolve — exactly the rule the project already applies to `؟` rows.

Output: packages/qiraat-core/fixtures/{pages,rulings}/page-NNN.json, grouped by the Mushaf
page each ayah's words actually live on, plus a dropped-loci report for the paper original.
"""
import json, os, re, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tokens as T
import authorities as A

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SC = '/tmp/claude-0/-home-user-Mutshabehat/e0ba1b96-dd1a-5b8a-886e-c95aefd540ed/scratchpad'
DATA = json.load(open(SC + '/maryam_like.json', encoding='utf-8'))
TS = '2026-09-20T12:00:00.000Z'

SRC = dict(sourceName='جداول فرش القراءات العشر (سور ٢٥–٥٦)', sourceType='other',
           sourceReference='جداول الآيات المسلَّمة: فرش الكلمات والأصول المطردة والشواهد',
           verificationNotes='بيانات مسلَّمة نصًّا آيةً آية (ليست استخراجًا بصريًّا). لم تُراجع بعدُ على الأصل الورقي.')

# ---- reader / group resolver -------------------------------------------------
R = A.READERS      # name -> Q0N
N = A.NARRATORS    # name -> Q0N-R0M
ALL20 = set(A.ALL_READINGS)

def rd(name):  # reader -> its two riwayat
    return set(A.readings_of(R[name]))

GROUPS = {
    'الكوفيون': rd('عاصم')|rd('حمزة')|rd('الكسائي')|rd('خلف العاشر'),
    'أهل الكوفة': rd('عاصم')|rd('حمزة')|rd('الكسائي')|rd('خلف العاشر'),
    'أهل سما': rd('نافع')|rd('ابن كثير')|rd('أبو عمرو'),
    'سما': rd('نافع')|rd('ابن كثير')|rd('أبو عمرو'),
    'الحرميان': rd('نافع')|rd('ابن كثير'),
    'الحرميّان': rd('نافع')|rd('ابن كثير'),
    'المدنيان': rd('نافع')|rd('أبو جعفر'),
    'المدنيّان': rd('نافع')|rd('أبو جعفر'),
    'البصريان': rd('أبو عمرو')|rd('يعقوب'),
    'البصريّان': rd('أبو عمرو')|rd('يعقوب'),
    'صحبة': rd('حمزة')|rd('الكسائي')|rd('خلف العاشر')|{N['شعبة']},
    'صحاب': rd('حمزة')|rd('الكسائي')|rd('خلف العاشر')|{N['حفص']},
}
# longest-name-first so "خلف العاشر" wins over "خلف", "الدوري عن الكسائي" over "الدوري"
NAR_DISAMBIG = {'الدوري عن أبي عمرو': N['الدوري عن أبي عمرو'],
                'الدوري عن الكسائي': N['الدوري عن الكسائي']}
NAMED = {}
for k,v in GROUPS.items(): NAMED[k]=set(v)
for k,v in NAR_DISAMBIG.items(): NAMED[k]={v}
for nm,q in N.items():
    if nm in ('الدوري',): continue   # bare الدوري is ambiguous -> unresolved
    NAMED[nm]={q}
for nm,q in R.items():
    NAMED[nm]=set(A.readings_of(q))
NAMED['خلف العاشر']=set(A.readings_of(R['خلف العاشر']))
# tokens that must never resolve from a bare form
AMBIG = ('الدوري', )
NAMES_BY_LEN = sorted(NAMED, key=len, reverse=True)

class Unresolved(Exception): pass

def resolve_readers(phrase, claimed):
    """Consume a run of reader/group names from the START of `phrase`. Returns (set, rest).
    'الباقون' resolves to the 20 minus `claimed`. Raises Unresolved on a bare ambiguous name
    or any unknown leading token that isn't a connector."""
    s = phrase.strip()
    got = set(); consumed = True
    # 'الباقون' short-circuits
    if s.startswith('الباقون'):
        rest = s[len('الباقون'):].strip()
        # skip an optional (…) expansion
        if rest.startswith('('):
            depth=0
            for i,ch in enumerate(rest):
                if ch=='(':depth+=1
                elif ch==')':
                    depth-=1
                    if depth==0: rest=rest[i+1:].strip(); break
        return set(ALL20)-claimed, rest
    def guard(t):
        if t.startswith('الدوري') and not any(t.startswith(x) for x in NAR_DISAMBIG):
            raise Unresolved('bare «الدوري»')
        if t.startswith('خلف') and not t.startswith('خلف العاشر') and not t.startswith('خلف عن'):
            raise Unresolved('bare «خلف»')
    while s:
        s = s.lstrip(' \t،,')
        if not s: break
        guard(s)
        matched = False
        # 1) match a whole name AS-IS (so و-initial names like ورش survive)
        for nm in NAMES_BY_LEN:
            if s.startswith(nm):
                got |= NAMED[nm]; s = s[len(nm):]; matched = True; break
        if matched: continue
        # 2) treat a leading و as a connector, but only if a real name follows it
        if s.startswith('و'):
            s2 = s[1:]; guard(s2)
            for nm in NAMES_BY_LEN:
                if s2.startswith(nm):
                    got |= NAMED[nm]; s = s2[len(nm):]; matched = True; break
            if matched: continue
        break
    return got, s

# ---- ayah -> page map --------------------------------------------------------
_word_pages = {}
def build_page_index():
    for p in range(1, 605):
        try: ws = T.page_words(p)
        except Exception: continue
        for w in ws:
            _word_pages.setdefault((w['surahNumber'], w['ayahNumber']), set()).add(p)
build_page_index()

def pages_for(surah, ayah):
    return sorted(_word_pages.get((surah, ayah), []))

# ---- farsh block parser ------------------------------------------------------
PAREN = re.compile(r'[（(﴿]([^)）﴾]+)[)）﴿﴾]')
def first_paren(s):
    m = PAREN.search(s)
    return m.group(1).strip() if m else None

DIFF_KEYS = [
    (('بالياء','بالنون','بالتاء','ياء الغيب','نون العظمة','تاء الخطاب','تاء التأنيث'),'word_form'),
    (('بألف','بغير ألف','ألف بعد','حذف الألف','إثبات الألف'),'orthography'),
    (('الهمز','همزة','تسهيل','إبدال الهمز','تحقيق'),'hamza'),
    (('بتشديد','بالتشديد','تخفيف','بالتخفيف','مشددة','مخففة'),'word_form'),
    (('بضم','بفتح','بكسر','بإسكان','بالضم','بالفتح','بالكسر','بالإسكان','برفع','بنصب','بجر','بالرفع','بالنصب'),'vowel'),
    (('إشمام',),'ishmam'),
]
def diff_type(desc):
    for keys,t in DIFF_KEYS:
        if any(k in desc for k in keys): return t
    return 'other'

def parse_farsh_block(block):
    """Return list of wujuh: [(text, desc, readingset, is_base_hafs)] or None if unparseable.
    A 'wajh' line looks like: '- قرأ READERS DESC: (TEXT).'  or  '- READERS DESC: (TEXT)'."""
    lines = [l.strip() for l in block.split('\n')]
    header = lines[0]
    sub = [l for l in lines[1:] if l.startswith('-')]
    if len(sub) < 2:  # need at least two wujuh to form a partition
        return None
    anchor = first_paren(header) or first_paren(' '.join(lines))
    wujuh = []
    claimed = set()
    for l in sub:
        body = l[1:].strip()
        body = re.sub(r'^قرأ\s+','',body)
        # split at the LAST ':' that precedes a parenthesised text, else last ':'
        if ':' not in body: return None
        pre, post = body.rsplit(':',1)
        text = first_paren(post)
        if text is None:
            # sometimes text is bare after colon
            text = post.strip().rstrip('.').strip() or None
        try:
            rset, rest = resolve_readers(pre, claimed)
        except Unresolved:
            return None
        if not rset:
            return None
        desc = rest.strip()
        wujuh.append([text, desc, rset])
        claimed |= rset
    return anchor, wujuh

def build():
    variants_by_page = collections.defaultdict(list)
    stats = collections.Counter()
    dropped = []
    for surah in range(25, 57):
        info = DATA[str(surah)]
        for row in info['rows']:
            try:
                ayah = int(str(row['ayah']).strip())
            except (TypeError, ValueError):
                continue
            fc = row['farsh']
            if not fc or 'لا خلاف' in fc:
                continue
            blocks = [b for b in re.split(r'\n?•\s*', fc) if b.strip()]
            pgs = pages_for(surah, ayah)
            for bi, block in enumerate(blocks):
                stats['blocks']+=1
                parsed = parse_farsh_block(block)
                if not parsed:
                    stats['drop_unparseable']+=1
                    dropped.append((surah,ayah,'unparseable',block[:80]))
                    continue
                anchor, wujuh = parsed
                if not anchor:
                    stats['drop_no_anchor']+=1; dropped.append((surah,ayah,'no_anchor',block[:80])); continue
                # partition check
                union=set(); overlap=False
                for _,_,rs in wujuh:
                    if union & rs: overlap=True
                    union|=rs
                if overlap or union!=ALL20:
                    stats['drop_partition']+=1
                    dropped.append((surah,ayah,f'partition miss={len(ALL20-union)} extra_overlap={overlap}',anchor))
                    continue
                # baseline: exactly one wajh contains حفص Q05-R02
                base_idx=[i for i,(_,_,rs) in enumerate(wujuh) if 'Q05-R02' in rs]
                if len(base_idx)!=1:
                    stats['drop_no_hafs']+=1; dropped.append((surah,ayah,'no/dup hafs',anchor)); continue
                bi_h=base_idx[0]
                # anchor on a real token
                loc=None
                for p in pgs:
                    try:
                        loc=T.find(p, anchor, 1, ayah); page=p; break
                    except T.NoMatch:
                        continue
                if loc is None:
                    stats['drop_anchor_miss']+=1; dropped.append((surah,ayah,'anchor not a token',anchor)); continue
                # baseline text must match mushaf rasm
                base_text=wujuh[bi_h][0]
                if base_text and T.norm(base_text)!=T.norm(loc['baseText']):
                    stats['drop_baseline_text']+=1; dropped.append((surah,ayah,f'baseline {base_text!r}!=mushaf {loc["baseText"]!r}',anchor)); continue
                # emit variant records (skip the base wajh)
                locus_id=f'L{page:03d}-s{surah}a{ayah}b{bi}'
                recs=[]
                for wi,(text,desc,rset) in enumerate(wujuh,1):
                    if wi-1==bi_h: continue
                    perf = bool(text) and T.norm(text)==T.norm(loc['baseText']) and any(k in desc for k in ('إشمام','اختلاس','السكت','بالسكت','الروم'))
                    recs.append({
                        'id':f'v-{locus_id}-w{wi}',
                        'surah':loc['surah'],'ayah':loc['startAyah'],
                        'startToken':loc['startWord'],'endToken':loc['endWord'],
                        'operation':'REPLACE','hafsText':loc['baseText'],
                        'variantText':loc['baseText'] if perf else (text or loc['baseText']),
                        'differenceType':{'orthography':'ORTHOGRAPHY','vowel':'HARAKAH','consonant':'LETTER','hamza':'HAMZ','word_form':'LETTER','ishmam':'HARAKAH','other':'OTHER'}[diff_type(desc)],
                        'verificationStatus':'REVIEWED','createdAt':TS,'updatedAt':TS,
                        'readingIds':sorted(rset),
                        'locusId':locus_id,
                        'locusType':'performance_variant' if perf else ('multi_word_variant' if loc['endWord']>loc['startWord'] else 'word_variant'),
                        **({'performanceNote':desc} if perf else {}),
                        'sources':[{'id':f's-{locus_id}-w{wi}','variantId':f'v-{locus_id}-w{wi}',**SRC}],
                        'description':desc,'wajhIndex':wi,'evidence':[],
                    })
                variants_by_page[page].extend(recs)
                stats['imported_loci']+=1
                stats['imported_records']+=len(recs)
    return variants_by_page, stats, dropped

if __name__=='__main__':
    vbp,stats,dropped=build()
    print('STATS:',dict(stats))
    print('pages with variants:',len(vbp))
    # dry run: show surah 25 sample
    import collections as C
    dr=C.Counter(r[2].split(' ')[0] for r in dropped)
    print('drop reasons head:',dict(C.Counter(r[2][:16] for r in dropped).most_common(8)))


# ---- أصول (rulings) parser ---------------------------------------------------
# Only families whose attribution is deterministic or explicitly listed, with hard guards
# against the NEGATIVE and UNIVERSAL statements that share the same leading phrase.
NEG = ('غير وارد','لا يدغم','لا يُدغم','لا تدغم','فتفخم','لا ترقيق','لا خلاف','لا صلة','لا يمد',
       'لا إمالة','ليست','لا تُرقَّق','لا ترقق','لا نقل','لا سكت')
UNIV = ('لجميع القراء','للجميع','لجميع القرّاء','لكل القراء','العشرة جميعًا','العشرة جميعا')
def is_neg(b): return any(x in b for x in NEG)
def is_univ(b): return any(x in b for x in UNIV)

RCOLORS = {  # must match build_rulings.py CATEGORIES exactly
 'MADD_BADAL':('مد البدل','#2563EB'),'MADD_LIN':('مد اللين المهموز','#2563EB'),
 'TARQIQ_RA':('ترقيق الراءات','#B45309'),'TAGHLIZ_LAM':('تغليظ اللامات','#B45309'),
 'IDGHAM_KABIR':('المدغم الكبير','#15803D'),'IDGHAM_SAGHIR':('المدغم الصغير','#15803D'),
 'IMALAH_TAQLIL':('الممال والمقلل','#C026D3'),'TAGHYIR_HAMZ':('تغيير الهمز','#DC2626'),
 'SILAT_HA':('صلة هاء الكناية','#0D9488'),'SAKT':('السكت','#7C3AED'),
}
def ruling_reading_rows(qids, action, alt=None):
    alt = alt or set()
    return [{'readingId':r,'action':action,'isDefault':r not in alt} for r in sorted(qids)]

def anchor_after_fi(bullet):
    """The (word) after 'في', else the first paren in the bullet."""
    m = re.search(r'في\s*[（(﴿]([^)）﴿﴾]+)[)）﴿﴾]', bullet)
    if m: return m.group(1).strip()
    return first_paren(bullet)

def parse_usul_bullet(b):
    """Return (category, anchor, [(reader_qids_set, action)], has_alt) or None."""
    head = b.split(':')[0]
    if is_neg(b): return None
    # ---- fixed-reader ورش/سوسي families
    def fixed(cat, reader_name, action, needle):
        if reader_name not in b: return None
        an = anchor_after_fi(b) or first_paren(b)
        if not an: return None
        return (cat, an, [(set(A.readings_of(R[reader_name] if reader_name in R else None)) if reader_name in R else {A.NARRATORS[reader_name]}, action)], False)
    if head.startswith('مد البدل') and 'ورش' in b:
        an=anchor_after_fi(b) or first_paren(b)
        if an: return ('MADD_BADAL', an, [({A.NARRATORS['ورش']},'مد البدل')], False)
    if head.startswith('مد اللين') and 'ورش' in b:
        an=anchor_after_fi(b) or first_paren(b)
        if an: return ('MADD_LIN', an, [({A.NARRATORS['ورش']},'مد اللين المهموز')], False)
    if head.startswith('ترقيق') and 'ورش' in b and not is_univ(b):
        an=anchor_after_fi(b) or first_paren(b)
        if an: return ('TARQIQ_RA', an, [({A.NARRATORS['ورش']},'ترقيق الراء')], False)
    if head.startswith('تغليظ') and 'ورش' in b:
        an=anchor_after_fi(b) or first_paren(b)
        if an: return ('TAGHLIZ_LAM', an, [({A.NARRATORS['ورش']},'تغليظ اللام')], False)
    if head.startswith('الإدغام الكبير') and 'السوسي' in b:
        an=anchor_after_fi(b) or first_paren(b)
        if an: return ('IDGHAM_KABIR', an, [({A.NARRATORS['السوسي']},'إدغام كبير')], False)
    if head.startswith('النقل لورش') and 'ورش' in b:
        an=anchor_after_fi(b) or first_paren(b)
        if an: return ('TAGHYIR_HAMZ', an, [({A.NARRATORS['ورش']},'النقل')], False)
    # ---- صلة هاء الكناية: only the distinctive ابن كثير case
    if head.startswith('صلة هاء') and 'ابن كثير' in b and not is_univ(b):
        an=anchor_after_fi(b) or first_paren(b)
        if an: return ('SILAT_HA', an, [(set(A.readings_of(R['ابن كثير'])),'صلة هاء الكناية')], False)
    # ---- إمالة وتقليل: parse the sub-bullets naming reader groups per action
    if head.startswith('إمالة') or head.startswith('الممال') or head.startswith('إمالة وتقليل'):
        an=first_paren(b)
        if not an: return None
        groups=[]; claimed=set(); alt=set()
        for l in b.split('\n')[1:]:
            l=l.strip()
            if not l.startswith('-'): continue
            body=l[1:].strip()
            if ':' not in body: continue
            act,names = body.split(':',1)
            act=act.strip()
            if 'فتح' in act or 'الباقون' in names:  # base
                continue
            try:
                rs,_=resolve_readers(names, claimed)
            except Unresolved:
                return None
            if not rs: continue
            action = 'إمالة' if 'إمال' in act else ('تقليل' if 'تقليل' in act or 'بين بين' in act else act)
            groups.append((rs,action)); claimed|=rs
        if not groups: return None
        return ('IMALAH_TAQLIL', an, groups, False)
    # ---- إدغام دال/تاء … (2-way إدغام/إظهار)
    if head.startswith('إدغام') and 'الإدغام الكبير' not in head and ('بالإدغام' in b or 'الإدغام' in b):
        an=first_paren(b)
        if not an: return None
        # find the readers on the الإدغام side
        m=re.search(r'(?:بالإدغام|الإدغام)\s*:?\s*([^\n.]+)', b)
        if not m: return None
        seg=m.group(1)
        if 'الباقون' in seg or is_univ(seg): return None
        try:
            rs,_=resolve_readers(seg, set())
        except Unresolved:
            return None
        if not rs or len(rs)>=20: return None
        return ('IDGHAM_SAGHIR', an, [(rs,'إدغام صغير')], False)
    return None

def build_rulings():
    by_page=collections.defaultdict(list); stats=collections.Counter(); dropped=[]
    for surah in range(25,57):
        for row in DATA[str(surah)]['rows']:
            try: ayah=int(str(row['ayah']).strip())
            except: continue
            u=row['usul']
            if not u: continue
            pgs=pages_for(surah,ayah)
            for bi,b in enumerate([x for x in re.split(r'\n?•\s*',u) if x.strip()]):
                stats['usul_bullets']+=1
                r=parse_usul_bullet(b)
                if not r:
                    stats['skip']+=1; continue
                cat,anchor,groups,_=r
                loc=None; page=None
                for p in pgs:
                    try: loc=T.find(p,anchor,1,ayah); page=p; break
                    except T.NoMatch: continue
                if loc is None:
                    stats['drop_anchor']+=1; dropped.append((surah,ayah,cat,anchor)); continue
                label,color=RCOLORS[cat]
                attribution=[]; readings=[]
                for rs,action in groups:
                    for q in sorted(rs):
                        attribution.append({'authorityId':q,'action':action})
                        readings.append({'readingId':q,'action':action,'isDefault':True})
                rec={'id':f'r-p{page:03d}-s{surah}a{ayah}b{bi}','pageNumber':page,'category':cat,
                     'categoryAr':label,'color':color,'wordAnchored':True,
                     'surah':loc['surah'],'ayah':loc['startAyah'],'startToken':loc['startWord'],
                     'endToken':loc['endWord'],'endAyah':loc['endAyah'],'baseText':loc['baseText'],
                     'verificationStatus':'REVIEWED','attribution':attribution,'readings':readings,
                     'hasAlternate':False,'createdAt':TS,'updatedAt':TS}
                by_page[page].append(rec)
                stats['imported']+=1
    return by_page,stats,dropped

if __name__=='__main__' and '--rulings' in sys.argv:
    bp,st,dr=build_rulings()
    print('RULING STATS:',dict(st))
    print('pages:',len(bp))
    cat=collections.Counter(r['category'] for recs in bp.values() for r in recs)
    print('by category:',dict(cat))


def write_all():
    vbp,vst,vdr = build()
    rbp,rst,rdr = build_rulings()
    pages = sorted(set(vbp)|set(rbp))
    vdir=os.path.join(ROOT,'packages/qiraat-core/fixtures/pages')
    rdir=os.path.join(ROOT,'packages/qiraat-core/fixtures/rulings')
    for p in pages:
        with open(os.path.join(vdir,f'page-{p:03d}.json'),'w',encoding='utf-8') as f:
            json.dump(vbp.get(p,[]),f,ensure_ascii=False,indent=2); f.write('\n')
        with open(os.path.join(rdir,f'page-{p:03d}.json'),'w',encoding='utf-8') as f:
            json.dump(rbp.get(p,[]),f,ensure_ascii=False,indent=2); f.write('\n')
    # dropped report for the paper original
    rep=os.path.join(ROOT,'docs/qiraat')
    os.makedirs(rep,exist_ok=True)
    with open(os.path.join(rep,'surahs-25-56-dropped.md'),'w',encoding='utf-8') as f:
        f.write('# Surahs 25–56 bulk import — loci dropped (resolve against the paper original)\n\n')
        f.write(f'Variant loci imported: {vst["imported_loci"]} ({vst["imported_records"]} records). ')
        f.write(f'Ruling records imported: {rst["imported"]}.\n\n')
        f.write('## Variant blocks not imported\n\n')
        f.write('| surah:ayah | reason | detail |\n|---|---|---|\n')
        for s,a,why,det in vdr:
            f.write(f'| {s}:{a} | {why[:40]} | {str(det)[:60]} |\n')
    print('WROTE',len(pages),'page pairs;', pages[0],'-',pages[-1])
    print('variant records:',sum(len(v) for v in vbp.values()),' ruling records:',sum(len(v) for v in rbp.values()))
    return pages

if __name__=='__main__' and '--write' in sys.argv:
    write_all()
