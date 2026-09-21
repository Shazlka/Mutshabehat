# -*- coding: utf-8 -*-
"""Parse the page-by-page prose extraction (docx, Mushaf pages 225-584) into Qiraat fixtures.

Third ingestion path. Same hard invariants as build_variants.py (a variant partitions the 20
Riwayat once and the Hafs wajh matches the rasm) and the same drop-on-doubt rule. Rulings are
family-labelled per line in this source, which is cleaner than the ayah tables, but still guarded
against negation/universal statements. DEDUP is additive: new loci are appended, while
source-named reader assignments may be appended to an existing category/locus when uncovered.
Same-reader disagreements are dropped.
"""
import json, os, re, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tokens as T
import authorities as A
from import_surah_tables import resolve_readers, Unresolved, is_neg, is_univ, NAMED, NAMES_BY_LEN

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SC = '/tmp/claude-0/-home-user-Mutshabehat/e0ba1b96-dd1a-5b8a-886e-c95aefd540ed/scratchpad'
DOC = json.load(open(SC + '/doc_pages.json', encoding='utf-8'))
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
    for keys,t in [(('بالياء','بالنون','بالتاء','ياء','نون العظمة','تاء'),'word_form'),
                   (('بألف','بغير ألف','ألف'),'orthography'),
                   (('همز','تسهيل','إبدال','تحقيق'),'hamza'),
                   (('تشديد','تخفيف','مشدد','مخفف'),'word_form'),
                   (('بضم','بفتح','بكسر','بإسكان','رفع','نصب','جر','ضم','فتح','كسر','إسكان'),'vowel'),
                   (('إشمام',),'ishmam')]:
        if any(k in desc for k in keys): return t
    return 'other'

def readers_from(text, claimed):
    """Resolve a reader clause: handles جميع القراء عدا X, الباقون/للجمهور, and name lists."""
    t=text.strip()
    m=re.search(r'جميع القراء عدا\s+(.+)', t)
    if m:
        exc,_=resolve_readers(re.sub(r'[اً]$','',m.group(1)).replace('نافعا','نافع'), set())
        if not exc: raise Unresolved('excepted empty')
        return set(ALL20)-exc
    if 'الباقون' in t or 'للجمهور' in t or 'الجمهور' in t:
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

def yield_block(page, anchor, wujuh, out):
    union=set(); overlap=False
    for _,_,rs in wujuh:
        if union&rs: overlap=True
        union|=rs
    if overlap or union!=ALL20: return
    base=[k for k,(_,_,rs) in enumerate(wujuh) if 'Q05-R02' in rs]
    if len(base)!=1: return
    try: loc=T.find(page, anchor, 1)
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
    # Keep the project-wide resolver rule here too: bare «خلف» is ambiguous between
    # خلف العاشر and خلف عن حمزة, so any clause containing it is unresolved and dropped.
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
        for anchor in anchors:
            emit_ruling(page,'TAGHYIR_HAMZ',anchor,[(rs,action)],out)

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
    if any(x in clause for x in ('الباقون','الباقين','للجمهور','الجمهور')): return None
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

def normalize_yaat_action(category, action, inherited=None):
    action=BRACE.sub('',action).strip(' ،,و.')
    if category=='YAAT_IDAFA':
        if 'فتح' in action: return 'الفتح وصلاً'
        if 'إسكان' in action or 'اسكان' in action: return 'الإسكان وصلاً'
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
            for clause in re.split(r'[؛.]',body):
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
                    groups.append((readers,normalized,alternate,'بخلف عنه' if alternate else None))
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
        if text and not (text.startswith(('و','،',',')) or text[0].isspace()):
            raise Unresolved('unresolved hamzatan reader separator: '+text)
        # An attached trailing «بخلف عنه» has the same scope as a parenthetical on this name.
        trailing=re.match(r'بخلف(?:\s+عنه)?(?=$|[،,؛.]|\s+[وأ])',text)
        if trailing:
            modes[-1]=(readers,True,'بخلف عنه')
            text=text[trailing.end():]
    return modes

def hamzatan_explicit_clause(clause):
    """Return only explicit reader/action pairs, with alternate notes scoped per reader."""
    if any(x in clause for x in ('الباقون','الباقين','للباقون','للباقين','للجمهور','الجمهور')): return None
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
    excluded=re.fullmatch(r'جميع القراء عدا\s+(.+)',text)
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

def parse_usul(page, lines):
    out=[]; section=None; target_section=None; target_hisham=False
    for raw in lines:
        line=raw.strip()
        head=line.split(':')[0]
        if is_neg(line) or has_bare_ambiguous_reader(line): continue
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
        # section header for الممال
        if line.startswith('الممال') and line.rstrip().endswith(':') and not BRACE.search(line):
            section='imalah'; continue
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
        if head.startswith('الإدغام الصغير') or (section is None and 'أدغمها' in line and 'الإدغام' in line):
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
    return out

def emit_ruling(page, cat, anchor, groups, out, notes=None, occurrence=1):
    """groups: (readers_set, action[, is_alternate[, condition]]) tuples."""
    try: loc=T.find(page, anchor, occurrence)
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
        'hasAlternate':has_alt,**({'notes':notes} if notes else {}),'createdAt':TS,'updatedAt':TS})

# ---------- driver ----------
def existing(kind, page):
    p=os.path.join(ROOT,f'packages/qiraat-core/fixtures/{kind}/page-{page:03d}.json')
    if os.path.exists(p):
        try: return json.load(open(p,encoding='utf-8'))
        except Exception: return []
    return []

def has_bare_ambiguous_reader(text):
    """Reject any source line that contains an unresolved bare narrator name."""
    if re.search(r'(?<!ب)(?:و)?خلف(?!\s*(?:العاشر|عن))', text):
        return True
    if re.search(r'الدوري(?!\s+عن\s+(?:أبو\s+عمرو|أبي\s+عمرو|الكسائي))', text):
        return True
    return False

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
        vtok={(x['surah'],x['ayah'],x['startToken']) for x in ev}
        v=[x for x in v if (x['surah'],x['ayah'],x['startToken']) not in vtok]
        # also dedup within this batch
        seenv=set(); v2=[]
        for x in v:
            k=(x['surah'],x['ayah'],x['startToken'])
            if k in seenv: continue
            seenv.add(k); v2.append(x)
        seenr={}; r2=[]
        for x in r:
            k=(x['surah'],x['ayah'],x['startToken'],x['category'])
            if k in seenr:
                added,dropped=merge_ruling_assignments(seenr[k],x)
                rstats['assignmentsAdded']+=added; rstats['conflictsDropped']+=dropped
                continue
            seenr[k]=x; r2.append(x)
        if v2: vout[page]=ev+v2
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
    if category=='WAQF_RASM':
        return merge_waqf_rasm_assignments(existing_record,candidate)
    if category=='WAQF_HAMZA':
        return merge_waqf_hamza_assignments(existing_record,candidate)
    if category not in ('YAAT_IDAFA','YAAT_ZAWAID'):
        added=0
        for field,key_fields in (
            ('readings',('readingId','action','isDefault')),
            ('attribution',('authorityId','action','condition')),
        ):
            current=existing_record.setdefault(field,[])
            seen={tuple(item.get(k) for k in key_fields) for item in current}
            for item in candidate.get(field,[]):
                key=tuple(item.get(k) for k in key_fields)
                if key in seen: continue
                current.append(item); seen.add(key)
                if field=='readings': added+=1
        if added:
            existing_record['hasAlternate']=bool(existing_record.get('hasAlternate') or candidate.get('hasAlternate'))
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
    return out

def checked_page303_farsh(page, lines):
    """Recover the page-303 forms the generic block parser cannot safely segment.

    The source combines several alternative forms on one prose line, and one header uses the
    non-Hafs form as its anchor. Keep this correction local to that page, use only explicit
    reader groups, and resolve every stored baseText through the real Mushaf token fixtures.
    Rows containing the ambiguous bare name «خلف» remain excluded by the generic resolver.
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

if __name__=='__main__':
    raw=sys.argv[1:]
    categories=None
    complete_ikhfa='--complete-ikhfa' in raw
    if '--category' in raw:
        ix=raw.index('--category')
        if ix+1>=len(raw): raise SystemExit('--category needs a category name')
        categories={raw[ix+1]}
    args=[a for a in raw if not a.startswith('--')]
    if categories is not None: args.remove(next(iter(categories)))
    if '-' in (args[0] if args else ''):
        a,b=args[0].split('-'); pages=list(range(int(a),int(b)+1))
    elif args:
        pages=[int(x) for x in args]
    else:
        pages=list(range(268,305))
    vout,rout,vs,rs=build(pages,categories=categories,complete_ikhfa=complete_ikhfa)
    print('pages touched:',sorted(set(vout)|set(rout)))
    print('variants added:',vs['added'])
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
