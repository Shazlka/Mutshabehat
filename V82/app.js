
/* =========================================================
 V84 PATCH — Fix Automated Surah Loader DB name
 IMPORTANT: Append this block at the VERY END of your existing V82 app.js.
 Do not replace the full app.js with this patch only.
 ========================================================= */
const RELEASE_V84_AUTO_LOADER_FIX = `Release Note — V84 Auto Loader Name Fix

Fixed:
- The app uses activeDb value "auto" for the Automated database.
- The Surah lazy loader now checks the actual database name used by your app: "auto".
- Surah filter buttons load chunks by Surah number using automated-surahs/surah-###.js.
- Automated Home count is read from automated-manifest.js.
- Automated page shows an instruction message until a Surah is selected.

Required files on GitHub:
- index.html must load automated-manifest.js before app.js.
- automated-surahs folder must be uploaded with all surah-001.js to surah-114.js.
`;

function isAutoDbV84(){ return activeDb === 'auto' || activeDb === 'automated'; }
function autoManifestV84(){ return window.AUTOMATED_MANIFEST || {totalGroups:0, surahs:[]}; }
function autoTotalCountV84(){ return Number(autoManifestV84().totalGroups || 0); }
function autoManifestItemByNoV84(no){ return (autoManifestV84().surahs || []).find(x => Number(x.no) === Number(no)); }
function autoManifestItemByNameV84(name){ return (autoManifestV84().surahs || []).find(x => normalize(x.name) === normalize(name)); }
function autoScriptLoadedV84(src){ return Array.from(document.querySelectorAll('script[data-auto-src-v84]')).some(s => s.dataset.autoSrcV84 === src); }
function loadScriptOnceV84(src){
  return new Promise((resolve, reject) => {
    if (autoScriptLoadedV84(src)) return resolve();
    let el = document.createElement('script');
    el.src = src + (src.includes('?') ? '&' : '?') + 'v=v84_auto_loader_fix';
    el.async = true;
    el.dataset.autoSrcV84 = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('Cannot load ' + src));
    document.head.appendChild(el);
  });
}
function dedupeGroupsV84(list){
  let seen = new Set();
  return (list || []).filter(g => {
    let key = safeText(g.id) || (safeText(g.title) + '|' + safeText((g.verses || []).map(v => v.surah + ':' + v.ayah).join(',')));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
async function loadAutomatedSurahNo(no){
  if (!isAutoDbV84() || !no) return;
  window.AUTOMATED_SURAH_DATA_BY_NO = window.AUTOMATED_SURAH_DATA_BY_NO || {};
  let item = autoManifestItemByNoV84(no);
  if (!item) {
    storage('لا يوجد ملف لهذه السورة في automated-manifest.js');
    return;
  }
  if (!window.AUTOMATED_SURAH_DATA_BY_NO[no]) {
    try {
      storage('تحميل ' + item.name + ' ...');
      await loadScriptOnceV84(item.file);
    } catch (e) {
      console.error('V84 Surah chunk load failed:', e);
      storage('فشل تحميل ملف السورة: ' + item.file);
      let box = document.getElementById('groups');
      if (box) box.innerHTML = '<div class="hint"><b>لم يتم تحميل ملف السورة.</b><br>تأكد أن مجلد <code>automated-surahs</code> مرفوع بجانب index.html وأن الملف موجود:<br><code>' + escapeHtml(item.file) + '</code></div>';
      return;
    }
  }
  let chunk = window.AUTOMATED_SURAH_DATA_BY_NO[no] || [];
  automatedData = dedupeGroupsV84([...(automatedData || []), ...chunk]);
  activeData = automatedData;
  storage('✓ تم تحميل ' + item.name + ' - ' + chunk.length + ' مجموعة');
}
async function filterBySurahNo(no){
  let item = autoManifestItemByNoV84(no) || {no:no, name:(surahNames() || {})[no] || String(no)};
  selectedSurahFilter = item.name;
  let fs = document.getElementById('filterStatus');
  if (fs) fs.textContent = 'المعروض الآن: ' + item.name + (isAutoDbV84() ? ' - جاري التحميل...' : '');
  if (isAutoDbV84()) await loadAutomatedSurahNo(no);
  if (fs) fs.textContent = 'المعروض الآن: ' + item.name;
  renderActiveGroups();
}
async function filterBySurah(s){
  let item = autoManifestItemByNameV84(s);
  if (item) return filterBySurahNo(item.no);
  selectedSurahFilter = s;
  let fs = document.getElementById('filterStatus');
  if (fs) fs.textContent = 'المعروض الآن: ' + s;
  renderActiveGroups();
}
function automatedPromptHtmlV84(){
  return '<div class="hint"><b>قاعدة المتشابهات الآلية جاهزة للتحميل حسب السورة.</b><br>افتح الفلتر واختر سورة ليتم تحميل ملفها فقط من <code>automated-surahs</code>.</div>';
}
function updateHomeCounts(){
  let p = document.getElementById('personalCountHome'), a = document.getElementById('autoCountHome');
  if (p) p.textContent = personalData.length + ' مجموعة';
  if (a) a.textContent = (autoTotalCountV84() || automatedData.length) + ' مجموعة';
}
async function openDatabase(w, skipSave){
  activeDb = (w === 'personal') ? 'personal' : 'auto';
  activeData = activeDb === 'personal' ? personalData : automatedData;
  if (!skipSave && typeof localStorage !== 'undefined') localStorage.setItem((typeof LAST_VIEW_KEY_V78 !== 'undefined' ? LAST_VIEW_KEY_V78 : 'mutashabihat_v78_last_view'), activeDb);
  document.getElementById('home').classList.add('hidden');
  document.getElementById('workspace').classList.remove('hidden');
  document.getElementById('dbTitle').textContent = activeDb === 'personal' ? 'المتشابهات الشخصية' : 'المتشابهات الآلية';
  document.getElementById('dbSubTitle').textContent = activeDb === 'personal' ? 'قابلة للإضافة والتعديل والحذف' : 'تحميل سريع: اختر سورة من الفلتر ليتم تحميل ملفها فقط';
  if (activeDb === 'auto' && selectedSurahFilter) await loadAutomatedSurahNo(getSurahNo(selectedSurahFilter));
  renderActiveGroups();
  buildSurahFilter();
  if (typeof collapseSurahFilterPanel === 'function') collapseSurahFilterPanel();
}
function surahCounts(data = activeData){
  if (isAutoDbV84() && window.AUTOMATED_MANIFEST) {
    let m = {};
    (autoManifestV84().surahs || []).forEach(x => m[x.name] = x.count || 0);
    return m;
  }
  let m = {};
  (data || []).forEach(g => getTags(g).forEach(s => m[s] = (m[s] || 0) + 1));
  return m;
}
function clearSurahFilter(){
  selectedSurahFilter = null;
  try { localStorage.removeItem((typeof LAST_SURAH_KEY_V78 !== 'undefined' ? LAST_SURAH_KEY_V78 : 'mutashabihat_v78_last_surah')); } catch(e) {}
  let fs = document.getElementById('filterStatus');
  if (fs) fs.textContent = isAutoDbV84() ? 'اختر سورة لتحميلها فقط' : 'المعروض الآن: كل السور';
  renderActiveGroups();
}
function renderActiveGroups(){
  if (!activeDb) return;
  if (isAutoDbV84() && !selectedSurahFilter) {
    let counter = document.getElementById('counter');
    if (counter) counter.textContent = 'اختر سورة لتحميل بياناتها فقط';
    renderChips(0);
    renderSurahIndex([]);
    let groupsBox = document.getElementById('groups');
    if (groupsBox) groupsBox.innerHTML = automatedPromptHtmlV84();
    updateToggleAllButton();
    buildSurahFilter();
    return;
  }
  let list = sortGroups(activeData.filter(passFilters));
  let counter = document.getElementById('counter');
  if (counter) counter.textContent = 'عدد النتائج: ' + list.length;
  renderChips(list.length);
  renderSurahIndex(list);
  document.getElementById('groups').innerHTML = list.length ? (displayMode === 'group-surah' ? renderGrouped(list) : list.map(renderCard).join('')) : '<div class="hint">لا توجد نتائج</div>';
  updateToggleAllButton();
  buildSurahFilter();
}
function pill(i){
  return `<button class="surah-pill ${selectedSurahFilter===i.name?'active':''} ${!i.count?'no-match':''}" onclick="filterBySurahNo(${i.no})"><span class="no-badge">${i.no}</span><span>${escapeHtml(i.name)}</span><span class="count-badge">${i.count}</span></button>`;
}
function init(){
  applySettings();
  personalData = loadDb(PERSONAL_KEY, filePersonal());
  automatedData = Array.isArray(window.AUTOMATED_DATA) ? window.AUTOMATED_DATA : [];
  updateHomeCounts();
  let dm = document.getElementById('displayMode');
  if (dm) dm.value = displayMode;
  let savedSurah = null;
  try { savedSurah = localStorage.getItem((typeof LAST_SURAH_KEY_V78 !== 'undefined' ? LAST_SURAH_KEY_V78 : 'mutashabihat_v78_last_surah')); } catch(e) {}
  if (savedSurah) selectedSurahFilter = savedSurah;
  buildSurahFilter();
  if (typeof collapseSurahFilterPanel === 'function') collapseSurahFilterPanel();
  let last = 'home';
  try { last = localStorage.getItem((typeof LAST_VIEW_KEY_V78 !== 'undefined' ? LAST_VIEW_KEY_V78 : 'mutashabihat_v78_last_view')) || 'home'; } catch(e) {}
  if (last === 'personal' || last === 'auto' || last === 'automated') openDatabase(last, true); else openHome(true);
  storage('✓ V84 جاهز - Auto loader fixed');
}
function openReleaseNotes(){
  modal('releaseModal','Release Notes — V84',`<div class="release-content">${escapeHtml(RELEASE_V84_AUTO_LOADER_FIX)}</div>`,`<button onclick="navigator.clipboard?.writeText(RELEASE_V84_AUTO_LOADER_FIX)">نسخ</button><button onclick="closeModal('releaseModal')">إغلاق</button>`)
}
