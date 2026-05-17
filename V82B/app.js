
/* =========================================================
   V82B — Fix: automated surah filter shows results correctly
   Root cause: automated-data.js is an empty stub; all data
   lives in chunked surah files. When a chunk fails to load
   the error message was silently overwritten by renderActiveGroups
   showing "لا توجد نتائج" with no retry option.
   This version:
   1. loadAutomatedSurahNo returns true/false for success/failure
   2. filterBySurahNo renders a clear retry UI on failure
   3. Counter always reflects actual loaded count, never manifest
   4. All V83 bug fixes included (nextPersonalId, copy button,
      per-db filter/sort, XSS sanitizer, delete blocklist)
   ========================================================= */

/* ── Constants & state ─────────────────────────────────── */
const PERSONAL_KEY    = 'mutashabihat_v69_personal_db';
const AUTO_KEY        = 'mutashabihat_v69_auto_db';
const SETTINGS_KEY    = 'mutashabihat_v69_settings';
const AUTO_DELETE_KEY = 'mutashabihat_v83_auto_deleted_ids';
const LAST_VIEW_KEY   = 'mutashabihat_v78_last_view';
const LAST_SURAH_KEY  = 'mutashabihat_v78_last_surah';

let personalData = [], automatedData = [], activeDb = null, activeData = [];
let draftVerses = [], editGroupId = null, editVersesBuffer = [], selectedSurahFilter = null;
let editMode       = localStorage.getItem('mutashabihat_v69_edit_mode') === 'true';
let displayMode    = localStorage.getItem('mutashabihat_v69_display_mode') || 'original';
let onlyWithResults = true, surahRange = 'all';
let advancedFilters = {status:'all', kind:'', minScore:'', surah:''};

/* ── Per-database independent state (filter + sort) ─────── */
var _perDbState = {
  personal: { filter: null, displayMode: localStorage.getItem('mutashabihat_v69_display_mode_personal') || 'original' },
  auto:     { filter: null, displayMode: localStorage.getItem('mutashabihat_v69_display_mode_auto')     || 'original' }
};

/* ── V82B: track surah load state ─────────────────────── */
var _pendingSurahNo  = null;
var _lastSurahFilterState = null;

/* ── Performance caches ─────────────────────────────────── */
let _surahNamesCache  = null;
let _surahNoMapCache  = null;
let _qAyahsCache      = null;
let _groupNormCache   = new WeakMap();
let _searchDebounce   = null;

/* ── Utility helpers ────────────────────────────────────── */
function safeText(v){ return v === undefined || v === null ? '' : String(v); }
function escapeHtml(v){
  return safeText(v)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
function normalize(v){
  return safeText(v).toLowerCase()
    .replace(/[ً-ٰٟۖ-ۭ]/g,'')
    .replace(/[إأآٱا]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
    .replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/ـ/g,'')
    .replace(/\s+/g,' ').trim();
}
function normalizeQuranSearchText(v){
  return safeText(v).toLowerCase()
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭ]/g,'')
    .replace(/[إأآٱا]/g,'ا').replace(/[ؤ]/g,'و').replace(/[ئ]/g,'ي')
    .replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ـ/g,'')
    .replace(/\s+/g,' ').trim();
}
function clone(v){ return JSON.parse(JSON.stringify(v || [])); }
function isTrue(v){ return v === true || v === 'true' || v === 1 || v === '1'; }

/* ── XSS-safe rich text renderer ───────────────────────── */
function safeRich(v){
  var s = safeText(v);
  if (!/<\/?(b|strong|u|span|br|div|p|ul|ol|li)\b/i.test(s)) {
    return escapeHtml(s).replace(/\n/g, '<br>');
  }
  return s
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<(?!\/?(?:b|strong|u|span|br|div|p|ul|ol|li)\b)[^>]+>/gi, '')
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    .replace(/javascript\s*:/gi, '');
}

/* ── Persistent auto-delete blocklist ──────────────────── */
function getDeletedAutoIds(){
  try { return new Set(JSON.parse(localStorage.getItem(AUTO_DELETE_KEY) || '[]')); }
  catch(e) { return new Set(); }
}
function addDeletedAutoId(id){
  var ids = getDeletedAutoIds(); ids.add(Number(id));
  localStorage.setItem(AUTO_DELETE_KEY, JSON.stringify([...ids]));
}
function applyAutoDeleteBlocklist(list){
  var deleted = getDeletedAutoIds();
  return deleted.size ? list.filter(function(g){ return !deleted.has(Number(g.id)); }) : list;
}

/* ── Cached surahNames ──────────────────────────────────── */
function surahNames(){
  if (_surahNamesCache) return _surahNamesCache;
  _surahNamesCache = typeof SURAH_NAMES !== 'undefined' ? SURAH_NAMES : {
    1:'الفاتحة',2:'البقرة',3:'آل عمران',4:'النساء',5:'المائدة',6:'الأنعام',
    7:'الأعراف',8:'الأنفال',9:'التوبة',10:'يونس',11:'هود',12:'يوسف',
    13:'الرعد',14:'إبراهيم',15:'الحجر',16:'النحل',17:'الإسراء',18:'الكهف',
    19:'مريم',20:'طه',21:'الأنبياء',22:'الحج',23:'المؤمنون',24:'النور',
    25:'الفرقان',26:'الشعراء',27:'النمل',28:'القصص',29:'العنكبوت',30:'الروم',
    31:'لقمان',32:'السجدة',33:'الأحزاب',34:'سبأ',35:'فاطر',36:'يس',
    37:'الصافات',38:'ص',39:'الزمر',40:'غافر',41:'فصلت',42:'الشورى',
    43:'الزخرف',44:'الدخان',45:'الجاثية',46:'الأحقاف',47:'محمد',48:'الفتح',
    49:'الحجرات',50:'ق',51:'الذاريات',52:'الطور',53:'النجم',54:'القمر',
    55:'الرحمن',56:'الواقعة',57:'الحديد',58:'المجادلة',59:'الحشر',60:'الممتحنة',
    61:'الصف',62:'الجمعة',63:'المنافقون',64:'التغابن',65:'الطلاق',66:'التحريم',
    67:'الملك',68:'القلم',69:'الحاقة',70:'المعارج',71:'نوح',72:'الجن',
    73:'المزمل',74:'المدثر',75:'القيامة',76:'الإنسان',77:'المرسلات',78:'النبأ',
    79:'النازعات',80:'عبس',81:'التكوير',82:'الانفطار',83:'المطففين',84:'الانشقاق',
    85:'البروج',86:'الطارق',87:'الأعلى',88:'الغاشية',89:'الفجر',90:'البلد',
    91:'الشمس',92:'الليل',93:'الضحى',94:'الشرح',95:'التين',96:'العلق',
    97:'القدر',98:'البينة',99:'الزلزلة',100:'العاديات',101:'القارعة',102:'التكاثر',
    103:'العصر',104:'الهمزة',105:'الفيل',106:'قريش',107:'الماعون',108:'الكوثر',
    109:'الكافرون',110:'النصر',111:'المسد',112:'الإخلاص',113:'الفلق',114:'الناس'
  };
  return _surahNamesCache;
}

/* ── O(1) surah reverse-lookup ──────────────────────────── */
function getSurahNo(n){
  if (!_surahNoMapCache){
    _surahNoMapCache = {};
    var names = surahNames();
    for (var no in names) _surahNoMapCache[normalize(names[no])] = Number(no);
  }
  return _surahNoMapCache[normalize(n)] || 9999;
}

/* ── Memoized qAyahs ────────────────────────────────────── */
function qAyahs(){
  if (_qAyahsCache) return _qAyahsCache;
  _qAyahsCache = [];
  try { for (var s = 1; s <= 114; s++) (getSurahAyahs(s) || []).forEach(function(a){ _qAyahsCache.push(a); }); }
  catch(e){}
  return _qAyahsCache;
}

/* ── Data helpers ───────────────────────────────────────── */
function filePersonal(){ return Array.isArray(window.PERSONAL_DATA) ? window.PERSONAL_DATA : []; }
function loadDb(k, f){
  try { var s = JSON.parse(localStorage.getItem(k) || 'null'); if (Array.isArray(s) && s.length) return s; }
  catch(e){}
  return clone(f);
}
function saveDb(w){
  if (w === 'auto' || w === 'automated') {
    storage('قاعدة الآلي تُحمَّل حسب السورة — الحذف محفوظ بقائمة المحذوفات');
    return;
  }
  localStorage.setItem(PERSONAL_KEY, JSON.stringify(personalData));
  storage('✓ محفوظ');
  triggerGitHubAutoSync('database-change:' + w);
}
function storage(t){ var b = document.getElementById('storageBadge'); if (b) b.textContent = t; }

/* ── Manifest helpers ───────────────────────────────────── */
function isAutoDb(){ return activeDb === 'auto' || activeDb === 'automated'; }
function autoManifest(){ return window.AUTOMATED_MANIFEST || {totalGroups:0, surahs:[]}; }
function autoTotalCount(){ return Number(autoManifest().totalGroups || 0); }
function autoManifestItemByNo(no){ return (autoManifest().surahs || []).find(function(x){ return Number(x.no) === Number(no); }); }
function autoManifestItemByName(name){ return (autoManifest().surahs || []).find(function(x){ return normalize(x.name) === normalize(name); }); }

/* ── V82B FIX: surah chunk lazy loader returns success/failure */
function autoScriptLoaded(src){
  return Array.from(document.querySelectorAll('script[data-auto-src-v82b]')).some(function(s){ return s.dataset.autoSrcV82b === src; });
}
function loadScriptOnce(src){
  return new Promise(function(resolve, reject){
    if (autoScriptLoaded(src)) return resolve();
    var el = document.createElement('script');
    el.src = src + (src.includes('?') ? '&' : '?') + 'v=v82b';
    el.async = true;
    el.dataset.autoSrcV82b = src;
    el.onload  = function(){ resolve(); };
    el.onerror = function(){ reject(new Error('Cannot load ' + src)); };
    document.head.appendChild(el);
  });
}
function dedupeGroups(list){
  var seen = new Set();
  return (list || []).filter(function(g){
    var key = safeText(g.id) || (safeText(g.title) + '|' + safeText((g.verses || []).map(function(v){ return v.surah + ':' + v.ayah; }).join(',')));
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

/* ── V82B FIX: returns true on success, false on failure ── */
async function loadAutomatedSurahNo(no){
  if (!isAutoDb() || !no) return false;
  window.AUTOMATED_SURAH_DATA_BY_NO = window.AUTOMATED_SURAH_DATA_BY_NO || {};
  var item = autoManifestItemByNo(no);
  if (!item){
    storage('لا يوجد ملف لهذه السورة في automated-manifest.js');
    return false;
  }
  if (!window.AUTOMATED_SURAH_DATA_BY_NO[no]){
    try {
      storage('⏳ تحميل ' + item.name + ' ...');
      await loadScriptOnce(item.file);
    } catch(e){
      console.error('V82B surah chunk load failed:', e);
      /* V82B FIX: do NOT write to groups.innerHTML here.
         Return false so filterBySurahNo renders the retry UI. */
      storage('❌ فشل تحميل ملف السورة: ' + item.file);
      return false;
    }
  }
  var chunk = window.AUTOMATED_SURAH_DATA_BY_NO[no] || [];
  var merged = dedupeGroups((automatedData || []).concat(chunk));
  automatedData = applyAutoDeleteBlocklist(merged);
  activeData = automatedData;
  storage('✓ تم تحميل ' + item.name + ' — ' + chunk.length + ' مجموعة');
  return true;
}

/* ── V82B FIX: retry UI when surah file is missing ─────── */
function surahLoadFailHtml(no, surahName, filePath){
  return '<div class="hint" style="text-align:center;padding:28px 16px">'
    + '<b style="font-size:1.1rem">❌ فشل تحميل ملف السورة</b><br><br>'
    + 'الملف المطلوب: <code>' + escapeHtml(filePath) + '</code><br><br>'
    + 'تأكد أن مجلد <code>automated-surahs</code> مرفوع بجانب <code>index.html</code> على الخادم.<br><br>'
    + '<button class="primary" onclick="retryLoadSurah(' + no + ')" style="margin-top:12px">🔄 إعادة المحاولة</button>'
    + '&nbsp;<button onclick="clearSurahFilter()" style="margin-top:12px">إلغاء</button>'
    + '</div>';
}

async function retryLoadSurah(no){
  if (!no) return;
  /* Reset cached state so the file is re-attempted */
  if (window.AUTOMATED_SURAH_DATA_BY_NO) delete window.AUTOMATED_SURAH_DATA_BY_NO[no];
  var el = document.querySelector('script[data-auto-src-v82b]');
  if (el){ var item = autoManifestItemByNo(no); if (item){ var old = document.querySelector('script[data-auto-src-v82b="'+item.file+'"]'); if(old) old.remove(); } }
  storage('⏳ إعادة محاولة تحميل السورة...');
  await filterBySurahNo(no);
}

/* ── Tags & text ────────────────────────────────────────── */
function getTags(g){
  var a = Array.isArray(g.surahs) ? g.surahs.filter(Boolean) : [];
  if (!a.length && Array.isArray(g.verses)) a = Array.from(new Set(g.verses.map(function(v){ return v.surah; }).filter(Boolean)));
  return a;
}
function groupText(g){
  return [g.title, g.note, g.unote, g.candidateKind, g.candidateScore, g.sharedPhrase]
    .concat(getTags(g))
    .concat((g.verses || []).flatMap(function(v){ return [v.surah, v.ayah, v.label].concat((v.parts || []).map(function(p){ return p.text; })); }))
    .join(' ');
}

/* ── Memoized normalised group text ─────────────────────── */
function groupNorm(g){
  if (_groupNormCache.has(g)) return _groupNormCache.get(g);
  var v = normalize(groupText(g)); _groupNormCache.set(g, v); return v;
}
function invalidateGroupNormCache(){ _groupNormCache = new WeakMap(); }

/* ── Filtering ──────────────────────────────────────────── */
function passStatus(g, s){
  s = s || 'all';
  if (s === 'favorite')      return isTrue(g.favorite);
  if (s === 'completed')     return isTrue(g.completed);
  if (s === 'notCompleted')  return !isTrue(g.completed);
  if (s === 'locked')        return isTrue(g.locked);
  if (s === 'autoCandidate') return isTrue(g.autoCandidate);
  return true;
}
function passFilters(g){
  var q  = normalize(document.getElementById('searchInput') ? document.getElementById('searchInput').value : '');
  var st = (document.getElementById('statusFilter') || {}).value || 'all';
  if (q && !groupNorm(g).includes(q)) return false;
  if (!passStatus(g, st) || !passStatus(g, advancedFilters.status)) return false;
  if (selectedSurahFilter && !getTags(g).includes(selectedSurahFilter)) return false;
  if (advancedFilters.kind && safeText(g.candidateKind) !== advancedFilters.kind) return false;
  if (advancedFilters.minScore && Number(g.candidateScore || 0) < Number(advancedFilters.minScore)) return false;
  if (advancedFilters.surah && !getTags(g).some(function(s){ return normalize(s).includes(normalize(advancedFilters.surah)); })) return false;
  return true;
}

/* ── Schwartzian sort ───────────────────────────────────── */
function sortGroups(a){
  if (displayMode === 'original') return a.slice();
  var keyed = a.map(function(g){
    var tags = getTags(g);
    return {
      g:  g,
      s:  Math.min.apply(null, tags.map(getSurahNo).concat([9999])),
      ay: Math.min.apply(null, (g.verses || []).map(function(v){ return Number(v.ayah) || 9999; }).concat([9999])),
      id: Number(g.id) || 0,
      vl: (g.verses || []).length
    };
  });
  if (displayMode === 'sort-surah' || displayMode === 'group-surah')
    keyed.sort(function(x, y){ return x.s - y.s || x.ay - y.ay || x.id - y.id; });
  else if (displayMode === 'newest')
    keyed.sort(function(x, y){ return y.id - x.id; });
  else if (displayMode === 'most-verses')
    keyed.sort(function(x, y){ return y.vl - x.vl; });
  return keyed.map(function(k){ return k.g; });
}

/* ── Debounced search ───────────────────────────────────── */
function onSearchInput(){ clearTimeout(_searchDebounce); _searchDebounce = setTimeout(renderActiveGroups, 200); }

/* ── Rendering ──────────────────────────────────────────── */
function automatedPromptHtml(){
  return '<div class="hint"><b>قاعدة المتشابهات الآلية جاهزة للتحميل حسب السورة.</b><br>افتح الفلتر واختر سورة ليتم تحميل ملفها فقط من <code>automated-surahs</code>.</div>';
}
function renderActiveGroups(){
  if (!activeDb) return;
  if (isAutoDb() && !selectedSurahFilter){
    var counter0 = document.getElementById('counter');
    if (counter0) counter0.textContent = 'اختر سورة لتحميل بياناتها فقط';
    renderChips(0); renderSurahIndex([]);
    var gb0 = document.getElementById('groups'); if (gb0) gb0.innerHTML = automatedPromptHtml();
    updateToggleAllButton(); buildSurahFilter(); return;
  }
  var list = sortGroups(activeData.filter(passFilters));
  var counter = document.getElementById('counter');
  if (counter) counter.textContent = 'عدد النتائج: ' + list.length;
  renderChips(list.length); renderSurahIndex(list);
  document.getElementById('groups').innerHTML = list.length
    ? (displayMode === 'group-surah' ? renderGrouped(list) : list.map(renderCard).join(''))
    : '<div class="hint">لا توجد نتائج</div>';
  updateToggleAllButton(); buildSurahFilter();
}
function renderChips(c){
  var chips = ['المعروض: ' + c];
  if (selectedSurahFilter) chips.push('السورة: ' + selectedSurahFilter);
  if (advancedFilters.kind) chips.push('النوع: ' + advancedFilters.kind);
  document.getElementById('activeFilterChips').innerHTML = chips.map(function(x){ return '<span>' + escapeHtml(x) + '</span>'; }).join('');
}
function renderSurahIndex(list){
  var bar = document.getElementById('surahIndexBar');
  if (displayMode !== 'group-surah'){ bar.innerHTML = ''; return; }
  var m = new Map();
  list.forEach(function(g){ getTags(g).forEach(function(s){ m.set(s, (m.get(s) || 0) + 1); }); });
  bar.innerHTML = Array.from(m).sort(function(a, b){ return getSurahNo(a[0]) - getSurahNo(b[0]); })
    .map(function(e){ return '<button onclick="document.getElementById(\'sec-' + getSurahNo(e[0]) + '\')?.scrollIntoView({behavior:\'smooth\'})">' + escapeHtml(e[0]) + ' (' + e[1] + ')</button>'; }).join('');
}
function renderGrouped(list){
  var m = new Map();
  list.forEach(function(g){ (getTags(g).length ? getTags(g) : ['غير محدد']).forEach(function(s){ if (!m.has(s)) m.set(s,[]); m.get(s).push(g); }); });
  return Array.from(m).sort(function(a, b){ return getSurahNo(a[0]) - getSurahNo(b[0]); })
    .map(function(e){ var s=e[0],items=e[1]; return '<section id="sec-' + getSurahNo(s) + '" class="surah-section"><div class="group-head" onclick="this.parentElement.classList.toggle(\'collapsed\')"><div class="group-num">' + (getSurahNo(s)===9999?'؟':getSurahNo(s)) + '</div><div class="group-title-wrap"><div class="group-title">📖 سورة ' + escapeHtml(s) + '</div><div class="group-tags"><span class="tag">' + items.length + ' مجموعة</span></div></div></div><div class="surah-section-groups">' + items.map(renderCard).join('') + '</div></section>'; }).join('');
}
function groupHasUniqueInSurah(g, s){ return (g.verses || []).some(function(v){ return safeText(v.surah) === safeText(s) && (v.parts || []).some(function(p){ return safeText(p.type) === 'unique'; }); }); }
function renderSurahTag(g, s){ return '<span class="tag ' + (groupHasUniqueInSurah(g,s)?'unique-surah-tag':'') + '">#' + escapeHtml(s) + '</span>'; }
function renderGroupBody(g){ return (g.verses || []).map(renderVerse).join('') + (g.note ? '<div class="note"><b>ملاحظة:</b><br>' + safeRich(g.note) + '</div>' : '') + (g.unote ? '<div class="unote"><b>فائدة إضافية:</b><br>' + safeRich(g.unote) + '</div>' : ''); }
function renderCard(g){
  var fav=isTrue(g.favorite),done=isTrue(g.completed),locked=isTrue(g.locked),ro=isAutoDb();
  var actions = '<button class="icon-btn outline-icon star ' + (fav?'active':'') + '" title="مفضلة" onclick="event.stopPropagation();toggleFlag(' + g.id + ',\'favorite\')">' + iconSvg('star') + '</button>';
  if (ro) actions += '<button onclick="event.stopPropagation();copyAutoGroupToPersonal(' + g.id + ')">نسخ للشخصية</button>';
  if (editMode){
    actions += '<button class="icon-btn outline-icon lock ' + (locked?'active':'') + '" title="قفل" onclick="event.stopPropagation();toggleFlag(' + g.id + ',\'locked\')">' + iconSvg('lock') + '</button>'
      + '<button class="icon-btn outline-icon" title="مقارنة" onclick="event.stopPropagation();openCompareModal(' + g.id + ')">' + iconSvg('compare') + '</button>'
      + (ro ? '<button class="danger" onclick="event.stopPropagation();deleteAutoGroup(' + g.id + ')">حذف من الآلية</button>'
            : '<button class="icon-btn outline-icon" title="تعديل" onclick="event.stopPropagation();openEditModal(' + g.id + ')">' + iconSvg('edit') + '</button>');
  }
  var cls = (fav?' is-favorite':'') + (done?' is-completed':'') + (locked?' is-locked':'');
  return '<article class="group' + cls + '" data-id="' + g.id + '"><div class="group-head" onclick="toggleGroup(this)"><div class="group-num ' + (done?'completed':'') + '" title="اضغط لتغيير حالة الإكمال" onclick="event.stopPropagation();toggleFlag(' + g.id + ',\'completed\')">' + escapeHtml(g.id) + '</div><div class="group-title-wrap"><div class="group-tags">' + getTags(g).map(function(s){ return renderSurahTag(g,s); }).join('') + '<span class="tag">' + (g.verses||[]).length + ' آية</span>' + (g.candidateScore ? '<span class="tag">score ' + g.candidateScore + '</span>' : '') + '</div><div class="group-title">' + highlight(g.title||'بدون عنوان') + '</div></div><div class="group-actions">' + actions + '<button class="icon-btn outline-icon" title="نسخ النص" onclick="event.stopPropagation();copyGroupText(' + g.id + ')">' + iconSvg('copy') + '</button><button class="icon-btn outline-icon" title="صورة HD" onclick="event.stopPropagation();downloadGroupImage(' + g.id + ')">' + iconSvg('camera') + '</button></div></div><div class="group-body">' + renderGroupBody(g) + '</div></article>';
}
function renderVerse(v){ return '<div class="verse-card"><div class="verse-ref"><span class="surah-name">' + escapeHtml(v.surah) + '</span><span class="ayah-num">' + escapeHtml(v.ayah) + '</span>' + (v.label ? '<span class="verse-label">' + escapeHtml(v.label) + '</span>' : '') + '</div><div class="verse-text">' + (v.parts || []).map(function(p){ return '<span class="' + escapeHtml(p.type||'normal') + '">' + highlight(p.text) + '</span>'; }).join(' ') + '</div></div>'; }
function highlight(t){
  var q = safeText(document.getElementById('searchInput') ? document.getElementById('searchInput').value : '').trim();
  var s = escapeHtml(t);
  if (!q) return s;
  return s.replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'), function(m){ return '<mark>' + m + '</mark>'; });
}

/* ── Toggle helpers ─────────────────────────────────────── */
function toggleGroup(h){ var gEl=h && h.closest && h.closest('.group'), id=gEl && gEl.dataset && gEl.dataset.id; if(isMobileLayout()&&id){openGroupDetailModal(id);return;} h.parentElement.classList.toggle('open'); updateToggleAllButton(); }
function toggleAllGroups(){ var gs=[...document.querySelectorAll('.group')],all=gs.length&&gs.every(function(g){return g.classList.contains('open');}); gs.forEach(function(g){g.classList.toggle('open',!all);}); updateToggleAllButton(); }
function updateToggleAllButton(){ var b=document.getElementById('toggleAllBtn'),gs=[...document.querySelectorAll('.group')]; if(b)b.textContent=gs.length&&gs.every(function(g){return g.classList.contains('open');})?'طي الكل':'فتح الكل'; }

/* ── Data operations ────────────────────────────────────── */
function findActive(id){ return activeData.find(function(g){ return Number(g.id) === Number(id); }); }
function toggleFlag(id, f){ var g=findActive(id); if(!g)return; g[f]=!isTrue(g[f]); saveDb(activeDb); renderActiveGroups(); updateHomeCounts(); }
/* V83 FIX: +1 outside .apply() */
function nextPersonalId(){ return Math.max.apply(null,[0].concat(personalData.map(function(g){return Number(g.id)||0;})))+1; }
function copyAutoGroupToPersonal(id){ var g=automatedData.find(function(x){return Number(x.id)===Number(id);}); if(!g)return; var c=clone([g])[0]; c.id=nextPersonalId(); c.autoCandidate=false; c.source='automated'; personalData.push(c); saveDb('personal'); alert('تم النسخ إلى الشخصية'); updateHomeCounts(); }

function deleteAutoGroup(id){
  if (!isAutoDb()){ toast('الحذف من القاعدة الآلية فقط','err'); return; }
  var g = automatedData.find(function(x){ return Number(x.id)===Number(id); });
  if (!g){ toast('لم يتم العثور على المجموعة','err'); return; }
  if (!confirm('حذف هذه المجموعة من القاعدة الآلية؟\n\nرقم: ' + safeText(g.id) + '\nالعنوان: ' + safeText(g.title||'بدون عنوان') + '\n\nالحذف يبقى بعد إعادة التحميل.')) return;
  addDeletedAutoId(id);
  automatedData = automatedData.filter(function(x){ return Number(x.id)!==Number(id); });
  activeData = automatedData;
  invalidateGroupNormCache();
  updateHomeCounts(); renderActiveGroups();
  toast('تم حذف المجموعة من القاعدة الآلية','ok');
}
function deleteAutoGroupFromModal(id, modalId){ deleteAutoGroup(id); if(modalId) closeModal(modalId); }

async function copyGroupText(id){ var g=findActive(id); if(!g)return; var ok=await writeClipboardText(groupPlainText(g)); toast(ok?'تم النسخ مع الملاحظات':'لم يتم النسخ','ok'); }
function exportActiveDatabase(){ if(!activeDb)return alert('افتح قاعدة أولاً'); var vn=activeDb==='personal'?'PERSONAL_DATA':'AUTOMATED_DATA',fn=activeDb==='personal'?'personal-data.js':'automated-data.js',blob=new Blob(['window.'+vn+' = '+JSON.stringify(activeData,null,2)+';\n'],{type:'application/javascript;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fn;a.click(); }

/* ── Navigation ─────────────────────────────────────────── */
function openHome(skipSave){ document.getElementById('home').classList.remove('hidden'); document.getElementById('workspace').classList.add('hidden'); activeDb=null; if(!skipSave)try{localStorage.setItem(LAST_VIEW_KEY,'home');}catch(e){} updateHomeCounts(); }

async function openDatabase(w, skipSave){
  if (activeDb === 'personal' || activeDb === 'auto') {
    _perDbState[activeDb].filter = selectedSurahFilter;
    _perDbState[activeDb].displayMode = displayMode;
  }
  activeDb=(w==='personal')?'personal':'auto'; activeData=activeDb==='personal'?personalData:automatedData;
  selectedSurahFilter = _perDbState[activeDb].filter;
  displayMode = _perDbState[activeDb].displayMode;
  var dm=document.getElementById('displayMode'); if(dm)dm.value=displayMode;
  _lastSurahFilterState=null;
  if(!skipSave)try{localStorage.setItem(LAST_VIEW_KEY,activeDb);}catch(e){}
  document.getElementById('home').classList.add('hidden'); document.getElementById('workspace').classList.remove('hidden');
  document.getElementById('dbTitle').textContent=activeDb==='personal'?'المتشابهات الشخصية':'المتشابهات الآلية';
  document.getElementById('dbSubTitle').textContent=activeDb==='personal'?'قابلة للإضافة والتعديل والحذف':'تحميل سريع: اختر سورة من الفلتر ليتم تحميل ملفها فقط';
  if(activeDb==='auto'&&selectedSurahFilter)await filterBySurahNo(getSurahNo(selectedSurahFilter));
  else { renderActiveGroups(); buildSurahFilter(); if(typeof collapseSurahFilterPanel==='function')collapseSurahFilterPanel(); }
}

function setDisplayMode(v){ displayMode=v; var dbKey=activeDb==='personal'?'personal':'auto'; _perDbState[dbKey].displayMode=v; localStorage.setItem('mutashabihat_v69_display_mode_'+dbKey,v); renderActiveGroups(); }
function clearSearch(){ document.getElementById('searchInput').value=''; renderActiveGroups(); }
function updateHomeCounts(){ var p=document.getElementById('personalCountHome'),a=document.getElementById('autoCountHome'); if(p)p.textContent=personalData.length+' مجموعة'; if(a)a.textContent=(autoTotalCount()||automatedData.length)+' مجموعة'+(isAutoDb()?' (تحميل حسب السورة)':''); }
function resetDualDbCacheV68(){ if(confirm('مسح الكاش وإعادة التحميل؟ (يشمل قائمة المحذوفات من الآلية)')){localStorage.removeItem(PERSONAL_KEY);localStorage.removeItem(AUTO_KEY);localStorage.removeItem(AUTO_DELETE_KEY);location.reload();} }

/* ── V82B FIX: filterBySurahNo handles load failure explicitly */
async function filterBySurahNo(no){
  var item = autoManifestItemByNo(no) || {no:no, name:(surahNames()||{})[no] || String(no)};
  selectedSurahFilter = item.name;
  try{ localStorage.setItem(LAST_SURAH_KEY, item.name); }catch(e){}
  _lastSurahFilterState = null;

  var fs = document.getElementById('filterStatus');
  if (fs) fs.textContent = 'المعروض الآن: ' + item.name + (isAutoDb() ? ' — جاري التحميل...' : '');

  var counter = document.getElementById('counter');
  var groupsBox = document.getElementById('groups');

  if (isAutoDb()){
    /* Show loading indicator while file downloads */
    if (counter) counter.textContent = '⏳ جاري التحميل...';
    if (groupsBox) groupsBox.innerHTML = '<div class="hint" style="text-align:center;padding:24px"><b>⏳ جاري تحميل سورة ' + escapeHtml(item.name) + '...</b><br><small>يُحمَّل الملف لأول مرة فقط، ثم يُخزَّن مؤقتاً.</small></div>';

    var ok = await loadAutomatedSurahNo(no);

    if (!ok){
      /* V82B FIX: show retry UI — counter reflects 0, retry button shown */
      if (counter) counter.textContent = 'فشل التحميل — 0 نتيجة';
      renderChips(0);
      if (fs) fs.textContent = 'فشل تحميل: ' + item.name;
      if (groupsBox) groupsBox.innerHTML = surahLoadFailHtml(no, item.name, item.file || './automated-surahs/surah-' + String(no).padStart(3,'0') + '.js');
      updateToggleAllButton(); buildSurahFilter();
      return;
    }
  }

  if (fs) fs.textContent = 'المعروض الآن: ' + item.name;
  renderActiveGroups();
}

async function filterBySurah(s){
  var item = autoManifestItemByName(s);
  if (item) return filterBySurahNo(item.no);
  selectedSurahFilter = s;
  try{ localStorage.setItem(LAST_SURAH_KEY, s); }catch(e){}
  var fs = document.getElementById('filterStatus');
  if (fs) fs.textContent = 'المعروض الآن: ' + s;
  renderActiveGroups();
}
function clearSurahFilter(){
  selectedSurahFilter = null;
  try{ localStorage.removeItem(LAST_SURAH_KEY); }catch(e){}
  _lastSurahFilterState = null;
  var fs = document.getElementById('filterStatus');
  if (fs) fs.textContent = isAutoDb() ? 'اختر سورة لتحميلها فقط' : 'المعروض الآن: كل السور';
  renderActiveGroups();
}
function surahCounts(data){
  data = data || activeData;
  if (isAutoDb() && window.AUTOMATED_MANIFEST){
    var m = {};
    (autoManifest().surahs || []).forEach(function(x){ m[x.name] = x.count || 0; });
    return m;
  }
  var m2 = {};
  (data || []).forEach(function(g){ getTags(g).forEach(function(s){ m2[s] = (m2[s]||0)+1; }); });
  return m2;
}

/* ── Surah filter rebuild (skip if state unchanged) ─────── */
function buildSurahFilter(){
  var state = (activeDb||'') + '|' + (selectedSurahFilter||'') + '|' + surahRange + '|' + onlyWithResults + '|' + ((document.getElementById('surahFilterSearch')||{}).value||'');
  if (state === _lastSurahFilterState) return;
  _lastSurahFilterState = state;
  renderSurahFilter();
  if (typeof collapseSurahFilterPanel === 'function') collapseSurahFilterPanel();
}
function rangeBounds(){ if(surahRange==='1-30')return[1,30];if(surahRange==='31-60')return[31,60];if(surahRange==='61-90')return[61,90];if(surahRange==='91-114')return[91,114];return[1,114]; }
function toggleSurahFilterPanel(){ var p=document.getElementById('surahFilterPanel'),b=document.getElementById('surahFilterToggleBtn'); if(!p||!b)return; p.classList.toggle('hidden'); b.textContent=p.classList.contains('hidden')?'فتح الفلتر ▾':'إغلاق الفلتر ▴'; }
function collapseSurahFilterPanel(){ var p=document.getElementById('surahFilterPanel'),b=document.getElementById('surahFilterToggleBtn'); if(p)p.classList.add('hidden'); if(b)b.textContent='فتح الفلتر ▾'; }
function toggleOnlyWithResults(){ onlyWithResults=!onlyWithResults; document.getElementById('onlyResultsBtn').classList.toggle('active',onlyWithResults); _lastSurahFilterState=null; renderSurahFilter(); }
function setSurahRange(r){ surahRange=r; document.querySelectorAll('.range-tabs button').forEach(function(b){b.classList.toggle('active',b.dataset.range===r);}); _lastSurahFilterState=null; renderSurahFilter(); }
function pill(i){ return '<button class="surah-pill '+(selectedSurahFilter===i.name?'active':'')+' '+(!i.count?'no-match':'')+'" onclick="filterBySurahNo('+i.no+')"><span class="no-badge">'+i.no+'</span><span>'+escapeHtml(i.name)+'</span><span class="count-badge">'+i.count+'</span></button>'; }
function renderSurahFilter(){
  var grid=document.getElementById('surahFilterGrid'),top=document.getElementById('topSurahGrid'); if(!grid)return;
  var names=surahNames(),counts=surahCounts(activeData.length?activeData:personalData);
  var q=normalize((document.getElementById('surahFilterSearch')||{}).value||'');
  var bounds=rangeBounds(),a=bounds[0],b=bounds[1];
  var items=Object.keys(names).map(function(no){return{no:+no,name:names[no],count:counts[names[no]]||0};});
  var visible=items.filter(function(i){return i.no>=a&&i.no<=b&&(!onlyWithResults||i.count>0||i.name===selectedSurahFilter)&&(!q||String(i.no).includes(q)||normalize(i.name).includes(q));});
  grid.innerHTML=visible.map(pill).join('')||'<div class="hint">لا توجد سور مطابقة</div>';
  top.innerHTML=items.filter(function(i){return i.count>0;}).sort(function(x,y){return y.count-x.count;}).slice(0,8).map(pill).join('');
  document.getElementById('surahCountLine').textContent='كل السور المعروض: '+visible.length+' من 114 سورة';
}

/* ── Modal system ───────────────────────────────────────── */
var __modalScrollY=0,__touchStartY=0,__touchStartX=0,__touchStartedOnHead=false;
function lockBodyScroll(){ if(document.body.classList.contains('modal-open-v78'))return; __modalScrollY=window.scrollY||document.documentElement.scrollTop||0; document.body.style.top='-'+__modalScrollY+'px'; document.body.classList.add('modal-open-v78'); }
function unlockBodyScroll(){ if(document.querySelector('.modal-backdrop'))return; document.body.classList.remove('modal-open-v78'); document.body.style.top=''; window.scrollTo(0,__modalScrollY||0); }
function modal(id,title,body,footer){ closeModal(id); var e=document.createElement('section'); e.id=id; e.className='modal-backdrop'; e.innerHTML='<div class="modal '+id+'-window" role="dialog" aria-modal="true"><div class="modal-head"><span class="modal-drag-handle"></span><h2>'+title+'</h2><button class="modal-close-btn icon-outline" aria-label="إغلاق" onclick="closeModal(\''+id+'\')">×</button></div><div class="modal-body">'+body+'</div><div class="modal-footer">'+(footer||'')+'</div></div>'; e.onclick=function(x){if(x.target===e)closeModal(id);}; document.getElementById('modalRoot').appendChild(e); lockBodyScroll(); enableSwipeToClose(e,id); }
function closeModal(id){ var el=document.getElementById(id); if(el)el.remove(); setTimeout(unlockBodyScroll,0); }
function isMobileLayout(){ return window.matchMedia&&window.matchMedia('(max-width: 900px)').matches; }
function enableSwipeToClose(backdrop,id){ var panel=backdrop.querySelector('.modal,.mobile-menu-panel'); if(!panel)return; panel.addEventListener('touchstart',function(e){if(!isMobileLayout())return;var t=e.touches[0];__touchStartY=t.clientY;__touchStartX=t.clientX;__touchStartedOnHead=!!e.target.closest('.modal-head,.modal-drag-handle');},{passive:true}); panel.addEventListener('touchmove',function(e){if(!isMobileLayout())return;if(e.target.closest('.modal-body'))return;e.preventDefault();},{passive:false}); panel.addEventListener('touchend',function(e){if(!isMobileLayout())return;var t=e.changedTouches[0],dy=t.clientY-__touchStartY,dx=Math.abs(t.clientX-__touchStartX);var body=panel.querySelector('.modal-body'),atTop=!body||body.scrollTop<=2;if(dy>95&&dx<80&&(__touchStartedOnHead||atTop))closeModal(id);},{passive:true}); }

/* ── Toast ──────────────────────────────────────────────── */
function toast(msg,type){ var t=document.getElementById('v78Toast'); if(!t){t=document.createElement('div');t.id='v78Toast';document.body.appendChild(t);} t.className='v78-toast '+(type||''); t.textContent=msg; t.classList.add('show'); clearTimeout(t._tm); t._tm=setTimeout(function(){t.classList.remove('show');},2600); }

/* ── SVG icons ──────────────────────────────────────────── */
function iconSvg(name){ var c='width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"'; var icons={star:'<svg '+c+'><path d="M12 3.5l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17.4 6.6 20.3l1-6.1-4.4-4.3 6.1-.9L12 3.5z"/></svg>',lock:'<svg '+c+'><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',copy:'<svg '+c+'><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',camera:'<svg '+c+'><path d="M4 8h3l1.6-2h6.8L17 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z"/><circle cx="12" cy="14" r="3.4"/></svg>',edit:'<svg '+c+'><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>',compare:'<svg '+c+'><path d="M8 7h13"/><path d="M8 17h13"/><path d="M3 7h.01"/><path d="M3 17h.01"/></svg>'}; return icons[name]||''; }

/* ── Mobile menu ────────────────────────────────────────── */
function openMobileMenu(){ var items=[['الرئيسية','openHome()'],['الشخصية',"openDatabase('personal')"],['الآلية',"openDatabase('auto')"],['إضافة','openAddModal()'],['الإحصائيات','openDashboard()'],['الإعدادات','openAppSettings()'],['دمج','openMergeWindow()'],['Release Notes','openReleaseNotes()']]; var e=document.createElement('section');e.id='mobileMenu';e.className='modal-backdrop';e.innerHTML='<div class="mobile-menu-panel"><button onclick="closeModal(\'mobileMenu\')">× إغلاق</button>'+items.map(function(i){return '<button onclick="closeModal(\'mobileMenu\');'+i[1]+'">'+i[0]+'</button>';}).join('')+'</div>';document.getElementById('modalRoot').appendChild(e);lockBodyScroll();enableSwipeToClose(e,'mobileMenu'); }

/* ── Group detail (mobile) ──────────────────────────────── */
function openGroupDetailModal(id){ var g=findActive(id);if(!g)return;var autoCopyBtn=isAutoDb()?'<button class="primary" onclick="copyAutoGroupToPersonal('+g.id+');closeModal(\'groupDetailModal\')">نسخ للشخصية</button>':'';var autoDeleteBtn=(isAutoDb()&&editMode)?'<button class="danger" onclick="deleteAutoGroupFromModal('+g.id+',\'groupDetailModal\')">حذف من الآلية</button>':'';modal('groupDetailModal','تفاصيل المجموعة','<div class="group-detail-card"><div class="group-detail-head"><div class="group-num '+(isTrue(g.completed)?'completed':'')+'" onclick="toggleFlag('+g.id+',\'completed\');closeModal(\'groupDetailModal\');openGroupDetailModal('+g.id+')">'+escapeHtml(g.id)+'</div><div><div class="group-tags">'+getTags(g).map(function(s){return renderSurahTag(g,s);}).join('')+'</div><h2>'+escapeHtml(g.title||'بدون عنوان')+'</h2></div></div>'+renderGroupBody(g)+'</div>','<button onclick="copyGroupText('+g.id+')">'+iconSvg('copy')+' نسخ مع الملاحظات</button><button onclick="downloadGroupImage('+g.id+')">'+iconSvg('camera')+' صورة HD</button>'+autoCopyBtn+autoDeleteBtn+'<button onclick="closeModal(\'groupDetailModal\')">إغلاق</button>'); }

/* ── Compare, Dashboard, Advanced Search ─────────────────── */
function openCompareModal(id){ var g=findActive(id);if(!g)return;modal('compareModal','المقارنة البصرية — '+escapeHtml(g.title),'<div>'+(g.verses||[]).map(function(v){return '<div class="compare-card"><b>'+escapeHtml(v.surah)+' آية '+escapeHtml(v.ayah)+' '+escapeHtml(v.label||'')+'</b><div class="compare-text">'+(v.parts||[]).map(function(p){return '<span class="'+(p.type==='normal'?'base':p.type==='shared'?'same':'cmpdiff')+'">'+escapeHtml(p.text)+'</span>';}).join(' ')+'</div></div>';}).join('')+'</div>','<button onclick="closeModal(\'compareModal\')">إغلاق</button>'); }
function openDashboard(){ var d=activeDb?activeData:personalData.concat(automatedData),ayah=d.reduce(function(s,g){return s+(g.verses||[]).length;},0),surahs=new Set(d.flatMap(getTags)).size; var cards=[['الشخصية',personalData.length],['الآلية',automatedData.length],['المجموعات',d.length],['الآيات',ayah],['السور',surahs],['المفضلة',d.filter(function(g){return isTrue(g.favorite);}).length],['المكتملة',d.filter(function(g){return isTrue(g.completed);}).length],['المقفلة',d.filter(function(g){return isTrue(g.locked);}).length]]; modal('dashboardModal','الإحصائيات','<div class="dashboard-grid">'+cards.map(function(c){return '<div class="dash-card"><div class="dash-value">'+c[1]+'</div><div>'+c[0]+'</div></div>';}).join('')+'</div>','<button onclick="closeModal(\'dashboardModal\')">إغلاق</button>'); }
function openAdvancedSearch(){ modal('advancedModal','بحث متقدم','<div class="form-grid"><label class="field">الحالة<select id="advStatus"><option value="all">الكل</option><option value="favorite">المفضلة</option><option value="completed">المكتملة</option><option value="notCompleted">غير مكتملة</option><option value="locked">المقفلة</option><option value="autoCandidate">مرشح آلي</option></select></label><label class="field">نوع المرشح<input id="advKind" placeholder="same-opening / shared-phrase"></label><label class="field">أقل درجة<input id="advScore" type="number"></label><label class="field">السورة<input id="advSurah"></label></div>','<button class="primary" onclick="applyAdvancedSearch()">تطبيق</button><button onclick="resetAdvancedSearch()">إعادة ضبط</button><button onclick="closeModal(\'advancedModal\')">إغلاق</button>'); document.getElementById('advStatus').value=advancedFilters.status;document.getElementById('advKind').value=advancedFilters.kind;document.getElementById('advScore').value=advancedFilters.minScore;document.getElementById('advSurah').value=advancedFilters.surah; }
function applyAdvancedSearch(){ advancedFilters={status:document.getElementById('advStatus').value,kind:document.getElementById('advKind').value.trim(),minScore:document.getElementById('advScore').value,surah:document.getElementById('advSurah').value.trim()}; closeModal('advancedModal');renderActiveGroups(); }
function resetAdvancedSearch(){ advancedFilters={status:'all',kind:'',minScore:'',surah:''}; closeModal('advancedModal');renderActiveGroups(); }

/* ── Add / Edit modal helpers ────────────────────────────── */
function partOptions(sel){ return ['normal','shared','diff','diff2','diff3','addition','unique'].map(function(x){return '<option value="'+x+'" '+(x===sel?'selected':'')+'>'+x+'</option>';}).join(''); }
function getRef(no,ay){ try{return typeof getAyah==='function'?getAyah(no,ay):null;}catch(e){return null;} }
function getSelectedTextareaText(id){ var el=document.getElementById(id);if(!el)return'';var a=el.selectionStart||0,b=el.selectionEnd||0;return(a!==b)?el.value.substring(a,b):''; }
function getValidSurahNo(v){ var n=parseInt(v,10);if(n>=1&&n<=114)return n;var g=getSurahNo(v);return g===9999?1:g; }
function surahOptionsHtml(sel){ var names=surahNames(),selected=getValidSurahNo(sel);return Object.keys(names).map(function(no){return'<option value="'+no+'" '+(+no===+selected?'selected':'')+'>'+no+' - '+names[no]+'</option>';}).join(''); }
function ayahOptionsHtml(no,sel){ var arr=[];try{arr=getSurahAyahs(getValidSurahNo(no))||[];}catch(x){} var selected=parseInt(sel,10)||1;return(arr.length?arr:[{ayahNo:1}]).map(function(a){return'<option value="'+a.ayahNo+'" '+(+a.ayahNo===+selected?'selected':'')+'>'+a.ayahNo+'</option>';}).join(''); }
function populateSurah(id,sel){ var e=document.getElementById(id);if(e)e.innerHTML=surahOptionsHtml(sel); }
function populateAyah(id,no,sel){ var e=document.getElementById(id);if(e)e.innerHTML=ayahOptionsHtml(no,sel); }
function onAddSurah(){ populateAyah('addAyah',document.getElementById('addSurah').value);previewAddAyah(); }
function previewAddAyah(){ var a=getRef(document.getElementById('addSurah').value,document.getElementById('addAyah').value);var p=document.getElementById('addPreview'),l=document.getElementById('addLive');if(p)p.value=a?a.text:'لم يتم العثور';if(l)l.innerHTML=a?'<span class="'+document.getElementById('addType').value+'">'+escapeHtml(a.text)+'</span>':''; }
function richEditor(id,label,color){ return '<label class="field">'+label+'<div class="rt-box"><div class="rt-toolbar"><button onclick="rt(\''+id+'\',\'bold\')"><b>B</b></button><button onclick="rt(\''+id+'\',\'underline\')"><u>U</u></button><button onclick="rt(\''+id+'\',\'insertUnorderedList\')">• قائمة</button><input type="color" value="'+color+'" onchange="rtColor(\''+id+'\',this.value)"><button onclick="rt(\''+id+'\',\'removeFormat\')">مسح تنسيق</button></div><div id="'+id+'" class="rt-editor" contenteditable="true"></div></div></label>'; }
function rt(id,cmd){ var e=document.getElementById(id);e.focus();document.execCommand(cmd,false,null); }
function rtColor(id,c){ var e=document.getElementById(id);e.focus();document.execCommand('foreColor',false,c); }
/* V83 FIX: return after redirect from auto DB */
function openAddModal(){ if(isAutoDb()){alert('الإضافة في الشخصية فقط');openDatabase('personal');return;}draftVerses=[];modal('addModal','إضافة متشابه جديد',addBody(),'<button class="primary" onclick="createNewGroup()">حفظ في الصفحة</button><button onclick="closeModal(\'addModal\')">إغلاق</button>');populateSurah('addSurah');onAddSurah();renderDraft();runQuranSearch('add'); }
function addBody(){ return '<div class="quran-search-box"><div class="search-stats"><span id="addExact">0 :Exact</span><span id="addClose">0 :Close</span><span id="addTotal">0 :Total</span></div><h3>بحث في quran-reference.js</h3><input class="wide-input" id="addQSearch" placeholder="اكتب كلمة أو جزء من آية..." oninput="runQuranSearch(\'add\')"><div id="addQResults" class="quran-results hint">اكتب كلمة لعرض النتائج.</div></div><label class="field">عنوان المتشابه<input id="addTitle" placeholder="مثال: الرجفة / الصيحة"></label><button onclick="generateTitleFromDraft()">توليد عنوان تلقائي</button><div class="color-row"><b>لون</b><input type="color" id="addColor" value="#55b94f"><span id="addColorPrev" class="color-preview">معاينة</span></div><div class="form-grid"><label class="field">السورة<select id="addSurah" onchange="onAddSurah()"></select></label><label class="field">رقم الآية<select id="addAyah" onchange="previewAddAyah()"></select></label><label class="field">نوع التلوين<select id="addType">'+partOptions('shared')+'</select></label><label class="field">Label<input id="addLabel"></label></div><label class="field">نص الآية<textarea id="addPreview" readonly></textarea></label><label class="field">تحديد جزء<textarea id="addSelectedPart"></textarea></label><div class="inline-actions"><button class="primary" onclick="addVerseToDraft()">إضافة الآية للمجموعة</button><button onclick="clearDraft()">مسح المؤقتة</button></div><h3>الآيات المؤقتة</h3><div id="draftVerses"></div>'+richEditor('addNote','ملاحظة','#1d4ed8')+richEditor('addUnote','فائدة فريدة / إضافية','#b91c1c'); }
function addVerseToDraft(){ var a=getRef(document.getElementById('addSurah').value,document.getElementById('addAyah').value);if(!a)return alert('لم يتم العثور');draftVerses.push({surah:a.surah,ayah:a.ayahNo,label:document.getElementById('addLabel').value.trim(),parts:[{type:document.getElementById('addType').value,text:document.getElementById('addSelectedPart').value.trim()||a.text}]});renderDraft(); }
function renderDraft(){ var b=document.getElementById('draftVerses');if(!b)return;b.innerHTML=draftVerses.length?draftVerses.map(function(v,i){return'<div class="draft-item"><b>'+v.surah+' '+v.ayah+'</b><button class="danger" onclick="draftVerses.splice('+i+',1);renderDraft()">حذف</button><div class="verse-text"><span class="'+v.parts[0].type+'">'+escapeHtml(v.parts[0].text)+'</span></div></div>';}).join(''):'<div class="hint">لا توجد آيات مضافة بعد.</div>'; }
function clearDraft(){ draftVerses=[];renderDraft(); }
function generateTitleFromDraft(){ if(draftVerses.length)document.getElementById('addTitle').value=draftVerses.map(function(v){return v.surah+' '+v.ayah;}).join(' / '); }
/* V83 FIX: nextPersonalId returns correct ID */
function createNewGroup(){ var title=document.getElementById('addTitle').value.trim();if(!title||!draftVerses.length)return alert('أدخل العنوان والآيات');personalData.push({id:nextPersonalId(),title:title,color:document.getElementById('addColor').value,surahs:Array.from(new Set(draftVerses.map(function(v){return v.surah;}))),verses:clone(draftVerses),note:document.getElementById('addNote').innerHTML,unote:document.getElementById('addUnote').innerHTML,favorite:false,completed:false,locked:false});invalidateGroupNormCache();saveDb('personal');closeModal('addModal');openDatabase('personal'); }

/* ── Quran search helpers ────────────────────────────────── */
function addQuranVerseObject(target,surah,ayah,text,type){ var obj={surah:safeText(surah),ayah:safeText(ayah),label:'',parts:[{type:type||'shared',text:safeText(text)}]};if(target==='edit'){editVersesBuffer.push(obj);renderEditVerses();setTimeout(function(){var el=document.getElementById('editVerses');if(el&&el.lastElementChild)el.lastElementChild.scrollIntoView({behavior:'smooth',block:'center'});},50);}else{draftVerses.push(obj);renderDraft();} }
function removeQuranVerseObject(target,surah,ayah){ var arr=target==='edit'?editVersesBuffer:draftVerses;var idx=arr.findIndex(function(v){return safeText(v.surah)===safeText(surah)&&safeText(v.ayah)===safeText(ayah);});if(idx>=0){arr.splice(idx,1);target==='edit'?renderEditVerses():renderDraft();return true;}return false; }
function quranItemExists(target,surah,ayah){ var arr=target==='edit'?editVersesBuffer:draftVerses;return arr.some(function(v){return safeText(v.surah)===safeText(surah)&&safeText(v.ayah)===safeText(ayah);}); }
function quranResultText(prefix,i,fullText){ var sel=getSelectedTextareaText(prefix+'QText_'+i);return sel||safeText(fullText); }
function runQuranSearch(prefix){
  var input=document.getElementById(prefix+'QSearch'),q=input?input.value.trim():'',box=document.getElementById(prefix+'QResults');if(!box)return;
  ['Exact','Close','Total'].forEach(function(k){var el=document.getElementById(prefix+k);if(el)el.textContent='0 :'+k;});
  if(!q){box.className='quran-results hint';box.innerHTML='اكتب كلمة لعرض النتائج.';return;}
  var nq=normalizeQuranSearchText(q),exact=[],close=[];
  qAyahs().forEach(function(a){var txt=safeText(a.text),nt=normalizeQuranSearchText(txt);if(txt.includes(q))exact.push(a);else if(nt.includes(nq))close.push(a);});
  var total=exact.length+close.length,all=exact.concat(close).slice(0,80);
  var e=document.getElementById(prefix+'Exact'),c2=document.getElementById(prefix+'Close'),t=document.getElementById(prefix+'Total');
  if(e)e.textContent=exact.length+' :Exact';if(c2)c2.textContent=close.length+' :Close';if(t)t.textContent=total+' :Total';
  box.className='quran-results';
  box.innerHTML=all.map(function(a,i){var target=prefix==='edit'?'edit':'add',exists=quranItemExists(target,a.surah,a.ayahNo),checked=exists?'checked':'';return'<div class="quran-result '+(exists?'selected':'')+'"><label class="quran-check-line"><input type="checkbox" class="'+prefix+'QCheck" '+checked+' onchange="toggleQuranResult(\''+prefix+'\',this)" data-index="'+i+'" data-surah-no="'+(a.surahNo||a.surah)+'" data-ayah="'+a.ayahNo+'" data-text="'+escapeHtml(a.text)+'" data-surah="'+escapeHtml(a.surah)+'"><span>'+(exists?'مضاف':'تحديد')+'</span></label><div class="quran-result-body"><b>'+a.surah+' — '+a.ayahNo+'</b><textarea id="'+prefix+'QText_'+i+'" class="quran-result-text" readonly>'+escapeHtml(a.text)+'</textarea><div class="quran-result-actions"><button onclick="addFullQuranResult(\''+prefix+'\',this)">إضافة الآية كاملة</button><button onclick="addSelectedQuranResult(\''+prefix+'\','+i+',this)">إضافة النص المحدد</button></div></div></div>';}).join('')+'<div class="quran-result-toolbar"><button class="primary" onclick="addCheckedQuran(\''+prefix+'\')">إضافة المحدد</button></div>';
}
function addCheckedQuran(prefix){ document.querySelectorAll('.'+prefix+'QCheck:checked').forEach(function(ch){var txt=ch.dataset.text;if(!quranItemExists(prefix==='edit'?'edit':'add',ch.dataset.surah,ch.dataset.ayah))addQuranVerseObject(prefix==='edit'?'edit':'add',ch.dataset.surah,ch.dataset.ayah,txt,'shared');});prefix==='edit'?runQuranSearch('edit'):runQuranSearch('add'); }
function toggleQuranResult(prefix,ch){ var target=prefix==='edit'?'edit':'add';if(ch.checked){if(!quranItemExists(target,ch.dataset.surah,ch.dataset.ayah))addQuranVerseObject(target,ch.dataset.surah,ch.dataset.ayah,ch.dataset.text,'shared');}else{removeQuranVerseObject(target,ch.dataset.surah,ch.dataset.ayah);}runQuranSearch(prefix); }
function addFullQuranResult(prefix,btn){ var root=btn.closest('.quran-result'),ch=root&&root.querySelector('input[type="checkbox"]');if(!ch)return;addQuranVerseObject(prefix==='edit'?'edit':'add',ch.dataset.surah,ch.dataset.ayah,ch.dataset.text,'shared');runQuranSearch(prefix); }
function addSelectedQuranResult(prefix,i,btn){ var root=btn.closest('.quran-result'),ch=root&&root.querySelector('input[type="checkbox"]');if(!ch)return;var txt=quranResultText(prefix,i,ch.dataset.text)||ch.dataset.text;addQuranVerseObject(prefix==='edit'?'edit':'add',ch.dataset.surah,ch.dataset.ayah,txt,'shared');runQuranSearch(prefix); }

/* ── Edit modal ─────────────────────────────────────────── */
function openEditModal(id){ var g=personalData.find(function(x){return+x.id===+id;});if(!g)return;if(isTrue(g.locked))return alert('المجموعة مقفلة');editGroupId=id;editVersesBuffer=clone(g.verses||[]);modal('editModal','تعديل المتشابه',editBody(g),'<button class="primary" onclick="saveEditGroup()">حفظ التعديل</button><button class="danger" onclick="deleteEditGroup()">حذف المجموعة</button><button onclick="closeModal(\'editModal\')">إغلاق</button>');renderEditVerses();runQuranSearch('edit'); }
function editBody(g){ return '<div class="quran-search-box edit-quran-search"><div class="search-stats"><span id="editExact">0 :Exact</span><span id="editClose">0 :Close</span><span id="editTotal">0 :Total</span></div><h3>بحث ذكي في القرآن</h3><input class="wide-input" id="editQSearch" placeholder="ابحث داخل quran-reference.js..." oninput="runQuranSearch(\'edit\')"><div id="editQResults" class="quran-results hint">اكتب كلمة لعرض النتائج.</div></div><label class="field">عنوان المتشابه<input id="editTitle" value="'+escapeHtml(g.title)+'"></label><div class="inline-actions"><button class="primary" onclick="addBlankEditVerse()">+ إضافة آية</button><button onclick="sortEditVersesByMushaf()">ترتيب حسب المصحف</button></div><div id="editVerses"></div>'+richEditor('editNote','ملاحظة','#1d4ed8')+richEditor('editUnote','فائدة فريدة / إضافية','#b91c1c'); }
function renderEditVerses(){ var b=document.getElementById('editVerses');if(!b)return;b.innerHTML=editVersesBuffer.map(function(v,vi){var sno=getValidSurahNo(v.surah),ayah=v.ayah||1;return'<div class="edit-verse"><div class="edit-verse-title"><b>آية '+(vi+1)+'</b><div><button onclick="moveEditVerse('+vi+',-1)">↑</button><button onclick="moveEditVerse('+vi+',1)">↓</button><button class="danger" onclick="editVersesBuffer.splice('+vi+',1);renderEditVerses()">حذف الآية</button></div></div><div class="form-grid"><label class="field">السورة<select onchange="setEditSurah('+vi+',this.value)">'+surahOptionsHtml(sno)+'</select></label><label class="field">رقم الآية<select onchange="setEditAyah('+vi+',this.value)">'+ayahOptionsHtml(sno,ayah)+'</select></label><label class="field">Label<input value="'+escapeHtml(v.label||'')+'" onchange="editVersesBuffer['+vi+'].label=this.value"></label></div><button onclick="fillEditAyah('+vi+')">ملء نص الآية من المرجع</button><h4>أجزاء النص</h4>'+(v.parts||[]).map(function(p,pi){return partRow(vi,pi,p);}).join('')+'<button onclick="addEditPart('+vi+')">+ إضافة جزء نص</button><div class="live-preview verse-text">'+(v.parts||[]).map(function(p){return'<span class="'+p.type+'">'+escapeHtml(p.text)+'</span>';}).join(' ')+'</div></div>';}).join(''); }
function partRow(vi,pi,p){ return'<div class="part-row"><select aria-label="نوع الجزء" onchange="editVersesBuffer['+vi+'].parts['+pi+'].type=this.value;renderEditVerses()">'+partOptions(p.type)+'</select><textarea aria-label="نص الجزء" onchange="editVersesBuffer['+vi+'].parts['+pi+'].text=this.value">'+escapeHtml(p.text)+'</textarea><div class="part-actions"><button onclick="moveEditPart('+vi+','+pi+',-1)">↑</button><button onclick="moveEditPart('+vi+','+pi+',1)">↓</button><button onclick="insertEditPart('+vi+','+pi+')">+ قبل</button><button onclick="insertEditPart('+vi+','+(pi+1)+')">+ بعد</button><button class="danger" onclick="removeEditPart('+vi+','+pi+')">حذف</button></div></div>'; }
function addBlankEditVerse(){ editVersesBuffer.push({surah:'الفاتحة',ayah:1,label:'',parts:[{type:'normal',text:''}]});renderEditVerses(); }
function moveEditVerse(i,d){ var j=i+d;if(j<0||j>=editVersesBuffer.length)return;var tmp=editVersesBuffer[i];editVersesBuffer[i]=editVersesBuffer[j];editVersesBuffer[j]=tmp;renderEditVerses(); }
function addEditPart(vi){ editVersesBuffer[vi].parts.push({type:'normal',text:''});renderEditVerses(); }
function insertEditPart(vi,pi){ editVersesBuffer[vi].parts.splice(pi+1,0,{type:'normal',text:''});renderEditVerses(); }
function removeEditPart(vi,pi){ editVersesBuffer[vi].parts.splice(pi,1);renderEditVerses(); }
function moveEditPart(vi,pi,d){ var a=editVersesBuffer[vi].parts,j=pi+d;if(j<0||j>=a.length)return;var tmp=a[pi];a[pi]=a[j];a[j]=tmp;renderEditVerses(); }
function setEditSurah(vi,no){ var names=surahNames(),sno=getValidSurahNo(no),arr=[];try{arr=getSurahAyahs(sno)||[];}catch(e){}if(!editVersesBuffer[vi])return;editVersesBuffer[vi].surah=names[sno]||String(no);editVersesBuffer[vi].ayah=(arr[0]&&arr[0].ayahNo)||1;renderEditVerses(); }
function setEditAyah(vi,ayah){ if(!editVersesBuffer[vi])return;editVersesBuffer[vi].ayah=parseInt(ayah,10)||ayah; }
function fillEditAyah(vi){ var v=editVersesBuffer[vi],a=getRef(getSurahNo(v.surah),v.ayah);if(!a)return alert('لم يتم العثور');v.surah=a.surah;v.ayah=a.ayahNo;v.parts=[{type:'normal',text:a.text}];renderEditVerses(); }
function sortEditVersesByMushaf(){ editVersesBuffer.sort(function(a,b){return getSurahNo(a.surah)-getSurahNo(b.surah)||(+a.ayah||0)-(+b.ayah||0);});renderEditVerses(); }
function saveEditGroup(){ var i=personalData.findIndex(function(g){return+g.id===+editGroupId;});if(i<0)return;personalData[i]=Object.assign({},personalData[i],{title:document.getElementById('editTitle').value.trim(),verses:clone(editVersesBuffer),surahs:Array.from(new Set(editVersesBuffer.map(function(v){return v.surah;}))),note:document.getElementById('editNote').innerHTML,unote:document.getElementById('editUnote').innerHTML});invalidateGroupNormCache();saveDb('personal');closeModal('editModal');renderActiveGroups(); }
function deleteEditGroup(){ if(confirm('حذف المجموعة؟')){personalData=personalData.filter(function(g){return+g.id!==+editGroupId;});invalidateGroupNormCache();saveDb('personal');closeModal('editModal');renderActiveGroups();updateHomeCounts();} }

/* ── Merge window ───────────────────────────────────────── */
function openMergeWindow(){ modal('mergeWindow','دمج / نقل من الآلية إلى الشخصية','<div class="tools"><input id="mergeSearch" placeholder="ابحث في الآلية..." oninput="renderMergeList()"><button onclick="selectAllMerge(true)">تحديد المعروض</button><button onclick="selectAllMerge(false)">إلغاء التحديد</button><button class="primary" onclick="copySelectedToPersonal()">نقل المحدد</button></div><div id="mergeList"></div>','<button onclick="closeModal(\'mergeWindow\')">إغلاق</button>');renderMergeList(); }
function renderMergeList(){ var q=normalize((document.getElementById('mergeSearch')||{}).value||'');var list=automatedData.filter(function(g){return!q||normalize(groupText(g)).includes(q);});document.getElementById('mergeList').innerHTML=list.map(function(g){return'<label class="merge-item"><input type="checkbox" class="merge-check" value="'+automatedData.indexOf(g)+'"><div><b>'+escapeHtml(g.title)+'</b><br><small>'+getTags(g).join('، ')+' — '+(g.verses||[]).length+' آيات</small></div><button onclick="copyOneToPersonal('+automatedData.indexOf(g)+')">نسخ</button></label>';}).join('')||'<div class="hint">لا توجد نتائج</div>'; }
function selectAllMerge(s){ document.querySelectorAll('.merge-check').forEach(function(x){x.checked=s;}); }
function copyOneToPersonal(i){ var g=clone([automatedData[i]])[0];g.id=nextPersonalId();g.autoCandidate=false;g.source='automated';personalData.push(g);saveDb('personal');updateHomeCounts();alert('تم النسخ'); }
function copySelectedToPersonal(){ var ids=[...document.querySelectorAll('.merge-check:checked')].map(function(x){return+x.value;});ids.forEach(copyOneToPersonal); }

/* ── Settings ────────────────────────────────────────────── */
var GH_DEFAULT = {ghOwner:'', ghRepo:'', ghBranch:'main', ghPath:'personal-data.js', ghAutoSync:false};
var GH_KEYS = {time:'github_last_sync_time',sha:'github_last_commit_sha',url:'github_last_commit_url',path:'github_last_sync_path',status:'github_last_sync_status',error:'github_last_sync_error'};
var ghSyncing=false, ghQueued=false, ghTimer=null;
function ghNorm(s){ return Object.assign({}, GH_DEFAULT, {theme:'quran-classic',font:'normal-quran'}, s||{}); }
function normalizeFontPreset(v){ v=safeText(v||'normal-quran'); if(v!=='normal-quran'&&v!=='mushaf-qpc-v2')return'normal-quran'; return v; }
function getSettings(){ try{var stored=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');var s=ghNorm(stored);s.font=normalizeFontPreset(s.font);s.ghToken=sessionStorage.getItem('gh_token_session')||stored.ghToken||'';return s;}catch(e){return ghNorm({});} }
function applySettings(){ var s=getSettings();document.body.setAttribute('data-theme',s.theme);document.body.setAttribute('data-font-preset',s.font);var b=document.getElementById('ghBadge');if(b){var st=localStorage.getItem(GH_KEYS.status)||'none';b.textContent=st==='success'?'✅ GitHub synced':st==='failed'?'❌ GitHub failed':st==='syncing'?'🟡 GitHub syncing':st==='no_changes'?'⚠️ No changes':(s.ghOwner&&s.ghRepo?'☁ GitHub ready':'☁ GitHub: not set');} }
function collectSettingsFromForm(){ var o=getSettings();return ghNorm({...o,theme:(document.getElementById('setTheme')||{}).value||o.theme,font:normalizeFontPreset((document.getElementById('setFont')||{}).value||o.font),ghToken:(document.getElementById('ghToken')||{}).value||'',ghOwner:(document.getElementById('ghOwner')||{}).value||'',ghRepo:(document.getElementById('ghRepo')||{}).value||'',ghBranch:(document.getElementById('ghBranch')||{}).value||o.ghBranch,ghPath:(document.getElementById('ghPath')||{}).value||o.ghPath,ghAutoSync:!!(document.getElementById('ghAutoSyncCheck')||{}).checked}); }
function saveSettings(closeAfter){ closeAfter=closeAfter!==false;var s=collectSettingsFromForm();var em=document.getElementById('editModeCheck');if(em){editMode=!!em.checked;localStorage.setItem('mutashabihat_v69_edit_mode',editMode);}sessionStorage.setItem('gh_token_session',s.ghToken||'');var toStore=Object.assign({},s,{ghToken:''});localStorage.setItem(SETTINGS_KEY,JSON.stringify(toStore));applySettings();if(closeAfter)closeModal('settingsModal');if(activeDb)renderActiveGroups();ghRender(); }
function openAppSettings(){ var s=getSettings();modal('settingsModal','إعدادات التطبيق','<div class="settings-section"><h2 class="github-sync-heading"><span id="githubSyncDot" class="github-sync-dot gray"></span>GitHub Auto Sync ☁</h2><div id="githubSyncStatusMount">'+ghStatusHtml()+'</div><label class="field">Token (مؤقت — يُمسح عند إغلاق النافذة)<input id="ghToken" type="password" value="'+escapeHtml(s.ghToken||'')+'"></label><div class="form-grid"><label class="field">Owner<input id="ghOwner" value="'+escapeHtml(s.ghOwner||'')+'"></label><label class="field">Repo<input id="ghRepo" value="'+escapeHtml(s.ghRepo||'')+'"></label><label class="field">Branch<input id="ghBranch" value="'+escapeHtml(s.ghBranch||'main')+'"></label><label class="field">Path<input id="ghPath" value="'+escapeHtml(s.ghPath||'personal-data.js')+'"></label></div><label class="github-autosync-toggle"><input type="checkbox" id="ghAutoSyncCheck" '+(s.ghAutoSync?'checked':'')+'>تفعيل المزامنة التلقائية بعد تعديل الشخصية</label><div class="inline-actions"><button class="primary" onclick="saveSettings()">Save / حفظ</button><button onclick="testGitHubConnection()">Test Connection</button><button onclick="syncToGitHub(\'manual\')">Sync Now</button></div></div><div class="settings-section"><h2>✏️ وضع التعديل</h2><label><input type="checkbox" id="editModeCheck" '+(editMode?'checked':'')+'>تفعيل وضع التعديل</label></div><div class="settings-section"><h2>🎨 المظهر / الخط</h2><div class="form-grid"><label class="field">Theme<select id="setTheme"><option value="quran-classic">Quran Classic</option><option value="apple-health">Apple Health</option><option value="bevel-night">Bevel Night</option></select></label><label class="field">Font<select id="setFont" onchange="updateFontPreview()"><option value="normal-quran">Normal Quran</option><option value="mushaf-qpc-v2">Mushaf QPC V2</option></select></label></div><div id="fontPreviewBox" class="font-preview-box" data-font-preset="normal-quran"><b>معاينة الخط قبل الحفظ</b><div class="font-preview-ayah">وَزَيَّنَ لَهُمُ الشَّيْطَانُ أَعْمَالَهُمْ فَصَدَّهُمْ عَنِ السَّبِيلِ فَهُمْ لَا يَهْتَدُونَ</div><small id="fontPreviewHint">إذا كان مجلد fonts فارغاً سيظهر الخط الاحتياطي تلقائياً.</small></div></div><div class="inline-actions"><button onclick="openReleaseNotes()">Release Notes</button><button onclick="exportActiveDatabase()">Export data.js</button><button onclick="resetDualDbCacheV68()">Reset Cache</button></div>','<button class="primary" onclick="saveSettings()">حفظ</button><button onclick="closeModal(\'settingsModal\')">إغلاق</button>');document.getElementById('setTheme').value=s.theme;document.getElementById('setFont').value=s.font;updateFontPreview();ghRender(); }
function updateFontPreview(){ var f=normalizeFontPreset((document.getElementById('setFont')||{}).value||getSettings().font),box=document.getElementById('fontPreviewBox'),hint=document.getElementById('fontPreviewHint');if(box)box.setAttribute('data-font-preset',f);if(hint)hint.textContent=f==='mushaf-qpc-v2'?'معاينة Mushaf QPC V2.':'معاينة الخط العادي.'; }

/* ── GitHub sync ─────────────────────────────────────────── */
function ghShort(s){return safeText(s).slice(0,7);}
function ghPathEnc(p){return safeText(p).split('/').map(encodeURIComponent).join('/');}
function ghApiGet(s){return'https://api.github.com/repos/'+encodeURIComponent(s.ghOwner)+'/'+encodeURIComponent(s.ghRepo)+'/contents/'+ghPathEnc(s.ghPath)+'?ref='+encodeURIComponent(s.ghBranch);}
function ghApiPut(s){return'https://api.github.com/repos/'+encodeURIComponent(s.ghOwner)+'/'+encodeURIComponent(s.ghRepo)+'/contents/'+ghPathEnc(s.ghPath);}
function ghFileUrl(s){return'https://github.com/'+encodeURIComponent(s.ghOwner)+'/'+encodeURIComponent(s.ghRepo)+'/blob/'+encodeURIComponent(s.ghBranch)+'/'+ghPathEnc(s.ghPath);}
function ghMeta(){ var st=ghSyncing?'syncing':(localStorage.getItem(GH_KEYS.status)||'none');var m={syncing:['syncing','yellow','🟡 جاري المزامنة...'],success:['success','green','✅ تمت المزامنة بنجاح'],failed:['failed','red','❌ فشل المزامنة'],no_changes:['no-changes','green','⚠️ لا توجد تغييرات'],none:['none','gray','لم تتم أي مزامنة بعد']};return m[st]||m.none; }
function ghStatusHtml(){ var s=getSettings(),m=ghMeta(),t=localStorage.getItem(GH_KEYS.time)||'',sha=localStorage.getItem(GH_KEYS.sha)||'',url=localStorage.getItem(GH_KEYS.url)||'',p=localStorage.getItem(GH_KEYS.path)||s.ghPath,er=localStorage.getItem(GH_KEYS.error)||'';return'<div class="github-sync-status-card '+m[0]+'"><div class="github-sync-status-title"><b>حالة المزامنة</b><span class="github-sync-chip '+m[0]+'">'+m[2]+'</span></div><div class="github-sync-lines"><div><strong>آخر مزامنة:</strong> '+(t?escapeHtml(t):'<span class="muted">لا يوجد</span>')+'</div><div><strong>الملف:</strong> <code>'+escapeHtml(p)+'</code></div>'+(sha?'<div><strong>Commit:</strong> <code>'+escapeHtml(ghShort(sha))+'</code></div>':'')+(er?'<div class="github-error-box"><strong>Error:</strong><pre>'+escapeHtml(er)+'</pre></div>':'')+'</div><div class="github-sync-actions">'+(url?'<button onclick="ghOpenCommit()">Open Commit</button>':'')+(er?'<button onclick="ghCopyError()">Copy Error</button>':'')+'<button onclick="ghVerify()">Verify on GitHub</button></div></div>'; }
function ghRender(){ var x=document.getElementById('githubSyncStatusMount');if(x)x.innerHTML=ghStatusHtml();var d=document.getElementById('githubSyncDot');if(d){var m=ghMeta();d.className='github-sync-dot '+m[1];d.title=m[2];}applySettings(); }
function ghSet(st,err){ localStorage.setItem(GH_KEYS.status,st);if(st==='failed'&&err)localStorage.setItem(GH_KEYS.error,safeText(err));if(st!=='failed')localStorage.removeItem(GH_KEYS.error);ghRender(); }
function ghContent(){ return'window.PERSONAL_DATA = '+JSON.stringify(personalData||[],null,2)+';\n'; }
async function ghB64(str){ var bytes=new TextEncoder().encode(str),bin='',ch=0x8000;for(var i=0;i<bytes.length;i+=ch)bin+=String.fromCharCode(...bytes.slice(i,i+ch));return btoa(bin); }
function ghDecode(b64){ var bin=atob(safeText(b64).replace(/\s/g,'')),arr=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);return new TextDecoder('utf-8').decode(arr); }
function ghCmp(x){ return safeText(x).replace(/\r\n/g,'\n').trim(); }
async function ghErr(r){ var body='';try{var j=await r.json();body=j.message||JSON.stringify(j);}catch(e){try{body=await r.text();}catch(_){body=r.statusText;}}return(r.status+' '+(r.statusText||'')+(body?' — '+body:'')).trim(); }
function ghOpenCommit(){ var u=localStorage.getItem(GH_KEYS.url)||'';if(u)window.open(u,'_blank','noopener'); }
function ghVerify(){ window.open(ghFileUrl(getSettings()),'_blank','noopener'); }
function ghCopyError(){ var e=localStorage.getItem(GH_KEYS.error)||'';writeClipboardText(e);if(typeof toast==='function')toast('تم نسخ تفاصيل الخطأ','ok'); }
async function testGitHubConnection(){ saveSettings(false);var s=getSettings(),el=document.getElementById('githubLiveStatus');if(el){el.className='status-line info';el.innerHTML='<span></span>جاري فحص الاتصال...';}try{if(!s.ghToken)throw new Error('Missing GitHub token');var r=await fetch('https://api.github.com/repos/'+encodeURIComponent(s.ghOwner)+'/'+encodeURIComponent(s.ghRepo),{headers:{Authorization:'Bearer '+s.ghToken,Accept:'application/vnd.github+json'}});if(!r.ok)throw new Error(await ghErr(r));var f=await fetch(ghApiGet(s),{headers:{Authorization:'Bearer '+s.ghToken,Accept:'application/vnd.github+json'}});if(!f.ok)throw new Error(await ghErr(f));if(el){el.className='status-line ok';el.innerHTML='<span></span>تم الاتصال بالمستودع والملف بنجاح';}}catch(e){console.error('GitHub connection test failed',e);if(el){el.className='status-line err';el.innerHTML='<span></span>فشل الاتصال: '+escapeHtml(e.message||e);}} }
async function syncToGitHub(reason){ saveSettings(false);if(ghSyncing){ghQueued=true;return;}var s=getSettings();if(!s.ghToken){ghSet('failed','Missing GitHub token');return;}ghSyncing=true;ghSet('syncing');storage('☁ جاري المزامنة...');try{var g=await fetch(ghApiGet(s),{headers:{Authorization:'Bearer '+s.ghToken,Accept:'application/vnd.github+json'}});if(!g.ok)throw new Error(await ghErr(g));var cur=await g.json(),sha=cur.sha;if(!sha)throw new Error('GitHub API did not return current file SHA');var remote='';try{remote=ghDecode(cur.content||'');}catch(e){}var local=ghContent();if(ghCmp(remote)===ghCmp(local)){localStorage.setItem(GH_KEYS.path,s.ghPath);ghSet('no_changes');storage('⚠️ لا توجد تغييرات');return;}var put=await fetch(ghApiPut(s),{method:'PUT',headers:{Authorization:'Bearer '+s.ghToken,Accept:'application/vnd.github+json','Content-Type':'application/json'},body:JSON.stringify({message:'Update Mutashabihat personal database '+new Date().toLocaleString('ar-EG'),content:await ghB64(local),sha:sha,branch:s.ghBranch})});if(!put.ok)throw new Error(await ghErr(put));var res=await put.json(),csha=(res&&res.commit&&res.commit.sha)||'',curl=(res&&res.commit&&res.commit.html_url)||(res&&res.content&&res.content.html_url)||'';if(!csha)throw new Error('GitHub update succeeded but commit SHA was not returned');localStorage.setItem(GH_KEYS.time,new Date().toLocaleString('ar-EG',{hour12:false}));localStorage.setItem(GH_KEYS.sha,csha);localStorage.setItem(GH_KEYS.url,curl);localStorage.setItem(GH_KEYS.path,s.ghPath);ghSet('success');storage('✅ تمت المزامنة بنجاح');}catch(e){console.error('Sync failed',e);ghSet('failed',e.message||String(e));storage('❌ فشل المزامنة');}finally{ghSyncing=false;ghRender();if(ghQueued){ghQueued=false;setTimeout(function(){syncToGitHub('queued');},900);}} }
function triggerGitHubAutoSync(reason){ var s=getSettings();if(!s.ghAutoSync||!s.ghToken)return;clearTimeout(ghTimer);ghTimer=setTimeout(function(){syncToGitHub(reason||'auto');},1200); }

/* ── Clipboard ──────────────────────────────────────────── */
async function writeClipboardText(txt){ try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(txt);return true;}}catch(e){}try{var ta=document.createElement('textarea');ta.value=txt;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;top:0;opacity:0';document.body.appendChild(ta);ta.focus();ta.select();ta.setSelectionRange(0,ta.value.length);var ok=document.execCommand('copy');ta.remove();return ok;}catch(e){return false;} }
function htmlToPlainText(v){ var d=document.createElement('div');d.innerHTML=safeText(v);return(d.textContent||d.innerText||'').trim(); }
function groupPlainText(g){ return(['عنوان المتشابه:\n'+safeText(g.title||'بدون عنوان'),'رقم المجموعة: '+safeText(g.id),'السور: '+getTags(g).join(' / '),'الآيات:'].concat((g.verses||[]).map(function(v,i){return(i+1)+'. سورة '+safeText(v.surah)+' — آية '+safeText(v.ayah)+(v.label?' — '+safeText(v.label):'')+'\n'+(v.parts||[]).map(function(p){return safeText(p.text);}).join(' ');})).concat([g.note?'ملاحظة:\n'+htmlToPlainText(g.note):'',g.unote?'فائدة إضافية:\n'+htmlToPlainText(g.unote):'']).filter(Boolean)).join('\n\n'); }

/* ── HD Image export ─────────────────────────────────────── */
var SHARE_COLORS={normal:{fg:'#111827',bg:null},shared:{fg:'#15803d',bg:'#dcfce7'},diff:{fg:'#92400e',bg:'#fef3c7'},diff2:{fg:'#6d28d9',bg:'#ede9fe'},diff3:{fg:'#0f766e',bg:'#ccfbf1'},addition:{fg:'#1d4ed8',bg:'#dbeafe'},unique:{fg:'#b91c1c',bg:'#fee2e2'}};
function canvasWrap(ctx,text,maxWidth){var words=safeText(text).replace(/\s+/g,' ').trim().split(' '),lines=[],line='';words.forEach(function(w){var test=line?line+' '+w:w;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=w;}else line=test;});if(line)lines.push(line);return lines.length?lines:[''];}
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function drawPill(ctx,text,x,y,fg,bg){ctx.font='700 24px Arial';var w=ctx.measureText(text).width+28;ctx.fillStyle=bg;roundRect(ctx,x-w,y-28,w,38,18);ctx.fill();ctx.fillStyle=fg;ctx.textAlign='right';ctx.fillText(text,x-14,y-2);return w+10;}
async function downloadGroupImage(id){ var g=findActive(id);if(!g)return;toast('جاري إنشاء الصورة...','info');try{var W=1500,pad=70,lineH=54,y=pad,measure=document.createElement('canvas').getContext('2d');measure.font='34px Arial';var maxText=W-pad*2,totalLines=3;(g.verses||[]).forEach(function(v){totalLines+=1;(v.parts||[]).forEach(function(p){totalLines+=canvasWrap(measure,p.text,maxText).length;});});if(g.note)totalLines+=canvasWrap(measure,htmlToPlainText(g.note),maxText).length+2;if(g.unote)totalLines+=canvasWrap(measure,htmlToPlainText(g.unote),maxText).length+2;var H=Math.max(900,pad*2+totalLines*lineH+220),scale=2,c=document.createElement('canvas');c.width=W*scale;c.height=H*scale;var ctx=c.getContext('2d');ctx.scale(scale,scale);ctx.direction='rtl';ctx.textBaseline='top';ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.strokeStyle='#d8dee8';ctx.lineWidth=3;roundRect(ctx,24,24,W-48,H-48,34);ctx.stroke();ctx.textAlign='right';ctx.fillStyle='#0f172a';ctx.font='800 42px Arial';canvasWrap(ctx,g.title||'بدون عنوان',maxText).forEach(function(line){ctx.fillText(line,W-pad,y);y+=58;});y+=10;var x=W-pad;x-=drawPill(ctx,'مجموعة '+safeText(g.id),x,y,'#1d4ed8','#dbeafe');getTags(g).forEach(function(s){x-=drawPill(ctx,'#'+s,x,y,groupHasUniqueInSurah(g,s)?'#991b1b':'#334155',groupHasUniqueInSurah(g,s)?'#fee2e2':'#f1f5f9');});y+=60;(g.verses||[]).forEach(function(v,idx){ctx.fillStyle='#475569';ctx.font='800 27px Arial';ctx.fillText((idx+1)+'. سورة '+safeText(v.surah)+' — آية '+safeText(v.ayah)+(v.label?' — '+safeText(v.label):''),W-pad,y);y+=46;(v.parts||[]).forEach(function(p){var st=SHARE_COLORS[p.type||'normal']||SHARE_COLORS.normal;ctx.font='34px Arial';canvasWrap(ctx,p.text,maxText).forEach(function(line){var tw=ctx.measureText(line).width;if(st.bg){ctx.fillStyle=st.bg;roundRect(ctx,W-pad-tw-16,y-4,tw+24,44,10);ctx.fill();}ctx.fillStyle=st.fg;ctx.fillText(line,W-pad,y);y+=52;});});y+=24;});function drawNote(title,text,bg,fg){if(!text)return;ctx.fillStyle=bg;roundRect(ctx,pad,y,W-pad*2,58,16);ctx.fill();ctx.fillStyle=fg;ctx.font='800 28px Arial';ctx.fillText(title,W-pad-18,y+13);y+=74;ctx.fillStyle='#0f172a';ctx.font='30px Arial';canvasWrap(ctx,htmlToPlainText(text),maxText).forEach(function(line){ctx.fillText(line,W-pad,y);y+=48;});y+=24;}drawNote('ملاحظة',g.note,'#eff6ff','#1d4ed8');drawNote('فائدة إضافية',g.unote,'#fff1f2','#b91c1c');c.toBlob(async function(blob){if(!blob){toast('فشل إنشاء الصورة','err');return;}var file=new File([blob],'mutashabihat_group_'+safeText(g.id)+'_HD.png',{type:'image/png'});try{if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:g.title||'متشابهات'});toast('تم تجهيز الصورة للمشاركة','ok');return;}}catch(e){}var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=file.name;a.click();setTimeout(function(){URL.revokeObjectURL(a.href);},1600);toast('تم تنزيل الصورة HD','ok');},'image/png',1);}catch(e){console.error(e);toast('فشل إنشاء الصورة','err');} }

/* ── Release notes & init ────────────────────────────────── */
var RELEASE_V82B = 'V82B — Fix: Surah filter shows results in automated database\n\nROOT CAUSE:\nautomated-data.js is an empty stub — all data lives in chunked\nsurah files (automated-surahs/surah-NNN.js). When a chunk file\nfails to load the old error message was immediately overwritten\nby renderActiveGroups() showing silent "لا توجد نتائج" with no\nway to retry.\n\nFIXES IN V82B:\n1. loadAutomatedSurahNo() now returns true/false (success/failure).\n2. filterBySurahNo() checks the return value — on failure shows a\n   clear error with the missing file path and a Retry button.\n3. Loading state shown in groups area while file downloads.\n4. Counter always reflects actual loaded count, never manifest count.\n5. surahLoadFailHtml() / retryLoadSurah() helper functions added.\n\nALSO INCLUDED (from V83):\n- nextPersonalId() parenthesis fix — saves groups with valid IDs\n- openAddModal() returns early after auto→personal redirect\n- Copy button always visible for automated DB (no edit mode needed)\n- Copy button in mobile group detail modal\n- Per-database independent filter and sort (_perDbState)\n- Persistent auto-delete blocklist (survives page reloads)\n- XSS-safe rich text sanitizer\n- GitHub PAT in sessionStorage only\n- Debounced search, Schwartzian sort, WeakMap group cache\n- defer on all scripts (parallel download)';

function openReleaseNotes(){ modal('releaseModal','Release Notes — V82B','<div class="release-content">'+escapeHtml(RELEASE_V82B)+'</div>','<button onclick="navigator.clipboard&&navigator.clipboard.writeText(RELEASE_V82B)">نسخ</button><button onclick="closeModal(\'releaseModal\')">إغلاق</button>'); }

function init(){
  applySettings();
  personalData = loadDb(PERSONAL_KEY, filePersonal());
  automatedData = applyAutoDeleteBlocklist(Array.isArray(window.AUTOMATED_DATA) ? window.AUTOMATED_DATA : []);
  updateHomeCounts();
  try{ var savedSurah=localStorage.getItem(LAST_SURAH_KEY); if(savedSurah)_perDbState.auto.filter=savedSurah; }catch(e){}
  buildSurahFilter();
  if(typeof collapseSurahFilterPanel==='function')collapseSurahFilterPanel();
  var last='home'; try{last=localStorage.getItem(LAST_VIEW_KEY)||'home';}catch(e){}
  if(last==='personal'||last==='auto'||last==='automated')openDatabase(last,true); else openHome(true);
  storage('✓ V82B جاهز');
  setTimeout(function(){try{ghRender();}catch(e){}},300);
}

window.addEventListener('DOMContentLoaded', init);
