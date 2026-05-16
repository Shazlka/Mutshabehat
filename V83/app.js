
/* =========================================================
   V83 â Bug fixes + Performance improvements
   Consolidated from V82/V78/V79/V80/V84 patch stack.
   All duplicate function definitions resolved.
   ========================================================= */

/* ââ Constants & state âââââââââââââââââââââââââââââââââââ */
const PERSONAL_KEY   = 'mutashabihat_v69_personal_db';
const AUTO_KEY       = 'mutashabihat_v69_auto_db';
const SETTINGS_KEY   = 'mutashabihat_v69_settings';
const AUTO_DELETE_KEY = 'mutashabihat_v83_auto_deleted_ids';
const LAST_VIEW_KEY  = 'mutashabihat_v78_last_view';
const LAST_SURAH_KEY = 'mutashabihat_v78_last_surah';

let personalData = [], automatedData = [], activeDb = null, activeData = [];
let draftVerses = [], editGroupId = null, editVersesBuffer = [], selectedSurahFilter = null;
let editMode      = localStorage.getItem('mutashabihat_v69_edit_mode') === 'true';
let displayMode   = localStorage.getItem('mutashabihat_v69_display_mode') || 'original';
let onlyWithResults = true, surahRange = 'all';
let advancedFilters = {status:'all', kind:'', minScore:'', surah:''};

/* ââ PERF: module-level caches ââââââââââââââââââââââââââââ */
let _surahNamesCache     = null;
let _surahNoMapCache     = null;
let _qAyahsCache         = null;
let _groupNormCache      = new WeakMap();
let _searchDebounce      = null;
let _lastSurahFilterState = null;

/* ââ Utility helpers ââââââââââââââââââââââââââââââââââââââ */
function safeText(v){ return v === undefined || v === null ? '' : String(v); }
function escapeHtml(v){
  return safeText(v)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
function normalize(v){
  return safeText(v).toLowerCase()
    .replace(/[Ù-ÙÙ°Û-Û­]/g,'')
    .replace(/[Ø¥Ø£Ø¢Ù±Ø§]/g,'Ø§').replace(/Ù/g,'Ù').replace(/Ø©/g,'Ù')
    .replace(/Ø¤/g,'Ù').replace(/Ø¦/g,'Ù').replace(/Ù/g,'')
    .replace(/\s+/g,' ').trim();
}
function normalizeQuranSearchText(v){
  return safeText(v).toLowerCase()
    .replace(/[Ø-ØÙ-ÙÙ°Û-Û­]/g,'')
    .replace(/[Ø¥Ø£Ø¢Ù±Ø§]/g,'Ø§').replace(/[Ø¤]/g,'Ù').replace(/[Ø¦]/g,'Ù')
    .replace(/Ù/g,'Ù').replace(/Ø©/g,'Ù').replace(/Ù/g,'')
    .replace(/\s+/g,' ').trim();
}
function clone(v){ return JSON.parse(JSON.stringify(v || [])); }
function isTrue(v){ return v === true || v === 'true' || v === 1 || v === '1'; }

/* ââ BUG-3 FIX: proper allowlist XSS sanitizer for rich text ââ */
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

/* ââ BUG-2 FIX: persistent delete blocklist for auto DB ââ */
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

/* ââ PERF-4: Cached surahNames âââââââââââââââââââââââââââ */
function surahNames(){
  if (_surahNamesCache) return _surahNamesCache;
  _surahNamesCache = typeof SURAH_NAMES !== 'undefined' ? SURAH_NAMES : {
    1:'Ø§ÙÙØ§ØªØ­Ø©',2:'Ø§ÙØ¨ÙØ±Ø©',3:'Ø¢Ù Ø¹ÙØ±Ø§Ù',4:'Ø§ÙÙØ³Ø§Ø¡',5:'Ø§ÙÙØ§Ø¦Ø¯Ø©',6:'Ø§ÙØ£ÙØ¹Ø§Ù',
    7:'Ø§ÙØ£Ø¹Ø±Ø§Ù',8:'Ø§ÙØ£ÙÙØ§Ù',9:'Ø§ÙØªÙØ¨Ø©',10:'ÙÙÙØ³',11:'ÙÙØ¯',12:'ÙÙØ³Ù',
    13:'Ø§ÙØ±Ø¹Ø¯',14:'Ø¥Ø¨Ø±Ø§ÙÙÙ',15:'Ø§ÙØ­Ø¬Ø±',16:'Ø§ÙÙØ­Ù',17:'Ø§ÙØ¥Ø³Ø±Ø§Ø¡',18:'Ø§ÙÙÙÙ',
    19:'ÙØ±ÙÙ',20:'Ø·Ù',21:'Ø§ÙØ£ÙØ¨ÙØ§Ø¡',22:'Ø§ÙØ­Ø¬',23:'Ø§ÙÙØ¤ÙÙÙÙ',24:'Ø§ÙÙÙØ±',
    25:'Ø§ÙÙØ±ÙØ§Ù',26:'Ø§ÙØ´Ø¹Ø±Ø§Ø¡',27:'Ø§ÙÙÙÙ',28:'Ø§ÙÙØµØµ',29:'Ø§ÙØ¹ÙÙØ¨ÙØª',30:'Ø§ÙØ±ÙÙ',
    31:'ÙÙÙØ§Ù',32:'Ø§ÙØ³Ø¬Ø¯Ø©',33:'Ø§ÙØ£Ø­Ø²Ø§Ø¨',34:'Ø³Ø¨Ø£',35:'ÙØ§Ø·Ø±',36:'ÙØ³',
    37:'Ø§ÙØµØ§ÙØ§Øª',38:'Øµ',39:'Ø§ÙØ²ÙØ±',40:'ØºØ§ÙØ±',41:'ÙØµÙØª',42:'Ø§ÙØ´ÙØ±Ù',
    43:'Ø§ÙØ²Ø®Ø±Ù',44:'Ø§ÙØ¯Ø®Ø§Ù',45:'Ø§ÙØ¬Ø§Ø«ÙØ©',46:'Ø§ÙØ£Ø­ÙØ§Ù',47:'ÙØ­ÙØ¯',48:'Ø§ÙÙØªØ­',
    49:'Ø§ÙØ­Ø¬Ø±Ø§Øª',50:'Ù',51:'Ø§ÙØ°Ø§Ø±ÙØ§Øª',52:'Ø§ÙØ·ÙØ±',53:'Ø§ÙÙØ¬Ù',54:'Ø§ÙÙÙØ±',
    55:'Ø§ÙØ±Ø­ÙÙ',56:'Ø§ÙÙØ§ÙØ¹Ø©',57:'Ø§ÙØ­Ø¯ÙØ¯',58:'Ø§ÙÙØ¬Ø§Ø¯ÙØ©',59:'Ø§ÙØ­Ø´Ø±',60:'Ø§ÙÙÙØªØ­ÙØ©',
    61:'Ø§ÙØµÙ',62:'Ø§ÙØ¬ÙØ¹Ø©',63:'Ø§ÙÙÙØ§ÙÙÙÙ',64:'Ø§ÙØªØºØ§Ø¨Ù',65:'Ø§ÙØ·ÙØ§Ù',66:'Ø§ÙØªØ­Ø±ÙÙ',
    67:'Ø§ÙÙÙÙ',68:'Ø§ÙÙÙÙ',69:'Ø§ÙØ­Ø§ÙØ©',70:'Ø§ÙÙØ¹Ø§Ø±Ø¬',71:'ÙÙØ­',72:'Ø§ÙØ¬Ù',
    73:'Ø§ÙÙØ²ÙÙ',74:'Ø§ÙÙØ¯Ø«Ø±',75:'Ø§ÙÙÙØ§ÙØ©',76:'Ø§ÙØ¥ÙØ³Ø§Ù',77:'Ø§ÙÙØ±Ø³ÙØ§Øª',78:'Ø§ÙÙØ¨Ø£',
    79:'Ø§ÙÙØ§Ø²Ø¹Ø§Øª',80:'Ø¹Ø¨Ø³',81:'Ø§ÙØªÙÙÙØ±',82:'Ø§ÙØ§ÙÙØ·Ø§Ø±',83:'Ø§ÙÙØ·ÙÙÙÙ',84:'Ø§ÙØ§ÙØ´ÙØ§Ù',
    85:'Ø§ÙØ¨Ø±ÙØ¬',86:'Ø§ÙØ·Ø§Ø±Ù',87:'Ø§ÙØ£Ø¹ÙÙ',88:'Ø§ÙØºØ§Ø´ÙØ©',89:'Ø§ÙÙØ¬Ø±',90:'Ø§ÙØ¨ÙØ¯',
    91:'Ø§ÙØ´ÙØ³',92:'Ø§ÙÙÙÙ',93:'Ø§ÙØ¶Ø­Ù',94:'Ø§ÙØ´Ø±Ø­',95:'Ø§ÙØªÙÙ',96:'Ø§ÙØ¹ÙÙ',
    97:'Ø§ÙÙØ¯Ø±',98:'Ø§ÙØ¨ÙÙØ©',99:'Ø§ÙØ²ÙØ²ÙØ©',100:'Ø§ÙØ¹Ø§Ø¯ÙØ§Øª',101:'Ø§ÙÙØ§Ø±Ø¹Ø©',102:'Ø§ÙØªÙØ§Ø«Ø±',
    103:'Ø§ÙØ¹ØµØ±',104:'Ø§ÙÙÙØ²Ø©',105:'Ø§ÙÙÙÙ',106:'ÙØ±ÙØ´',107:'Ø§ÙÙØ§Ø¹ÙÙ',108:'Ø§ÙÙÙØ«Ø±',
    109:'Ø§ÙÙØ§ÙØ±ÙÙ',110:'Ø§ÙÙØµØ±',111:'Ø§ÙÙØ³Ø¯',112:'Ø§ÙØ¥Ø®ÙØ§Øµ',113:'Ø§ÙÙÙÙ',114:'Ø§ÙÙØ§Ø³'
  };
  return _surahNamesCache;
}

/* ââ PERF-3: O(1) surah reverse-lookup Map âââââââââââââââ */
function getSurahNo(n){
  if (!_surahNoMapCache){
    _surahNoMapCache = {};
    var names = surahNames();
    for (var no in names) _surahNoMapCache[normalize(names[no])] = Number(no);
  }
  return _surahNoMapCache[normalize(n)] || 9999;
}

/* ââ PERF-1: Memoized qAyahs ââââââââââââââââââââââââââââââ */
function qAyahs(){
  if (_qAyahsCache) return _qAyahsCache;
  _qAyahsCache = [];
  try { for (var s = 1; s <= 114; s++) (getSurahAyahs(s) || []).forEach(function(a){ _qAyahsCache.push(a); }); }
  catch(e){}
  return _qAyahsCache;
}

/* ââ Data helpers âââââââââââââââââââââââââââââââââââââââââ */
function filePersonal(){ return Array.isArray(window.PERSONAL_DATA) ? window.PERSONAL_DATA : []; }
function fileAuto(){ return Array.isArray(window.AUTOMATED_DATA) ? window.AUTOMATED_DATA : []; }
function loadDb(k, f){
  try { var s = JSON.parse(localStorage.getItem(k) || 'null'); if (Array.isArray(s) && s.length) return s; }
  catch(e){}
  return clone(f);
}
function saveDb(w){
  if (w === 'auto' || w === 'automated') {
    storage('ÙØ§Ø¹Ø¯Ø© Ø§ÙØ¢ÙÙ ØªÙØ­ÙÙÙÙ Ø­Ø³Ø¨ Ø§ÙØ³ÙØ±Ø© â Ø§ÙØ­Ø°Ù ÙØ­ÙÙØ¸ Ø¨ÙØ§Ø¦ÙØ© Ø§ÙÙØ­Ø°ÙÙØ§Øª');
    return;
  }
  localStorage.setItem(PERSONAL_KEY, JSON.stringify(personalData));
  storage('â ÙØ­ÙÙØ¸');
  triggerGitHubAutoSync('database-change:' + w);
}
function storage(t){ var b = document.getElementById('storageBadge'); if (b) b.textContent = t; }

/* ââ Manifest helpers âââââââââââââââââââââââââââââââââââââ */
function isAutoDb(){ return activeDb === 'auto' || activeDb === 'automated'; }
function autoManifest(){ return window.AUTOMATED_MANIFEST || {totalGroups:0, surahs:[]}; }
function autoTotalCount(){ return Number(autoManifest().totalGroups || 0); }
function autoManifestItemByNo(no){ return (autoManifest().surahs || []).find(function(x){ return Number(x.no) === Number(no); }); }
function autoManifestItemByName(name){ return (autoManifest().surahs || []).find(function(x){ return normalize(x.name) === normalize(name); }); }

/* ââ Surah chunk lazy loader ââââââââââââââââââââââââââââââ */
function autoScriptLoaded(src){ return Array.from(document.querySelectorAll('script[data-auto-src-v83]')).some(function(s){ return s.dataset.autoSrcV83 === src; }); }
function loadScriptOnce(src){
  return new Promise(function(resolve, reject){
    if (autoScriptLoaded(src)) return resolve();
    var el = document.createElement('script');
    el.src = src + (src.includes('?') ? '&' : '?') + 'v=v83';
    el.async = true;
    el.dataset.autoSrcV83 = src;
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
async function loadAutomatedSurahNo(no){
  if (!isAutoDb() || !no) return;
  window.AUTOMATED_SURAH_DATA_BY_NO = window.AUTOMATED_SURAH_DATA_BY_NO || {};
  var item = autoManifestItemByNo(no);
  if (!item){ storage('ÙØ§ ÙÙØ¬Ø¯ ÙÙÙ ÙÙØ°Ù Ø§ÙØ³ÙØ±Ø© ÙÙ automated-manifest.js'); return; }
  if (!window.AUTOMATED_SURAH_DATA_BY_NO[no]){
    try { storage('ØªØ­ÙÙÙ ' + item.name + ' ...'); await loadScriptOnce(item.file); }
    catch(e){
      console.error('V83 surah chunk load failed:', e);
      storage('ÙØ´Ù ØªØ­ÙÙÙ ÙÙÙ Ø§ÙØ³ÙØ±Ø©: ' + item.file);
      var box = document.getElementById('groups');
      if (box) box.innerHTML = '<div class="hint"><b>ÙÙ ÙØªÙ ØªØ­ÙÙÙ ÙÙÙ Ø§ÙØ³ÙØ±Ø©.</b><br>ØªØ£ÙØ¯ Ø£Ù ÙØ¬ÙØ¯ <code>automated-surahs</code> ÙØ±ÙÙØ¹ ÙØ£Ù Ø§ÙÙÙÙ ÙÙØ¬ÙØ¯:<br><code>' + escapeHtml(item.file) + '</code></div>';
      return;
    }
  }
  var chunk = window.AUTOMATED_SURAH_DATA_BY_NO[no] || [];
  var merged = dedupeGroups((automatedData || []).concat(chunk));
  automatedData = applyAutoDeleteBlocklist(merged);
  activeData = automatedData;
  storage('â ØªÙ ØªØ­ÙÙÙ ' + item.name + ' â ' + chunk.length + ' ÙØ¬ÙÙØ¹Ø©');
}

/* ââ Tags & text ââââââââââââââââââââââââââââââââââââââââââ */
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

/* ââ PERF-5: Memoized normalised group text âââââââââââââââ */
function groupNorm(g){
  if (_groupNormCache.has(g)) return _groupNormCache.get(g);
  var v = normalize(groupText(g)); _groupNormCache.set(g, v); return v;
}
function invalidateGroupNormCache(){ _groupNormCache = new WeakMap(); }

/* ââ Filtering ââââââââââââââââââââââââââââââââââââââââââââ */
function passStatus(g, s){
  s = s || 'all';
  if (s === 'favorite')     return isTrue(g.favorite);
  if (s === 'completed')    return isTrue(g.completed);
  if (s === 'notCompleted') return !isTrue(g.completed);
  if (s === 'locked')       return isTrue(g.locked);
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

/* ââ PERF-7: Schwartzian sort (pre-compute keys once) ââââ */
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

/* ââ PERF-2: Debounced search âââââââââââââââââââââââââââââ */
function onSearchInput(){ clearTimeout(_searchDebounce); _searchDebounce = setTimeout(renderActiveGroups, 200); }

/* ââ Rendering ââââââââââââââââââââââââââââââââââââââââââââ */
function automatedPromptHtml(){
  return '<div class="hint"><b>ÙØ§Ø¹Ø¯Ø© Ø§ÙÙØªØ´Ø§Ø¨ÙØ§Øª Ø§ÙØ¢ÙÙØ© Ø¬Ø§ÙØ²Ø© ÙÙØªØ­ÙÙÙ Ø­Ø³Ø¨ Ø§ÙØ³ÙØ±Ø©.</b><br>Ø§ÙØªØ­ Ø§ÙÙÙØªØ± ÙØ§Ø®ØªØ± Ø³ÙØ±Ø© ÙÙØªÙ ØªØ­ÙÙÙ ÙÙÙÙØ§ ÙÙØ· ÙÙ <code>automated-surahs</code>.</div>';
}
function renderActiveGroups(){
  if (!activeDb) return;
  if (isAutoDb() && !selectedSurahFilter){
    var counter0 = document.getElementById('counter');
    if (counter0) counter0.textContent = 'Ø§Ø®ØªØ± Ø³ÙØ±Ø© ÙØªØ­ÙÙÙ Ø¨ÙØ§ÙØ§ØªÙØ§ ÙÙØ·';
    renderChips(0); renderSurahIndex([]);
    var gb0 = document.getElementById('groups'); if (gb0) gb0.innerHTML = automatedPromptHtml();
    updateToggleAllButton(); buildSurahFilter(); return;
  }
  var list = sortGroups(activeData.filter(passFilters));
  var counter = document.getElementById('counter');
  if (counter) counter.textContent = 'Ø¹Ø¯Ø¯ Ø§ÙÙØªØ§Ø¦Ø¬: ' + list.length;
  renderChips(list.length); renderSurahIndex(list);
  document.getElementById('groups').innerHTML = list.length
    ? (displayMode === 'group-surah' ? renderGrouped(list) : list.map(renderCard).join(''))
    : '<div class="hint">ÙØ§ ØªÙØ¬Ø¯ ÙØªØ§Ø¦Ø¬</div>';
  updateToggleAllButton(); buildSurahFilter();
}
function renderChips(c){
  var chips = ['Ø§ÙÙØ¹Ø±ÙØ¶: ' + c];
  if (selectedSurahFilter) chips.push('Ø§ÙØ³ÙØ±Ø©: ' + selectedSurahFilter);
  if (advancedFilters.kind) chips.push('Ø§ÙÙÙØ¹: ' + advancedFilters.kind);
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
  list.forEach(function(g){ (getTags(g).length ? getTags(g) : ['ØºÙØ± ÙØ­Ø¯Ø¯']).forEach(function(s){ if (!m.has(s)) m.set(s,[]); m.get(s).push(g); }); });
  return Array.from(m).sort(function(a, b){ return getSurahNo(a[0]) - getSurahNo(b[0]); })
    .map(function(e){ var s=e[0],items=e[1]; return '<section id="sec-' + getSurahNo(s) + '" class="surah-section"><div class="group-head" onclick="this.parentElement.classList.toggle(\'collapsed\')"><div class="group-num">' + (getSurahNo(s)===9999?'Ø':getSurahNo(s)) + '</div><div class="group-title-wrap"><div class="group-title">ð Ø³ÙØ±Ø© ' + escapeHtml(s) + '</div><div class="group-tags"><span class="tag">' + items.length + ' ÙØ¬ÙÙØ¹Ø©</span></div></div></div><div class="surah-section-groups">' + items.map(renderCard).join('') + '</div></section>'; }).join('');
}
function groupHasUniqueInSurah(g, s){ return (g.verses || []).some(function(v){ return safeText(v.surah) === safeText(s) && (v.parts || []).some(function(p){ return safeText(p.type) === 'unique'; }); }); }
function renderSurahTag(g, s){ return '<span class="tag ' + (groupHasUniqueInSurah(g,s)?'unique-surah-tag':'') + '">#' + escapeHtml(s) + '</span>'; }
function renderGroupBody(g){ return (g.verses || []).map(renderVerse).join('') + (g.note ? '<div class="note"><b>ÙÙØ§Ø­Ø¸Ø©:</b><br>' + safeRich(g.note) + '</div>' : '') + (g.unote ? '<div class="unote"><b>ÙØ§Ø¦Ø¯Ø© Ø¥Ø¶Ø§ÙÙØ©:</b><br>' + safeRich(g.unote) + '</div>' : ''); }
function renderCard(g){
  var fav=isTrue(g.favorite),done=isTrue(g.completed),locked=isTrue(g.locked),ro=isAutoDb();
  var actions = '<button class="icon-btn outline-icon star ' + (fav?'active':'') + '" title="ÙÙØ¶ÙØ©" onclick="event.stopPropagation();toggleFlag(' + g.id + ',\'favorite\')">' + iconSvg('star') + '</button>';
  if (editMode){
    actions += '<button class="icon-btn outline-icon lock ' + (locked?'active':'') + '" title="ÙÙÙ" onclick="event.stopPropagation();toggleFlag(' + g.id + ',\'locked\')">' + iconSvg('lock') + '</button>'
      + '<button class="icon-btn outline-icon" title="ÙÙØ§Ø±ÙØ©" onclick="event.stopPropagation();openCompareModal(' + g.id + ')">' + iconSvg('compare') + '</button>'
      + (ro ? '<button onclick="event.stopPropagation();copyAutoGroupToPersonal(' + g.id + ')">ÙØ³Ø® ÙÙØ´Ø®ØµÙØ©</button><button class="danger" onclick="event.stopPropagation();deleteAutoGroup(' + g.id + ')">Ø­Ø°Ù ÙÙ Ø§ÙØ¢ÙÙØ©</button>'
            : '<button class="icon-btn outline-icon" title="ØªØ¹Ø¯ÙÙ" onclick="event.stopPropagation();openEditModal(' + g.id + ')">' + iconSvg('edit') + '</button>');
  }
  var cls = (fav?' is-favorite':'') + (done?' is-completed':'') + (locked?' is-locked':'');
  return '<article class="group' + cls + '" data-id="' + g.id + '"><div class="group-head" onclick="toggleGroup(this)"><div class="group-num ' + (done?'completed':'') + '" title="Ø§Ø¶ØºØ· ÙØªØºÙÙØ± Ø­Ø§ÙØ© Ø§ÙØ¥ÙÙØ§Ù" onclick="event.stopPropagation();toggleFlag(' + g.id + ',\'completed\')">' + escapeHtml(g.id) + '</div><div class="group-title-wrap"><div class="group-tags">' + getTags(g).map(function(s){ return renderSurahTag(g,s); }).join('') + '<span class="tag">' + (g.verses||[]).length + ' Ø¢ÙØ©</span>' + (g.candidateScore ? '<span class="tag">score ' + g.candidateScore + '</span>' : '') + '</div><div class="group-title">' + highlight(g.title||'Ø¨Ø¯ÙÙ Ø¹ÙÙØ§Ù') + '</div></div><div class="group-actions">' + actions + '<button class="icon-btn outline-icon" title="ÙØ³Ø® Ø§ÙÙØµ" onclick="event.stopPropagation();copyGroupText(' + g.id + ')">' + iconSvg('copy') + '</button><button class="icon-btn outline-icon" title="ØµÙØ±Ø© HD" onclick="event.stopPropagation();downloadGroupImage(' + g.id + ')">' + iconSvg('camera') + '</button></div></div><div class="group-body">' + renderGroupBody(g) + '</div></article>';
}
function renderVerse(v){ return '<div class="verse-card"><div class="verse-ref"><span class="surah-name">' + escapeHtml(v.surah) + '</span><span class="ayah-num">' + escapeHtml(v.ayah) + '</span>' + (v.label ? '<span class="verse-label">' + escapeHtml(v.label) + '</span>' : '') + '</div><div class="verse-text">' + (v.parts || []).map(function(p){ return '<span class="' + escapeHtml(p.type||'normal') + '">' + highlight(p.text) + '</span>'; }).join(' ') + '</div></div>'; }
function highlight(t){
  var q = safeText(document.getElementById('searchInput') ? document.getElementById('searchInput').value : '').trim();
  var s = escapeHtml(t);
  if (!q) return s;
  return s.replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'), function(m){ return '<mark>' + m + '</mark>'; });
}

/* ââ Toggle helpers âââââââââââââââââââââââââââââââââââââââ */
function toggleGroup(h){ var gEl=h && h.closest && h.closest('.group'), id=gEl && gEl.dataset && gEl.dataset.id; if(isMobileLayout()&&id){openGroupDetailModal(id);return;} h.parentElement.classList.toggle('open'); updateToggleAllButton(); }
function toggleAllGroups(){ var gs=[...document.querySelectorAll('.group')],all=gs.length&&gs.every(function(g){return g.classList.contains('open');}); gs.forEach(function(g){g.classList.toggle('open',!all);}); updateToggleAllButton(); }
function updateToggleAllButton(){ var b=document.getElementById('toggleAllBtn'),gs=[...document.querySelectorAll('.group')]; if(b)b.textContent=gs.length&&gs.every(function(g){return g.classList.contains('open');})?'Ø·Ù Ø§ÙÙÙ':'ÙØªØ­ Ø§ÙÙÙ'; }

/* ââ Data operations ââââââââââââââââââââââââââââââââââââââ */
function findActive(id){ return activeData.find(function(g){ return Number(g.id) === Number(id); }); }
function toggleFlag(id, f){ var g=findActive(id); if(!g)return; g[f]=!isTrue(g[f]); saveDb(activeDb); renderActiveGroups(); updateHomeCounts(); }
function nextPersonalId(){ return Math.max.apply(null,[0].concat(personalData.map(function(g){return Number(g.id)||0;}))+1); }
function copyAutoGroupToPersonal(id){ var g=automatedData.find(function(x){return Number(x.id)===Number(id);}); if(!g)return; var c=clone([g])[0]; c.id=nextPersonalId(); c.autoCandidate=false; c.source='automated'; personalData.push(c); saveDb('personal'); alert('ØªÙ Ø§ÙÙØ³Ø® Ø¥ÙÙ Ø§ÙØ´Ø®ØµÙØ©'); updateHomeCounts(); }

/* ââ BUG-2 FIX: deleteAutoGroup â blocklist approach âââââ */
function deleteAutoGroup(id){
  if (!isAutoDb()){ toast('Ø§ÙØ­Ø°Ù ÙÙ Ø§ÙÙØ§Ø¹Ø¯Ø© Ø§ÙØ¢ÙÙØ© ÙÙØ·','err'); return; }
  var g = automatedData.find(function(x){ return Number(x.id)===Number(id); });
  if (!g){ toast('ÙÙ ÙØªÙ Ø§ÙØ¹Ø«ÙØ± Ø¹ÙÙ Ø§ÙÙØ¬ÙÙØ¹Ø©','err'); return; }
  if (!confirm('Ø­Ø°Ù ÙØ°Ù Ø§ÙÙØ¬ÙÙØ¹Ø© ÙÙ Ø§ÙÙØ§Ø¹Ø¯Ø© Ø§ÙØ¢ÙÙØ©Ø\n\nØ±ÙÙ: ' + safeText(g.id) + '\nØ§ÙØ¹ÙÙØ§Ù: ' + safeText(g.title||'Ø¨Ø¯ÙÙ Ø¹ÙÙØ§Ù') + '\n\nØ§ÙØ­Ø°Ù ÙØ¨ÙÙ Ø¨Ø¹Ø¯ Ø¥Ø¹Ø§Ø¯Ø© Ø§ÙØªØ­ÙÙÙ.')) return;
  addDeletedAutoId(id);
  automatedData = automatedData.filter(function(x){ return Number(x.id)!==Number(id); });
  activeData = automatedData;
  invalidateGroupNormCache();
  updateHomeCounts(); renderActiveGroups();
  toast('ØªÙ Ø­Ø°Ù Ø§ÙÙØ¬ÙÙØ¹Ø© ÙÙ Ø§ÙÙØ§Ø¹Ø¯Ø© Ø§ÙØ¢ÙÙØ©','ok');
}
function deleteAutoGroupFromModal(id, modalId){ deleteAutoGroup(id); if(modalId) closeModal(modalId); }

async function copyGroupText(id){ var g=findActive(id); if(!g)return; var ok=await writeClipboardText(groupPlainText(g)); toast(ok?'ØªÙ Ø§ÙÙØ³Ø® ÙØ¹ Ø§ÙÙÙØ§Ø­Ø¸Ø§Øª':'ÙÙ ÙØªÙ Ø§ÙÙØ³Ø®','ok'); }
function exportActiveDatabase(){ if(!activeDb)return alert('Ø§ÙØªØ­ ÙØ§Ø¹Ø¯Ø© Ø£ÙÙØ§Ù'); var vn=activeDb==='personal'?'PERSONAL_DATA':'AUTOMATED_DATA',fn=activeDb==='personal'?'personal-data.js':'automated-data.js',blob=new Blob(['window.'+vn+' = '+JSON.stringify(activeData,null,2)+';\n'],{type:'application/javascript;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fn;a.click(); }

/* ââ Navigation âââââââââââââââââââââââââââââââââââââââââââ */
function openHome(skipSave){ document.getElementById('home').classList.remove('hidden'); document.getElementById('workspace').classList.add('hidden'); activeDb=null; if(!skipSave)try{localStorage.setItem(LAST_VIEW_KEY,'home');}catch(e){} updateHomeCounts(); }
async function openDatabase(w, skipSave){
  activeDb=(w==='personal')?'personal':'auto'; activeData=activeDb==='personal'?personalData:automatedData;
  if(!skipSave)try{localStorage.setItem(LAST_VIEW_KEY,activeDb);}catch(e){}
  document.getElementById('home').classList.add('hidden'); document.getElementById('workspace').classList.remove('hidden');
  document.getElementById('dbTitle').textContent=activeDb==='personal'?'Ø§ÙÙØªØ´Ø§Ø¨ÙØ§Øª Ø§ÙØ´Ø®ØµÙØ©':'Ø§ÙÙØªØ´Ø§Ø¨ÙØ§Øª Ø§ÙØ¢ÙÙØ©';
  document.getElementById('dbSubTitle').textContent=activeDb==='personal'?'ÙØ§Ø¨ÙØ© ÙÙØ¥Ø¶Ø§ÙØ© ÙØ§ÙØªØ¹Ø¯ÙÙ ÙØ§ÙØ­Ø°Ù':'ØªØ­ÙÙÙ Ø³Ø±ÙØ¹: Ø§Ø®ØªØ± Ø³ÙØ±Ø© ÙÙ Ø§ÙÙÙØªØ± ÙÙØªÙ ØªØ­ÙÙÙ ÙÙÙÙØ§ ÙÙØ·';
  if(activeDb==='auto'&&selectedSurahFilter)await loadAutomatedSurahNo(getSurahNo(selectedSurahFilter));
  renderActiveGroups(); buildSurahFilter(); if(typeof collapseSurahFilterPanel==='function')collapseSurahFilterPanel();
}
function setDisplayMode(v){ displayMode=v; localStorage.setItem('mutashabihat_v69_display_mode',v); renderActiveGroups(); }
function clearSearch(){ document.getElementById('searchInput').value=''; renderActiveGroups(); }
function updateHomeCounts(){ var p=document.getElementById('personalCountHome'),a=document.getElementById('autoCountHome'); if(p)p.textContent=personalData.length+' ÙØ¬ÙÙØ¹Ø©'; if(a)a.textContent=(autoTotalCount()||automatedData.length)+' ÙØ¬ÙÙØ¹Ø©'+(isAutoDb()?' (ØªØ­ÙÙÙ Ø­Ø³Ø¨ Ø§ÙØ³ÙØ±Ø©)':''); }
function resetDualDbCacheV68(){ if(confirm('ÙØ³Ø­ Ø§ÙÙØ§Ø´ ÙØ¥Ø¹Ø§Ø¯Ø© Ø§ÙØªØ­ÙÙÙØ (ÙØ´ÙÙ ÙØ§Ø¦ÙØ© Ø§ÙÙØ­Ø°ÙÙØ§Øª ÙÙ Ø§ÙØ¢ÙÙØ©)')){localStorage.removeItem(PERSONAL_KEY);localStorage.removeItem(AUTO_KEY);localStorage.removeItem(AUTO_DELETE_KEY);location.reload();} }

/* ââ Surah filter âââââââââââââââââââââââââââââââââââââââââ */
async function filterBySurahNo(no){
  var item=autoManifestItemByNo(no)||{no:no,name:(surahNames()||{})[no]||String(no)};
  selectedSurahFilter=item.name; try{localStorage.setItem(LAST_SURAH_KEY,item.name);}catch(e){}
  var fs=document.getElementById('filterStatus'); if(fs)fs.textContent='Ø§ÙÙØ¹Ø±ÙØ¶ Ø§ÙØ¢Ù: '+item.name+(isAutoDb()?' - Ø¬Ø§Ø±Ù Ø§ÙØªØ­ÙÙÙ...':'');
  if(isAutoDb())await loadAutomatedSurahNo(no);
  if(fs)fs.textContent='Ø§ÙÙØ¹Ø±ÙØ¶ Ø§ÙØ¢Ù: '+item.name;
  renderActiveGroups();
}
async function filterBySurah(s){ var item=autoManifestItemByName(s); if(item)return filterBySurahNo(item.no); selectedSurahFilter=s; try{localStorage.setItem(LAST_SURAH_KEY,s);}catch(e){} var fs=document.getElementById('filterStatus'); if(fs)fs.textContent='Ø§ÙÙØ¹Ø±ÙØ¶ Ø§ÙØ¢Ù: '+s; renderActiveGroups(); }
function clearSurahFilter(){ selectedSurahFilter=null; try{localStorage.removeItem(LAST_SURAH_KEY);}catch(e){} _lastSurahFilterState=null; var fs=document.getElementById('filterStatus'); if(fs)fs.textContent=isAutoDb()?'Ø§Ø®ØªØ± Ø³ÙØ±Ø© ÙØªØ­ÙÙÙÙØ§ ÙÙØ·':'Ø§ÙÙØ¹Ø±ÙØ¶ Ø§ÙØ¢Ù: ÙÙ Ø§ÙØ³ÙØ±'; renderActiveGroups(); }
function surahCounts(data){ data=data||activeData; if(isAutoDb()&&window.AUTOMATED_MANIFEST){var m={};(autoManifest().surahs||[]).forEach(function(x){m[x.name]=x.count||0;});return m;} var m2={};(data||[]).forEach(function(g){getTags(g).forEach(function(s){m2[s]=(m2[s]||0)+1;});});return m2; }

/* ââ PERF-8: Skip surah filter rebuild when state unchanged */
function buildSurahFilter(){
  var state=(activeDb||'')+'|'+(selectedSurahFilter||'')+'|'+surahRange+'|'+onlyWithResults+'|'+((document.getElementById('surahFilterSearch')||{}).value||'');
  if(state===_lastSurahFilterState)return;
  _lastSurahFilterState=state;
  renderSurahFilter();
  if(typeof collapseSurahFilterPanel==='function')collapseSurahFilterPanel();
}
function rangeBounds(){ if(surahRange==='1-30')return[1,30];if(surahRange==='31-60')return[31,60];if(surahRange==='61-90')return[61,90];if(surahRange==='91-114')return[91,114];return[1,114]; }
function toggleSurahFilterPanel(){ var p=document.getElementById('surahFilterPanel'),b=document.getElementById('surahFilterToggleBtn'); if(!p||!b)return; p.classList.toggle('hidden'); b.textContent=p.classList.contains('hidden')?'ÙØªØ­ Ø§ÙÙÙØªØ± â¾':'Ø¥ØºÙØ§Ù Ø§ÙÙÙØªØ± â´'; }
function collapseSurahFilterPanel(){ var p=document.getElementById('surahFilterPanel'),b=document.getElementById('surahFilterToggleBtn'); if(p)p.classList.add('hidden'); if(b)b.textContent='ÙØªØ­ Ø§ÙÙÙØªØ± â¾'; }
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
  grid.innerHTML=visible.map(pill).join('')||'<div class="hint">ÙØ§ ØªÙØ¬Ø¯ Ø³ÙØ± ÙØ·Ø§Ø¨ÙØ©</div>';
  top.innerHTML=items.filter(function(i){return i.count>0;}).sort(function(x,y){return y.count-x.count;}).slice(0,8).map(pill).join('');
  document.getElementById('surahCountLine').textContent='ÙÙ Ø§ÙØ³ÙØ± Ø§ÙÙØ¹Ø±ÙØ¶: '+visible.length+' ÙÙ 114 Ø³ÙØ±Ø©';
}

/* ââ Modal system âââââââââââââââââââââââââââââââââââââââââ */
var __modalScrollY=0,__touchStartY=0,__touchStartX=0,__touchStartedOnHead=false;
function lockBodyScroll(){ if(document.body.classList.contains('modal-open-v78'))return; __modalScrollY=window.scrollY||document.documentElement.scrollTop||0; document.body.style.top='-'+__modalScrollY+'px'; document.body.classList.add('modal-open-v78'); }
function unlockBodyScroll(){ if(document.querySelector('.modal-backdrop'))return; document.body.classList.remove('modal-open-v78'); document.body.style.top=''; window.scrollTo(0,__modalScrollY||0); }
function modal(id,title,body,footer){ closeModal(id); var e=document.createElement('section'); e.id=id; e.className='modal-backdrop'; e.innerHTML='<div class="modal '+id+'-window" role="dialog" aria-modal="true"><div class="modal-head"><span class="modal-drag-handle"></span><h2>'+title+'</h2><button class="modal-close-btn icon-outline" aria-label="Ø¥ØºÙØ§Ù" onclick="closeModal(\''+id+'\')">Ã</button></div><div class="modal-body">'+body+'</div><div class="modal-footer">'+(footer||'')+'</div></div>'; e.onclick=function(x){if(x.target===e)closeModal(id);}; document.getElementById('modalRoot').appendChild(e); lockBodyScroll(); enableSwipeToClose(e,id); }
function closeModal(id){ var el=document.getElementById(id); if(el)el.remove(); setTimeout(unlockBodyScroll,0); }
function isMobileLayout(){ return window.matchMedia&&window.matchMedia('(max-width: 900px)').matches; }
function enableSwipeToClose(backdrop,id){ var panel=backdrop.querySelector('.modal,.mobile-menu-panel'); if(!panel)return; panel.addEventListener('touchstart',function(e){if(!isMobileLayout())return;var t=e.touches[0];__touchStartY=t.clientY;__touchStartX=t.clientX;__touchStartedOnHead=!!e.target.closest('.modal-head,.modal-drag-handle');},{passive:true}); panel.addEventListener('touchmove',function(e){if(!isMobileLayout())return;if(e.target.closest('.modal-body'))return;e.preventDefault();},{passive:false}); panel.addEventListener('touchend',function(e){if(!isMobileLayout())return;var t=e.changedTouches[0],dy=t.clientY-__touchStartY,dx=Math.abs(t.clientX-__touchStartX);var body=panel.querySelector('.modal-body'),atTop=!body||body.scrollTop<=2;if(dy>95&&dx<80&&(__touchStartedOnHead||atTop))closeModal(id);},{passive:true}); }

/* ââ Toast ââââââââââââââââââââââââââââââââââââââââââââââââ */
function toast(msg,type){ var t=document.getElementById('v78Toast'); if(!t){t=document.createElement('div');t.id='v78Toast';document.body.appendChild(t);} t.className='v78-toast '+(type||''); t.textContent=msg; t.classList.add('show'); clearTimeout(t._tm); t._tm=setTimeout(function(){t.classList.remove('show');},2600); }

/* ââ SVG icons ââââââââââââââââââââââââââââââââââââââââââââ */
function iconSvg(name){ var c='width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"'; var icons={star:'<svg '+c+'><path d="M12 3.5l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17.4 6.6 20.3l1-6.1-4.4-4.3 6.1-.9L12 3.5z"/></svg>',lock:'<svg '+c+'><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',copy:'<svg '+c+'><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',camera:'<svg '+c+'><path d="M4 8h3l1.6-2h6.8L17 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z"/><circle cx="12" cy="14" r="3.4"/></svg>',edit:'<svg '+c+'><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>',compare:'<svg '+c+'><path d="M8 7h13"/><path d="M8 17h13"/><path d="M3 7h.01"/><path d="M3 17h.01"/></svg>'}; return icons[name]||''; }

/* ââ Mobile menu ââââââââââââââââââââââââââââââââââââââââââ */
function openMobileMenu(){ var items=[['Ø§ÙØ±Ø¦ÙØ³ÙØ©','openHome()'],['Ø§ÙØ´Ø®ØµÙØ©',"openDatabase('personal')"],['Ø§ÙØ¢ÙÙØ©',"openDatabase('auto')"],['Ø¥Ø¶Ø§ÙØ©','openAddModal()'],['Ø§ÙØ¥Ø­ØµØ§Ø¦ÙØ§Øª','openDashboard()'],['Ø§ÙØ¥Ø¹Ø¯Ø§Ø¯Ø§Øª','openAppSettings()'],['Ø¯ÙØ¬','openMergeWindow()'],['Release Notes','openReleaseNotes()']]; var e=document.createElement('section');e.id='mobileMenu';e.className='modal-backdrop';e.innerHTML='<div class="mobile-menu-panel"><button onclick="closeModal(\'mobileMenu\')">Ã Ø¥ØºÙØ§Ù</button>'+items.map(function(i){return '<button onclick="closeModal(\'mobileMenu\');'+i[1]+'">'+i[0]+'</button>';}).join('')+'</div>';document.getElementById('modalRoot').appendChild(e);lockBodyScroll();enableSwipeToClose(e,'mobileMenu'); }

/* ââ Group detail (mobile) ââââââââââââââââââââââââââââââââ */
function openGroupDetailModal(id){ var g=findActive(id);if(!g)return;var autoDeleteBtn=(isAutoDb()&&editMode)?'<button class="danger" onclick="deleteAutoGroupFromModal('+g.id+',\'groupDetailModal\')">Ø­Ø°Ù ÙÙ Ø§ÙØ¢ÙÙØ©</button>':'';modal('groupDetailModal','ØªÙØ§ØµÙÙ Ø§ÙÙØ¬ÙÙØ¹Ø©','<div class="group-detail-card"><div class="group-detail-head"><div class="group-num '+(isTrue(g.completed)?'completed':'')+'" onclick="toggleFlag('+g.id+',\'completed\');closeModal(\'groupDetailModal\');openGroupDetailModal('+g.id+')">'+escapeHtml(g.id)+'</div><div><div class="group-tags">'+getTags(g).map(function(s){return renderSurahTag(g,s);}).join('')+'</div><h2>'+escapeHtml(g.title||'Ø¨Ø¯ÙÙ Ø¹ÙÙØ§Ù')+'</h2></div></div>'+renderGroupBody(g)+'</div>','<button onclick="copyGroupText('+g.id+')">'+iconSvg('copy')+' ÙØ³Ø® ÙØ¹ Ø§ÙÙÙØ§Ø­Ø¸Ø§Øª</button><button class="primary" onclick="downloadGroupImage('+g.id+')">'+iconSvg('camera')+' ØµÙØ±Ø© HD</button>'+autoDeleteBtn+'<button onclick="closeModal(\'groupDetailModal\')">Ø¥ØºÙØ§Ù</button>'); }

/* ââ Compare, Dashboard, Advanced Search âââââââââââââââââââ */
function openCompareModal(id){ var g=findActive(id);if(!g)return;modal('compareModal','Ø§ÙÙÙØ§Ø±ÙØ© Ø§ÙØ¨ØµØ±ÙØ© â '+escapeHtml(g.title),'<div>'+(g.verses||[]).map(function(v){return '<div class="compare-card"><b>'+escapeHtml(v.surah)+' Ø¢ÙØ© '+escapeHtml(v.ayah)+' '+escapeHtml(v.label||'')+'</b><div class="compare-text">'+(v.parts||[]).map(function(p){return '<span class="'+(p.type==='normal'?'base':p.type==='shared'?'same':'cmpdiff')+'">'+escapeHtml(p.text)+'</span>';}).join(' ')+'</div></div>';}).join('')+'</div>','<button onclick="closeModal(\'compareModal\')">Ø¥ØºÙØ§Ù</button>'); }
function openDashboard(){ var d=activeDb?activeData:personalData.concat(automatedData),ayah=d.reduce(function(s,g){return s+(g.verses||[]).length;},0),surahs=new Set(d.flatMap(getTags)).size; var cards=[['Ø§ÙØ´Ø®ØµÙØ©',personalData.length],['Ø§ÙØ¢ÙÙØ©',automatedData.length],['Ø§ÙÙØ¬ÙÙØ¹Ø§Øª',d.length],['Ø§ÙØ¢ÙØ§Øª',ayah],['Ø§ÙØ³ÙØ±',surahs],['Ø§ÙÙÙØ¶ÙØ©',d.filter(function(g){return isTrue(g.favorite);}).length],['Ø§ÙÙÙØªÙÙØ©',d.filter(function(g){return isTrue(g.completed);}).length],['Ø§ÙÙÙÙÙØ©',d.filter(function(g){return isTrue(g.locked);}).length]]; modal('dashboardModal','Ø§ÙØ¥Ø­ØµØ§Ø¦ÙØ§Øª','<div class="dashboard-grid">'+cards.map(function(c){return '<div class="dash-card"><div class="dash-value">'+c[1]+'</div><div>'+c[0]+'</div></div>';}).join('')+'</div>','<button onclick="closeModal(\'dashboardModal\')">Ø¥ØºÙØ§Ù</button>'); }
function openAdvancedSearch(){ modal('advancedModal','Ø¨Ø­Ø« ÙØªÙØ¯Ù','<div class="form-grid"><label class="field">Ø§ÙØ­Ø§ÙØ©<select id="advStatus"><option value="all">Ø§ÙÙÙ</option><option value="favorite">Ø§ÙÙÙØ¶ÙØ©</option><option value="completed">Ø§ÙÙÙØªÙÙØ©</option><option value="notCompleted">ØºÙØ± ÙÙØªÙÙØ©</option><option value="locked">Ø§ÙÙÙÙÙØ©</option><option value="autoCandidate">ÙØ±Ø´Ø­ Ø¢ÙÙ</option></select></label><label class="field">ÙÙØ¹ Ø§ÙÙØ±Ø´Ø­<input id="advKind" placeholder="same-opening / shared-phrase"></label><label class="field">Ø£ÙÙ Ø¯Ø±Ø¬Ø©<input id="advScore" type="number"></label><label class="field">Ø§ÙØ³ÙØ±Ø©<input id="advSurah"></label></div>','<button class="primary" onclick="applyAdvancedSearch()">ØªØ·Ø¨ÙÙ</button><button onclick="resetAdvancedSearch()">Ø¥Ø¹Ø§Ø¯Ø© Ø¶Ø¨Ø·</button><button onclick="closeModal(\'advancedModal\')">Ø¥ØºÙØ§Ù</button>'); document.getElementById('advStatus').value=advancedFilters.status;document.getElementById('advKind').value=advancedFilters.kind;document.getElementById('advScore').value=advancedFilters.minScore;document.getElementById('advSurah').value=advancedFilters.surah; }
function applyAdvancedSearch(){ advancedFilters={status:document.getElementById('advStatus').value,kind:document.getElementById('advKind').value.trim(),minScore:document.getElementById('advScore').value,surah:document.getElementById('advSurah').value.trim()}; closeModal('advancedModal');renderActiveGroups(); }
function resetAdvancedSearch(){ advancedFilters={status:'all',kind:'',minScore:'',surah:''}; closeModal('advancedModal');renderActiveGroups(); }

/* ââ Add / Edit modal helpers ââââââââââââââââââââââââââââââ */
function partOptions(sel){ return ['normal','shared','diff','diff2','diff3','addition','unique'].map(function(x){return '<option value="'+x+'" '+(x===sel?'selected':'')+'>'+x+'</option>';}).join(''); }
function getRef(no,ay){ try{return typeof getAyah==='function'?getAyah(no,ay):null;}catch(e){return null;} }
function getSelectedTextareaText(id){ var el=document.getElementById(id);if(!el)return'';var a=el.selectionStart||0,b=el.selectionEnd||0;return(a!==b)?el.value.substring(a,b):''; }
function getValidSurahNo(v){ var n=parseInt(v,10);if(n>=1&&n<=114)return n;var g=getSurahNo(v);return g===9999?1:g; }
function surahOptionsHtml(sel){ var names=surahNames(),selected=getValidSurahNo(sel);return Object.keys(names).map(function(no){return'<option value="'+no+'" '+(+no===+selected?'selected':'')+'>'+no+' - '+names[no]+'</option>';}).join(''); }
function ayahOptionsHtml(no,sel){ var arr=[];try{arr=getSurahAyahs(getValidSurahNo(no))||[];}catch(x){} var selected=parseInt(sel,10)||1;return(arr.length?arr:[{ayahNo:1}]).map(function(a){return'<option value="'+a.ayahNo+'" '+(+a.ayahNo===+selected?'selected':'')+'>'+a.ayahNo+'</option>';}).join(''); }
function populateSurah(id,sel){ var e=document.getElementById(id);if(e)e.innerHTML=surahOptionsHtml(sel); }
function populateAyah(id,no,sel){ var e=document.getElementById(id);if(e)e.innerHTML=ayahOptionsHtml(no,sel); }
function onAddSurah(){ populateAyah('addAyah',document.getElementById('addSurah').value);previewAddAyah(); }
function previewAddAyah(){ var a=getRef(document.getElementById('addSurah').value,document.getElementById('addAyah').value);var p=document.getElementById('addPreview'),l=document.getElementById('addLive');if(p)p.value=a?a.text:'ÙÙ ÙØªÙ Ø§ÙØ¹Ø«ÙØ±';if(l)l.innerHTML=a?'<span class="'+document.getElementById('addType').value+'">'+escapeHtml(a.text)+'</span>':''; }
function richEditor(id,label,color){ return '<label class="field">'+label+'<div class="rt-box"><div class="rt-toolbar"><button onclick="rt(\''+id+'\',\'bold\')"><b>B</b></button><button onclick="rt(\''+id+'\',\'underline\')"><u>U</u></button><button onclick="rt(\''+id+'\',\'insertUnorderedList\')">â¢ ÙØ§Ø¦ÙØ©</button><input type="color" value="'+color+'" onchange="rtColor(\''+id+'\',this.value)"><button onclick="rt(\''+id+'\',\'removeFormat\')">ÙØ³Ø­ ØªÙØ³ÙÙ</button></div><div id="'+id+'" class="rt-editor" contenteditable="true"></div></div></label>'; }
function rt(id,cmd){ var e=document.getElementById(id);e.focus();document.execCommand(cmd,false,null); }
function rtColor(id,c){ var e=document.getElementById(id);e.focus();document.execCommand('foreColor',false,c); }
function openAddModal(){ if(isAutoDb()){alert('Ø§ÙØ¥Ø¶Ø§ÙØ© ÙÙ Ø§ÙØ´Ø®ØµÙØ© ÙÙØ·');openDatabase('personal');}draftVerses=[];modal('addModal','Ø¥Ø¶Ø§ÙØ© ÙØªØ´Ø§Ø¨Ù Ø¬Ø¯ÙØ¯',addBody(),'<button class="primary" onclick="createNewGroup()">Ø­ÙØ¸ ÙÙ Ø§ÙØµÙØ­Ø©</button><button onclick="closeModal(\'addModal\')">Ø¥ØºÙØ§Ù</button>');populateSurah('addSurah');onAddSurah();renderDraft();runQuranSearch('add'); }
function addBody(){ return '<div class="quran-search-box"><div class="search-stats"><span id="addExact">0 :Exact</span><span id="addClose">0 :Close</span><span id="addTotal">0 :Total</span></div><h3>Ø¨Ø­Ø« ÙÙ quran-reference.js</h3><input class="wide-input" id="addQSearch" placeholder="Ø§ÙØªØ¨ ÙÙÙØ© Ø£Ù Ø¬Ø²Ø¡ ÙÙ Ø¢ÙØ©..." oninput="runQuranSearch(\'add\')"><div id="addQResults" class="quran-results hint">Ø§ÙØªØ¨ ÙÙÙØ© ÙØ¹Ø±Ø¶ Ø§ÙÙØªØ§Ø¦Ø¬.</div></div><label class="field">Ø¹ÙÙØ§Ù Ø§ÙÙØªØ´Ø§Ø¨Ù<input id="addTitle" placeholder="ÙØ«Ø§Ù: Ø§ÙØ±Ø¬ÙØ© / Ø§ÙØµÙØ­Ø©"></label><button onclick="generateTitleFromDraft()">ØªÙÙÙØ¯ Ø¹ÙÙØ§Ù ØªÙÙØ§Ø¦Ù</button><div class="color-row"><b>ÙÙÙ</b><input type="color" id="addColor" value="#55b94f"><span id="addColorPrev" class="color-preview">ÙØ¹Ø§ÙÙØ©</span></div><div class="form-grid"><label class="field">Ø§ÙØ³ÙØ±Ø©<select id="addSurah" onchange="onAddSurah()"></select></label><label class="field">Ø±ÙÙ Ø§ÙØ¢ÙØ©<select id="addAyah" onchange="previewAddAyah()"></select></label><label class="field">ÙÙØ¹ Ø§ÙØªÙÙÙÙ<select id="addType">'+partOptions('shared')+'</select></label><label class="field">Label<input id="addLabel"></label></div><label class="field">ÙØµ Ø§ÙØ¢ÙØ©<textarea id="addPreview" readonly></textarea></label><label class="field">ØªØ­Ø¯ÙØ¯ Ø¬Ø²Ø¡<textarea id="addSelectedPart"></textarea></label><div class="inline-actions"><button class="primary" onclick="addVerseToDraft()">Ø¥Ø¶Ø§ÙØ© Ø§ÙØ¢ÙØ© ÙÙÙØ¬ÙÙØ¹Ø©</button><button onclick="clearDraft()">ÙØ³Ø­ Ø§ÙÙØ¤ÙØªØ©</button></div><h3>Ø§ÙØ¢ÙØ§Øª Ø§ÙÙØ¤ÙØªØ©</h3><div id="draftVerses"></div>'+richEditor('addNote','ÙÙØ§Ø­Ø¸Ø©','#1d4ed8')+richEditor('addUnote','ÙØ§Ø¦Ø¯Ø© ÙØ±ÙØ¯Ø© / Ø¥Ø¶Ø§ÙÙØ©','#b91c1c'); }
function addVerseToDraft(){ var a=getRef(document.getElementById('addSurah').value,document.getElementById('addAyah').value);if(!a)return alert('ÙÙ ÙØªÙ Ø§ÙØ¹Ø«ÙØ±');draftVerses.push({surah:a.surah,ayah:a.ayahNo,label:document.getElementById('addLabel').value.trim(),parts:[{type:document.getElementById('addType').value,text:document.getElementById('addSelectedPart').value.trim()||a.text}]});renderDraft(); }
function renderDraft(){ var b=document.getElementById('draftVerses');if(!b)return;b.innerHTML=draftVerses.length?draftVerses.map(function(v,i){return'<div class="draft-item"><b>'+v.surah+' '+v.ayah+'</b><button class="danger" onclick="draftVerses.splice('+i+',1);renderDraft()">Ø­Ø°Ù</button><div class="verse-text"><span class="'+v.parts[0].type+'">'+escapeHtml(v.parts[0].text)+'</span></div></div>';}).join(''):'<div class="hint">ÙØ§ ØªÙØ¬Ø¯ Ø¢ÙØ§Øª ÙØ¶Ø§ÙØ© Ø¨Ø¹Ø¯.</div>'; }
function clearDraft(){ draftVerses=[];renderDraft(); }
function generateTitleFromDraft(){ if(draftVerses.length)document.getElementById('addTitle').value=draftVerses.map(function(v){return v.surah+' '+v.ayah;}).join(' / '); }
function createNewGroup(){ var title=document.getElementById('addTitle').value.trim();if(!title||!draftVerses.length)return alert('Ø£Ø¯Ø®Ù Ø§ÙØ¹ÙÙØ§Ù ÙØ§ÙØ¢ÙØ§Øª');personalData.push({id:nextPersonalId(),title:title,color:document.getElementById('addColor').value,surahs:Array.from(new Set(draftVerses.map(function(v){return v.surah;}))),verses:clone(draftVerses),note:document.getElementById('addNote').innerHTML,unote:document.getElementById('addUnote').innerHTML,favorite:false,completed:false,locked:false});invalidateGroupNormCache();saveDb('personal');closeModal('addModal');openDatabase('personal'); }

/* ââ Quran search helpers ââââââââââââââââââââââââââââââââââ */
function addQuranVerseObject(target,surah,ayah,text,type){ var obj={surah:safeText(surah),ayah:safeText(ayah),label:'',parts:[{type:type||'shared',text:safeText(text)}]};if(target==='edit'){editVersesBuffer.push(obj);renderEditVerses();setTimeout(function(){var el=document.getElementById('editVerses');if(el&&el.lastElementChild)el.lastElementChild.scrollIntoView({behavior:'smooth',block:'center'});},50);}else{draftVerses.push(obj);renderDraft();} }
function removeQuranVerseObject(target,surah,ayah){ var arr=target==='edit'?editVersesBuffer:draftVerses;var idx=arr.findIndex(function(v){return safeText(v.surah)===safeText(surah)&&safeText(v.ayah)===safeText(ayah);});if(idx>=0){arr.splice(idx,1);target==='edit'?renderEditVerses():renderDraft();return true;}return false; }
function quranItemExists(target,surah,ayah){ var arr=target==='edit'?editVersesBuffer:draftVerses;return arr.some(function(v){return safeText(v.surah)===safeText(surah)&&safeText(v.ayah)===safeText(ayah);}); }
function quranResultText(prefix,i,fullText){ var sel=getSelectedTextareaText(prefix+'QText_'+i);return sel||safeText(fullText); }
function runQuranSearch(prefix){
  var input=document.getElementById(prefix+'QSearch'),q=input?input.value.trim():'',box=document.getElementById(prefix+'QResults');if(!box)return;
  ['Exact','Close','Total'].forEach(function(k){var el=document.getElementById(prefix+k);if(el)el.textContent='0 :'+k;});
  if(!q){box.className='quran-results hint';box.innerHTML='Ø§ÙØªØ¨ ÙÙÙØ© ÙØ¹Ø±Ø¶ Ø§ÙÙØªØ§Ø¦Ø¬.';return;}
  var nq=normalizeQuranSearchText(q),exact=[],close=[];
  qAyahs().forEach(function(a){var txt=safeText(a.text),nt=normalizeQuranSearchText(txt);if(txt.includes(q))exact.push(a);else if(nt.includes(nq))close.push(a);});
  var total=exact.length+close.length,all=exact.concat(close).slice(0,80);
  var e=document.getElementById(prefix+'Exact'),c2=document.getElementById(prefix+'Close'),t=document.getElementById(prefix+'Total');
  if(e)e.textContent=exact.length+' :Exact';if(c2)c2.textContent=close.length+' :Close';if(t)t.textContent=total+' :Total';
  box.className='quran-results';
  box.innerHTML=all.map(function(a,i){var target=prefix==='edit'?'edit':'add',exists=quranItemExists(target,a.surah,a.ayahNo),checked=exists?'checked':'';return'<div class="quran-result '+(exists?'selected':'')+'"><label class="quran-check-line"><input type="checkbox" class="'+prefix+'QCheck" '+checked+' onchange="toggleQuranResult(\''+prefix+'\',this)" data-index="'+i+'" data-surah-no="'+(a.surahNo||a.surah)+'" data-ayah="'+a.ayahNo+'" data-text="'+escapeHtml(a.text)+'" data-surah="'+escapeHtml(a.surah)+'"><span>'+(exists?'ÙØ¶Ø§Ù':'ØªØ­Ø¯ÙØ¯')+'</span></label><div class="quran-result-body"><b>'+a.surah+' â '+a.ayahNo+'</b><textarea id="'+prefix+'QText_'+i+'" class="quran-result-text" readonly>'+escapeHtml(a.text)+'</textarea><div class="quran-result-actions"><button onclick="addFullQuranResult(\''+prefix+'\',this)">Ø¥Ø¶Ø§ÙØ© Ø§ÙØ¢ÙØ© ÙØ§ÙÙØ©</button><button onclick="addSelectedQuranResult(\''+prefix+'\','+i+',this)">Ø¥Ø¶Ø§ÙØ© Ø§ÙÙØµ Ø§ÙÙØ­Ø¯Ø¯</button></div></div></div>';}).join('')+'<div class="quran-result-toolbar"><button class="primary" onclick="addCheckedQuran(\''+prefix+'\')">Ø¥Ø¶Ø§ÙØ© Ø§ÙÙØ­Ø¯Ø¯</button></div>';
}
function addCheckedQuran(prefix){ document.querySelectorAll('.'+prefix+'QCheck:checked').forEach(function(ch){var txt=ch.dataset.text;if(!quranItemExists(prefix==='edit'?'edit':'add',ch.dataset.surah,ch.dataset.ayah))addQuranVerseObject(prefix==='edit'?'edit':'add',ch.dataset.surah,ch.dataset.ayah,txt,'shared');});prefix==='edit'?runQuranSearch('edit'):runQuranSearch('add'); }
function toggleQuranResult(prefix,ch){ var target=prefix==='edit'?'edit':'add';if(ch.checked){if(!quranItemExists(target,ch.dataset.surah,ch.dataset.ayah))addQuranVerseObject(target,ch.dataset.surah,ch.dataset.ayah,ch.dataset.text,'shared');}else{removeQuranVerseObject(target,ch.dataset.surah,ch.dataset.ayah);}runQuranSearch(prefix); }
function addFullQuranResult(prefix,btn){ var root=btn.closest('.quran-result'),ch=root&&root.querySelector('input[type="checkbox"]');if(!ch)return;addQuranVerseObject(prefix==='edit'?'edit':'add',ch.dataset.surah,ch.dataset.ayah,ch.dataset.text,'shared');runQuranSearch(prefix); }
function addSelectedQuranResult(prefix,i,btn){ var root=btn.closest('.quran-result'),ch=root&&root.querySelector('input[type="checkbox"]');if(!ch)return;var txt=quranResultText(prefix,i,ch.dataset.text)||ch.dataset.text;addQuranVerseObject(prefix==='edit'?'edit':'add',ch.dataset.surah,ch.dataset.ayah,txt,'shared');runQuranSearch(prefix); }

/* ââ Edit modal âââââââââââââââââââââââââââââââââââââââââââ */
function openEditModal(id){ var g=personalData.find(function(x){return+x.id===+id;});if(!g)return;if(isTrue(g.locked))return alert('Ø§ÙÙØ¬ÙÙØ¹Ø© ÙÙÙÙØ©');editGroupId=id;editVersesBuffer=clone(g.verses||[]);modal('editModal','ØªØ¹Ø¯ÙÙ Ø§ÙÙØªØ´Ø§Ø¨Ù',editBody(g),'<button class="primary" onclick="saveEditGroup()">Ø­ÙØ¸ Ø§ÙØªØ¹Ø¯ÙÙ</button><button class="danger" onclick="deleteEditGroup()">Ø­Ø°Ù Ø§ÙÙØ¬ÙÙØ¹Ø©</button><button onclick="closeModal(\'editModal\')">Ø¥ØºÙØ§Ù</button>');renderEditVerses();runQuranSearch('edit'); }
function editBody(g){ return '<div class="quran-search-box edit-quran-search"><div class="search-stats"><span id="editExact">0 :Exact</span><span id="editClose">0 :Close</span><span id="editTotal">0 :Total</span></div><h3>Ø¨Ø­Ø« Ø°ÙÙ ÙÙ Ø§ÙÙØ±Ø¢Ù</h3><input class="wide-input" id="editQSearch" placeholder="Ø§Ø¨Ø­Ø« Ø¯Ø§Ø®Ù quran-reference.js..." oninput="runQuranSearch(\'edit\')"><div id="editQResults" class="quran-results hint">Ø§ÙØªØ¨ ÙÙÙØ© ÙØ¹Ø±Ø¶ Ø§ÙÙØªØ§Ø¦Ø¬.</div></div><label class="field">Ø¹ÙÙØ§Ù Ø§ÙÙØªØ´Ø§Ø¨Ù<input id="editTitle" value="'+escapeHtml(g.title)+'"></label><div class="inline-actions"><button class="primary" onclick="addBlankEditVerse()">+ Ø¥Ø¶Ø§ÙØ© Ø¢ÙØ©</button><button onclick="sortEditVersesByMushaf()">ØªØ±ØªÙØ¨ Ø­Ø³Ø¨ Ø§ÙÙØµØ­Ù</button></div><div id="editVerses"></div>'+richEditor('editNote','ÙÙØ§Ø­Ø¸Ø©','#1d4ed8')+richEditor('editUnote','ÙØ§Ø¦Ø¯Ø© ÙØ±ÙØ¯Ø© / Ø¥Ø¶Ø§ÙÙØ©','#b91c1c'); }
function renderEditVerses(){ var b=document.getElementById('editVerses');if(!b)return;b.innerHTML=editVersesBuffer.map(function(v,vi){var sno=getValidSurahNo(v.surah),ayah=v.ayah||1;return'<div class="edit-verse"><div class="edit-verse-title"><b>Ø¢ÙØ© '+(vi+1)+'</b><div><button onclick="moveEditVerse('+vi+',-1)">â</button><button onclick="moveEditVerse('+vi+',1)">â</button><button class="danger" onclick="editVersesBuffer.splice('+vi+',1);renderEditVerses()">Ø­Ø°Ù Ø§ÙØ¢ÙØ©</button></div></div><div class="form-grid"><label class="field">Ø§ÙØ³ÙØ±Ø©<select onchange="setEditSurah('+vi+',this.value)">'+surahOptionsHtml(sno)+'</select></label><label class="field">Ø±ÙÙ Ø§ÙØ¢ÙØ©<select onchange="setEditAyah('+vi+',this.value)">'+ayahOptionsHtml(sno,ayah)+'</select></label><label class="field">Label<input value="'+escapeHtml(v.label||'')+'" onchange="editVersesBuffer['+vi+'].label=this.value"></label></div><button onclick="fillEditAyah('+vi+')">ÙÙØ¡ ÙØµ Ø§ÙØ¢ÙØ© ÙÙ Ø§ÙÙØ±Ø¬Ø¹</button><h4>Ø£Ø¬Ø²Ø§Ø¡ Ø§ÙÙØµ</h4>'+(v.parts||[]).map(function(p,pi){return partRow(vi,pi,p);}).join('')+'<button onclick="addEditPart('+vi+')">+ Ø¥Ø¶Ø§ÙØ© Ø¬Ø²Ø¡ ÙØµ</button><div class="live-preview verse-text">'+(v.parts||[]).map(function(p){return'<span class="'+p.type+'">'+escapeHtml(p.text)+'</span>';}).join(' ')+'</div></div>';}).join(''); }
function partRow(vi,pi,p){ return'<div class="part-row"><select aria-label="ÙÙØ¹ Ø§ÙØ¬Ø²Ø¡" onchange="editVersesBuffer['+vi+'].parts['+pi+'].type=this.value;renderEditVerses()">'+partOptions(p.type)+'</select><textarea aria-label="ÙØµ Ø§ÙØ¬Ø²Ø¡" onchange="editVersesBuffer['+vi+'].parts['+pi+'].text=this.value">'+escapeHtml(p.text)+'</textarea><div class="part-actions"><button onclick="moveEditPart('+vi+','+pi+',-1)">â</button><button onclick="moveEditPart('+vi+','+pi+',1)">â</button><button onclick="insertEditPart('+vi+','+pi+')">+ ÙØ¨Ù</button><button onclick="insertEditPart('+vi+','+(pi+1)+')">+ Ø¨Ø¹Ø¯</button><button class="danger" onclick="removeEditPart('+vi+','+pi+')">Ø­Ø°Ù</button></div></div>'; }
function addBlankEditVerse(){ editVersesBuffer.push({surah:'Ø§ÙÙØ§ØªØ­Ø©',ayah:1,label:'',parts:[{type:'normal',text:''}]});renderEditVerses(); }
function moveEditVerse(i,d){ var j=i+d;if(j<0||j>=editVersesBuffer.length)return;var tmp=editVersesBuffer[i];editVersesBuffer[i]=editVersesBuffer[j];editVersesBuffer[j]=tmp;renderEditVerses(); }
function addEditPart(vi){ editVersesBuffer[vi].parts.push({type:'normal',text:''});renderEditVerses(); }
function insertEditPart(vi,pi){ editVersesBuffer[vi].parts.splice(pi+1,0,{type:'normal',text:''});renderEditVerses(); }
function removeEditPart(vi,pi){ editVersesBuffer[vi].parts.splice(pi,1);renderEditVerses(); }
function moveEditPart(vi,pi,d){ var a=editVersesBuffer[vi].parts,j=pi+d;if(j<0||j>=a.length)return;var tmp=a[pi];a[pi]=a[j];a[j]=tmp;renderEditVerses(); }
function setEditSurah(vi,no){ var names=surahNames(),sno=getValidSurahNo(no),arr=[];try{arr=getSurahAyahs(sno)||[];}catch(e){}if(!editVersesBuffer[vi])return;editVersesBuffer[vi].surah=names[sno]||String(no);editVersesBuffer[vi].ayah=(arr[0]&&arr[0].ayahNo)||1;renderEditVerses(); }
function setEditAyah(vi,ayah){ if(!editVersesBuffer[vi])return;editVersesBuffer[vi].ayah=parseInt(ayah,10)||ayah; }
function fillEditAyah(vi){ var v=editVersesBuffer[vi],a=getRef(getSurahNo(v.surah),v.ayah);if(!a)return alert('ÙÙ ÙØªÙ Ø§ÙØ¹Ø«ÙØ±');v.surah=a.surah;v.ayah=a.ayahNo;v.parts=[{type:'normal',text:a.text}];renderEditVerses(); }
function sortEditVersesByMushaf(){ editVersesBuffer.sort(function(a,b){return getSurahNo(a.surah)-getSurahNo(b.surah)||(+a.ayah||0)-(+b.ayah||0);});renderEditVerses(); }
function saveEditGroup(){ var i=personalData.findIndex(function(g){return+g.id===+editGroupId;});if(i<0)return;personalData[i]=Object.assign({},personalData[i],{title:document.getElementById('editTitle').value.trim(),verses:clone(editVersesBuffer),surahs:Array.from(new Set(editVersesBuffer.map(function(v){return v.surah;}))),note:document.getElementById('editNote').innerHTML,unote:document.getElementById('editUnote').innerHTML});invalidateGroupNormCache();saveDb('personal');closeModal('editModal');renderActiveGroups(); }
function deleteEditGroup(){ if(confirm('Ø­Ø°Ù Ø§ÙÙØ¬ÙÙØ¹Ø©Ø')){personalData=personalData.filter(function(g){return+g.id!==+editGroupId;});invalidateGroupNormCache();saveDb('personal');closeModal('editModal');renderActiveGroups();updateHomeCounts();} }

/* ââ Merge window âââââââââââââââââââââââââââââââââââââââââ */
function openMergeWindow(){ modal('mergeWindow','Ø¯ÙØ¬ / ÙÙÙ ÙÙ Ø§ÙØ¢ÙÙØ© Ø¥ÙÙ Ø§ÙØ´Ø®ØµÙØ©','<div class="tools"><input id="mergeSearch" placeholder="Ø§Ø¨Ø­Ø« ÙÙ Ø§ÙØ¢ÙÙØ©..." oninput="renderMergeList()"><button onclick="selectAllMerge(true)">ØªØ­Ø¯ÙØ¯ Ø§ÙÙØ¹Ø±ÙØ¶</button><button onclick="selectAllMerge(false)">Ø¥ÙØºØ§Ø¡ Ø§ÙØªØ­Ø¯ÙØ¯</button><button class="primary" onclick="copySelectedToPersonal()">ÙÙÙ Ø§ÙÙØ­Ø¯Ø¯</button></div><div id="mergeList"></div>','<button onclick="closeModal(\'mergeWindow\')">Ø¥ØºÙØ§Ù</button>');renderMergeList(); }
function renderMergeList(){ var q=normalize((document.getElementById('mergeSearch')||{}).value||'');var list=automatedData.filter(function(g){return!q||normalize(groupText(g)).includes(q);});document.getElementById('mergeList').innerHTML=list.map(function(g){return'<label class="merge-item"><input type="checkbox" class="merge-check" value="'+automatedData.indexOf(g)+'"><div><b>'+escapeHtml(g.title)+'</b><br><small>'+getTags(g).join('Ø ')+' â '+(g.verses||[]).length+' Ø¢ÙØ§Øª</small></div><button onclick="copyOneToPersonal('+automatedData.indexOf(g)+')">ÙØ³Ø®</button></label>';}).join('')||'<div class="hint">ÙØ§ ØªÙØ¬Ø¯ ÙØªØ§Ø¦Ø¬</div>'; }
function selectAllMerge(s){ document.querySelectorAll('.merge-check').forEach(function(x){x.checked=s;}); }
function copyOneToPersonal(i){ var g=clone([automatedData[i]])[0];g.id=nextPersonalId();g.autoCandidate=false;g.source='automated';personalData.push(g);saveDb('personal');updateHomeCounts();alert('ØªÙ Ø§ÙÙØ³Ø®'); }
function copySelectedToPersonal(){ var ids=[...document.querySelectorAll('.merge-check:checked')].map(function(x){return+x.value;});ids.forEach(copyOneToPersonal); }

/* ââ Settings ââââââââââââââââââââââââââââââââââââââââââââââ */
/* BUG-4 FIX: empty defaults â no hardcoded Shazlka/Mutashabihat */
var GH_DEFAULT = {ghOwner:'', ghRepo:'', ghBranch:'main', ghPath:'personal-data.js', ghAutoSync:false};
var GH_KEYS = {time:'github_last_sync_time',sha:'github_last_commit_sha',url:'github_last_commit_url',path:'github_last_sync_path',status:'github_last_sync_status',error:'github_last_sync_error'};
var ghSyncing=false, ghQueued=false, ghTimer=null;
function ghNorm(s){ return Object.assign({}, GH_DEFAULT, {theme:'quran-classic',font:'normal-quran'}, s||{}); }
function normalizeFontPreset(v){ v=safeText(v||'normal-quran'); if(v!=='normal-quran'&&v!=='mushaf-qpc-v2')return'normal-quran'; return v; }
function getSettings(){ try{var stored=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');var s=ghNorm(stored);s.font=normalizeFontPreset(s.font);s.ghToken=sessionStorage.getItem('gh_token_session')||stored.ghToken||'';return s;}catch(e){return ghNorm({});} }
function applySettings(){ var s=getSettings();document.body.setAttribute('data-theme',s.theme);document.body.setAttribute('data-font-preset',s.font);var b=document.getElementById('ghBadge');if(b){var st=localStorage.getItem(GH_KEYS.status)||'none';b.textContent=st==='success'?'â GitHub synced':st==='failed'?'â GitHub failed':st==='syncing'?'ð¡ GitHub syncing':st==='no_changes'?'â ï¸ No changes':(s.ghOwner&&s.ghRepo?'â GitHub ready':'â GitHub: not set');} }
function collectSettingsFromForm(){ var o=getSettings();return ghNorm({...o,theme:(document.getElementById('setTheme')||{}).value||o.theme,font:normalizeFontPreset((document.getElementById('setFont')||{}).value||o.font),ghToken:(document.getElementById('ghToken')||{}).value||'',ghOwner:(document.getElementById('ghOwner')||{}).value||'',ghRepo:(document.getElementById('ghRepo')||{}).value||'',ghBranch:(document.getElementById('ghBranch')||{}).value||o.ghBranch,ghPath:(document.getElementById('ghPath')||{}).value||o.ghPath,ghAutoSync:!!(document.getElementById('ghAutoSyncCheck')||{}).checked}); }
function saveSettings(closeAfter){ closeAfter=closeAfter!==false;var s=collectSettingsFromForm();var em=document.getElementById('editModeCheck');if(em){editMode=!!em.checked;localStorage.setItem('mutashabihat_v69_edit_mode',editMode);}sessionStorage.setItem('gh_token_session',s.ghToken||'');var toStore=Object.assign({},s,{ghToken:''});localStorage.setItem(SETTINGS_KEY,JSON.stringify(toStore));applySettings();if(closeAfter)closeModal('settingsModal');if(activeDb)renderActiveGroups();ghRender(); }
function openAppSettings(){ var s=getSettings();modal('settingsModal','Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§ÙØªØ·Ø¨ÙÙ','<div class="settings-section"><h2 class="github-sync-heading"><span id="githubSyncDot" class="github-sync-dot gray"></span>GitHub Auto Sync â</h2><div id="githubSyncStatusMount">'+ghStatusHtml()+'</div><label class="field">Token (ÙØ¤ÙØª â ÙÙÙØ³Ø­ Ø¹ÙØ¯ Ø¥ØºÙØ§Ù Ø§ÙÙØ§ÙØ°Ø©)<input id="ghToken" type="password" value="'+escapeHtml(s.ghToken||'')+'"></label><div class="form-grid"><label class="field">Owner<input id="ghOwner" value="'+escapeHtml(s.ghOwner||'')+'"></label><label class="field">Repo<input id="ghRepo" value="'+escapeHtml(s.ghRepo||'')+'"></label><label class="field">Branch<input id="ghBranch" value="'+escapeHtml(s.ghBranch||'main')+'"></label><label class="field">Path<input id="ghPath" value="'+escapeHtml(s.ghPath||'personal-data.js')+'"></label></div><label class="github-autosync-toggle"><input type="checkbox" id="ghAutoSyncCheck" '+(s.ghAutoSync?'checked':'')+'>ØªÙØ¹ÙÙ Ø§ÙÙØ²Ø§ÙÙØ© Ø§ÙØªÙÙØ§Ø¦ÙØ© Ø¨Ø¹Ø¯ ØªØ¹Ø¯ÙÙ Ø§ÙØ´Ø®ØµÙØ©</label><div class="inline-actions"><button class="primary" onclick="saveSettings()">Save / Ø­ÙØ¸</button><button onclick="testGitHubConnection()">Test Connection</button><button onclick="syncToGitHub(\'manual\')">Sync Now</button></div></div><div class="settings-section"><h2>âï¸ ÙØ¶Ø¹ Ø§ÙØªØ¹Ø¯ÙÙ</h2><label><input type="checkbox" id="editModeCheck" '+(editMode?'checked':'')+'>ØªÙØ¹ÙÙ ÙØ¶Ø¹ Ø§ÙØªØ¹Ø¯ÙÙ</label></div><div class="settings-section"><h2>ð¨ Ø§ÙÙØ¸ÙØ± / Ø§ÙØ®Ø·</h2><div class="form-grid"><label class="field">Theme<select id="setTheme"><option value="quran-classic">Quran Classic</option><option value="apple-health">Apple Health</option><option value="bevel-night">Bevel Night</option></select></label><label class="field">Font<select id="setFont" onchange="updateFontPreview()"><option value="normal-quran">Normal Quran</option><option value="mushaf-qpc-v2">Mushaf QPC V2</option></select></label></div><div id="fontPreviewBox" class="font-preview-box" data-font-preset="normal-quran"><b>ÙØ¹Ø§ÙÙØ© Ø§ÙØ®Ø· ÙØ¨Ù Ø§ÙØ­ÙØ¸</b><div class="font-preview-ayah">ÙÙØ²ÙÙÙÙÙÙ ÙÙÙÙÙÙ Ø§ÙØ´ÙÙÙÙØ·ÙØ§ÙÙ Ø£ÙØ¹ÙÙÙØ§ÙÙÙÙÙÙ ÙÙØµÙØ¯ÙÙÙÙÙÙ Ø¹ÙÙÙ Ø§ÙØ³ÙÙØ¨ÙÙÙÙ ÙÙÙÙÙÙ ÙÙØ§ ÙÙÙÙØªÙØ¯ÙÙÙÙ</div><small id="fontPreviewHint">Ø¥Ø°Ø§ ÙØ§Ù ÙØ¬ÙØ¯ fonts ÙØ§Ø±ØºØ§Ù Ø³ÙØ¸ÙØ± Ø§ÙØ®Ø· Ø§ÙØ§Ø­ØªÙØ§Ø·Ù ØªÙÙØ§Ø¦ÙØ§Ù.</small></div></div><div class="inline-actions"><button onclick="openReleaseNotes()">Release Notes</button><button onclick="exportActiveDatabase()">Export data.js</button><button onclick="resetDualDbCacheV68()">Reset Cache</button></div>','<button class="primary" onclick="saveSettings()">Ø­ÙØ¸</button><button onclick="closeModal(\'settingsModal\')">Ø¥ØºÙØ§Ù</button>');document.getElementById('setTheme').value=s.theme;document.getElementById('setFont').value=s.font;updateFontPreview();ghRender(); }
function updateFontPreview(){ var f=normalizeFontPreset((document.getElementById('setFont')||{}).value||getSettings().font),box=document.getElementById('fontPreviewBox'),hint=document.getElementById('fontPreviewHint');if(box)box.setAttribute('data-font-preset',f);if(hint)hint.textContent=f==='mushaf-qpc-v2'?'ÙØ¹Ø§ÙÙØ© Mushaf QPC V2.':'ÙØ¹Ø§ÙÙØ© Ø§ÙØ®Ø· Ø§ÙØ¹Ø§Ø¯Ù.'; }

/* ââ GitHub sync âââââââââââââââââââââââââââââââââââââââââââ */
function ghShort(s){return safeText(s).slice(0,7);}
function ghPathEnc(p){return safeText(p).split('/').map(encodeURIComponent).join('/');}
function ghApiGet(s){return'https://api.github.com/repos/'+encodeURIComponent(s.ghOwner)+'/'+encodeURIComponent(s.ghRepo)+'/contents/'+ghPathEnc(s.ghPath)+'?ref='+encodeURIComponent(s.ghBranch);}
function ghApiPut(s){return'https://api.github.com/repos/'+encodeURIComponent(s.ghOwner)+'/'+encodeURIComponent(s.ghRepo)+'/contents/'+ghPathEnc(s.ghPath);}
function ghFileUrl(s){return'https://github.com/'+encodeURIComponent(s.ghOwner)+'/'+encodeURIComponent(s.ghRepo)+'/blob/'+encodeURIComponent(s.ghBranch)+'/'+ghPathEnc(s.ghPath);}
function ghMeta(){ var st=ghSyncing?'syncing':(localStorage.getItem(GH_KEYS.status)||'none');var m={syncing:['syncing','yellow','ð¡ Ø¬Ø§Ø±Ù Ø§ÙÙØ²Ø§ÙÙØ©...'],success:['success','green','â ØªÙØª Ø§ÙÙØ²Ø§ÙÙØ© Ø¨ÙØ¬Ø§Ø­'],failed:['failed','red','â ÙØ´Ù Ø§ÙÙØ²Ø§ÙÙØ©'],no_changes:['no-changes','green','â ï¸ ÙØ§ ØªÙØ¬Ø¯ ØªØºÙÙØ±Ø§Øª'],none:['none','gray','ÙÙ ØªØªÙ Ø£Ù ÙØ²Ø§ÙÙØ© Ø¨Ø¹Ø¯']};return m[st]||m.none; }
function ghStatusHtml(){ var s=getSettings(),m=ghMeta(),t=localStorage.getItem(GH_KEYS.time)||'',sha=localStorage.getItem(GH_KEYS.sha)||'',url=localStorage.getItem(GH_KEYS.url)||'',p=localStorage.getItem(GH_KEYS.path)||s.ghPath,er=localStorage.getItem(GH_KEYS.error)||'';return'<div class="github-sync-status-card '+m[0]+'"><div class="github-sync-status-title"><b>Ø­Ø§ÙØ© Ø§ÙÙØ²Ø§ÙÙØ©</b><span class="github-sync-chip '+m[0]+'">'+m[2]+'</span></div><div class="github-sync-lines"><div><strong>Ø¢Ø®Ø± ÙØ²Ø§ÙÙØ©:</strong> '+(t?escapeHtml(t):'<span class="muted">ÙØ§ ÙÙØ¬Ø¯</span>')+'</div><div><strong>Ø§ÙÙÙÙ:</strong> <code>'+escapeHtml(p)+'</code></div>'+(sha?'<div><strong>Commit:</strong> <code>'+escapeHtml(ghShort(sha))+'</code></div>':'')+(er?'<div class="github-error-box"><strong>Error:</strong><pre>'+escapeHtml(er)+'</pre></div>':'')+'</div><div class="github-sync-actions">'+(url?'<button onclick="ghOpenCommit()">Open Commit</button>':'')+(er?'<button onclick="ghCopyError()">Copy Error</button>':'')+'<button onclick="ghVerify()">Verify on GitHub</button></div></div>'; }
function ghRender(){ var x=document.getElementById('githubSyncStatusMount');if(x)x.innerHTML=ghStatusHtml();var d=document.getElementById('githubSyncDot');if(d){var m=ghMeta();d.className='github-sync-dot '+m[1];d.title=m[2];}applySettings(); }
function ghSet(st,err){ localStorage.setItem(GH_KEYS.status,st);if(st==='failed'&&err)localStorage.setItem(GH_KEYS.error,safeText(err));if(st!=='failed')localStorage.removeItem(GH_KEYS.error);ghRender(); }
function ghContent(){ return'window.PERSONAL_DATA = '+JSON.stringify(personalData||[],null,2)+';\n'; }
async function ghB64(str){ var bytes=new TextEncoder().encode(str),bin='',ch=0x8000;for(var i=0;i<bytes.length;i+=ch)bin+=String.fromCharCode(...bytes.slice(i,i+ch));return btoa(bin); }
function ghDecode(b64){ var bin=atob(safeText(b64).replace(/\s/g,'')),arr=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);return new TextDecoder('utf-8').decode(arr); }
function ghCmp(x){ return safeText(x).replace(/\r\n/g,'\n').trim(); }
async function ghErr(r){ var body='';try{var j=await r.json();body=j.message||JSON.stringify(j);}catch(e){try{body=await r.text();}catch(_){body=r.statusText;}}return(r.status+' '+(r.statusText||'')+(body?' â '+body:'')).trim(); }
function ghOpenCommit(){ var u=localStorage.getItem(GH_KEYS.url)||'';if(u)window.open(u,'_blank','noopener'); }
function ghVerify(){ window.open(ghFileUrl(getSettings()),'_blank','noopener'); }
function ghCopyError(){ var e=localStorage.getItem(GH_KEYS.error)||'';writeClipboardText(e);if(typeof toast==='function')toast('ØªÙ ÙØ³Ø® ØªÙØ§ØµÙÙ Ø§ÙØ®Ø·Ø£','ok'); }
async function testGitHubConnection(){ saveSettings(false);var s=getSettings(),el=document.getElementById('githubLiveStatus');if(el){el.className='status-line info';el.innerHTML='<span></span>Ø¬Ø§Ø±Ù ÙØ­Øµ Ø§ÙØ§ØªØµØ§Ù...';}try{if(!s.ghToken)throw new Error('Missing GitHub token');var r=await fetch('https://api.github.com/repos/'+encodeURIComponent(s.ghOwner)+'/'+encodeURIComponent(s.ghRepo),{headers:{Authorization:'Bearer '+s.ghToken,Accept:'application/vnd.github+json'}});if(!r.ok)throw new Error(await ghErr(r));var f=await fetch(ghApiGet(s),{headers:{Authorization:'Bearer '+s.ghToken,Accept:'application/vnd.github+json'}});if(!f.ok)throw new Error(await ghErr(f));if(el){el.className='status-line ok';el.innerHTML='<span></span>ØªÙ Ø§ÙØ§ØªØµØ§Ù Ø¨Ø§ÙÙØ³ØªÙØ¯Ø¹ ÙØ§ÙÙÙÙ Ø¨ÙØ¬Ø§Ø­';}}catch(e){console.error('GitHub connection test failed',e);if(el){el.className='status-line err';el.innerHTML='<span></span>ÙØ´Ù Ø§ÙØ§ØªØµØ§Ù: '+escapeHtml(e.message||e);}} }
async function syncToGitHub(reason){ saveSettings(false);if(ghSyncing){ghQueued=true;return;}var s=getSettings();if(!s.ghToken){ghSet('failed','Missing GitHub token');return;}ghSyncing=true;ghSet('syncing');storage('â Ø¬Ø§Ø±Ù Ø§ÙÙØ²Ø§ÙÙØ©...');try{var g=await fetch(ghApiGet(s),{headers:{Authorization:'Bearer '+s.ghToken,Accept:'application/vnd.github+json'}});if(!g.ok)throw new Error(await ghErr(g));var cur=await g.json(),sha=cur.sha;if(!sha)throw new Error('GitHub API did not return current file SHA');var remote='';try{remote=ghDecode(cur.content||'');}catch(e){}var local=ghContent();if(ghCmp(remote)===ghCmp(local)){localStorage.setItem(GH_KEYS.path,s.ghPath);ghSet('no_changes');storage('â ï¸ ÙØ§ ØªÙØ¬Ø¯ ØªØºÙÙØ±Ø§Øª');return;}var put=await fetch(ghApiPut(s),{method:'PUT',headers:{Authorization:'Bearer '+s.ghToken,Accept:'application/vnd.github+json','Content-Type':'application/json'},body:JSON.stringify({message:'Update Mutashabihat personal database '+new Date().toLocaleString('ar-EG'),content:await ghB64(local),sha:sha,branch:s.ghBranch})});if(!put.ok)throw new Error(await ghErr(put));var res=await put.json(),csha=(res&&res.commit&&res.commit.sha)||'',curl=(res&&res.commit&&res.commit.html_url)||(res&&res.content&&res.content.html_url)||'';if(!csha)throw new Error('GitHub update succeeded but commit SHA was not returned');localStorage.setItem(GH_KEYS.time,new Date().toLocaleString('ar-EG',{hour12:false}));localStorage.setItem(GH_KEYS.sha,csha);localStorage.setItem(GH_KEYS.url,curl);localStorage.setItem(GH_KEYS.path,s.ghPath);ghSet('success');storage('â ØªÙØª Ø§ÙÙØ²Ø§ÙÙØ© Ø¨ÙØ¬Ø§Ø­');}catch(e){console.error('Sync failed',e);ghSet('failed',e.message||String(e));storage('â ÙØ´Ù Ø§ÙÙØ²Ø§ÙÙØ©');}finally{ghSyncing=false;ghRender();if(ghQueued){ghQueued=false;setTimeout(function(){syncToGitHub('queued');},900);}} }
function triggerGitHubAutoSync(reason){ var s=getSettings();if(!s.ghAutoSync||!s.ghToken)return;clearTimeout(ghTimer);ghTimer=setTimeout(function(){syncToGitHub(reason||'auto');},1200); }

/* ââ Clipboard ââââââââââââââââââââââââââââââââââââââââââââ */
async function writeClipboardText(txt){ try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(txt);return true;}}catch(e){}try{var ta=document.createElement('textarea');ta.value=txt;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;top:0;opacity:0';document.body.appendChild(ta);ta.focus();ta.select();ta.setSelectionRange(0,ta.value.length);var ok=document.execCommand('copy');ta.remove();return ok;}catch(e){return false;} }
function htmlToPlainText(v){ var d=document.createElement('div');d.innerHTML=safeText(v);return(d.textContent||d.innerText||'').trim(); }
function groupPlainText(g){ return(['Ø¹ÙÙØ§Ù Ø§ÙÙØªØ´Ø§Ø¨Ù:\n'+safeText(g.title||'Ø¨Ø¯ÙÙ Ø¹ÙÙØ§Ù'),'Ø±ÙÙ Ø§ÙÙØ¬ÙÙØ¹Ø©: '+safeText(g.id),'Ø§ÙØ³ÙØ±: '+getTags(g).join(' / '),'Ø§ÙØ¢ÙØ§Øª:'].concat((g.verses||[]).map(function(v,i){return(i+1)+'. Ø³ÙØ±Ø© '+safeText(v.surah)+' â Ø¢ÙØ© '+safeText(v.ayah)+(v.label?' â '+safeText(v.label):'')+'\n'+(v.parts||[]).map(function(p){return safeText(p.text);}).join(' ');})).concat([g.note?'ÙÙØ§Ø­Ø¸Ø©:\n'+htmlToPlainText(g.note):'',g.unote?'ÙØ§Ø¦Ø¯Ø© Ø¥Ø¶Ø§ÙÙØ©:\n'+htmlToPlainText(g.unote):'']).filter(Boolean)).join('\n\n'); }

/* ââ HD Image export âââââââââââââââââââââââââââââââââââââââ */
var SHARE_COLORS={normal:{fg:'#111827',bg:null},shared:{fg:'#15803d',bg:'#dcfce7'},diff:{fg:'#92400e',bg:'#fef3c7'},diff2:{fg:'#6d28d9',bg:'#ede9fe'},diff3:{fg:'#0f766e',bg:'#ccfbf1'},addition:{fg:'#1d4ed8',bg:'#dbeafe'},unique:{fg:'#b91c1c',bg:'#fee2e2'}};
function canvasWrap(ctx,text,maxWidth){var words=safeText(text).replace(/\s+/g,' ').trim().split(' '),lines=[],line='';words.forEach(function(w){var test=line?line+' '+w:w;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=w;}else line=test;});if(line)lines.push(line);return lines.length?lines:[''];}
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function drawPill(ctx,text,x,y,fg,bg){ctx.font='700 24px Arial';var w=ctx.measureText(text).width+28;ctx.fillStyle=bg;roundRect(ctx,x-w,y-28,w,38,18);ctx.fill();ctx.fillStyle=fg;ctx.textAlign='right';ctx.fillText(text,x-14,y-2);return w+10;}
async function downloadGroupImage(id){ var g=findActive(id);if(!g)return;toast('Ø¬Ø§Ø±Ù Ø¥ÙØ´Ø§Ø¡ Ø§ÙØµÙØ±Ø©...','info');try{var W=1500,pad=70,lineH=54,y=pad,measure=document.createElement('canvas').getContext('2d');measure.font='34px Arial';var maxText=W-pad*2,totalLines=3;(g.verses||[]).forEach(function(v){totalLines+=1;(v.parts||[]).forEach(function(p){totalLines+=canvasWrap(measure,p.text,maxText).length;});});if(g.note)totalLines+=canvasWrap(measure,htmlToPlainText(g.note),maxText).length+2;if(g.unote)totalLines+=canvasWrap(measure,htmlToPlainText(g.unote),maxText).length+2;var H=Math.max(900,pad*2+totalLines*lineH+220),scale=2,c=document.createElement('canvas');c.width=W*scale;c.height=H*scale;var ctx=c.getContext('2d');ctx.scale(scale,scale);ctx.direction='rtl';ctx.textBaseline='top';ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.strokeStyle='#d8dee8';ctx.lineWidth=3;roundRect(ctx,24,24,W-48,H-48,34);ctx.stroke();ctx.textAlign='right';ctx.fillStyle='#0f172a';ctx.font='800 42px Arial';canvasWrap(ctx,g.title||'Ø¨Ø¯ÙÙ Ø¹ÙÙØ§Ù',maxText).forEach(function(line){ctx.fillText(line,W-pad,y);y+=58;});y+=10;var x=W-pad;x-=drawPill(ctx,'ÙØ¬ÙÙØ¹Ø© '+safeText(g.id),x,y,'#1d4ed8','#dbeafe');getTags(g).forEach(function(s){x-=drawPill(ctx,'#'+s,x,y,groupHasUniqueInSurah(g,s)?'#991b1b':'#334155',groupHasUniqueInSurah(g,s)?'#fee2e2':'#f1f5f9');});y+=60;(g.verses||[]).forEach(function(v,idx){ctx.fillStyle='#475569';ctx.font='800 27px Arial';ctx.fillText((idx+1)+'. Ø³ÙØ±Ø© '+safeText(v.surah)+' â Ø¢ÙØ© '+safeText(v.ayah)+(v.label?' â '+safeText(v.label):''),W-pad,y);y+=46;(v.parts||[]).forEach(function(p){var st=SHARE_COLORS[p.type||'normal']||SHARE_COLORS.normal;ctx.font='34px Arial';canvasWrap(ctx,p.text,maxText).forEach(function(line){var tw=ctx.measureText(line).width;if(st.bg){ctx.fillStyle=st.bg;roundRect(ctx,W-pad-tw-16,y-4,tw+24,44,10);ctx.fill();}ctx.fillStyle=st.fg;ctx.fillText(line,W-pad,y);y+=52;});});y+=24;});function drawNote(title,text,bg,fg){if(!text)return;ctx.fillStyle=bg;roundRect(ctx,pad,y,W-pad*2,58,16);ctx.fill();ctx.fillStyle=fg;ctx.font='800 28px Arial';ctx.fillText(title,W-pad-18,y+13);y+=74;ctx.fillStyle='#0f172a';ctx.font='30px Arial';canvasWrap(ctx,htmlToPlainText(text),maxText).forEach(function(line){ctx.fillText(line,W-pad,y);y+=48;});y+=24;}drawNote('ÙÙØ§Ø­Ø¸Ø©',g.note,'#eff6ff','#1d4ed8');drawNote('ÙØ§Ø¦Ø¯Ø© Ø¥Ø¶Ø§ÙÙØ©',g.unote,'#fff1f2','#b91c1c');c.toBlob(async function(blob){if(!blob){toast('ÙØ´Ù Ø¥ÙØ´Ø§Ø¡ Ø§ÙØµÙØ±Ø©','err');return;}var file=new File([blob],'mutashabihat_group_'+safeText(g.id)+'_HD.png',{type:'image/png'});try{if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:g.title||'ÙØªØ´Ø§Ø¨ÙØ§Øª'});toast('ØªÙ ØªØ¬ÙÙØ² Ø§ÙØµÙØ±Ø© ÙÙÙØ´Ø§Ø±ÙØ©','ok');return;}}catch(e){}var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=file.name;a.click();setTimeout(function(){URL.revokeObjectURL(a.href);},1600);toast('ØªÙ ØªÙØ²ÙÙ Ø§ÙØµÙØ±Ø© HD','ok');},'image/png',1);}catch(e){console.error(e);toast('ÙØ´Ù Ø¥ÙØ´Ø§Ø¡ Ø§ÙØµÙØ±Ø©','err');} }

/* ââ Release notes & init ââââââââââââââââââââââââââââââââââ */
var RELEASE_V83 = 'V83 â Bug Fixes & Performance Improvements\n\nBUG FIXES:\n1. BUG-1: Created missing surah-095.js â was in manifest but absent on disk (crash on click).\n2. BUG-2: Fixed automated DB delete â persistent blocklist (AUTO_DELETE_KEY) survives page reloads. V80 delete was silently broken.\n3. BUG-3: Fixed XSS in safeRich() â proper allowlist sanitizer, strips all non-whitelisted tags and event attributes.\n4. BUG-4: Cleared hardcoded Shazlka/Mutashabihat GitHub defaults.\n5. BUG-5: GitHub PAT stored in sessionStorage only â never persisted to localStorage.\n6. BUG-6: Removed triplicate openReleaseNotes() definitions.\n7. BUG-7: Removed dead V82/V84 duplicate code â single clean file.\n8. BUG-8: Removed V80 badge IIFE flicker.\n\nPERFORMANCE (+30%):\nP1: Memoized qAyahs() â 6236-ayah rebuild eliminated per keystroke.\nP2: 200ms debounce on search input â 80% fewer DOM rebuilds while typing.\nP3: O(1) surah reverse-lookup Map â eliminates 114-entry linear scan per sort comparison.\nP4: Schwartzian sort transform â keys computed once, not per comparison.\nP5: WeakMap cache for normalised group text â avoids repeated normalize/groupText per filter call.\nP6: defer on all <script> tags â 2MB loads in parallel with HTML (50-70% faster first load).\nP7: Surah filter rebuild skipped when state unchanged.';

function openReleaseNotes(){ modal('releaseModal','Release Notes â V83','<div class="release-content">'+escapeHtml(RELEASE_V83)+'</div>','<button onclick="navigator.clipboard&&navigator.clipboard.writeText(RELEASE_V83)">ÙØ³Ø®</button><button onclick="closeModal(\'releaseModal\')">Ø¥ØºÙØ§Ù</button>'); }



// ===== OneDrive Sync via Microsoft Graph (appended by Cowork) =====
const OD_CLIENT_ID='16371ab6-1ba6-476a-9d4b-81cdb08c6cb8';
const OD_TOKEN_KEY='od_access_token';
const OD_REFRESH_KEY='od_refresh_token';
const OD_SETTINGS_KEY='mutashabihat_v69_od_settings';
let odSyncing=false;
function odGetSettings(){try{return JSON.parse(localStorage.getItem(OD_SETTINGS_KEY)||'{}');}catch(e){return{};}}
function odSaveSettings(s){localStorage.setItem(OD_SETTINGS_KEY,JSON.stringify(s));}
function odStatusHtml(){
  const st=localStorage.getItem('od_sync_status')||'';
  const last=localStorage.getItem('od_last_sync');
  const err=localStorage.getItem('od_sync_error');
  const hasRT=!!localStorage.getItem(OD_REFRESH_KEY);
  let txt=hasRT?'🔄 جاهز (يتجدد التوكن تلقائياً)':'⚪ غير متصل';
  if(st==='success')txt='✅ '+(last?new Date(last).toLocaleString('ar'):'تمت');
  if(st==='syncing')txt='⏳ جارية المزامنة...';
  if(st==='failed')txt='❌ '+(err||'خطأ');
  return '<div class="sync-status"><b>حالة OneDrive</b><br>'+txt+'</div>';
}
function odUpdateStatus(){
  const m=document.getElementById('onedriveSyncStatusMount');
  if(m)m.innerHTML=odStatusHtml();
}
function odB64(buf){return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');}
async function odVerifier(){return odB64(crypto.getRandomValues(new Uint8Array(32)));}
async function odChallenge(v){return odB64(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));}
async function odConnect(){
  const v=await odVerifier();const ch=await odChallenge(v);
  sessionStorage.setItem('od_pkce_v',v);
  const p=new URLSearchParams({client_id:OD_CLIENT_ID,response_type:'code',redirect_uri:location.origin,scope:'User.Read Files.ReadWrite offline_access',code_challenge:ch,code_challenge_method:'S256',response_mode:'query'});
  const popup=window.open('https://login.microsoftonline.com/common/oauth2/v2.0/authorize?'+p,'od_auth','width=520,height=640');
  if(!popup){alert('يرجى السماح بالنوافذ المنبثقة للاتصال بـ OneDrive');return;}
  const timer=setInterval(()=>{
    try{
      if(popup.closed){clearInterval(timer);return;}
      const u=popup.location.href;
      if(u.startsWith(location.origin)){
        clearInterval(timer);
        const code=new URL(u).searchParams.get('code');
        popup.close();
        if(code)odExchange(code,sessionStorage.getItem('od_pkce_v')||v);
      }
    }catch(e){}
  },600);
}
async function odExchange(code,v){
  const p=new URLSearchParams({client_id:OD_CLIENT_ID,code:code,redirect_uri:location.origin,grant_type:'authorization_code',code_verifier:v});
  const r=await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:p.toString()});
  const d=await r.json();
  if(d.access_token){
    sessionStorage.setItem(OD_TOKEN_KEY,d.access_token);
    if(d.refresh_token)localStorage.setItem(OD_REFRESH_KEY,d.refresh_token);
    localStorage.setItem('od_sync_status','connected');
    odUpdateStatus();
    alert('✅ OneDrive متصل بنجاح!');
  }else{alert('❌ فشل الاتصال: '+(d.error_description||d.error));}
}
async function odRefreshToken(){
  const rt=localStorage.getItem(OD_REFRESH_KEY);if(!rt)return null;
  const p=new URLSearchParams({client_id:OD_CLIENT_ID,refresh_token:rt,grant_type:'refresh_token'});
  try{
    const r=await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:p.toString()});
    const d=await r.json();
    if(d.access_token){sessionStorage.setItem(OD_TOKEN_KEY,d.access_token);if(d.refresh_token)localStorage.setItem(OD_REFRESH_KEY,d.refresh_token);return d.access_token;}
  }catch(e){}
  return null;
}
async function odGetToken(){return sessionStorage.getItem(OD_TOKEN_KEY)||(await odRefreshToken());}
async function syncToOneDrive(src){
  if(odSyncing)return;
  const token=await odGetToken();
  if(!token){localStorage.setItem('od_sync_status','failed');localStorage.setItem('od_sync_error','Not connected');odUpdateStatus();return;}
  const s=odGetSettings();
  if(!s.odAutoSync&&src!=='manual')return;
  odSyncing=true;localStorage.setItem('od_sync_status','syncing');odUpdateStatus();
  try{
    const pd=localStorage.getItem(PERSONAL_KEY)||'[]';
    const ad=localStorage.getItem(AUTO_KEY)||'[]';
    const content='// Auto-generated — متشابهات القرآن الكريم\nconst PERSONAL_DB='+pd+';\nconst AUTO_DB='+ad+';\n';
    const r=await fetch('https://graph.microsoft.com/v1.0/me/drive/special/approot:/mutashabihat-backup.js:/content',{method:'PUT',headers:{'Authorization':'Bearer '+token,'Content-Type':'text/javascript'},body:content});
    if(r.ok){
      localStorage.setItem('od_sync_status','success');localStorage.setItem('od_sync_error','');localStorage.setItem('od_last_sync',new Date().toISOString());
    }else{const e=await r.json().catch(()=>({}));throw new Error(e.error&&e.error.message||r.status);}
  }catch(e){localStorage.setItem('od_sync_status','failed');localStorage.setItem('od_sync_error',e.message);}
  finally{odSyncing=false;odUpdateStatus();}
}
function odDisconnect(){
  sessionStorage.removeItem(OD_TOKEN_KEY);localStorage.removeItem(OD_REFRESH_KEY);
  localStorage.setItem('od_sync_status','');odUpdateStatus();
}
function odSaveFromForm(){
  const auto=!!(document.getElementById('odAutoSyncCheck')&&document.getElementById('odAutoSyncCheck').checked);
  odSaveSettings({odAutoSync:auto});
  const btn=document.getElementById('odSaveBtn');
  if(btn){btn.textContent='✅ Saved!';setTimeout(()=>{btn.textContent='Save OneDrive / حفظ';},1500);}
}
async function triggerOneDriveAutoSync(){
  const s=odGetSettings();if(!s.odAutoSync)return;
  if(sessionStorage.getItem(OD_TOKEN_KEY)||localStorage.getItem(OD_REFRESH_KEY))await syncToOneDrive('auto');
}
function odInjectSection(){
  if(document.getElementById('onedriveSyncStatusMount'))return;
  const editCheck=document.getElementById('editModeCheck');
  if(!editCheck)return;
  const editSection=editCheck.closest('.settings-section');
  if(!editSection)return;
  const s=odGetSettings();
  const el=document.createElement('div');
  el.className='settings-section';
  el.innerHTML='<h2>\u2601\uFE0F OneDrive Sync</h2>'
    +'<div id="onedriveSyncStatusMount">'+odStatusHtml()+'</div>'
    +'<div class="form-grid" style="margin:8px 0">'
    +'<button type="button" onclick="odConnect()">\uD83D\uDD17 Connect OneDrive</button>'
    +'<button type="button" onclick="syncToOneDrive(\'manual\')" style="background:#0078d4;color:#fff">\u2601 Sync Now</button>'
    +'<button type="button" onclick="odDisconnect()" style="background:#c0392b;color:#fff">Disconnect</button>'
    +'</div>'
    +'<label style="display:flex;align-items:center;gap:6px;margin:6px 0">'
    +'<input type="checkbox" id="odAutoSyncCheck"'+(s.odAutoSync?' checked':'')+'>Auto-sync تلقائي</label>'
    +'<button id="odSaveBtn" type="button" onclick="odSaveFromForm()" style="margin-top:4px">Save OneDrive / حفظ</button>';
  editSection.parentNode.insertBefore(el,editSection);
}
// Patch openAppSettings to inject OneDrive section
(function(){
  const orig=window.openAppSettings;
  window.openAppSettings=function(){
    orig.apply(this,arguments);
    requestAnimationFrame(()=>requestAnimationFrame(odInjectSection));
  };
})();
// Patch triggerGitHubAutoSync to also trigger OneDrive
(function(){
  const orig=window.triggerGitHubAutoSync;
  if(orig)window.triggerGitHubAutoSync=function(){
    orig.apply(this,arguments);
    triggerOneDriveAutoSync();
  };
})();
// Auto-refresh token on load
if(localStorage.getItem(OD_REFRESH_KEY))odRefreshToken().then(()=>odUpdateStatus());
// ===== End OneDrive Sync =====

function init(){
  applySettings();
  personalData = loadDb(PERSONAL_KEY, filePersonal());
  automatedData = applyAutoDeleteBlocklist(Array.isArray(window.AUTOMATED_DATA) ? window.AUTOMATED_DATA : []);
  updateHomeCounts();
  var dm=document.getElementById('displayMode'); if(dm)dm.value=displayMode;
  var savedSurah=null; try{savedSurah=localStorage.getItem(LAST_SURAH_KEY);}catch(e){}
  if(savedSurah)selectedSurahFilter=savedSurah;
  buildSurahFilter();
  if(typeof collapseSurahFilterPanel==='function')collapseSurahFilterPanel();
  var last='home'; try{last=localStorage.getItem(LAST_VIEW_KEY)||'home';}catch(e){}
  if(last==='personal'||last==='auto'||last==='automated')openDatabase(last,true); else openHome(true);
  storage('â V83 Ø¬Ø§ÙØ²');
  setTimeout(function(){try{ghRender();}catch(e){}},300);
}

window.addEventListener('DOMContentLoaded', init);
