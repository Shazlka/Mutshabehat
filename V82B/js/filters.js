/* =========================================================
 V85 — Independent Sorting + Filters per Database
 IMPORTANT: This patch is appended at the end to preserve all existing V70–V84 features.
 ========================================================= */
const PERSONAL_SORT_KEY_V85='personalSortMethod', AUTOMATED_SORT_KEY_V85='automatedSortMethod', PERSONAL_FILTERS_KEY_V85='personalFilters', AUTOMATED_FILTERS_KEY_V85='automatedFilters', LEGACY_DISPLAY_KEY_V85='mutashabihat_v69_display_mode';

async function filterBySurahNo(no){let item=autoManifestItemByNo(no)||{name:(surahNames()||{})[no],no:no};selectedSurahFilter=item.name;document.getElementById('filterStatus').textContent='المعروض الآن: '+item.name+(activeDb==='automated'?' - جاري التحميل...':'');if(activeDb==='automated')await loadAutomatedSurahNo(no);document.getElementById('filterStatus').textContent='المعروض الآن: '+item.name;renderActiveGroups()}

function setDisplayMode(v){displayMode=v;localStorage.setItem('mutashabihat_v69_display_mode',v);renderActiveGroups()}

function clearSearch(){document.getElementById('searchInput').value='';renderActiveGroups()}

function getTags(g){let a=Array.isArray(g.surahs)?g.surahs.filter(Boolean):[];if(!a.length&&Array.isArray(g.verses))a=[...new Set(g.verses.map(v=>v.surah).filter(Boolean))];return a}

function groupText(g){return [g.title,g.note,g.unote,g.candidateKind,g.candidateScore,g.sharedPhrase,...getTags(g),...(g.verses||[]).flatMap(v=>[v.surah,v.ayah,v.label,...(v.parts||[]).map(p=>p.text)])].join(' ')}

function passStatus(g,s){s=s||'all';if(s==='favorite')return isTrue(g.favorite);if(s==='completed')return isTrue(g.completed);if(s==='notCompleted')return !isTrue(g.completed);if(s==='locked')return isTrue(g.locked);if(s==='autoCandidate')return isTrue(g.autoCandidate);return true}

function passFilters(g){let q=normalize(document.getElementById('searchInput')?.value||'');let st=document.getElementById('statusFilter')?.value||'all';if(q&&!normalize(groupText(g)).includes(q))return false;if(!passStatus(g,st)||!passStatus(g,advancedFilters.status))return false;if(selectedSurahFilter&&!getTags(g).includes(selectedSurahFilter))return false;if(advancedFilters.kind&&safeText(g.candidateKind)!==advancedFilters.kind)return false;if(advancedFilters.minScore&&Number(g.candidateScore||0)<Number(advancedFilters.minScore))return false;if(advancedFilters.surah&&!getTags(g).some(s=>normalize(s).includes(normalize(advancedFilters.surah))))return false;return true}

function sortGroups(a){a=a.slice();let fs=g=>Math.min(...getTags(g).map(getSurahNo),9999),fa=g=>Math.min(...(g.verses||[]).map(v=>Number(v.ayah)||9999),9999);if(displayMode==='sort-surah'||displayMode==='group-surah')a.sort((x,y)=>fs(x)-fs(y)||fa(x)-fa(y)||(Number(x.id)||0)-(Number(y.id)||0));if(displayMode==='newest')a.sort((x,y)=>(Number(y.id)||0)-(Number(x.id)||0));if(displayMode==='most-verses')a.sort((x,y)=>(y.verses||[]).length-(x.verses||[]).length);return a}

function surahCounts(data=activeData){if(activeDb==='automated'&&window.AUTOMATED_MANIFEST){let m={};(autoManifest().surahs||[]).forEach(x=>m[x.name]=x.count||0);return m}let m={};(data||[]).forEach(g=>getTags(g).forEach(s=>m[s]=(m[s]||0)+1));return m}

function buildSurahFilter(){renderSurahFilter()}

function rangeBounds(){if(surahRange==='1-30')return[1,30];if(surahRange==='31-60')return[31,60];if(surahRange==='61-90')return[61,90];if(surahRange==='91-114')return[91,114];return[1,114]}

function toggleSurahFilterPanel(){let p=document.getElementById('surahFilterPanel'),b=document.getElementById('surahFilterToggleBtn');p.classList.toggle('hidden');b.textContent=p.classList.contains('hidden')?'فتح الفلتر ▾':'إغلاق الفلتر ▴'}

function toggleOnlyWithResults(){onlyWithResults=!onlyWithResults;document.getElementById('onlyResultsBtn').classList.toggle('active',onlyWithResults);renderSurahFilter()}

function setSurahRange(r){surahRange=r;document.querySelectorAll('.range-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.range===r));renderSurahFilter()}

async function filterBySurah(s){let item=autoManifestItemByName(s);if(item)return filterBySurahNo(item.no);selectedSurahFilter=s;document.getElementById('filterStatus').textContent='المعروض الآن: '+s;renderActiveGroups()}

function clearSurahFilter(){selectedSurahFilter=null;document.getElementById('filterStatus').textContent=activeDb==='automated'?'اختر سورة لتحميلها فقط':'المعروض الآن: كل السور';renderActiveGroups()}

function renderSurahFilter(){let grid=document.getElementById('surahFilterGrid'),top=document.getElementById('topSurahGrid');if(!grid)return;let names=surahNames(),counts=surahCounts(activeData.length?activeData:personalData),q=normalize(document.getElementById('surahFilterSearch')?.value||''),[a,b]=rangeBounds();let items=Object.keys(names).map(no=>({no:+no,name:names[no],count:counts[names[no]]||0}));let visible=items.filter(i=>i.no>=a&&i.no<=b&&(!onlyWithResults||i.count>0||i.name===selectedSurahFilter)&&(!q||String(i.no).includes(q)||normalize(i.name).includes(q)));grid.innerHTML=visible.map(pill).join('')||'<div class="hint">لا توجد سور مطابقة</div>';top.innerHTML=items.filter(i=>i.count>0).sort((x,y)=>y.count-x.count).slice(0,8).map(pill).join('');document.getElementById('surahCountLine').textContent=`كل السور المعروض: ${visible.length} من 114 سورة`}

function pill(i){return `<button class="surah-pill ${selectedSurahFilter===i.name?'active':''} ${!i.count?'no-match':''}" onclick="filterBySurahNo(${i.no})"><span class="no-badge">${i.no}</span><span>${escapeHtml(i.name)}</span><span class="count-badge">${i.count}</span></button>`}

function filterBySurah(s){selectedSurahFilter=s;localStorage.setItem(LAST_SURAH_KEY_V78,s);document.getElementById('filterStatus').textContent='المعروض الآن: '+s;renderActiveGroups()}

function clearSurahFilter(){selectedSurahFilter=null;localStorage.removeItem(LAST_SURAH_KEY_V78);document.getElementById('filterStatus').textContent='المعروض الآن: كل السور';renderActiveGroups()}

function buildSurahFilter(){renderSurahFilter();collapseSurahFilterPanel()}

function collapseSurahFilterPanel(){
  let p=document.getElementById('surahFilterPanel'),b=document.getElementById('surahFilterToggleBtn');
  if(p)p.classList.add('hidden');
  if(b)b.textContent='فتح الفلتر ▾';
  let db=document.querySelector('.dashboard-body');
  if(db)db.classList.remove('filter-open');
}

function toggleSurahFilterPanel(){
  let p=document.getElementById('surahFilterPanel'),b=document.getElementById('surahFilterToggleBtn');
  if(!p||!b)return;
  p.classList.toggle('hidden');
  b.textContent=p.classList.contains('hidden')?'فتح الفلتر ▾':'إغلاق الفلتر ▴';
  let db=document.querySelector('.dashboard-body');
  if(db)db.classList.toggle('filter-open',!p.classList.contains('hidden'));
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

function pill(i){
  return `<button class="surah-pill ${selectedSurahFilter===i.name?'active':''} ${!i.count?'no-match':''}" onclick="filterBySurahNo(${i.no})"><span class="no-badge">${i.no}</span><span>${escapeHtml(i.name)}</span><span class="count-badge">${i.count}</span></button>`;
}

function dbNameV85(db){db=db||activeDb;return db==='personal'?'personal':'auto'}

function sortKeyV85(db){return dbNameV85(db)==='personal'?PERSONAL_SORT_KEY_V85:AUTOMATED_SORT_KEY_V85}

function filtersKeyV85(db){return dbNameV85(db)==='personal'?PERSONAL_FILTERS_KEY_V85:AUTOMATED_FILTERS_KEY_V85}

function validSortV85(v){return ['original','sort-surah','group-surah','newest','most-verses'].includes(v)?v:'original'}

function getSortMethodV85(db){let saved=null;try{saved=localStorage.getItem(sortKeyV85(db))}catch(e){}if(!saved&&dbNameV85(db)==='personal'){try{saved=localStorage.getItem(LEGACY_DISPLAY_KEY_V85)}catch(e){}}return validSortV85(saved||'original')}

function saveSortMethodV85(db,value){value=validSortV85(value);try{localStorage.setItem(sortKeyV85(db),value)}catch(e){}if(dbNameV85(db)==='personal'){try{localStorage.setItem(LEGACY_DISPLAY_KEY_V85,value)}catch(e){}}}

function defaultAdvancedFiltersV85(){return {status:'all',kind:'',minScore:'',surah:''}}

function defaultFiltersV85(){return {selectedSurahFilter:null,onlyWithResults:true,surahRange:'all',advancedFilters:defaultAdvancedFiltersV85(),search:'',surahSearch:''}}

function normalizeFiltersV85(f){let d=defaultFiltersV85();f=(f&&typeof f==='object')?f:{};let af=(f.advancedFilters&&typeof f.advancedFilters==='object')?f.advancedFilters:{};return {selectedSurahFilter:f.selectedSurahFilter||null,onlyWithResults:typeof f.onlyWithResults==='boolean'?f.onlyWithResults:d.onlyWithResults,surahRange:['all','1-30','31-60','61-90','91-114'].includes(f.surahRange)?f.surahRange:d.surahRange,advancedFilters:{status:af.status||'all',kind:af.kind||'',minScore:af.minScore||'',surah:af.surah||''},search:safeText(f.search||''),surahSearch:safeText(f.surahSearch||'')}}

function getFiltersV85(db){try{return normalizeFiltersV85(JSON.parse(localStorage.getItem(filtersKeyV85(db))||'null'))}catch(e){return defaultFiltersV85()}}

function saveFiltersV85(db){db=dbNameV85(db);let filters=normalizeFiltersV85({selectedSurahFilter,onlyWithResults,surahRange,advancedFilters,search:document.getElementById('searchInput')?.value||'',surahSearch:document.getElementById('surahFilterSearch')?.value||''});try{localStorage.setItem(filtersKeyV85(db),JSON.stringify(filters))}catch(e){}}

function applyFiltersV85(db){let f=getFiltersV85(db);selectedSurahFilter=f.selectedSurahFilter;onlyWithResults=f.onlyWithResults;surahRange=f.surahRange;advancedFilters=f.advancedFilters;let si=document.getElementById('searchInput');if(si)si.value=f.search;let sf=document.getElementById('surahFilterSearch');if(sf)sf.value=f.surahSearch;let onlyBtn=document.getElementById('onlyResultsBtn');if(onlyBtn)onlyBtn.classList.toggle('active',onlyWithResults);document.querySelectorAll('.range-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.range===surahRange));let dm=document.getElementById('displayMode');if(dm)dm.value=displayMode;let fs=document.getElementById('filterStatus');if(fs)fs.textContent=selectedSurahFilter?('المعروض الآن: '+selectedSurahFilter):(dbNameV85(db)==='auto'?'اختر سورة لتحميلها فقط':'المعروض الآن: كل السور')}

function setDisplayMode(v){displayMode=validSortV85(v);saveSortMethodV85(activeDb||'personal',displayMode);renderActiveGroups()}

function clearSearch(){let si=document.getElementById('searchInput');if(si)si.value='';saveFiltersV85(activeDb);renderActiveGroups()}

function toggleOnlyWithResults(){onlyWithResults=!onlyWithResults;let btn=document.getElementById('onlyResultsBtn');if(btn)btn.classList.toggle('active',onlyWithResults);saveFiltersV85(activeDb);renderSurahFilter()}

function setSurahRange(r){surahRange=['all','1-30','31-60','61-90','91-114'].includes(r)?r:'all';document.querySelectorAll('.range-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.range===surahRange));saveFiltersV85(activeDb);renderSurahFilter()}

async function filterBySurahNo(no){let item=(typeof autoManifestItemByNoV84==='function'?autoManifestItemByNoV84(no):null)||{no:no,name:(surahNames()||{})[no]||String(no)};selectedSurahFilter=item.name;let fs=document.getElementById('filterStatus');if(fs)fs.textContent='المعروض الآن: '+item.name+((typeof isAutoDbV84==='function'&&isAutoDbV84())?' - جاري التحميل...':'');saveFiltersV85(activeDb);if(typeof isAutoDbV84==='function'&&isAutoDbV84())await loadAutomatedSurahNo(no);if(fs)fs.textContent='المعروض الآن: '+item.name;saveFiltersV85(activeDb);renderActiveGroups()}

async function filterBySurah(s){let item=(typeof autoManifestItemByNameV84==='function')?autoManifestItemByNameV84(s):null;if(item)return filterBySurahNo(item.no);selectedSurahFilter=s;let fs=document.getElementById('filterStatus');if(fs)fs.textContent='المعروض الآن: '+s;saveFiltersV85(activeDb);renderActiveGroups()}

function clearSurahFilter(){selectedSurahFilter=null;let fs=document.getElementById('filterStatus');if(fs)fs.textContent=(typeof isAutoDbV84==='function'&&isAutoDbV84())?'اختر سورة لتحميلها فقط':'المعروض الآن: كل السور';saveFiltersV85(activeDb);renderActiveGroups()}

function resetCurrentFiltersV85(){let db=dbNameV85(activeDb);try{localStorage.removeItem(filtersKeyV85(db))}catch(e){}selectedSurahFilter=null;onlyWithResults=true;surahRange='all';advancedFilters=defaultAdvancedFiltersV85();let si=document.getElementById('searchInput');if(si)si.value='';let sf=document.getElementById('surahFilterSearch');if(sf)sf.value='';applyFiltersV85(db);renderActiveGroups()}
