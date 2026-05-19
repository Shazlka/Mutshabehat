function init(){applySettings();personalData=loadDb(PERSONAL_KEY,filePersonal());automatedData=fileAuto();updateHomeCounts();document.getElementById('displayMode').value=displayMode;openHome();buildSurahFilter();storage('✓ V82 جاهز - التحميل حسب السورة')}

window.addEventListener('DOMContentLoaded',init);

function resetDualDbCacheV68(){if(confirm('مسح كاش V70 وإعادة التحميل من الملفات؟')){localStorage.removeItem(PERSONAL_KEY);localStorage.removeItem(AUTO_KEY);location.reload()}}

function openHome(){document.getElementById('home').classList.remove('hidden');document.getElementById('workspace').classList.add('hidden');activeDb=null;updateHomeCounts()}

function updateHomeCounts(){let p=document.getElementById('personalCountHome'),a=document.getElementById('autoCountHome');if(p)p.textContent=personalData.length+' مجموعة';if(a)a.textContent=(autoTotalCount()||automatedData.length)+' مجموعة (تحميل حسب السورة)'}

async function openDatabase(w){activeDb=w;activeData=w==='personal'?personalData:automatedData;document.getElementById('home').classList.add('hidden');document.getElementById('workspace').classList.remove('hidden');document.getElementById('dbTitle').textContent=w==='personal'?'المتشابهات الشخصية':'المتشابهات الآلية';document.getElementById('dbSubTitle').textContent=w==='personal'?'قابلة للإضافة والتعديل والحذف':'تحميل سريع: اختر سورة ليتم تحميل ملفها فقط';if(w==='automated'&&selectedSurahFilter)await loadAutomatedSurahNo(getSurahNo(selectedSurahFilter));renderActiveGroups();buildSurahFilter()}

function init(){applySettings();personalData=loadDb(PERSONAL_KEY,filePersonal());automatedData=loadDb(AUTO_KEY,fileAuto());updateHomeCounts();let dm=document.getElementById('displayMode');if(dm)dm.value=displayMode;let savedSurah=localStorage.getItem(LAST_SURAH_KEY_V78);if(savedSurah)selectedSurahFilter=savedSurah;buildSurahFilter();collapseSurahFilterPanel();let last=localStorage.getItem(LAST_VIEW_KEY_V78)||'home';if(last==='personal'||last==='auto')openDatabase(last,true);else openHome(true);storage('✓ V78 جاهز')}

function openHome(skipSave){document.getElementById('home').classList.remove('hidden');document.getElementById('workspace').classList.add('hidden');activeDb=null;if(!skipSave)localStorage.setItem(LAST_VIEW_KEY_V78,'home');updateHomeCounts()}

function openDatabase(w,skipSave){activeDb=w;activeData=w==='personal'?personalData:automatedData;if(!skipSave)localStorage.setItem(LAST_VIEW_KEY_V78,w);document.getElementById('home').classList.add('hidden');document.getElementById('workspace').classList.remove('hidden');document.getElementById('dbTitle').textContent=w==='personal'?'المتشابهات الشخصية':'المتشابهات الآلية';document.getElementById('dbSubTitle').textContent=w==='personal'?'قابلة للإضافة والتعديل والحذف':'للمراجعة والنسخ للشخصية فقط';renderActiveGroups();buildSurahFilter();collapseSurahFilterPanel();if(selectedSurahFilter){let fs=document.getElementById('filterStatus');if(fs)fs.textContent='المعروض الآن: '+selectedSurahFilter}}

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

async function openDatabase(w,skipSave){if(activeDb)saveFiltersV85(activeDb);activeDb=(w==='personal')?'personal':'auto';activeData=activeDb==='personal'?personalData:automatedData;displayMode=getSortMethodV85(activeDb);applyFiltersV85(activeDb);if(!skipSave&&typeof localStorage!=='undefined')localStorage.setItem((typeof LAST_VIEW_KEY_V78!=='undefined'?LAST_VIEW_KEY_V78:'mutashabihat_v78_last_view'),activeDb);document.getElementById('home').classList.add('hidden');document.getElementById('workspace').classList.remove('hidden');document.getElementById('dbTitle').textContent=activeDb==='personal'?'المتشابهات الشخصية':'المتشابهات الآلية';document.getElementById('dbSubTitle').textContent=activeDb==='personal'?'قابلة للإضافة والتعديل والحذف':'تحميل سريع: اختر سورة من الفلتر ليتم تحميل ملفها فقط';let dm=document.getElementById('displayMode');if(dm)dm.value=displayMode;if(activeDb==='auto'&&selectedSurahFilter)await loadAutomatedSurahNo(getSurahNo(selectedSurahFilter));renderActiveGroups();buildSurahFilter();if(typeof collapseSurahFilterPanel==='function')collapseSurahFilterPanel()}

function openHome(skipSave){if(activeDb)saveFiltersV85(activeDb);document.getElementById('home').classList.remove('hidden');document.getElementById('workspace').classList.add('hidden');activeDb=null;if(!skipSave)localStorage.setItem((typeof LAST_VIEW_KEY_V78!=='undefined'?LAST_VIEW_KEY_V78:'mutashabihat_v78_last_view'),'home');updateHomeCounts()}

function init(){applySettings();personalData=loadDb(PERSONAL_KEY,filePersonal());automatedData=Array.isArray(window.AUTOMATED_DATA)?window.AUTOMATED_DATA:[];updateHomeCounts();buildSurahFilter();if(typeof collapseSurahFilterPanel==='function')collapseSurahFilterPanel();let last='home';try{last=localStorage.getItem((typeof LAST_VIEW_KEY_V78!=='undefined'?LAST_VIEW_KEY_V78:'mutashabihat_v78_last_view'))||'home'}catch(e){}if(last==='personal'||last==='auto'||last==='automated')openDatabase(last,true);else openHome(true);storage('✓ V85 جاهز - فرز وفلاتر مستقلة')}
