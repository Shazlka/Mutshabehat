"""Token index over the real Mushaf-1441 page-word fixtures.

Every Qiraat locus MUST be anchored through this module. Hand-typing base text silently
reorders combining marks and produces spans that match nothing at render time.
"""
import json, os, re, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FIX = os.path.join(ROOT, 'packages/quran-data/mushaf1441/fixtures/page-words')

# 064B-0670 covers every harakah INCLUDING shadda (0651). An earlier cut of this regex
# excluded shadda and silently failed every doubled word (وَوَصَّىٰ, لِّجِبْرِيلَ).
TASHKEEL = re.compile('[ً-ٰۖ-ۭؐ-ؚ]')

def norm(s: str) -> str:
    """Normalize a Uthmani token for matching.

    Stricter than src/lib/arabic.ts normalizeArabic() in three places the mushaf demands:
      - ىٰ (alef maqsura + dagger alef) is ONE long aa, so it folds to ا, never to يا;
      - ۧ / ۥ (small high yeh / waw) mark an omitted ي / و and expand to them, exactly
        parallel to the dagger alef, instead of being stripped as ornament;
      - shadda is stripped.
    """
    s = s or ''
    s = s.replace('ىٰ', 'ا')
    s = s.replace('ۧ', 'ي').replace('ۦ', 'ي')
    s = s.replace('ۥ', 'و')
    s = s.replace('ٰ', 'ا')
    s = TASHKEEL.sub('', s)
    s = re.sub('[إأآاٱ]', 'ا', s)
    s = s.replace('ى', 'ي').replace('ة', 'ه')
    s = s.replace('ؤ', 'و').replace('ئ', 'ي')
    s = s.replace('ـ', '')
    return ' '.join(s.split())

def fold(s: str) -> str:
    """Third tier: fold ي to ا. The mushaf writes a final long aa as ىٰ (-> ا) where
    an ordinary transcription writes ى (-> ي), so ووصى and ووصا are the same word."""
    return norm(s).replace('ي', 'ا')

def skeleton(s: str) -> str:
    """Fuzzier tier: also drop ا and ء so plene/defective spellings and hamza seats collapse."""
    return norm(s).replace('ا', '').replace('ء', '')

_pages = {}

def page_words(page: int):
    if page not in _pages:
        with open(os.path.join(FIX, f'page-{page:03d}.json'), encoding='utf-8') as f:
            d = json.load(f)
        ws = []
        for line in d['lines']:
            for w in line['words']:
                if w.get('charTypeName') == 'word':
                    ws.append(w)
        _pages[page] = ws
    return _pages[page]

class NoMatch(Exception):
    pass

def find(page: int, text: str, occurrence: int = 1, ayah: int = None):
    """Locate `text` (1..N whitespace-separated words) on `page`.

    Returns dict with surah/startAyah/startWord/endAyah/endWord/baseText, where baseText is
    taken VERBATIM from the fixtures, never from `text`.
    """
    ws = page_words(page)
    want = [norm(t) for t in text.split() if norm(t)]
    if not want:
        raise NoMatch(f'empty query on page {page}')
    n = len(want)
    hits = []
    for key in (norm, fold, skeleton):
        want_k = [key(t) for t in text.split() if key(t)]
        if len(want_k) != n:
            continue
        hits = []
        for i in range(len(ws) - n + 1):
            seg = ws[i:i + n]
            if ayah is not None and seg[0]['ayahNumber'] != ayah:
                continue
            if all(key(seg[j]['textUthmani']) == want_k[j] for j in range(n)):
                hits.append(seg)
        if hits:
            break
    if not hits:
        raise NoMatch(f'page {page}: no match for {text!r}' + (f' in ayah {ayah}' if ayah else ''))
    if occurrence > len(hits):
        raise NoMatch(f'page {page}: {text!r} occurrence {occurrence} but only {len(hits)} found')
    seg = hits[occurrence - 1]
    return {
        'surah': seg[0]['surahNumber'],
        'startAyah': seg[0]['ayahNumber'],
        'startWord': seg[0]['wordIndexInAyah'],
        'endAyah': seg[-1]['ayahNumber'],
        'endWord': seg[-1]['wordIndexInAyah'],
        'baseText': ' '.join(w['textUthmani'] for w in seg),
        'count': len(hits),
    }

def count(page: int, text: str, ayah: int = None) -> int:
    try:
        return find(page, text, 1, ayah)['count']
    except NoMatch:
        return 0
