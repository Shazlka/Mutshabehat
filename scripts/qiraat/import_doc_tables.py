# -*- coding: utf-8 -*-
"""Parse the page-by-page prose extraction (docx, Mushaf pages 225-584) into Qiraat fixtures.

Third ingestion path. Same hard invariants as build_variants.py (a variant partitions the 20
Riwayat once and the Hafs wajh matches the rasm) and the same drop-on-doubt rule. Rulings are
family-labelled per line in this source, which is cleaner than the ayah tables, but still guarded
against negation/universal statements. DEDUP: on a page that already has fixtures, a locus is
added only if no existing record already covers that (surah,ayah,startToken[,category]).
"""
import json, os, re, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tokens as T
import authorities as A
from import_surah_tables import resolve_readers, Unresolved, is_neg, is_univ

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
# Within this family only, a bare «خلف» (not «خلف العاشر» / «خلف عن حمزة») is خلف العاشر: the
# أصحاب الإمالة roster is always stated at reader level here, never by a lone narrator's bare
# name. This is scoped to الممال parsing alone — every other family keeps the project-wide rule
# that a bare «خلف» must never resolve.
BARE_KHALAF_RE = re.compile(r'خلف(?!\s*العاشر|\s*عن)')
TAQLIL_SPLIT_RE = re.compile(r'وقللهما|وقللها|وقلل|والتقليل|تقليل')

def imalah_readers_from(text, claimed):
    return readers_from(BARE_KHALAF_RE.sub('خلف العاشر', text), claimed)

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
    if not anchors: return
    text = BRACE.sub('', clause)
    text = re.sub(r'\([^)]*\)', '', text)
    if ':' in text: text = text.rsplit(':', 1)[-1]
    text = IMALAH_CONNECTORS.sub('', text.strip())
    text = text.strip().rstrip('.').strip()
    m = TAQLIL_SPLIT_RE.search(text)
    imala_part = text[:m.start()] if m else text
    taqlil_part = text[m.end():] if m else ''
    imala_part = re.sub(r'[،,]\s*$', '', imala_part.strip()).strip()
    groups=[]
    if imala_part:
        try: rs=imalah_readers_from(imala_part, set())
        except Unresolved: rs=None
        if rs and rs!=ALL20: groups.append((rs,'إمالة',False))
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

def parse_yaat_line(page, category, line, out):
    """Parse only source-named readers; the remainder is intentionally not emitted."""
    pending=[]
    for chunk in split_anchor_clauses(line):
        pre,sep,body=chunk.partition(':')
        anchors=BRACE.findall(pre)
        if not sep or not anchors: continue
        groups=[]; notes=[]
        try:
            for clause in re.split(r'[؛.]',body):
                clause=clause.strip()
                if not clause: continue
                parsed=explicit_reader_clause(clause)
                if not parsed: continue
                action,readers,alternate,note=parsed
                if category=='YAAT_IDAFA':
                    # Only فتح الياء وصلًا is in scope; explicit remainder clauses are omitted.
                    if not ('فتح' in action and 'وصل' in action): continue
                    action='الفتح وصلاً'
                else:
                    if not any(x in action for x in ('إثبات','يثبت','حذف','يحذف')): continue
                    action=BRACE.sub('',action).strip()
                if not action: continue
                groups.append((readers,action,alternate,'بخلف عنه' if alternate else None))
                if note: notes.append(note)
        except Unresolved:
            # One unresolved name invalidates the whole source line, even if another clause parsed.
            return
        if groups:
            for anchor in anchors:
                pending.append((anchor,groups,'؛ '.join(dict.fromkeys(notes)) or None))
    for anchor,groups,notes in pending:
        emit_ruling(page,category,anchor,groups,out,notes=notes)

def likely_reader_text(text):
    probe=re.sub(r'بخلف(?:\s+عنه)?','',text)
    names=tuple(A.READERS)+tuple(A.NARRATORS)+(
        'خلف','الدوري','الكوفيون','أهل سما','الحرميان','المدنيان','البصريان','صحبة','صحاب','جميع القراء عدا')
    return any(name in probe for name in names)

def hamzatan_explicit_clause(clause):
    """Return only a single action clause whose reader group is explicitly named."""
    if any(x in clause for x in ('الباقون','الباقين','للجمهور','الجمهور')): return None
    for m in PARENS.finditer(clause):
        names=m.group(1).strip()
        try: readers=resolve_explicit_group(names)
        except Unresolved:
            if likely_reader_text(names): raise
            continue
        if not readers: continue
        action=clause[:m.start()].strip()
        action=re.split(r'(?:،\s*أو\s*|\s+أو\s+)',action)[-1].strip(' ،,و')
        action=BRACE.sub('',action).strip()
        if not action: continue
        alternate='بخلف' in clause
        notes=[n.strip() for n in PARENS.findall(clause)
               if not likely_reader_text(n) and 'بخلف' not in n]
        return action,readers,alternate,('بخلف عنه' if alternate else None),notes
    parsed=explicit_reader_clause(clause)
    if not parsed: return None
    action,readers,alternate,note=parsed
    action=BRACE.sub('',action).strip()
    action=re.sub(r'^لمن قرأ بالهمز[،,]\s*','',action)
    if not action: return None
    notes=[n.strip() for n in PARENS.findall(clause)
           if not likely_reader_text(n) and 'بخلف' not in n]
    return action,readers,alternate,('بخلف عنه' if alternate else None),notes

def parse_hamzatan_line(page,category,line,out):
    pending=[]
    for chunk in split_anchor_clauses(line):
        pre,sep,body=chunk.partition(':')
        anchors=BRACE.findall(pre)
        if not sep or not anchors: continue
        groups=[]; notes=[n.strip() for n in PARENS.findall(pre)]
        try:
            for semicolon_clause in re.split(r'[؛.]',body):
                clause=semicolon_clause.strip()
                if not clause: continue
                parsed=hamzatan_explicit_clause(clause)
                if not parsed: continue
                action,readers,alternate,condition,clause_notes=parsed
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

def parse_usul(page, lines):
    out=[]; section=None; target_section=None; target_hisham=False
    for raw in lines:
        line=raw.strip()
        head=line.split(':')[0]
        if is_neg(line): continue
        # New source-labelled families may be inline or introduced by a bare heading followed
        # by one or more anchored lines.
        target_headers=[('الهمزتان من كلمتين','HAMZATAN_KALIMATAYN'),
                        ('الهمزتان من كلمة','HAMZATAN_KALIMA'),
                        ('الوقف على مرسوم الخط','WAQF_RASM'),
                        ('وقف حمزة وهشام','WAQF_HAMZA'),('وقف حمزة','WAQF_HAMZA'),
                        ('ياءات الإضافة','YAAT_IDAFA'),('ياءات الزوائد','YAAT_ZAWAID')]
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
                    else: parse_hamzatan_line(page,cat,content,out)
                matched_target=True
                break
        if matched_target: continue
        # Leave the target section on any other named family before considering its continuation.
        known_other=(list(FIXED)+['الممال','صلة هاء','الإدغام الصغير','تغيير الهمز','الهمز المفرد',
                     'إبدال','الإدغام الكبير','الإدغام الصغير','ترك الغنة','السكت','الإخفاء',
                     'صلة ميم الجمع','ميم الجمع','الوقف على مرسوم الخط','وقف حمزة','الهمزتان'])
        if target_section:
            if BRACE.search(line) and not any(line.startswith(x) for x in known_other):
                if not is_univ(line):
                    if target_section.startswith('YAAT_'): parse_yaat_line(page,target_section,line,out)
                    elif target_section=='WAQF_RASM': parse_waqf_rasm_line(page,line,out)
                    elif target_section=='WAQF_HAMZA': parse_waqf_hamza_line(page,line,out,target_hisham)
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
        # صلة هاء الكناية — only distinctive ابن كثير case
        if head.startswith('صلة هاء') and 'ابن كثير' in line and not is_univ(line):
            for anchor in BRACE.findall(line):
                emit_ruling(page,'SILAT_HA',anchor,[(q('ابن كثير'),'صلة هاء الكناية')],out)
            continue
        # الإدغام الصغير: "﴿w﴾: أظهرها ...؛ وأدغمها READERS"
        if head.startswith('الإدغام الصغير') or (section is None and 'أدغمها' in line and 'الإدغام' in line):
            anchors=BRACE.findall(line)
            m=re.search(r'أدغمها\s+([^؛.]+)', line)
            if anchors and m:
                try: rs=readers_from(m.group(1), set())
                except Unresolved: rs=None
                if rs and rs!=ALL20:
                    for a in anchors: emit_ruling(page,'IDGHAM_SAGHIR',a,[(rs,'إدغام صغير')],out)
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

def build(page_list):
    vstats=collections.Counter(); rstats=collections.Counter()
    vout={}; rout={}
    for page in page_list:
        pd=DOC.get(str(page))
        if not pd: continue
        vs=list(parse_farsh(page, pd['farsh']) or [])
        v=[]; parse_farsh(page, pd['farsh'])
        # parse_farsh is a generator wrapper returning out via yield_block into list; call properly:
        v=[]; 
        # re-run collecting
        gen_out=[]
        # parse_farsh yields nothing; it fills via yield_block into 'out' created inside — fix: call and capture
        v=collect_farsh(page, pd['farsh'])
        r=parse_usul(page, pd['usul'])
        # DEDUP against existing
        ev=existing('pages',page); er=existing('rulings',page)
        vtok={(x['surah'],x['ayah'],x['startToken']) for x in ev}
        rtok={(x['surah'],x['ayah'],x['startToken'],x['category']) for x in er}
        v=[x for x in v if (x['surah'],x['ayah'],x['startToken']) not in vtok]
        r=[x for x in r if (x['surah'],x['ayah'],x['startToken'],x['category']) not in rtok]
        # also dedup within this batch
        seenv=set(); v2=[]
        for x in v:
            k=(x['surah'],x['ayah'],x['startToken'])
            if k in seenv: continue
            seenv.add(k); v2.append(x)
        seenr=set(); r2=[]
        for x in r:
            k=(x['surah'],x['ayah'],x['startToken'],x['category'])
            if k in seenr: continue
            seenr.add(k); r2.append(x)
        if ev or v2: vout[page]=ev+v2
        if er or r2: rout[page]=er+r2
        vstats['added']+=len(v2); rstats['added']+=len(r2)
    return vout,rout,vstats,rstats

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
    return out

if __name__=='__main__':
    args=[a for a in sys.argv[1:] if not a.startswith('--')]
    if '-' in (args[0] if args else ''):
        a,b=args[0].split('-'); pages=list(range(int(a),int(b)+1))
    elif args:
        pages=[int(x) for x in args]
    else:
        pages=list(range(268,305))
    vout,rout,vs,rs=build(pages)
    print('pages touched:',sorted(set(vout)|set(rout)))
    print('variants added:',vs['added'],' rulings added:',rs['added'])
    if '--write' in sys.argv:
        vd=os.path.join(ROOT,'packages/qiraat-core/fixtures/pages')
        rd=os.path.join(ROOT,'packages/qiraat-core/fixtures/rulings')
        for p in sorted(set(vout)|set(rout)):
            json.dump(vout.get(p,existing('pages',p)),open(os.path.join(vd,f'page-{p:03d}.json'),'w'),ensure_ascii=False,indent=2)
            open(os.path.join(vd,f'page-{p:03d}.json'),'a').write('\n')
            json.dump(rout.get(p,existing('rulings',p)),open(os.path.join(rd,f'page-{p:03d}.json'),'w'),ensure_ascii=False,indent=2)
            open(os.path.join(rd,f'page-{p:03d}.json'),'a').write('\n')
        print('WROTE',len(set(vout)|set(rout)),'page pairs')
