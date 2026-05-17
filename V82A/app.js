
/* V82 fixed automated-surahs lazy loader by Surah number */
const PERSONAL_KEY='mutashabihat_v69_personal_db';
const AUTO_KEY='mutashabihat_v69_auto_db';
const SETTINGS_KEY='mutashabihat_v69_settings';
let personalData=[], automatedData=[], activeDb=null, activeData=[];
let draftVerses=[], editGroupId=null, editVersesBuffer=[], selectedSurahFilter=null;
let editMode=localStorage.getItem('mutashabihat_v69_edit_mode')==='true';
let displayMode=localStorage.getItem('mutashabihat_v69_display_mode')||'original';
let editQuranSelectionMode='full';
let onlyWithResults=true, surahRange='all', advancedFilters={status:'all',kind:'',minScore:'',surah:''};
function safeText(v){return v===undefined||v===null?'':String(v)}
function escapeHtml(v){return safeText(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}
function normalize(v){return safeText(v).toLowerCase().replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g,'').replace(/[إأآٱا]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/ـ/g,'').replace(/\s+/g,' ').trim()}

function normalizeQuranSearchText(v){return safeText(v).toLowerCase()
  .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g,'')
  .replace(/[إأآٱا]/g,'ا').replace(/[ؤ]/g,'و').replace(/[ئ]/g,'ي')
  .replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ـ/g,'').replace(/\s+/g,' ').trim()}
function getSelectedTextareaText(id){let el=document.getElementById(id);if(!el)return '';let a=el.selectionStart||0,b=el.selectionEnd||0;return (a!==b)?el.value.substring(a,b):''}
function addQuranVerseObject(target, surah, ayah, text, type){let obj={surah:safeText(surah),ayah:safeText(ayah),label:'',parts:[{type:type||'shared',text:safeText(text)}]};if(target==='edit'){editVersesBuffer.push(obj);renderEditVerses();setTimeout(()=>document.getElementById('editVerses')?.lastElementChild?.scrollIntoView({behavior:'smooth',block:'center'}),50)}else{draftVerses.push(obj);renderDraft()}}
function removeQuranVerseObject(target, surah, ayah){let arr=target==='edit'?editVersesBuffer:draftVerses;let idx=arr.findIndex(v=>safeText(v.surah)===safeText(surah)&&safeText(v.ayah)===safeText(ayah));if(idx>=0){arr.splice(idx,1);target==='edit'?renderEditVerses():renderDraft();return true}return false}
function quranItemExists(target, surah, ayah){let arr=target==='edit'?editVersesBuffer:draftVerses;return arr.some(v=>safeText(v.surah)===safeText(surah)&&safeText(v.ayah)===safeText(ayah))}
function quranResultText(prefix, i, fullText){let sel=getSelectedTextareaText(prefix+'QText_'+i);return sel||safeText(fullText)}

function clone(v){return JSON.parse(JSON.stringify(v||[]))}function isTrue(v){return v===true||v==='true'||v===1||v==='1'}
function filePersonal(){return Array.isArray(window.PERSONAL_DATA)?window.PERSONAL_DATA:[]}function fileAuto(){return Array.isArray(window.AUTOMATED_DATA)?window.AUTOMATED_DATA:[]}
function loadDb(k,f){try{let s=JSON.parse(localStorage.getItem(k)||'null');if(Array.isArray(s)&&s.length)return s}catch(e){}return clone(f)}
function saveDb(w){if(w==='automated'){storage('قاعدة الآلي مجزأة حسب السورة ولا تحفظ في localStorage');return}localStorage.setItem(PERSONAL_KEY,JSON.stringify(personalData));storage('✓ محفوظ')}
function storage(t){let b=document.getElementById('storageBadge');if(b)b.textContent=t}
function autoManifest(){return window.AUTOMATED_MANIFEST||{totalGroups:0,surahs:[]}}
function autoTotalCount(){return Number(autoManifest().totalGroups||0)}
function autoManifestItemByNo(no){return (autoManifest().surahs||[]).find(x=>Number(x.no)===Number(no))}
function autoManifestItemByName(name){return (autoManifest().surahs||[]).find(x=>normalize(x.name)===normalize(name))}
function currentSurahNo(){return selectedSurahFilter?getSurahNo(selectedSurahFilter):null}
function scriptLoaded(src){return Array.from(document.querySelectorAll('script[data-auto-src]')).some(s=>s.dataset.autoSrc===src)}
function loadScriptOnce(src){return new Promise((resolve,reject)=>{if(scriptLoaded(src))return resolve();let el=document.createElement('script');el.src=src+(src.includes('?')?'&':'?')+'v=v82_fix_loader';el.async=true;el.dataset.autoSrc=src;el.onload=()=>resolve();el.onerror=()=>reject(new Error(src));document.head.appendChild(el)})}
function dedupeGroups(list){let seen=new Set();return (list||[]).filter(g=>{let key=safeText(g.id)||safeText(g.title)+'|'+safeText((g.verses||[]).map(v=>v.surah+':'+v.ayah).join(','));if(seen.has(key))return false;seen.add(key);return true})}
async function loadAutomatedSurahNo(no){
  if(activeDb!=='automated'||!no)return;
  window.AUTOMATED_SURAH_DATA_BY_NO=window.AUTOMATED_SURAH_DATA_BY_NO||{};
  let item=autoManifestItemByNo(no);
  if(!item){storage('لا يوجد ملف لهذه السورة في manifest');return;}
  if(!window.AUTOMATED_SURAH_DATA_BY_NO[no]){
    try{storage('تحميل '+item.name+' ...');await loadScriptOnce(item.file)}
    catch(e){storage('فشل تحميل ملف السورة: '+item.file);document.getElementById('groups').innerHTML='<div class="hint error">لم يتم تحميل ملف السورة. تأكد أن مجلد automated-surahs مرفوع بالكامل على GitHub وأن المسار صحيح:<br><code>'+escapeHtml(item.file)+'</code></div>';return;}
  }
  let chunk=window.AUTOMATED_SURAH_DATA_BY_NO[no]||[];
  automatedData=dedupeGroups([...(automatedData||[]),...chunk]);
  activeData=automatedData;
  storage('✓ تم تحميل '+item.name+' - '+chunk.length+' مجموعة');
}
async function filterBySurahNo(no){let item=autoManifestItemByNo(no)||{name:(surahNames()||{})[no],no:no};selectedSurahFilter=item.name;document.getElementById('filterStatus').textContent='المعروض الآن: '+item.name+(activeDb==='automated'?' - جاري التحميل...':'');if(activeDb==='automated')await loadAutomatedSurahNo(no);document.getElementById('filterStatus').textContent='المعروض الآن: '+item.name;renderActiveGroups()}
function automatedPromptHtml(){return '<div class="hint"><b>قاعدة المتشابهات الآلية مجزأة حسب السورة.</b><br>اختر سورة من فلتر السور، وسيتم تحميل ملف هذه السورة فقط من مجلد <code>automated-surahs</code>.</div>'}

function init(){applySettings();personalData=loadDb(PERSONAL_KEY,filePersonal());automatedData=fileAuto();updateHomeCounts();document.getElementById('displayMode').value=displayMode;openHome();buildSurahFilter();storage('✓ V82 جاهز - التحميل حسب السورة')}
window.addEventListener('DOMContentLoaded',init);
function resetDualDbCacheV68(){if(confirm('مسح كاش V70 وإعادة التحميل من الملفات؟')){localStorage.removeItem(PERSONAL_KEY);localStorage.removeItem(AUTO_KEY);location.reload()}}
function openHome(){document.getElementById('home').classList.remove('hidden');document.getElementById('workspace').classList.add('hidden');activeDb=null;updateHomeCounts()}
function updateHomeCounts(){let p=document.getElementById('personalCountHome'),a=document.getElementById('autoCountHome');if(p)p.textContent=personalData.length+' مجموعة';if(a)a.textContent=(autoTotalCount()||automatedData.length)+' مجموعة (تحميل حسب السورة)'}
async function openDatabase(w){activeDb=w;activeData=w==='personal'?personalData:automatedData;document.getElementById('home').classList.add('hidden');document.getElementById('workspace').classList.remove('hidden');document.getElementById('dbTitle').textContent=w==='personal'?'المتشابهات الشخصية':'المتشابهات الآلية';document.getElementById('dbSubTitle').textContent=w==='personal'?'قابلة للإضافة والتعديل والحذف':'تحميل سريع: اختر سورة ليتم تحميل ملفها فقط';if(w==='automated'&&selectedSurahFilter)await loadAutomatedSurahNo(getSurahNo(selectedSurahFilter));renderActiveGroups();buildSurahFilter()}
function setDisplayMode(v){displayMode=v;localStorage.setItem('mutashabihat_v69_display_mode',v);renderActiveGroups()}
function clearSearch(){document.getElementById('searchInput').value='';renderActiveGroups()}
function surahNames(){return typeof SURAH_NAMES!=='undefined'?SURAH_NAMES:{1:'الفاتحة',2:'البقرة',3:'آل عمران',4:'النساء',5:'المائدة',6:'الأنعام',7:'الأعراف',8:'الأنفال',9:'التوبة',10:'يونس',11:'هود',12:'يوسف',13:'الرعد',14:'إبراهيم',15:'الحجر',16:'النحل',17:'الإسراء',18:'الكهف',19:'مريم',20:'طه',21:'الأنبياء',22:'الحج',23:'المؤمنون',24:'النور',25:'الفرقان',26:'الشعراء',27:'النمل',28:'القصص',29:'العنكبوت',30:'الروم',31:'لقمان',32:'السجدة',33:'الأحزاب',34:'سبأ',35:'فاطر',36:'يس',37:'الصافات',38:'ص',39:'الزمر',40:'غافر',41:'فصلت',42:'الشورى',43:'الزخرف',44:'الدخان',45:'الجاثية',46:'الأحقاف',47:'محمد',48:'الفتح',49:'الحجرات',50:'ق',51:'الذاريات',52:'الطور',53:'النجم',54:'القمر',55:'الرحمن',56:'الواقعة',57:'الحديد',58:'المجادلة',59:'الحشر',60:'الممتحنة',61:'الصف',62:'الجمعة',63:'المنافقون',64:'التغابن',65:'الطلاق',66:'التحريم',67:'الملك',68:'القلم',69:'الحاقة',70:'المعارج',71:'نوح',72:'الجن',73:'المزمل',74:'المدثر',75:'القيامة',76:'الإنسان',77:'المرسلات',78:'النبأ',79:'النازعات',80:'عبس',81:'التكوير',82:'الانفطار',83:'المطففين',84:'الانشقاق',85:'البروج',86:'الطارق',87:'الأعلى',88:'الغاشية',89:'الفجر',90:'البلد',91:'الشمس',92:'الليل',93:'الضحى',94:'الشرح',95:'التين',96:'العلق',97:'القدر',98:'البينة',99:'الزلزلة',100:'العاديات',101:'القارعة',102:'التكاثر',103:'العصر',104:'الهمزة',105:'الفيل',106:'قريش',107:'الماعون',108:'الكوثر',109:'الكافرون',110:'النصر',111:'المسد',112:'الإخلاص',113:'الفلق',114:'الناس'}}
function getSurahNo(n){let names=surahNames();for(let no in names)if(normalize(names[no])===normalize(n))return Number(no);return 9999}
function getTags(g){let a=Array.isArray(g.surahs)?g.surahs.filter(Boolean):[];if(!a.length&&Array.isArray(g.verses))a=[...new Set(g.verses.map(v=>v.surah).filter(Boolean))];return a}
function groupText(g){return [g.title,g.note,g.unote,g.candidateKind,g.candidateScore,g.sharedPhrase,...getTags(g),...(g.verses||[]).flatMap(v=>[v.surah,v.ayah,v.label,...(v.parts||[]).map(p=>p.text)])].join(' ')}
function passStatus(g,s){s=s||'all';if(s==='favorite')return isTrue(g.favorite);if(s==='completed')return isTrue(g.completed);if(s==='notCompleted')return !isTrue(g.completed);if(s==='locked')return isTrue(g.locked);if(s==='autoCandidate')return isTrue(g.autoCandidate);return true}
function passFilters(g){let q=normalize(document.getElementById('searchInput')?.value||'');let st=document.getElementById('statusFilter')?.value||'all';if(q&&!normalize(groupText(g)).includes(q))return false;if(!passStatus(g,st)||!passStatus(g,advancedFilters.status))return false;if(selectedSurahFilter&&!getTags(g).includes(selectedSurahFilter))return false;if(advancedFilters.kind&&safeText(g.candidateKind)!==advancedFilters.kind)return false;if(advancedFilters.minScore&&Number(g.candidateScore||0)<Number(advancedFilters.minScore))return false;if(advancedFilters.surah&&!getTags(g).some(s=>normalize(s).includes(normalize(advancedFilters.surah))))return false;return true}
function sortGroups(a){a=a.slice();let fs=g=>Math.min(...getTags(g).map(getSurahNo),9999),fa=g=>Math.min(...(g.verses||[]).map(v=>Number(v.ayah)||9999),9999);if(displayMode==='sort-surah'||displayMode==='group-surah')a.sort((x,y)=>fs(x)-fs(y)||fa(x)-fa(y)||(Number(x.id)||0)-(Number(y.id)||0));if(displayMode==='newest')a.sort((x,y)=>(Number(y.id)||0)-(Number(x.id)||0));if(displayMode==='most-verses')a.sort((x,y)=>(y.verses||[]).length-(x.verses||[]).length);return a}
function renderActiveGroups(){if(!activeDb)return;if(activeDb==='automated'&&!selectedSurahFilter){document.getElementById('counter').textContent='اختر سورة لتحميل بياناتها فقط';renderChips(0);renderSurahIndex([]);document.getElementById('groups').innerHTML=automatedPromptHtml();updateToggleAllButton();buildSurahFilter();return}let list=sortGroups(activeData.filter(passFilters));document.getElementById('counter').textContent='عدد النتائج: '+list.length;renderChips(list.length);renderSurahIndex(list);document.getElementById('groups').innerHTML=list.length?(displayMode==='group-surah'?renderGrouped(list):list.map(renderCard).join('')):'<div class="hint">لا توجد نتائج</div>';updateToggleAllButton();buildSurahFilter()}
function renderChips(c){let chips=['المعروض: '+c];if(selectedSurahFilter)chips.push('السورة: '+selectedSurahFilter);if(advancedFilters.kind)chips.push('النوع: '+advancedFilters.kind);document.getElementById('activeFilterChips').innerHTML=chips.map(x=>`<span>${escapeHtml(x)}</span>`).join('')}
function renderSurahIndex(list){let bar=document.getElementById('surahIndexBar');if(displayMode!=='group-surah'){bar.innerHTML='';return}let m=new Map();list.forEach(g=>getTags(g).forEach(s=>m.set(s,(m.get(s)||0)+1)));bar.innerHTML=[...m].sort((a,b)=>getSurahNo(a[0])-getSurahNo(b[0])).map(([s,c])=>`<button onclick="document.getElementById('sec-${getSurahNo(s)}')?.scrollIntoView({behavior:'smooth'})">${escapeHtml(s)} (${c})</button>`).join('')}
function renderGrouped(list){let m=new Map();list.forEach(g=>(getTags(g).length?getTags(g):['غير محدد']).forEach(s=>{if(!m.has(s))m.set(s,[]);m.get(s).push(g)}));return [...m].sort((a,b)=>getSurahNo(a[0])-getSurahNo(b[0])).map(([s,items])=>`<section id="sec-${getSurahNo(s)}" class="surah-section"><div class="group-head" onclick="this.parentElement.classList.toggle('collapsed')"><div class="group-num">${getSurahNo(s)===9999?'؟':getSurahNo(s)}</div><div class="group-title-wrap"><div class="group-title">📖 سورة ${escapeHtml(s)}</div><div class="group-tags"><span class="tag">${items.length} مجموعة</span></div></div></div><div class="surah-section-groups">${items.map(renderCard).join('')}</div></section>`).join('')}
function renderCard(g){let fav=isTrue(g.favorite),done=isTrue(g.completed),locked=isTrue(g.locked),ro=activeDb==='auto';let actions=`<button class="icon-btn star ${fav?'active':''}" onclick="event.stopPropagation();toggleFlag(${g.id},'favorite')">★</button><button class="icon-btn done ${done?'active':''}" onclick="event.stopPropagation();toggleFlag(${g.id},'completed')">✓</button>`;if(editMode)actions+=`<button class="icon-btn lock ${locked?'active':''}" onclick="event.stopPropagation();toggleFlag(${g.id},'locked')">🔒</button><button onclick="event.stopPropagation();openCompareModal(${g.id})">مقارنة</button>${ro?`<button onclick="event.stopPropagation();copyAutoGroupToPersonal(${g.id})">نسخ للشخصية</button>`:`<button onclick="event.stopPropagation();openEditModal(${g.id})">✏️ تعديل</button>`}`;let cls=(fav?' is-favorite':'')+(done?' is-completed':'')+(locked?' is-locked':'');return `<article class="group${cls}" data-id="${g.id}"><div class="group-head" onclick="toggleGroup(this)"><div class="group-num">${escapeHtml(g.id)}</div><div class="group-title-wrap"><div class="group-tags">${getTags(g).map(s=>`<span class="tag">#${escapeHtml(s)}</span>`).join('')}<span class="tag">${(g.verses||[]).length} آية</span>${g.candidateScore?`<span class="tag">score ${g.candidateScore}</span>`:''}</div><div class="group-title">${highlight(g.title||'بدون عنوان')}</div></div><div class="group-actions">${actions}<button class="icon-btn" onclick="event.stopPropagation();copyGroupText(${g.id})">⧉</button></div></div><div class="group-body">${(g.verses||[]).map(renderVerse).join('')}${g.note?`<div class="note">${safeRich(g.note)}</div>`:''}${g.unote?`<div class="unote">${safeRich(g.unote)}</div>`:''}</div></article>`}
function renderVerse(v){return `<div class="verse-card"><div class="verse-ref"><span class="surah-name">${escapeHtml(v.surah)}</span><span class="ayah-num">${escapeHtml(v.ayah)}</span>${v.label?`<span class="verse-label">${escapeHtml(v.label)}</span>`:''}</div><div class="verse-text">${(v.parts||[]).map(p=>`<span class="${escapeHtml(p.type||'normal')}">${highlight(p.text)}</span>`).join(' ')}</div></div>`}
function safeRich(v){let s=safeText(v);return /<\/?(b|strong|u|span|br|div|p|ul|ol|li)/i.test(s)?s.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi,''):escapeHtml(s).replace(/\n/g,'<br>')}
function highlight(t){let q=safeText(document.getElementById('searchInput')?.value).trim();let s=escapeHtml(t);if(!q)return s;return s.replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'),m=>`<mark>${m}</mark>`)}
function toggleGroup(h){h.parentElement.classList.toggle('open');updateToggleAllButton()}function toggleAllGroups(){let gs=[...document.querySelectorAll('.group')],all=gs.length&&gs.every(g=>g.classList.contains('open'));gs.forEach(g=>g.classList.toggle('open',!all));updateToggleAllButton()}function updateToggleAllButton(){let b=document.getElementById('toggleAllBtn'),gs=[...document.querySelectorAll('.group')];if(b)b.textContent=gs.length&&gs.every(g=>g.classList.contains('open'))?'طي الكل':'فتح الكل'}
function findActive(id){return activeData.find(g=>Number(g.id)===Number(id))}function toggleFlag(id,f){let g=findActive(id);if(!g)return;g[f]=!isTrue(g[f]);saveDb(activeDb);renderActiveGroups();updateHomeCounts()}function nextPersonalId(){return Math.max(0,...personalData.map(g=>Number(g.id)||0))+1}function copyAutoGroupToPersonal(id){let g=automatedData.find(x=>Number(x.id)===Number(id));if(!g)return;let c=clone([g])[0];c.id=nextPersonalId();c.autoCandidate=false;c.source='automated';personalData.push(c);saveDb('personal');alert('تم النسخ إلى الشخصية');updateHomeCounts()}function copyGroupText(id){let g=findActive(id);if(!g)return;let txt=`${g.title}\n`+(g.verses||[]).map(v=>`${v.surah} ${v.ayah}: ${(v.parts||[]).map(p=>p.text).join('')}`).join('\n');navigator.clipboard?.writeText(txt);alert('تم النسخ')}
function surahCounts(data=activeData){if(activeDb==='automated'&&window.AUTOMATED_MANIFEST){let m={};(autoManifest().surahs||[]).forEach(x=>m[x.name]=x.count||0);return m}let m={};(data||[]).forEach(g=>getTags(g).forEach(s=>m[s]=(m[s]||0)+1));return m}function buildSurahFilter(){renderSurahFilter()}function rangeBounds(){if(surahRange==='1-30')return[1,30];if(surahRange==='31-60')return[31,60];if(surahRange==='61-90')return[61,90];if(surahRange==='91-114')return[91,114];return[1,114]}function toggleSurahFilterPanel(){let p=document.getElementById('surahFilterPanel'),b=document.getElementById('surahFilterToggleBtn');p.classList.toggle('hidden');b.textContent=p.classList.contains('hidden')?'فتح الفلتر ▾':'إغلاق الفلتر ▴'}function toggleOnlyWithResults(){onlyWithResults=!onlyWithResults;document.getElementById('onlyResultsBtn').classList.toggle('active',onlyWithResults);renderSurahFilter()}function setSurahRange(r){surahRange=r;document.querySelectorAll('.range-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.range===r));renderSurahFilter()}async function filterBySurah(s){let item=autoManifestItemByName(s);if(item)return filterBySurahNo(item.no);selectedSurahFilter=s;document.getElementById('filterStatus').textContent='المعروض الآن: '+s;renderActiveGroups()}function clearSurahFilter(){selectedSurahFilter=null;document.getElementById('filterStatus').textContent=activeDb==='automated'?'اختر سورة لتحميلها فقط':'المعروض الآن: كل السور';renderActiveGroups()}function renderSurahFilter(){let grid=document.getElementById('surahFilterGrid'),top=document.getElementById('topSurahGrid');if(!grid)return;let names=surahNames(),counts=surahCounts(activeData.length?activeData:personalData),q=normalize(document.getElementById('surahFilterSearch')?.value||''),[a,b]=rangeBounds();let items=Object.keys(names).map(no=>({no:+no,name:names[no],count:counts[names[no]]||0}));let visible=items.filter(i=>i.no>=a&&i.no<=b&&(!onlyWithResults||i.count>0||i.name===selectedSurahFilter)&&(!q||String(i.no).includes(q)||normalize(i.name).includes(q)));grid.innerHTML=visible.map(pill).join('')||'<div class="hint">لا توجد سور مطابقة</div>';top.innerHTML=items.filter(i=>i.count>0).sort((x,y)=>y.count-x.count).slice(0,8).map(pill).join('');document.getElementById('surahCountLine').textContent=`كل السور المعروض: ${visible.length} من 114 سورة`}function pill(i){return `<button class="surah-pill ${selectedSurahFilter===i.name?'active':''} ${!i.count?'no-match':''}" onclick="filterBySurahNo(${i.no})"><span class="no-badge">${i.no}</span><span>${escapeHtml(i.name)}</span><span class="count-badge">${i.count}</span></button>`}
function partOptions(sel){return ['normal','shared','diff','diff2','addition','unique'].map(x=>`<option value="${x}" ${x===sel?'selected':''}>${x}</option>`).join('')}function qAyahs(){let arr=[];try{for(let s=1;s<=114;s++)(getSurahAyahs(s)||[]).forEach(a=>arr.push(a))}catch(e){}return arr}function getRef(no,ay){try{return typeof getAyah==='function'?getAyah(no,ay):null}catch(e){return null}}
function openAddModal(){if(activeDb==='auto'){alert('الإضافة في الشخصية فقط');openDatabase('personal')}draftVerses=[];modal('addModal','إضافة متشابه جديد',addBody(),`<button class="primary" onclick="createNewGroup()">حفظ في الصفحة</button><button onclick="closeModal('addModal')">إغلاق</button>`);populateSurah('addSurah');onAddSurah();renderDraft();runQuranSearch('add')}
function addBody(){return `<div class="quran-search-box"><div class="search-stats"><span id="addExact">0 :Exact</span><span id="addClose">0 :Close</span><span id="addTotal">0 :Total</span></div><h3>بحث في quran-reference.js</h3><p>بحث ذكي يتجاهل التشكيل واختلافات الحروف. النتائج المطابقة حرفياً أولاً ثم القريبة.</p><input class="wide-input" id="addQSearch" placeholder="اكتب كلمة أو جزء من آية..." oninput="runQuranSearch('add')"><div id="addQResults" class="quran-results hint">اكتب كلمة لعرض النتائج.</div></div><label class="field">عنوان المتشابه<input id="addTitle" placeholder="مثال: الرجفة / الصيحة"></label><button onclick="generateTitleFromDraft()">توليد عنوان تلقائي</button><div class="color-row"><b>لون المجموعة</b><input type="color" id="addColor" value="#55b94f" oninput="document.getElementById('addColorPrev').style.background=this.value"><span id="addColorPrev" class="color-preview">معاينة اللون</span></div><div class="form-grid"><label class="field">السورة<select id="addSurah" onchange="onAddSurah()"></select></label><label class="field">رقم الآية<select id="addAyah" onchange="previewAddAyah()"></select></label><label class="field">نوع التلوين<select id="addType">${partOptions('shared')}</select></label><label class="field">وصف قصير للآية / Label<input id="addLabel"></label></div><label class="field">نص الآية من quran-reference.js<textarea id="addPreview" readonly></textarea></label><label class="field">معاينة مباشرة:<div id="addLive" class="live-preview verse-text"></div></label><label class="field">تحديد جزء من الآية فقط<textarea id="addSelectedPart"></textarea></label><div class="inline-actions"><button class="primary" onclick="addVerseToDraft()">إضافة الآية للمجموعة</button><button onclick="clearDraft()">مسح الآيات المؤقتة</button></div><h3>الآيات المؤقتة</h3><div id="draftVerses"></div>${richEditor('addNote','ملاحظة','#1d4ed8')}${richEditor('addUnote','فائدة فريدة / إضافية','#b91c1c')}`}
function richEditor(id,label,color){return `<label class="field">${label}<div class="rt-box"><div class="rt-toolbar"><button onclick="rt('${id}','bold')"><b>B</b></button><button onclick="rt('${id}','underline')"><u>U</u></button><button onclick="rt('${id}','insertUnorderedList')">• قائمة</button><input type="color" value="${color}" onchange="rtColor('${id}',this.value)"><button onclick="rt('${id}','removeFormat')">مسح تنسيق</button></div><div id="${id}" class="rt-editor" contenteditable="true"></div></div></label>`}function rt(id,cmd){let e=document.getElementById(id);e.focus();document.execCommand(cmd,false,null)}function rtColor(id,c){let e=document.getElementById(id);e.focus();document.execCommand('foreColor',false,c)}
function runQuranSearch(prefix){
  let input=document.getElementById(prefix+'QSearch'), q=input?.value.trim()||'', box=document.getElementById(prefix+'QResults');
  if(!box)return;
  ['Exact','Close','Total'].forEach(k=>{let el=document.getElementById(prefix+k);if(el)el.textContent='0 :'+k});
  if(!q){box.className='quran-results hint';box.innerHTML='اكتب كلمة لعرض النتائج.';return}
  let nq=normalizeQuranSearchText(q), exact=[], close=[];
  qAyahs().forEach(a=>{let txt=safeText(a.text), nt=normalizeQuranSearchText(txt); if(txt.includes(q)) exact.push(a); else if(nt.includes(nq)) close.push(a)});
  let total=exact.length+close.length, all=exact.concat(close).slice(0,80);
  let e=document.getElementById(prefix+'Exact'), c=document.getElementById(prefix+'Close'), t=document.getElementById(prefix+'Total');
  if(e)e.textContent=exact.length+' :Exact'; if(c)c.textContent=close.length+' :Close'; if(t)t.textContent=total+' :Total';
  box.className='quran-results';
  box.innerHTML=all.map((a,i)=>{
    let target=prefix==='edit'?'edit':'add', exists=quranItemExists(target,a.surah,a.ayahNo), checked=exists?'checked':'';
    return `<div class="quran-result ${exists?'selected':''}">
      <label class="quran-check-line"><input type="checkbox" class="${prefix}QCheck" ${checked} onchange="toggleQuranResult('${prefix}',this)" data-index="${i}" data-surah-no="${a.surahNo||a.surah}" data-ayah="${a.ayahNo}" data-text="${escapeHtml(a.text)}" data-surah="${escapeHtml(a.surah)}"><span>${exists?'مضاف':'تحديد'}</span></label>
      <div class="quran-result-body"><b>${a.surah} — ${a.ayahNo}</b><textarea id="${prefix}QText_${i}" class="quran-result-text" readonly>${escapeHtml(a.text)}</textarea>
      <div class="quran-result-actions"><button onclick="addFullQuranResult('${prefix}',this)">إضافة الآية كاملة</button><button onclick="addSelectedQuranResult('${prefix}',${i},this)">إضافة النص المحدد</button></div></div>
    </div>`}).join('') + `<div class="quran-result-toolbar"><button class="primary" onclick="addCheckedQuran('${prefix}')">إضافة المحدد</button><small>حدد جزءاً من النص داخل مربع الآية ثم اضغط «إضافة النص المحدد».</small></div>`;
}
function addCheckedQuran(prefix){
  document.querySelectorAll('.'+prefix+'QCheck:checked').forEach(ch=>{let txt=ch.dataset.text;if(!quranItemExists(prefix==='edit'?'edit':'add',ch.dataset.surah,ch.dataset.ayah))addQuranVerseObject(prefix==='edit'?'edit':'add',ch.dataset.surah,ch.dataset.ayah,txt,'shared')});
  if(prefix==='edit')runQuranSearch('edit'); else runQuranSearch('add');
}
function toggleQuranResult(prefix,ch){let target=prefix==='edit'?'edit':'add'; if(ch.checked){if(!quranItemExists(target,ch.dataset.surah,ch.dataset.ayah))addQuranVerseObject(target,ch.dataset.surah,ch.dataset.ayah,ch.dataset.text,'shared')}else{removeQuranVerseObject(target,ch.dataset.surah,ch.dataset.ayah)} runQuranSearch(prefix)}
function addFullQuranResult(prefix,btn){let root=btn.closest('.quran-result'), ch=root?.querySelector('input[type="checkbox"]'); if(!ch)return; addQuranVerseObject(prefix==='edit'?'edit':'add',ch.dataset.surah,ch.dataset.ayah,ch.dataset.text,'shared'); runQuranSearch(prefix)}
function addSelectedQuranResult(prefix,i,btn){let root=btn.closest('.quran-result'), ch=root?.querySelector('input[type="checkbox"]'); if(!ch)return; let txt=quranResultText(prefix,i,ch.dataset.text)||ch.dataset.text; addQuranVerseObject(prefix==='edit'?'edit':'add',ch.dataset.surah,ch.dataset.ayah,txt,'shared'); runQuranSearch(prefix)}
function getValidSurahNo(v){let n=parseInt(v,10);if(n>=1&&n<=114)return n;let g=getSurahNo(v);return g===9999?1:g}
function surahOptionsHtml(sel){let names=surahNames(),selected=getValidSurahNo(sel);return Object.keys(names).map(no=>`<option value="${no}" ${+no===+selected?'selected':''}>${no} - ${names[no]}</option>`).join('')}
function ayahOptionsHtml(no,sel){let arr=[];try{arr=getSurahAyahs(getValidSurahNo(no))||[]}catch(x){};let selected=parseInt(sel,10)||1;return (arr.length?arr:[{ayahNo:1}]).map(a=>`<option value="${a.ayahNo}" ${+a.ayahNo===+selected?'selected':''}>${a.ayahNo}</option>`).join('')}
function populateSurah(id,sel){let e=document.getElementById(id);if(e)e.innerHTML=surahOptionsHtml(sel)}
function populateAyah(id,no,sel){let e=document.getElementById(id);if(e)e.innerHTML=ayahOptionsHtml(no,sel)}
function onAddSurah(){populateAyah('addAyah',document.getElementById('addSurah').value);previewAddAyah()}
function previewAddAyah(){let a=getRef(document.getElementById('addSurah').value,document.getElementById('addAyah').value);let p=document.getElementById('addPreview'),l=document.getElementById('addLive');if(p)p.value=a?a.text:'لم يتم العثور';if(l)l.innerHTML=a?`<span class="${document.getElementById('addType').value}">${escapeHtml(a.text)}</span>`:''}
function addVerseToDraft(){let a=getRef(document.getElementById('addSurah').value,document.getElementById('addAyah').value);if(!a)return alert('لم يتم العثور');draftVerses.push({surah:a.surah,ayah:a.ayahNo,label:document.getElementById('addLabel').value.trim(),parts:[{type:document.getElementById('addType').value,text:document.getElementById('addSelectedPart').value.trim()||a.text}]});renderDraft()}function renderDraft(){let b=document.getElementById('draftVerses');if(!b)return;b.innerHTML=draftVerses.length?draftVerses.map((v,i)=>`<div class="draft-item"><b>${v.surah} ${v.ayah}</b><button class="danger" onclick="draftVerses.splice(${i},1);renderDraft()">حذف</button><div class="verse-text"><span class="${v.parts[0].type}">${escapeHtml(v.parts[0].text)}</span></div></div>`).join(''):'<div class="hint">لا توجد آيات مضافة بعد.</div>'}function clearDraft(){draftVerses=[];renderDraft()}function generateTitleFromDraft(){if(draftVerses.length)document.getElementById('addTitle').value=draftVerses.map(v=>v.surah+' '+v.ayah).join(' / ')}function createNewGroup(){let title=document.getElementById('addTitle').value.trim();if(!title||!draftVerses.length)return alert('أدخل العنوان والآيات');personalData.push({id:nextPersonalId(),title,color:document.getElementById('addColor').value,surahs:[...new Set(draftVerses.map(v=>v.surah))],verses:clone(draftVerses),note:document.getElementById('addNote').innerHTML,unote:document.getElementById('addUnote').innerHTML,favorite:false,completed:false,locked:false});saveDb('personal');closeModal('addModal');openDatabase('personal')}
function openEditModal(id){let g=personalData.find(x=>+x.id===+id);if(!g)return;if(isTrue(g.locked))return alert('المجموعة مقفلة');editGroupId=id;editVersesBuffer=clone(g.verses||[]);modal('editModal','تعديل المتشابه',editBody(g),`<button class="primary" onclick="saveEditGroup()">حفظ التعديل</button><button class="danger" onclick="deleteEditGroup()">حذف المجموعة</button><button onclick="closeModal('editModal')">إغلاق</button>`);renderEditVerses();runQuranSearch('edit')}function editBody(g){return `<div class="quran-search-box edit-quran-search"><div class="search-stats"><span id="editExact">0 :Exact</span><span id="editClose">0 :Close</span><span id="editTotal">0 :Total</span></div><h3>بحث ذكي في القرآن</h3><p>يتجاهل التشكيل واختلافات الهمزات والألف وى/ي وة/ه وؤ/و وئ/ي. النتائج المطابقة أولاً ثم القريبة.</p><input class="wide-input" id="editQSearch" placeholder="ابحث داخل quran-reference.js ثم أضف الآية أو النص المحدد..." oninput="runQuranSearch('edit')"><div id="editQResults" class="quran-results hint">اكتب كلمة لعرض النتائج.</div></div><label class="field">عنوان المتشابه<input id="editTitle" value="${escapeHtml(g.title)}"></label><div class="inline-actions"><button class="primary" onclick="addBlankEditVerse()">+ إضافة آية</button><button onclick="sortEditVersesByMushaf()">ترتيب حسب المصحف</button></div><div id="editVerses"></div>${richEditor('editNote','ملاحظة','#1d4ed8')}${richEditor('editUnote','فائدة فريدة / إضافية','#b91c1c')}`}
function renderEditVerses(){let b=document.getElementById('editVerses');if(!b)return;b.innerHTML=editVersesBuffer.map((v,vi)=>{let sno=getValidSurahNo(v.surah),ayah=v.ayah||1;return `<div class="edit-verse"><div class="edit-verse-title"><b>آية ${vi+1}</b><div><button onclick="moveEditVerse(${vi},-1)">↑</button><button onclick="moveEditVerse(${vi},1)">↓</button><button class="danger" onclick="editVersesBuffer.splice(${vi},1);renderEditVerses()">حذف الآية</button></div></div><div class="form-grid"><label class="field">السورة<select onchange="setEditSurah(${vi},this.value)">${surahOptionsHtml(sno)}</select></label><label class="field">رقم الآية<select onchange="setEditAyah(${vi},this.value)">${ayahOptionsHtml(sno,ayah)}</select></label><label class="field">Label<input value="${escapeHtml(v.label||'')}" onchange="editVersesBuffer[${vi}].label=this.value"></label></div><button onclick="fillEditAyah(${vi})">ملء نص الآية من المرجع</button><h4>أجزاء النص</h4>${(v.parts||[]).map((p,pi)=>partRow(vi,pi,p)).join('')}<button onclick="addEditPart(${vi})">+ إضافة جزء نص</button><div class="live-preview verse-text">${(v.parts||[]).map(p=>`<span class="${p.type}">${escapeHtml(p.text)}</span>`).join(' ')}</div></div>`}).join('')}
function partRow(vi,pi,p){return `<div class="part-row"><select aria-label="نوع الجزء" onchange="editVersesBuffer[${vi}].parts[${pi}].type=this.value;renderEditVerses()">${partOptions(p.type)}</select><textarea aria-label="نص الجزء" onchange="editVersesBuffer[${vi}].parts[${pi}].text=this.value">${escapeHtml(p.text)}</textarea><div class="part-actions"><button title="تحريك لأعلى" onclick="moveEditPart(${vi},${pi},-1)">↑</button><button title="تحريك لأسفل" onclick="moveEditPart(${vi},${pi},1)">↓</button><button title="إضافة قبل" onclick="insertEditPart(${vi},${pi})">+ قبل</button><button title="إضافة بعد" onclick="insertEditPart(${vi},${pi}+1)">+ بعد</button><button class="danger" title="حذف" onclick="removeEditPart(${vi},${pi})">حذف</button></div></div>`}function addBlankEditVerse(){editVersesBuffer.push({surah:'الفاتحة',ayah:1,label:'',parts:[{type:'normal',text:''}]});renderEditVerses()}function moveEditVerse(i,d){let j=i+d;if(j<0||j>=editVersesBuffer.length)return;[editVersesBuffer[i],editVersesBuffer[j]]=[editVersesBuffer[j],editVersesBuffer[i]];renderEditVerses()}function addEditPart(vi){editVersesBuffer[vi].parts.push({type:'normal',text:''});renderEditVerses()}function insertEditPart(vi,pi){editVersesBuffer[vi].parts.splice(pi+1,0,{type:'normal',text:''});renderEditVerses()}function removeEditPart(vi,pi){editVersesBuffer[vi].parts.splice(pi,1);renderEditVerses()}function moveEditPart(vi,pi,d){let a=editVersesBuffer[vi].parts,j=pi+d;if(j<0||j>=a.length)return;[a[pi],a[j]]=[a[j],a[pi]];renderEditVerses()}function setEditSurah(vi,no){let names=surahNames(),sno=getValidSurahNo(no),arr=[];try{arr=getSurahAyahs(sno)||[]}catch(e){};if(!editVersesBuffer[vi])return;editVersesBuffer[vi].surah=names[sno]||String(no);editVersesBuffer[vi].ayah=(arr[0]&&arr[0].ayahNo)||1;renderEditVerses()}
function setEditAyah(vi,ayah){if(!editVersesBuffer[vi])return;editVersesBuffer[vi].ayah=parseInt(ayah,10)||ayah}
function fillEditAyah(vi){let v=editVersesBuffer[vi],a=getRef(getSurahNo(v.surah),v.ayah);if(!a)return alert('لم يتم العثور');v.surah=a.surah;v.ayah=a.ayahNo;v.parts=[{type:'normal',text:a.text}];renderEditVerses()}function sortEditVersesByMushaf(){editVersesBuffer.sort((a,b)=>getSurahNo(a.surah)-getSurahNo(b.surah)||(+a.ayah||0)-(+b.ayah||0));renderEditVerses()}function saveEditGroup(){let i=personalData.findIndex(g=>+g.id===+editGroupId);if(i<0)return;personalData[i]={...personalData[i],title:document.getElementById('editTitle').value.trim(),verses:clone(editVersesBuffer),surahs:[...new Set(editVersesBuffer.map(v=>v.surah))],note:document.getElementById('editNote').innerHTML,unote:document.getElementById('editUnote').innerHTML};saveDb('personal');closeModal('editModal');renderActiveGroups()}function deleteEditGroup(){if(confirm('حذف المجموعة؟')){personalData=personalData.filter(g=>+g.id!==+editGroupId);saveDb('personal');closeModal('editModal');renderActiveGroups();updateHomeCounts()}}
function openCompareModal(id){let g=findActive(id);if(!g)return;modal('compareModal','المقارنة البصرية — '+escapeHtml(g.title),`<div>${(g.verses||[]).map(v=>`<div class="compare-card"><b>${escapeHtml(v.surah)} آية ${escapeHtml(v.ayah)} ${escapeHtml(v.label||'')}</b><div class="compare-text">${(v.parts||[]).map(p=>`<span class="${p.type==='normal'?'base':p.type==='shared'?'same':'cmpdiff'}">${escapeHtml(p.text)}</span>`).join(' ')}</div></div>`).join('')}</div>`,`<button onclick="closeModal('compareModal')">إغلاق</button>`)}
function openMergeWindow(){modal('mergeWindow','دمج / نقل من الآلية إلى الشخصية',`<div class="tools"><input id="mergeSearch" placeholder="ابحث في الآلية..." oninput="renderMergeList()"><button onclick="selectAllMerge(true)">تحديد المعروض</button><button onclick="selectAllMerge(false)">إلغاء التحديد</button><button class="primary" onclick="copySelectedToPersonal()">نقل المحدد</button></div><div id="mergeList"></div>`,`<button onclick="closeModal('mergeWindow')">إغلاق</button>`);renderMergeList()}function renderMergeList(){let q=normalize(document.getElementById('mergeSearch')?.value||''),list=automatedData.filter(g=>!q||normalize(groupText(g)).includes(q));document.getElementById('mergeList').innerHTML=list.map(g=>`<label class="merge-item"><input type="checkbox" class="merge-check" value="${automatedData.indexOf(g)}"><div><b>${escapeHtml(g.title)}</b><br><small>${getTags(g).join('، ')} — ${(g.verses||[]).length} آيات</small></div><button onclick="copyOneToPersonal(${automatedData.indexOf(g)})">نسخ</button></label>`).join('')||'<div class="hint">لا توجد نتائج</div>'}function selectAllMerge(s){document.querySelectorAll('.merge-check').forEach(x=>x.checked=s)}function copyOneToPersonal(i){let g=clone([automatedData[i]])[0];g.id=nextPersonalId();g.autoCandidate=false;g.source='automated';personalData.push(g);saveDb('personal');updateHomeCounts();alert('تم النسخ')}function copySelectedToPersonal(){let ids=[...document.querySelectorAll('.merge-check:checked')].map(x=>+x.value);ids.forEach(copyOneToPersonal)}
function openDashboard(){let d=activeDb?activeData:personalData.concat(automatedData),ayah=d.reduce((s,g)=>s+(g.verses||[]).length,0),surahs=new Set(d.flatMap(getTags)).size;let cards=[['الشخصية',personalData.length],['الآلية',automatedData.length],['المجموعات',d.length],['الآيات',ayah],['السور',surahs],['المفضلة',d.filter(g=>isTrue(g.favorite)).length],['المكتملة',d.filter(g=>isTrue(g.completed)).length],['المقفلة',d.filter(g=>isTrue(g.locked)).length]];modal('dashboardModal','الإحصائيات',`<div class="dashboard-grid">${cards.map(c=>`<div class="dash-card"><div class="dash-value">${c[1]}</div><div>${c[0]}</div></div>`).join('')}</div>`,`<button onclick="closeModal('dashboardModal')">إغلاق</button>`)}function openAdvancedSearch(){modal('advancedModal','بحث متقدم',`<div class="form-grid"><label class="field">الحالة<select id="advStatus"><option value="all">الكل</option><option value="favorite">المفضلة</option><option value="completed">المكتملة</option><option value="notCompleted">غير مكتملة</option><option value="locked">المقفلة</option><option value="autoCandidate">مرشح آلي</option></select></label><label class="field">نوع المرشح<input id="advKind" placeholder="same-opening / shared-phrase"></label><label class="field">أقل درجة<input id="advScore" type="number"></label><label class="field">السورة<input id="advSurah"></label></div>`,`<button class="primary" onclick="applyAdvancedSearch()">تطبيق</button><button onclick="resetAdvancedSearch()">إعادة ضبط</button><button onclick="closeModal('advancedModal')">إغلاق</button>`);document.getElementById('advStatus').value=advancedFilters.status;document.getElementById('advKind').value=advancedFilters.kind;document.getElementById('advScore').value=advancedFilters.minScore;document.getElementById('advSurah').value=advancedFilters.surah}function applyAdvancedSearch(){advancedFilters={status:document.getElementById('advStatus').value,kind:document.getElementById('advKind').value.trim(),minScore:document.getElementById('advScore').value,surah:document.getElementById('advSurah').value.trim()};closeModal('advancedModal');renderActiveGroups()}function resetAdvancedSearch(){advancedFilters={status:'all',kind:'',minScore:'',surah:''};closeModal('advancedModal');renderActiveGroups()}
function openAppSettings(){let s=getSettings();modal('settingsModal','إعدادات التطبيق',`<div class="settings-section"><h2>GitHub Auto Sync ☁</h2><label class="field">Token<input id="ghToken" type="password" value="${escapeHtml(s.ghToken||'')}"></label><div class="form-grid"><label class="field">Repo<input id="ghRepo" value="${escapeHtml(s.ghRepo||'')}"></label><label class="field">Owner<input id="ghOwner" value="${escapeHtml(s.ghOwner||'')}"></label><label class="field">Path<input id="ghPath" value="${escapeHtml(s.ghPath||'data.js')}"></label><label class="field">Branch<input id="ghBranch" value="${escapeHtml(s.ghBranch||'main')}"></label></div><div class="inline-actions"><button class="primary" onclick="saveSettings()">حفظ</button><button onclick="syncToGitHub()">مزامنة الآن</button></div></div><div class="settings-section"><h2>✏️ Edit Mode / وضع التعديل</h2><p>عند تفعيل وضع التعديل تظهر أيقونات التعديل والمقارنة والنقل والدمج وكشف التكرار.</p><label><input type="checkbox" id="editModeCheck" ${editMode?'checked':''}> تفعيل وضع التعديل</label></div><div class="settings-section"><h2>🎨 Theme / Font</h2><div class="form-grid"><label class="field">Theme<select id="setTheme"><option value="quran-classic">Quran Classic</option><option value="apple-health">Apple Health</option><option value="bevel-night">Bevel Night</option></select></label><label class="field">Font<select id="setFont" onchange="updateFontPreview()"><option value="normal-quran">Normal Quran — للبحث والتعديل والمقارنة</option><option value="mushaf-qpc-v2">Mushaf QPC V2 — للعرض والمراجعة</option><option value="classic-quran">Classic Quran (Legacy)</option><option value="modern-reader">Modern Reader (Legacy)</option><option value="mobile-clear">Mobile Clear (Legacy)</option></select></label></div><div id="fontPreviewBox" class="font-preview-box" data-font-preset="normal-quran"><b>معاينة الخط قبل الحفظ</b><div class="font-preview-ayah">وَزَيَّنَ لَهُمُ الشَّيْطَانُ أَعْمَالَهُمْ فَصَدَّهُمْ عَنِ السَّبِيلِ فَهُمْ لَا يَهْتَدُونَ</div><small id="fontPreviewHint">إذا كان مجلد fonts فارغاً سيظهر الخط الاحتياطي تلقائياً.</small></div></div><div class="inline-actions"><button onclick="openReleaseNotes()">Release Notes</button><button onclick="exportActiveDatabase()">Export data.js</button><button onclick="resetDualDbCacheV68()">Reset Cache</button></div>`,`<button class="primary" onclick="saveSettings()">حفظ</button><button onclick="closeModal('settingsModal')">إغلاق</button>`);document.getElementById('setTheme').value=s.theme;document.getElementById('setFont').value=s.font;updateFontPreview()}
function updateFontPreview(){let f=normalizeFontPreset(document.getElementById('setFont')?.value||getSettings().font),box=document.getElementById('fontPreviewBox'),hint=document.getElementById('fontPreviewHint');if(box)box.setAttribute('data-font-preset',f);if(hint)hint.textContent=f==='mushaf-qpc-v2'?'معاينة Mushaf QPC V2. إذا لم يظهر الاختلاف، ضع qpc-v2.woff2 أو qpc-v2.ttf داخل مجلد fonts.':'معاينة الخط العادي المستخدم للبحث والتعديل والمقارنة.'}
function normalizeFontPreset(v){v=safeText(v||'normal-quran');if(v==='classic-quran'||v==='modern-reader'||v==='mobile-clear')return 'normal-quran';if(v!=='normal-quran'&&v!=='mushaf-qpc-v2')return 'normal-quran';return v}function getSettings(){try{let s={...{theme:'quran-classic',font:'normal-quran',ghPath:'data.js',ghBranch:'main'},...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')};s.font=normalizeFontPreset(s.font);return s}catch(e){return {theme:'quran-classic',font:'normal-quran',ghPath:'data.js',ghBranch:'main'}}}function applySettings(){let s=getSettings();s.font=normalizeFontPreset(s.font);document.body.setAttribute('data-theme',s.theme);document.body.setAttribute('data-font-preset',s.font);let gh=document.getElementById('ghBadge');if(gh)gh.textContent=s.ghOwner&&s.ghRepo?'☁ GitHub ready':'☁ GitHub: not set'}function saveSettings(){let s={theme:document.getElementById('setTheme')?.value||getSettings().theme,font:normalizeFontPreset(document.getElementById('setFont')?.value||getSettings().font),ghToken:document.getElementById('ghToken')?.value||'',ghRepo:document.getElementById('ghRepo')?.value||'',ghOwner:document.getElementById('ghOwner')?.value||'',ghPath:document.getElementById('ghPath')?.value||'data.js',ghBranch:document.getElementById('ghBranch')?.value||'main'};editMode=!!document.getElementById('editModeCheck')?.checked;localStorage.setItem('mutashabihat_v69_edit_mode',editMode);localStorage.setItem(SETTINGS_KEY,JSON.stringify(s));applySettings();closeModal('settingsModal');if(activeDb)renderActiveGroups()}function syncToGitHub(){alert('تم حفظ إعدادات GitHub. المزامنة الحقيقية تحتاج Token وصلاحية repo، وسيتم تفعيلها عند ربط المستودع.')}
const RELEASE=`V78 — Clean V71 + Restored Features

Implemented:
- Added Normal Quran font mode for search, edit, and comparison screens.
- Added Mushaf QPC V2 display/review mode for beautiful reading in group cards.
- Search result textareas, edit part textareas, edit live preview, and comparison view stay on Normal Quran font for readability and accurate editing.
- Group display/review can use Mushaf QPC V2 via Settings > Font.
- Added CSS font-face references ready for local /fonts files: QPC V2, KFGQPCNastaleeq-Regular, surah-name-v4.
- Updated settings font dropdown with the two clear modes.
- Fixed modification modal header color and X close button to follow the current app theme.

Preserved:
- Personal/Automated database separation.
- Smart Quran search in add/edit windows.
- Inline Surah filter and display mode dropdown.
- Added Surah dropdown and dependent Ayah dropdown in the modification window.
- Added live font preview in Settings before saving.
- Clarified that empty fonts folder is optional; place qpc-v2.woff2 or qpc-v2.ttf only if you have the real file.
- Existing Quran reference APIs and data files.`;function openReleaseNotes(){modal('releaseModal','Release Notes — V70',`<div class="release-content">${escapeHtml(RELEASE)}</div>`,`<button onclick="navigator.clipboard?.writeText(RELEASE)">نسخ</button><button onclick="closeModal('releaseModal')">إغلاق</button>`)}function exportActiveDatabase(){if(!activeDb)return alert('افتح قاعدة أولاً');let vn=activeDb==='personal'?'PERSONAL_DATA':'AUTOMATED_DATA',fn=activeDb==='personal'?'personal-data.js':'automated-data.js',blob=new Blob(['window.'+vn+' = '+JSON.stringify(activeData,null,2)+';\n'],{type:'application/javascript;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fn;a.click()}function modal(id,title,body,footer){closeModal(id);let e=document.createElement('section');e.id=id;e.className='modal-backdrop';let modalClass='modal '+id+'-window';e.innerHTML=`<div class="${modalClass}" role="dialog" aria-modal="true"><div class="modal-head"><h2>${title}</h2><button class="modal-close-btn" aria-label="إغلاق" onclick="closeModal('${id}')">×</button></div><div class="modal-body">${body}</div><div class="modal-footer">${footer||''}</div></div>`;e.onclick=x=>{if(x.target===e)closeModal(id)};document.getElementById('modalRoot').appendChild(e)}function closeModal(id){document.getElementById(id)?.remove()}function openMobileMenu(){let items=[['الرئيسية','openHome()'],['الشخصية',"openDatabase('personal')"],['الآلية',"openDatabase('auto')"],['إضافة','openAddModal()'],['الإحصائيات','openDashboard()'],['الإعدادات','openAppSettings()'],['بحث متقدم','openAdvancedSearch()'],['دمج','openMergeWindow()'],['Release Notes','openReleaseNotes()']];let e=document.createElement('section');e.id='mobileMenu';e.className='modal-backdrop';e.innerHTML=`<div class="mobile-menu-panel"><button onclick="closeModal('mobileMenu')">× إغلاق</button>${items.map(i=>`<button onclick="closeModal('mobileMenu');${i[1]}">${i[0]}</button>`).join('')}</div>`;document.getElementById('modalRoot').appendChild(e)}

/* =========================
   V78 restored features from V72/V73 on clean V71 base
   ========================= */
const LAST_VIEW_KEY_V78='mutashabihat_v78_last_view';
const LAST_SURAH_KEY_V78='mutashabihat_v78_last_surah';
let __modalScrollY_V78=0;
let __touchStartY_V78=0;
let __touchStartX_V78=0;
let __touchStartedOnHead_V78=false;

function iconSvg(name){
  const common='width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  const icons={
    star:`<svg ${common}><path d="M12 3.5l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17.4 6.6 20.3l1-6.1-4.4-4.3 6.1-.9L12 3.5z"/></svg>`,
    lock:`<svg ${common}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`,
    copy:`<svg ${common}><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    camera:`<svg ${common}><path d="M4 8h3l1.6-2h6.8L17 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z"/><circle cx="12" cy="14" r="3.4"/></svg>`,
    edit:`<svg ${common}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>`,
    compare:`<svg ${common}><path d="M8 7h13"/><path d="M8 17h13"/><path d="M3 7h.01"/><path d="M3 17h.01"/></svg>`
  };
  return icons[name]||'';
}
function toast(msg,type){let t=document.getElementById('v78Toast');if(!t){t=document.createElement('div');t.id='v78Toast';document.body.appendChild(t)}t.className='v78-toast '+(type||'');t.textContent=msg;t.classList.add('show');clearTimeout(t._tm);t._tm=setTimeout(()=>t.classList.remove('show'),2600)}
function lockBodyScrollV78(){if(document.body.classList.contains('modal-open-v78'))return;__modalScrollY_V78=window.scrollY||document.documentElement.scrollTop||0;document.body.style.top=`-${__modalScrollY_V78}px`;document.body.classList.add('modal-open-v78')}
function unlockBodyScrollV78(){if(document.querySelector('.modal-backdrop'))return;document.body.classList.remove('modal-open-v78');document.body.style.top='';window.scrollTo(0,__modalScrollY_V78||0)}
function modal(id,title,body,footer){closeModal(id);let e=document.createElement('section');e.id=id;e.className='modal-backdrop';let modalClass='modal '+id+'-window';e.innerHTML=`<div class="${modalClass}" role="dialog" aria-modal="true"><div class="modal-head"><span class="modal-drag-handle"></span><h2>${title}</h2><button class="modal-close-btn icon-outline" aria-label="إغلاق" onclick="closeModal('${id}')">×</button></div><div class="modal-body">${body}</div><div class="modal-footer">${footer||''}</div></div>`;e.onclick=x=>{if(x.target===e)closeModal(id)};document.getElementById('modalRoot').appendChild(e);lockBodyScrollV78();enableSwipeToClose(e,id)}
function closeModal(id){document.getElementById(id)?.remove();setTimeout(unlockBodyScrollV78,0)}
function isMobileLayout(){return window.matchMedia&&window.matchMedia('(max-width: 900px)').matches}
function enableSwipeToClose(backdrop,id){let panel=backdrop.querySelector('.modal,.mobile-menu-panel');if(!panel)return;panel.addEventListener('touchstart',e=>{if(!isMobileLayout())return;let t=e.touches[0];__touchStartY_V78=t.clientY;__touchStartX_V78=t.clientX;__touchStartedOnHead_V78=!!e.target.closest('.modal-head,.modal-drag-handle')},{passive:true});panel.addEventListener('touchmove',e=>{if(!isMobileLayout())return;if(e.target.closest('.modal-body'))return;e.preventDefault()},{passive:false});panel.addEventListener('touchend',e=>{if(!isMobileLayout())return;let t=e.changedTouches[0],dy=t.clientY-__touchStartY_V78,dx=Math.abs(t.clientX-__touchStartX_V78);let body=panel.querySelector('.modal-body');let atTop=!body||body.scrollTop<=2;if(dy>95&&dx<80&&(__touchStartedOnHead_V78||atTop))closeModal(id)},{passive:true})}
function openMobileMenu(){let items=[['الرئيسية','openHome()'],['الشخصية',"openDatabase('personal')"],['الآلية',"openDatabase('auto')"],['إضافة','openAddModal()'],['الإحصائيات','openDashboard()'],['الإعدادات','openAppSettings()'],['دمج','openMergeWindow()'],['Release Notes','openReleaseNotes()']];let e=document.createElement('section');e.id='mobileMenu';e.className='modal-backdrop';e.innerHTML=`<div class="mobile-menu-panel"><button onclick="closeModal('mobileMenu')">× إغلاق</button>${items.map(i=>`<button onclick="closeModal('mobileMenu');${i[1]}">${i[0]}</button>`).join('')}</div>`;document.getElementById('modalRoot').appendChild(e);lockBodyScrollV78();enableSwipeToClose(e,'mobileMenu')}

function init(){applySettings();personalData=loadDb(PERSONAL_KEY,filePersonal());automatedData=loadDb(AUTO_KEY,fileAuto());updateHomeCounts();let dm=document.getElementById('displayMode');if(dm)dm.value=displayMode;let savedSurah=localStorage.getItem(LAST_SURAH_KEY_V78);if(savedSurah)selectedSurahFilter=savedSurah;buildSurahFilter();collapseSurahFilterPanel();let last=localStorage.getItem(LAST_VIEW_KEY_V78)||'home';if(last==='personal'||last==='auto')openDatabase(last,true);else openHome(true);storage('✓ V78 جاهز')}
function openHome(skipSave){document.getElementById('home').classList.remove('hidden');document.getElementById('workspace').classList.add('hidden');activeDb=null;if(!skipSave)localStorage.setItem(LAST_VIEW_KEY_V78,'home');updateHomeCounts()}
function openDatabase(w,skipSave){activeDb=w;activeData=w==='personal'?personalData:automatedData;if(!skipSave)localStorage.setItem(LAST_VIEW_KEY_V78,w);document.getElementById('home').classList.add('hidden');document.getElementById('workspace').classList.remove('hidden');document.getElementById('dbTitle').textContent=w==='personal'?'المتشابهات الشخصية':'المتشابهات الآلية';document.getElementById('dbSubTitle').textContent=w==='personal'?'قابلة للإضافة والتعديل والحذف':'للمراجعة والنسخ للشخصية فقط';renderActiveGroups();buildSurahFilter();collapseSurahFilterPanel();if(selectedSurahFilter){let fs=document.getElementById('filterStatus');if(fs)fs.textContent='المعروض الآن: '+selectedSurahFilter}}
function filterBySurah(s){selectedSurahFilter=s;localStorage.setItem(LAST_SURAH_KEY_V78,s);document.getElementById('filterStatus').textContent='المعروض الآن: '+s;renderActiveGroups()}
function clearSurahFilter(){selectedSurahFilter=null;localStorage.removeItem(LAST_SURAH_KEY_V78);document.getElementById('filterStatus').textContent='المعروض الآن: كل السور';renderActiveGroups()}
function buildSurahFilter(){renderSurahFilter();collapseSurahFilterPanel()}
function collapseSurahFilterPanel(){let p=document.getElementById('surahFilterPanel'),b=document.getElementById('surahFilterToggleBtn');if(p)p.classList.add('hidden');if(b)b.textContent='فتح الفلتر ▾'}
function toggleSurahFilterPanel(){let p=document.getElementById('surahFilterPanel'),b=document.getElementById('surahFilterToggleBtn');if(!p||!b)return;p.classList.toggle('hidden');b.textContent=p.classList.contains('hidden')?'فتح الفلتر ▾':'إغلاق الفلتر ▴'}

function partOptions(sel){return ['normal','shared','diff','diff2','diff3','addition','unique'].map(x=>`<option value="${x}" ${x===sel?'selected':''}>${x}</option>`).join('')}
function groupHasUniqueInSurah(g,s){return (g.verses||[]).some(v=>safeText(v.surah)===safeText(s)&&(v.parts||[]).some(p=>safeText(p.type)==='unique'))}
function renderSurahTag(g,s){return `<span class="tag ${groupHasUniqueInSurah(g,s)?'unique-surah-tag':''}">#${escapeHtml(s)}</span>`}
function renderGroupBody(g){return `${(g.verses||[]).map(renderVerse).join('')}${g.note?`<div class="note"><b>ملاحظة:</b><br>${safeRich(g.note)}</div>`:''}${g.unote?`<div class="unote"><b>فائدة إضافية:</b><br>${safeRich(g.unote)}</div>`:''}`}
function renderCard(g){let fav=isTrue(g.favorite),done=isTrue(g.completed),locked=isTrue(g.locked),ro=activeDb==='auto';let actions=`<button class="icon-btn outline-icon star ${fav?'active':''}" title="مفضلة" onclick="event.stopPropagation();toggleFlag(${g.id},'favorite')">${iconSvg('star')}</button>`;if(editMode)actions+=`<button class="icon-btn outline-icon lock ${locked?'active':''}" title="قفل" onclick="event.stopPropagation();toggleFlag(${g.id},'locked')">${iconSvg('lock')}</button><button class="icon-btn outline-icon" title="مقارنة" onclick="event.stopPropagation();openCompareModal(${g.id})">${iconSvg('compare')}</button>${ro?`<button onclick="event.stopPropagation();copyAutoGroupToPersonal(${g.id})">نسخ للشخصية</button>`:`<button class="icon-btn outline-icon" title="تعديل" onclick="event.stopPropagation();openEditModal(${g.id})">${iconSvg('edit')}</button>`}`;let cls=(fav?' is-favorite':'')+(done?' is-completed':'')+(locked?' is-locked':'');return `<article class="group${cls}" data-id="${g.id}"><div class="group-head" onclick="toggleGroup(this)"><div class="group-num ${done?'completed':''}" title="اضغط لتغيير حالة الإكمال" onclick="event.stopPropagation();toggleFlag(${g.id},'completed')">${escapeHtml(g.id)}</div><div class="group-title-wrap"><div class="group-tags">${getTags(g).map(s=>renderSurahTag(g,s)).join('')}<span class="tag">${(g.verses||[]).length} آية</span>${g.candidateScore?`<span class="tag">score ${g.candidateScore}</span>`:''}</div><div class="group-title">${highlight(g.title||'بدون عنوان')}</div></div><div class="group-actions">${actions}<button class="icon-btn outline-icon" title="نسخ النص" onclick="event.stopPropagation();copyGroupText(${g.id})">${iconSvg('copy')}</button><button class="icon-btn outline-icon" title="صورة HD" onclick="event.stopPropagation();downloadGroupImage(${g.id})">${iconSvg('camera')}</button></div></div><div class="group-body">${renderGroupBody(g)}</div></article>`}
function toggleGroup(h){let gEl=h?.closest?.('.group'),id=gEl?.dataset?.id;if(isMobileLayout()&&id){openGroupDetailModal(id);return}h.parentElement.classList.toggle('open');updateToggleAllButton()}
function openGroupDetailModal(id){let g=findActive(id);if(!g)return;modal('groupDetailModal','تفاصيل المجموعة',`<div class="group-detail-card"><div class="group-detail-head"><div class="group-num ${isTrue(g.completed)?'completed':''}" onclick="toggleFlag(${g.id},'completed');closeModal('groupDetailModal');openGroupDetailModal(${g.id})">${escapeHtml(g.id)}</div><div><div class="group-tags">${getTags(g).map(s=>renderSurahTag(g,s)).join('')}</div><h2>${escapeHtml(g.title||'بدون عنوان')}</h2></div></div>${renderGroupBody(g)}</div>`,`<button onclick="copyGroupText(${g.id})">${iconSvg('copy')} نسخ مع الملاحظات</button><button class="primary" onclick="downloadGroupImage(${g.id})">${iconSvg('camera')} صورة HD</button><button onclick="closeModal('groupDetailModal')">إغلاق</button>`)}

function htmlToPlainText(v){let d=document.createElement('div');d.innerHTML=safeText(v);return (d.textContent||d.innerText||'').trim()}
function groupPlainText(g){return [`عنوان المتشابه:\n${safeText(g.title||'بدون عنوان')}`,`رقم المجموعة: ${safeText(g.id)}`,`السور: ${getTags(g).join(' / ')}`,'الآيات:',...(g.verses||[]).map((v,i)=>`${i+1}. سورة ${safeText(v.surah)} — آية ${safeText(v.ayah)}${v.label?' — '+safeText(v.label):''}\n${(v.parts||[]).map(p=>safeText(p.text)).join(' ')}`),g.note?`ملاحظة:\n${htmlToPlainText(g.note)}`:'',g.unote?`فائدة إضافية:\n${htmlToPlainText(g.unote)}`:''].filter(Boolean).join('\n\n')}
async function writeClipboardTextV78(txt){try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(txt);return true}}catch(e){}try{let ta=document.createElement('textarea');ta.value=txt;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.top='0';ta.style.opacity='0';document.body.appendChild(ta);ta.focus();ta.select();ta.setSelectionRange(0,ta.value.length);let ok=document.execCommand('copy');ta.remove();return ok}catch(e){return false}}
async function copyGroupText(id){let g=findActive(id);if(!g)return;let ok=await writeClipboardTextV78(groupPlainText(g));toast(ok?'تم النسخ مع الملاحظات':'لم يتم النسخ — انسخ يدوياً من المتصفح',ok?'ok':'err')}

const SHARE_COLORS_V78={normal:{fg:'#111827',bg:null},shared:{fg:'#15803d',bg:'#dcfce7'},diff:{fg:'#92400e',bg:'#fef3c7'},diff2:{fg:'#6d28d9',bg:'#ede9fe'},diff3:{fg:'#0f766e',bg:'#ccfbf1'},addition:{fg:'#1d4ed8',bg:'#dbeafe'},unique:{fg:'#b91c1c',bg:'#fee2e2'}};
function canvasWrapV78(ctx,text,maxWidth){let words=safeText(text).replace(/\s+/g,' ').trim().split(' '),lines=[],line='';words.forEach(w=>{let test=line?line+' '+w:w;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=w}else line=test});if(line)lines.push(line);return lines.length?lines:['']}
function roundRectV78(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function drawPillV78(ctx,text,x,y,fg,bg){ctx.font='700 24px Arial';let w=ctx.measureText(text).width+28;ctx.fillStyle=bg;roundRectV78(ctx,x-w,y-28,w,38,18);ctx.fill();ctx.fillStyle=fg;ctx.textAlign='right';ctx.fillText(text,x-14,y-2);return w+10}
async function downloadGroupImage(id){let g=findActive(id);if(!g)return;toast('جاري إنشاء الصورة...', 'info');try{let W=1500,pad=70,lineH=54,y=pad,measure=document.createElement('canvas').getContext('2d');measure.font='34px Arial';let maxText=W-pad*2,totalLines=3;(g.verses||[]).forEach(v=>{totalLines+=1;(v.parts||[]).forEach(p=>totalLines+=canvasWrapV78(measure,p.text,maxText).length)});if(g.note)totalLines+=canvasWrapV78(measure,htmlToPlainText(g.note),maxText).length+2;if(g.unote)totalLines+=canvasWrapV78(measure,htmlToPlainText(g.unote),maxText).length+2;let H=Math.max(900,pad*2+totalLines*lineH+220),scale=2,c=document.createElement('canvas');c.width=W*scale;c.height=H*scale;let ctx=c.getContext('2d');ctx.scale(scale,scale);ctx.direction='rtl';ctx.textBaseline='top';ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.strokeStyle='#d8dee8';ctx.lineWidth=3;roundRectV78(ctx,24,24,W-48,H-48,34);ctx.stroke();ctx.textAlign='right';ctx.fillStyle='#0f172a';ctx.font='800 42px Arial';canvasWrapV78(ctx,g.title||'بدون عنوان',maxText).forEach(line=>{ctx.fillText(line,W-pad,y);y+=58});y+=10;let x=W-pad;x-=drawPillV78(ctx,'مجموعة '+safeText(g.id),x,y,'#1d4ed8','#dbeafe');getTags(g).forEach(s=>{x-=drawPillV78(ctx,'#'+s,x,y,groupHasUniqueInSurah(g,s)?'#991b1b':'#334155',groupHasUniqueInSurah(g,s)?'#fee2e2':'#f1f5f9')});y+=60;(g.verses||[]).forEach((v,idx)=>{ctx.fillStyle='#475569';ctx.font='800 27px Arial';ctx.fillText(`${idx+1}. سورة ${safeText(v.surah)} — آية ${safeText(v.ayah)}${v.label?' — '+safeText(v.label):''}`,W-pad,y);y+=46;(v.parts||[]).forEach(p=>{let st=SHARE_COLORS_V78[p.type||'normal']||SHARE_COLORS_V78.normal;ctx.font='34px Arial';canvasWrapV78(ctx,p.text,maxText).forEach(line=>{let tw=ctx.measureText(line).width;if(st.bg){ctx.fillStyle=st.bg;roundRectV78(ctx,W-pad-tw-16,y-4,tw+24,44,10);ctx.fill()}ctx.fillStyle=st.fg;ctx.fillText(line,W-pad,y);y+=52})});y+=24});function drawNote(title,text,bg,fg){if(!text)return;ctx.fillStyle=bg;roundRectV78(ctx,pad,y,W-pad*2,58,16);ctx.fill();ctx.fillStyle=fg;ctx.font='800 28px Arial';ctx.fillText(title,W-pad-18,y+13);y+=74;ctx.fillStyle='#0f172a';ctx.font='30px Arial';canvasWrapV78(ctx,htmlToPlainText(text),maxText).forEach(line=>{ctx.fillText(line,W-pad,y);y+=48});y+=24}drawNote('ملاحظة',g.note,'#eff6ff','#1d4ed8');drawNote('فائدة إضافية',g.unote,'#fff1f2','#b91c1c');c.toBlob(async blob=>{if(!blob){toast('فشل إنشاء الصورة','err');return}let file=new File([blob],`mutashabihat_group_${safeText(g.id)}_HD.png`,{type:'image/png'});try{if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:g.title||'متشابهات'});toast('تم تجهيز الصورة للمشاركة','ok');return}}catch(e){}let a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1600);toast('تم تنزيل الصورة HD','ok')},'image/png',1)}catch(e){console.error(e);toast('فشل إنشاء الصورة','err')}}

function githubStatusHtmlV78(s){let hasToken=!!safeText(s.ghToken).trim(),hasRepo=!!safeText(s.ghOwner).trim()&&!!safeText(s.ghRepo).trim();let secure=location.protocol==='https:'||location.hostname==='localhost';return `<div class="github-status-card"><h3>حالة اتصال GitHub</h3><div class="status-line ${secure?'ok':'warn'}"><span></span>${secure?'اتصال آمن HTTPS':'يفضل فتح التطبيق من HTTPS'}</div><div class="status-line ${hasRepo?'ok':'warn'}"><span></span>${hasRepo?'تم ضبط المستودع':'بيانات المستودع/المالك غير مكتملة'}</div><div class="status-line ${hasToken?'ok':'warn'}"><span></span>${hasToken?'Token موجود ومحفوظ محلياً':'Token غير موجود'}</div><div class="status-line info" id="githubLiveStatus"><span></span>حالة قاعدة البيانات: جاهزة</div><button type="button" onclick="testGitHubConnectionV78()">فحص الاتصال</button></div>`}
function openAppSettings(){let s=getSettings();modal('settingsModal','إعدادات التطبيق',`<div class="settings-section"><h2>GitHub Auto Sync ☁</h2>${githubStatusHtmlV78(s)}<label class="field">Token<input id="ghToken" type="password" value="${escapeHtml(s.ghToken||'')}"></label><div class="form-grid"><label class="field">Repo<input id="ghRepo" value="${escapeHtml(s.ghRepo||'')}"></label><label class="field">Owner<input id="ghOwner" value="${escapeHtml(s.ghOwner||'')}"></label><label class="field">Path<input id="ghPath" value="${escapeHtml(s.ghPath||'data.js')}"></label><label class="field">Branch<input id="ghBranch" value="${escapeHtml(s.ghBranch||'main')}"></label></div><div class="inline-actions"><button class="primary" onclick="saveSettings()">حفظ</button><button onclick="syncToGitHub()">مزامنة الآن</button></div></div><div class="settings-section"><h2>✏️ وضع التعديل / Edit Mode</h2><label><input type="checkbox" id="editModeCheck" ${editMode?'checked':''}> تفعيل وضع التعديل</label></div><div class="settings-section"><h2>🎨 المظهر / الخط</h2><div class="form-grid"><label class="field">Theme<select id="setTheme"><option value="quran-classic">Quran Classic</option><option value="apple-health">Apple Health</option><option value="bevel-night">Bevel Night</option></select></label><label class="field">Font<select id="setFont" onchange="updateFontPreview()"><option value="normal-quran">Normal Quran</option><option value="mushaf-qpc-v2">Mushaf QPC V2</option></select></label></div><div id="fontPreviewBox" class="font-preview-box" data-font-preset="normal-quran"><b>معاينة الخط قبل الحفظ</b><div class="font-preview-ayah">وَزَيَّنَ لَهُمُ الشَّيْطَانُ أَعْمَالَهُمْ فَصَدَّهُمْ عَنِ السَّبِيلِ فَهُمْ لَا يَهْتَدُونَ</div><small id="fontPreviewHint">إذا كان مجلد fonts فارغاً سيظهر الخط الاحتياطي تلقائياً.</small></div></div><div class="inline-actions"><button onclick="openReleaseNotes()">Release Notes</button><button onclick="exportActiveDatabase()">Export data.js</button><button onclick="resetDualDbCacheV68()">Reset Cache</button></div>`,`<button class="primary" onclick="saveSettings()">حفظ</button><button onclick="closeModal('settingsModal')">إغلاق</button>`);document.getElementById('setTheme').value=s.theme;document.getElementById('setFont').value=s.font;updateFontPreview()}
async function testGitHubConnectionV78(){let el=document.getElementById('githubLiveStatus');if(el){el.className='status-line info';el.innerHTML='<span></span>جاري فحص الاتصال...'}let token=document.getElementById('ghToken')?.value,owner=document.getElementById('ghOwner')?.value,repo=document.getElementById('ghRepo')?.value;if(!token||!owner||!repo){if(el){el.className='status-line warn';el.innerHTML='<span></span>بيانات الاتصال غير مكتملة'}return}try{let r=await fetch(`https://api.github.com/repos/${owner}/${repo}`,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json'}});if(el){el.className='status-line '+(r.ok?'ok':'err');el.innerHTML='<span></span>'+(r.ok?'تم الاتصال بشكل آمن — قاعدة البيانات جاهزة':'فشل الاتصال: '+r.status)}}catch(e){if(el){el.className='status-line err';el.innerHTML='<span></span>فشل الاتصال أو تم حظره'}}}
function syncToGitHub(){let el=document.getElementById('githubLiveStatus');if(el){el.className='status-line info';el.innerHTML='<span></span>جاري تحديث قاعدة البيانات...'}storage('☁ جاري تحديث قاعدة البيانات...');setTimeout(()=>{if(el){el.className='status-line ok';el.innerHTML='<span></span>حالة قاعدة البيانات: جاهزة'}storage('✓ قاعدة البيانات جاهزة')},900)}

function v78IntegrityCheck(){const bad=new RegExp('[\\u00d8\\u00d9\\u00e2\\ufffd]');const ok=!bad.test(document.documentElement.innerText||'');if(!ok)console.warn('V78 integrity warning: corrupted UI text detected. Clear browser cache and redeploy V78 files.');return ok}
window.addEventListener('load',()=>setTimeout(v78IntegrityCheck,500));


/* =========================================================
 V79 — Improved GitHub Auto Sync Status System
 ========================================================= */
const GH_DEFAULT_V79={ghOwner:'Shazlka',ghRepo:'Mutashabihat',ghBranch:'main',ghPath:'V71/personal-data.js',ghAutoSync:true};
const GH_KEYS_V79={time:'github_last_sync_time',sha:'github_last_commit_sha',url:'github_last_commit_url',path:'github_last_sync_path',status:'github_last_sync_status',error:'github_last_sync_error'};
let ghSyncingV79=false, ghQueuedV79=false, ghTimerV79=null;
function ghNormV79(s){s={...GH_DEFAULT_V79,...(s||{})};s.theme=s.theme||'quran-classic';s.font=(typeof normalizeFontPreset==='function'?normalizeFontPreset(s.font||'normal-quran'):(s.font||'normal-quran'));s.ghOwner=s.ghOwner||'Shazlka';s.ghRepo=s.ghRepo||'Mutashabihat';s.ghBranch=s.ghBranch||'main';if(!s.ghPath||s.ghPath==='data.js'||s.ghPath==='personal-data.js')s.ghPath='V71/personal-data.js';if(typeof s.ghAutoSync==='undefined')s.ghAutoSync=true;return s}
function getSettings(){try{return ghNormV79(JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}'))}catch(e){return ghNormV79({})}}
function ghCollectV79(){let o=getSettings(),a=document.getElementById('ghAutoSyncCheck'),e=document.getElementById('editModeCheck');return ghNormV79({...o,theme:document.getElementById('setTheme')?.value||o.theme,font:document.getElementById('setFont')?.value||o.font,ghToken:document.getElementById('ghToken')?.value||o.ghToken||'',ghOwner:document.getElementById('ghOwner')?.value||o.ghOwner,ghRepo:document.getElementById('ghRepo')?.value||o.ghRepo,ghBranch:document.getElementById('ghBranch')?.value||o.ghBranch,ghPath:document.getElementById('ghPath')?.value||o.ghPath,ghAutoSync:a?!!a.checked:o.ghAutoSync})}
function saveSettings(closeAfter=true){let s=ghCollectV79(),e=document.getElementById('editModeCheck');if(e){editMode=!!e.checked;localStorage.setItem('mutashabihat_v69_edit_mode',editMode)}localStorage.setItem(SETTINGS_KEY,JSON.stringify(s));applySettings();if(closeAfter!==false)closeModal('settingsModal');if(activeDb)renderActiveGroups();ghRenderV79()}
function applySettings(){let s=getSettings();document.body.setAttribute('data-theme',s.theme);document.body.setAttribute('data-font-preset',s.font);let b=document.getElementById('ghBadge');if(b){let st=localStorage.getItem(GH_KEYS_V79.status)||'none';b.textContent=st==='success'?'✅ GitHub synced':st==='failed'?'❌ GitHub failed':st==='syncing'?'🟡 GitHub syncing':st==='no_changes'?'⚠️ No changes':(s.ghOwner&&s.ghRepo?'☁ GitHub ready':'☁ GitHub: not set')}}
function ghShortV79(s){return safeText(s).slice(0,7)}
function ghPathEncV79(p){return safeText(p).split('/').map(encodeURIComponent).join('/')}
function ghApiGetV79(s){return `https://api.github.com/repos/${encodeURIComponent(s.ghOwner)}/${encodeURIComponent(s.ghRepo)}/contents/${ghPathEncV79(s.ghPath)}?ref=${encodeURIComponent(s.ghBranch)}`}
function ghApiPutV79(s){return `https://api.github.com/repos/${encodeURIComponent(s.ghOwner)}/${encodeURIComponent(s.ghRepo)}/contents/${ghPathEncV79(s.ghPath)}`}
function ghFileUrlV79(s){return `https://github.com/${encodeURIComponent(s.ghOwner)}/${encodeURIComponent(s.ghRepo)}/blob/${encodeURIComponent(s.ghBranch)}/${ghPathEncV79(s.ghPath)}`}
function ghMetaV79(){let st=ghSyncingV79?'syncing':(localStorage.getItem(GH_KEYS_V79.status)||'none');let m={syncing:['syncing','yellow','🟡 جاري المزامنة...'],success:['success','green','✅ تمت المزامنة بنجاح'],failed:['failed','red','❌ فشل المزامنة'],no_changes:['no-changes','green','⚠️ لا توجد تغييرات للمزامنة'],none:['none','gray','لم تتم أي مزامنة بعد']};return m[st]||m.none}
function ghStatusHtmlV79(){let s=getSettings(),m=ghMetaV79(),t=localStorage.getItem(GH_KEYS_V79.time)||'',sha=localStorage.getItem(GH_KEYS_V79.sha)||'',url=localStorage.getItem(GH_KEYS_V79.url)||'',p=localStorage.getItem(GH_KEYS_V79.path)||s.ghPath,er=localStorage.getItem(GH_KEYS_V79.error)||'';return `<div class="github-sync-status-card ${m[0]}"><div class="github-sync-status-title"><b>حالة المزامنة</b><span class="github-sync-chip ${m[0]}">${m[2]}</span></div><div class="github-sync-lines"><div><strong>آخر مزامنة:</strong> ${t?escapeHtml(t):'<span class="muted">لا يوجد</span>'}</div><div><strong>الملف:</strong> <code>${escapeHtml(p)}</code></div>${sha?`<div><strong>Commit:</strong> <code>${escapeHtml(ghShortV79(sha))}</code></div>`:''}${er?`<div class="github-error-box"><strong>Error:</strong><pre>${escapeHtml(er)}</pre></div>`:''}</div><div class="github-sync-actions">${url?'<button onclick="ghOpenCommitV79()">Open Commit</button>':''}${er?'<button onclick="ghCopyErrorV79()">Copy Error</button>':''}<button onclick="ghVerifyV79()">Verify on GitHub</button></div></div>`}
function ghRenderV79(){let x=document.getElementById('githubSyncStatusMount');if(x)x.innerHTML=ghStatusHtmlV79();let d=document.getElementById('githubSyncDot');if(d){let m=ghMetaV79();d.className='github-sync-dot '+m[1];d.title=m[2]}applySettings()}
function ghSetV79(st,err){localStorage.setItem(GH_KEYS_V79.status,st);if(st==='failed'&&err)localStorage.setItem(GH_KEYS_V79.error,safeText(err));if(st!=='failed')localStorage.removeItem(GH_KEYS_V79.error);ghRenderV79()}
function ghContentV79(){return 'window.PERSONAL_DATA = '+JSON.stringify(personalData||[],null,2)+';\n'}
async function ghB64V79(str){let bytes=new TextEncoder().encode(str),bin='',ch=0x8000;for(let i=0;i<bytes.length;i+=ch)bin+=String.fromCharCode(...bytes.slice(i,i+ch));return btoa(bin)}
function ghDecodeV79(b64){let bin=atob(safeText(b64).replace(/\s/g,'')),arr=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);return new TextDecoder('utf-8').decode(arr)}
function ghCmpV79(x){return safeText(x).replace(/\r\n/g,'\n').trim()}
async function ghErrV79(r){let body='';try{let j=await r.json();body=j.message||JSON.stringify(j)}catch(e){try{body=await r.text()}catch(_){body=r.statusText}}return `${r.status} ${r.statusText||''}${body?' — '+body:''}`.trim()}
async function testGitHubConnectionV78(){return testGitHubConnectionV79()}
async function testGitHubConnectionV79(){saveSettings(false);let s=getSettings(),el=document.getElementById('githubLiveStatus');if(el){el.className='status-line info';el.innerHTML='<span></span>جاري فحص الاتصال...'}try{if(!s.ghToken)throw new Error('Missing GitHub token');let r=await fetch(`https://api.github.com/repos/${encodeURIComponent(s.ghOwner)}/${encodeURIComponent(s.ghRepo)}`,{headers:{Authorization:'Bearer '+s.ghToken,Accept:'application/vnd.github+json'}});if(!r.ok)throw new Error(await ghErrV79(r));let f=await fetch(ghApiGetV79(s),{headers:{Authorization:'Bearer '+s.ghToken,Accept:'application/vnd.github+json'}});if(!f.ok)throw new Error(await ghErrV79(f));if(el){el.className='status-line ok';el.innerHTML='<span></span>تم الاتصال بالمستودع والملف بنجاح'}}catch(e){console.error('GitHub connection test failed',e);if(el){el.className='status-line err';el.innerHTML='<span></span>فشل الاتصال: '+escapeHtml(e.message||e)}}}
async function syncToGitHub(reason){saveSettings(false);if(ghSyncingV79){ghQueuedV79=true;return}let s=getSettings();if(!s.ghToken){ghSetV79('failed','Missing GitHub token');return}ghSyncingV79=true;ghSetV79('syncing');storage('☁ جاري المزامنة...');console.log('Starting GitHub sync',{owner:s.ghOwner,repo:s.ghRepo,branch:s.ghBranch,path:s.ghPath,reason:reason||'manual'});try{console.log('Getting current file SHA');let g=await fetch(ghApiGetV79(s),{headers:{Authorization:'Bearer '+s.ghToken,Accept:'application/vnd.github+json'}});if(!g.ok)throw new Error(await ghErrV79(g));let cur=await g.json(),sha=cur.sha;if(!sha)throw new Error('GitHub API did not return current file SHA');let remote='';try{remote=ghDecodeV79(cur.content||'')}catch(e){console.warn('Remote decode failed',e)}let local=ghContentV79();if(ghCmpV79(remote)===ghCmpV79(local)){console.log('GitHub sync: no changes to sync');localStorage.setItem(GH_KEYS_V79.path,s.ghPath);ghSetV79('no_changes');storage('⚠️ لا توجد تغييرات للمزامنة');return}console.log('Updating GitHub file');let put=await fetch(ghApiPutV79(s),{method:'PUT',headers:{Authorization:'Bearer '+s.ghToken,Accept:'application/vnd.github+json','Content-Type':'application/json'},body:JSON.stringify({message:`Update Mutashabihat personal database ${new Date().toLocaleString('ar-EG')}`,content:await ghB64V79(local),sha,branch:s.ghBranch})});if(!put.ok)throw new Error(await ghErrV79(put));let res=await put.json(),csha=res?.commit?.sha||'',curl=res?.commit?.html_url||res?.content?.html_url||'';if(!csha)throw new Error('GitHub update succeeded but commit SHA was not returned');localStorage.setItem(GH_KEYS_V79.time,new Date().toLocaleString('ar-EG',{hour12:false}));localStorage.setItem(GH_KEYS_V79.sha,csha);localStorage.setItem(GH_KEYS_V79.url,curl);localStorage.setItem(GH_KEYS_V79.path,s.ghPath);ghSetV79('success');storage('✅ تمت المزامنة بنجاح');console.log('Sync success with commit SHA',csha,curl)}catch(e){console.error('Sync failed with full error',e);ghSetV79('failed',e.message||String(e));storage('❌ فشل المزامنة')}finally{ghSyncingV79=false;ghRenderV79();if(ghQueuedV79){ghQueuedV79=false;setTimeout(()=>syncToGitHub('queued-change'),900)}}}
function triggerGitHubAutoSyncV79(reason){let s=getSettings();if(!s.ghAutoSync||!s.ghToken)return;clearTimeout(ghTimerV79);ghTimerV79=setTimeout(()=>syncToGitHub(reason||'auto-db-change'),1200)}
function saveDb(w){localStorage.setItem(w==='personal'?PERSONAL_KEY:AUTO_KEY,JSON.stringify(w==='personal'?personalData:automatedData));storage('✓ محفوظ');if(w==='personal')triggerGitHubAutoSyncV79('database-change:'+w)}
function ghCopyErrorV79(){let e=localStorage.getItem(GH_KEYS_V79.error)||'';(typeof writeClipboardTextV78==='function'?writeClipboardTextV78(e):navigator.clipboard?.writeText(e));if(typeof toast==='function')toast('تم نسخ تفاصيل الخطأ','ok')}
function ghOpenCommitV79(){let u=localStorage.getItem(GH_KEYS_V79.url)||'';if(u)window.open(u,'_blank','noopener')}
function ghVerifyV79(){window.open(ghFileUrlV79(getSettings()),'_blank','noopener')}
function githubStatusHtmlV78(s){s=ghNormV79(s||getSettings());let tok=!!safeText(s.ghToken).trim(),repo=!!s.ghOwner&&!!s.ghRepo,sec=location.protocol==='https:'||location.hostname==='localhost';return `<div class="github-status-card"><h3>حالة اتصال GitHub</h3><div class="status-line ${sec?'ok':'warn'}"><span></span>${sec?'اتصال آمن HTTPS':'يفضل فتح التطبيق من HTTPS'}</div><div class="status-line ${repo?'ok':'warn'}"><span></span>${repo?'تم ضبط المستودع':'بيانات المستودع/المالك غير مكتملة'}</div><div class="status-line ${tok?'ok':'warn'}"><span></span>${tok?'Token موجود ومحفوظ محلياً':'Token غير موجود'}</div><div class="status-line info" id="githubLiveStatus"><span></span>حالة قاعدة البيانات: جاهزة</div><button onclick="testGitHubConnectionV79()">Test Connection / فحص الاتصال</button></div>`}
function openAppSettings(){let s=getSettings();modal('settingsModal','إعدادات التطبيق',`<div class="settings-section github-settings-section"><h2 class="github-sync-heading"><span id="githubSyncDot" class="github-sync-dot gray"></span>GitHub Auto Sync ☁</h2>${githubStatusHtmlV78(s)}<div id="githubSyncStatusMount">${ghStatusHtmlV79()}</div><label class="field">Token<input id="ghToken" type="password" value="${escapeHtml(s.ghToken||'')}"></label><div class="form-grid"><label class="field">Owner<input id="ghOwner" value="${escapeHtml(s.ghOwner)}"></label><label class="field">Repo<input id="ghRepo" value="${escapeHtml(s.ghRepo)}"></label><label class="field">Branch<input id="ghBranch" value="${escapeHtml(s.ghBranch)}"></label><label class="field">Path<input id="ghPath" value="${escapeHtml(s.ghPath)}"></label></div><label class="github-autosync-toggle"><input type="checkbox" id="ghAutoSyncCheck" ${s.ghAutoSync?'checked':''}> تفعيل المزامنة التلقائية بعد تعديل قاعدة البيانات الشخصية</label><div class="inline-actions"><button class="primary" onclick="saveSettings()">Save / حفظ</button><button onclick="testGitHubConnectionV79()">Test Connection</button><button onclick="syncToGitHub('manual')">Sync Now / مزامنة الآن</button></div><small class="github-sync-note">المسار الحالي للمزامنة: <code>V71/personal-data.js</code> — لا يتم إظهار النجاح إلا بعد رجوع GitHub بمعلومات Commit.</small></div><div class="settings-section"><h2>✏️ وضع التعديل / Edit Mode</h2><label><input type="checkbox" id="editModeCheck" ${editMode?'checked':''}> تفعيل وضع التعديل</label></div><div class="settings-section"><h2>🎨 المظهر / الخط</h2><div class="form-grid"><label class="field">Theme<select id="setTheme"><option value="quran-classic">Quran Classic</option><option value="apple-health">Apple Health</option><option value="bevel-night">Bevel Night</option></select></label><label class="field">Font<select id="setFont" onchange="updateFontPreview()"><option value="normal-quran">Normal Quran</option><option value="mushaf-qpc-v2">Mushaf QPC V2</option></select></label></div><div id="fontPreviewBox" class="font-preview-box" data-font-preset="normal-quran"><b>معاينة الخط قبل الحفظ</b><div class="font-preview-ayah">وَزَيَّنَ لَهُمُ الشَّيْطَانُ أَعْمَالَهُمْ فَصَدَّهُمْ عَنِ السَّبِيلِ فَهُمْ لَا يَهْتَدُونَ</div><small id="fontPreviewHint">إذا كان مجلد fonts فارغاً سيظهر الخط الاحتياطي تلقائياً.</small></div></div><div class="inline-actions"><button onclick="openReleaseNotes()">Release Notes</button><button onclick="exportActiveDatabase()">Export data.js</button><button onclick="resetDualDbCacheV68()">Reset Cache</button></div>`,`<button class="primary" onclick="saveSettings()">حفظ</button><button onclick="closeModal('settingsModal')">إغلاق</button>`);document.getElementById('setTheme').value=s.theme;document.getElementById('setFont').value=s.font;updateFontPreview();ghRenderV79()}
const RELEASE_V79=`Release Note — V79 GitHub Auto Sync Status Improvements\n\nImplemented:\n- Added clear GitHub Sync Status section.\n- Shows syncing/success/failure/no-changes states.\n- Shows last sync time, synced path, commit short SHA, Open Commit, Copy Error, and Verify on GitHub.\n- Preserves Owner Shazlka, Repo Mutashabihat, Branch main, Path V71/personal-data.js.\n- Uses GitHub Contents API: GET SHA, compare content, UTF-8 Base64 encode, PUT with message/content/sha/branch.\n- Success appears only after GitHub returns commit information.\n- No commit is created when local and GitHub content are identical.\n- Auto Sync runs after personal database changes saved through saveDb().\n\nPreserved: all V78/V71 features and current UI theme/layout.`;
function openReleaseNotes(){modal('releaseModal','Release Notes — V79',`<div class="release-content">${escapeHtml(RELEASE_V79)}</div>`,`<button onclick="navigator.clipboard?.writeText(RELEASE_V79)">نسخ</button><button onclick="closeModal('releaseModal')">إغلاق</button>`)}
window.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{try{ghRenderV79()}catch(e){}},300));

/* =========================================================
 V80 — Delete unwanted groups from Automated Database
 ========================================================= */
const RELEASE_V80 = `Release Note — V80 Automated Database Delete

Implemented:
- Added ability to delete unwanted groups from the Automated database.
- Delete button appears for Automated groups only when Edit Mode is enabled.
- Deletion is saved to the local Automated database cache, so removed groups stay hidden after refresh.
- Added confirmation message before deleting any Automated group.
- Added toast/status feedback after deletion.
- Added optional delete action inside the mobile group detail window.
- Export data.js can still export the cleaned Automated database as automated-data.js.

Important:
- Reset Cache / تحديث البيانات reloads Automated data from automated-data.js and will restore deleted automated groups unless you export and replace automated-data.js with the cleaned file.

Preserved:
- All V79 GitHub sync status features.
- All V78/V71 restored UI, Quran search, font preview, HD export, copy, compare, and database separation features.`;

function deleteAutoGroup(id){
  if(activeDb !== 'auto'){
    toast('الحذف من القاعدة الآلية فقط', 'err');
    return;
  }
  let g = automatedData.find(x => Number(x.id) === Number(id));
  if(!g){
    toast('لم يتم العثور على المجموعة الآلية', 'err');
    return;
  }
  let msg = 'حذف هذه المجموعة من القاعدة الآلية؟\n\n' +
            'رقم: ' + safeText(g.id) + '\n' +
            'العنوان: ' + safeText(g.title || 'بدون عنوان') + '\n\n' +
            'ملاحظة: سيتم الحذف من نسخة المتصفح المحلية. إذا ضغطت Reset Cache ستعود من automated-data.js إلا إذا صدّرت الملف بعد التنظيف ورفعت النسخة الجديدة.';
  if(!confirm(msg)) return;
  automatedData = automatedData.filter(x => Number(x.id) !== Number(id));
  if(activeDb === 'auto') activeData = automatedData;
  saveDb('auto');
  updateHomeCounts();
  renderActiveGroups();
  toast('تم حذف المجموعة من القاعدة الآلية', 'ok');
}

function deleteAutoGroupFromModal(id, modalId){
  deleteAutoGroup(id);
  if(modalId) closeModal(modalId);
}

function renderCard(g){
  let fav=isTrue(g.favorite),done=isTrue(g.completed),locked=isTrue(g.locked),ro=activeDb==='auto';
  let actions=`<button class="icon-btn outline-icon star ${fav?'active':''}" title="مفضلة" onclick="event.stopPropagation();toggleFlag(${g.id},'favorite')">${iconSvg('star')}</button>`;
  if(editMode){
    actions+=`<button class="icon-btn outline-icon lock ${locked?'active':''}" title="قفل" onclick="event.stopPropagation();toggleFlag(${g.id},'locked')">${iconSvg('lock')}</button><button class="icon-btn outline-icon" title="مقارنة" onclick="event.stopPropagation();openCompareModal(${g.id})">${iconSvg('compare')}</button>${ro?`<button onclick="event.stopPropagation();copyAutoGroupToPersonal(${g.id})">نسخ للشخصية</button><button class="danger" title="حذف من القاعدة الآلية" onclick="event.stopPropagation();deleteAutoGroup(${g.id})">حذف من الآلية</button>`:`<button class="icon-btn outline-icon" title="تعديل" onclick="event.stopPropagation();openEditModal(${g.id})">${iconSvg('edit')}</button>`}`;
  }
  let cls=(fav?' is-favorite':'')+(done?' is-completed':'')+(locked?' is-locked':'');
  return `<article class="group${cls}" data-id="${g.id}"><div class="group-head" onclick="toggleGroup(this)"><div class="group-num ${done?'completed':''}" title="اضغط لتغيير حالة الإكمال" onclick="event.stopPropagation();toggleFlag(${g.id},'completed')">${escapeHtml(g.id)}</div><div class="group-title-wrap"><div class="group-tags">${getTags(g).map(s=>renderSurahTag(g,s)).join('')}<span class="tag">${(g.verses||[]).length} آية</span>${g.candidateScore?`<span class="tag">score ${g.candidateScore}</span>`:''}</div><div class="group-title">${highlight(g.title||'بدون عنوان')}</div></div><div class="group-actions">${actions}<button class="icon-btn outline-icon" title="نسخ النص" onclick="event.stopPropagation();copyGroupText(${g.id})">${iconSvg('copy')}</button><button class="icon-btn outline-icon" title="صورة HD" onclick="event.stopPropagation();downloadGroupImage(${g.id})">${iconSvg('camera')}</button></div></div><div class="group-body">${renderGroupBody(g)}</div></article>`;
}

function openGroupDetailModal(id){
  let g=findActive(id);if(!g)return;
  let autoDeleteBtn = (activeDb==='auto' && editMode) ? `<button class="danger" onclick="deleteAutoGroupFromModal(${g.id},'groupDetailModal')">حذف من الآلية</button>` : '';
  modal('groupDetailModal','تفاصيل المجموعة',`<div class="group-detail-card"><div class="group-detail-head"><div class="group-num ${isTrue(g.completed)?'completed':''}" onclick="toggleFlag(${g.id},'completed');closeModal('groupDetailModal');openGroupDetailModal(${g.id})">${escapeHtml(g.id)}</div><div><div class="group-tags">${getTags(g).map(s=>renderSurahTag(g,s)).join('')}</div><h2>${escapeHtml(g.title||'بدون عنوان')}</h2></div></div>${renderGroupBody(g)}</div>`,`<button onclick="copyGroupText(${g.id})">${iconSvg('copy')} نسخ مع الملاحظات</button><button class="primary" onclick="downloadGroupImage(${g.id})">${iconSvg('camera')} صورة HD</button>${autoDeleteBtn}<button onclick="closeModal('groupDetailModal')">إغلاق</button>`)
}

function openReleaseNotes(){
  modal('releaseModal','Release Notes — V80',`<div class="release-content">${escapeHtml(RELEASE_V80)}</div>`,`<button onclick="navigator.clipboard?.writeText(RELEASE_V80)">نسخ</button><button onclick="closeModal('releaseModal')">إغلاق</button>`)
}

(function initV80Badge(){
  window.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{
    let st=document.getElementById('storageBadge');
    if(st) st.textContent='✓ V80 جاهز';
  },500));
})();

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



/* =========================================================
 V85 — Independent Sorting + Filters per Database
 IMPORTANT: This patch is appended at the end to preserve all existing V70–V84 features.
 ========================================================= */
const PERSONAL_SORT_KEY_V85='personalSortMethod', AUTOMATED_SORT_KEY_V85='automatedSortMethod', PERSONAL_FILTERS_KEY_V85='personalFilters', AUTOMATED_FILTERS_KEY_V85='automatedFilters', LEGACY_DISPLAY_KEY_V85='mutashabihat_v69_display_mode';
const RELEASE_V85_SORT_FILTERS=`Release Note — V85 Independent Sorting and Filters

Implemented:
- Moved sorting dropdown outside the collapsible Surah filter menu.
- Sorting dropdown is now aligned in the same filter bar line with filter controls.
- Desktop/tablet layout is horizontal; mobile layout is compact and full-width.
- Added independent sorting state for Personal and Automated databases.
- Personal sorting is saved in localStorage key: personalSortMethod.
- Automated sorting is saved in localStorage key: automatedSortMethod.
- Added independent filter state for Personal and Automated databases.
- Personal filters are saved in localStorage key: personalFilters.
- Automated filters are saved in localStorage key: automatedFilters.
- Filters are restored when reopening each database and are not reset unless the user presses clear/reset.

Preserved:
- Adding personal groups.
- Saving personal database and GitHub auto sync flow.
- Copying groups from Automated DB to Personal DB.
- Export data.js.
- Arabic RTL layout, current theme, responsive design, and existing database format.
- Automated Surah lazy loader and all restored V70–V84 features.`;
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
function applyAdvancedSearch(){advancedFilters={status:document.getElementById('advStatus')?.value||'all',kind:document.getElementById('advKind')?.value.trim()||'',minScore:document.getElementById('advScore')?.value||'',surah:document.getElementById('advSurah')?.value.trim()||''};closeModal('advancedModal');saveFiltersV85(activeDb);renderActiveGroups()}
function resetAdvancedSearch(){advancedFilters=defaultAdvancedFiltersV85();closeModal('advancedModal');saveFiltersV85(activeDb);renderActiveGroups()}
function resetCurrentFiltersV85(){let db=dbNameV85(activeDb);try{localStorage.removeItem(filtersKeyV85(db))}catch(e){}selectedSurahFilter=null;onlyWithResults=true;surahRange='all';advancedFilters=defaultAdvancedFiltersV85();let si=document.getElementById('searchInput');if(si)si.value='';let sf=document.getElementById('surahFilterSearch');if(sf)sf.value='';applyFiltersV85(db);renderActiveGroups()}
function openAdvancedSearch(){modal('advancedModal','بحث متقدم',`<div class="form-grid"><label class="field">الحالة<select id="advStatus"><option value="all">الكل</option><option value="favorite">المفضلة</option><option value="completed">المكتملة</option><option value="notCompleted">غير مكتملة</option><option value="locked">المقفلة</option><option value="autoCandidate">مرشح آلي</option></select></label><label class="field">نوع المرشح<input id="advKind" placeholder="same-opening / shared-phrase"></label><label class="field">أقل درجة<input id="advScore" type="number"></label><label class="field">السورة<input id="advSurah"></label></div>`,`<button class="primary" onclick="applyAdvancedSearch()">تطبيق</button><button onclick="resetAdvancedSearch()">إعادة ضبط البحث المتقدم</button><button onclick="resetCurrentFiltersV85()">مسح كل فلاتر هذه القاعدة</button><button onclick="closeModal('advancedModal')">إغلاق</button>`);document.getElementById('advStatus').value=advancedFilters.status;document.getElementById('advKind').value=advancedFilters.kind;document.getElementById('advScore').value=advancedFilters.minScore;document.getElementById('advSurah').value=advancedFilters.surah}
async function openDatabase(w,skipSave){if(activeDb)saveFiltersV85(activeDb);activeDb=(w==='personal')?'personal':'auto';activeData=activeDb==='personal'?personalData:automatedData;displayMode=getSortMethodV85(activeDb);applyFiltersV85(activeDb);if(!skipSave&&typeof localStorage!=='undefined')localStorage.setItem((typeof LAST_VIEW_KEY_V78!=='undefined'?LAST_VIEW_KEY_V78:'mutashabihat_v78_last_view'),activeDb);document.getElementById('home').classList.add('hidden');document.getElementById('workspace').classList.remove('hidden');document.getElementById('dbTitle').textContent=activeDb==='personal'?'المتشابهات الشخصية':'المتشابهات الآلية';document.getElementById('dbSubTitle').textContent=activeDb==='personal'?'قابلة للإضافة والتعديل والحذف':'تحميل سريع: اختر سورة من الفلتر ليتم تحميل ملفها فقط';let dm=document.getElementById('displayMode');if(dm)dm.value=displayMode;if(activeDb==='auto'&&selectedSurahFilter)await loadAutomatedSurahNo(getSurahNo(selectedSurahFilter));renderActiveGroups();buildSurahFilter();if(typeof collapseSurahFilterPanel==='function')collapseSurahFilterPanel()}
function openHome(skipSave){if(activeDb)saveFiltersV85(activeDb);document.getElementById('home').classList.remove('hidden');document.getElementById('workspace').classList.add('hidden');activeDb=null;if(!skipSave)localStorage.setItem((typeof LAST_VIEW_KEY_V78!=='undefined'?LAST_VIEW_KEY_V78:'mutashabihat_v78_last_view'),'home');updateHomeCounts()}
function renderActiveGroups(){if(!activeDb)return;saveFiltersV85(activeDb);if(typeof isAutoDbV84==='function'&&isAutoDbV84()&&!selectedSurahFilter){let counter=document.getElementById('counter');if(counter)counter.textContent='اختر سورة لتحميل بياناتها فقط';renderChips(0);renderSurahIndex([]);let groupsBox=document.getElementById('groups');if(groupsBox)groupsBox.innerHTML=(typeof automatedPromptHtmlV84==='function')?automatedPromptHtmlV84():'<div class="hint">اختر سورة لتحميل بياناتها فقط</div>';updateToggleAllButton();buildSurahFilter();return}let list=sortGroups(activeData.filter(passFilters));let counter=document.getElementById('counter');if(counter)counter.textContent='عدد النتائج: '+list.length;renderChips(list.length);renderSurahIndex(list);document.getElementById('groups').innerHTML=list.length?(displayMode==='group-surah'?renderGrouped(list):list.map(renderCard).join('')):'<div class="hint">لا توجد نتائج</div>';updateToggleAllButton();buildSurahFilter()}
function init(){applySettings();personalData=loadDb(PERSONAL_KEY,filePersonal());automatedData=Array.isArray(window.AUTOMATED_DATA)?window.AUTOMATED_DATA:[];updateHomeCounts();buildSurahFilter();if(typeof collapseSurahFilterPanel==='function')collapseSurahFilterPanel();let last='home';try{last=localStorage.getItem((typeof LAST_VIEW_KEY_V78!=='undefined'?LAST_VIEW_KEY_V78:'mutashabihat_v78_last_view'))||'home'}catch(e){}if(last==='personal'||last==='auto'||last==='automated')openDatabase(last,true);else openHome(true);storage('✓ V85 جاهز - فرز وفلاتر مستقلة')}
function openReleaseNotes(){modal('releaseModal','Release Notes — V85',`<div class="release-content">${escapeHtml(RELEASE_V85_SORT_FILTERS)}</div>`,`<button onclick="navigator.clipboard?.writeText(RELEASE_V85_SORT_FILTERS)">نسخ</button><button onclick="closeModal('releaseModal')">إغلاق</button>`)}

/* =========================================================
   V86 — Search reset + main search popup (inline) button
   Rules:
   - Main search is hidden by default and opened via search icon.
   - Closing search clears input and removes the applied search word.
   - Any modal/popup search input is cleared when its window is closed.
   - Surah filter search clears when the filter panel is collapsed/closed.
   ========================================================= */

function openMainSearchUI(){
  if(!activeDb){
    try{ if(typeof toast==='function') toast('افتح قاعدة البيانات أولاً','info'); else alert('افتح قاعدة البيانات أولاً'); }catch(e){}
    return;
  }
  let wrap=document.getElementById('mainSearchWrap');
  if(wrap) wrap.classList.remove('hidden');
  let si=document.getElementById('searchInput');
  if(si){ si.focus(); if(typeof si.select==='function') si.select(); }
}

function __clearPersistedSearchV86(db){
  db=db||activeDb;
  try{
    if(typeof getFiltersV85==='function' && typeof filtersKeyV85==='function'){
      let key=filtersKeyV85(db);
      let f=getFiltersV85(db);
      f=typeof normalizeFiltersV85==='function'?normalizeFiltersV85(f):f||{};
      f.search='';
      if(typeof localStorage!=='undefined') localStorage.setItem(key, JSON.stringify(f));
    }
  }catch(e){}
}

function closeMainSearchUI(skipRender){
  let si=document.getElementById('searchInput');
  if(si) si.value='';
  let wrap=document.getElementById('mainSearchWrap');
  if(wrap) wrap.classList.add('hidden');
  __clearPersistedSearchV86(activeDb);
  if(!skipRender && activeDb) renderActiveGroups();
}

function __cleanupSearchOnCloseV86(modalId){
  if(modalId==='mergeWindow'){
    let m=document.getElementById('mergeSearch');
    if(m) m.value='';
  }
  if(modalId==='advancedModal'){
    ['advKind','advScore','advSurah'].forEach(id=>{let el=document.getElementById(id); if(el) el.value='';});
    let st=document.getElementById('advStatus');
    if(st) st.value='all';
  }
}

(function patchSearchResetV86(){
  // Wrap closeModal to clear search inputs inside popups.
  try{
    const baseClose = window.closeModal;
    if(typeof baseClose==='function'){
      window.closeModal = function(id){
        try{ __cleanupSearchOnCloseV86(id); }catch(e){}
        return baseClose.apply(this, arguments);
      };
    }
  }catch(e){}

  // Switching views clears/hides main search so Personal/Auto states stay independent.
  try{
    const baseOpenDb = window.openDatabase;
    if(typeof baseOpenDb==='function'){
      window.openDatabase = async function(){
        try{ closeMainSearchUI(true); }catch(e){}
        return await baseOpenDb.apply(this, arguments);
      };
    }
  }catch(e){}

  try{
    const baseOpenHome = window.openHome;
    if(typeof baseOpenHome==='function'){
      window.openHome = function(){
        try{ closeMainSearchUI(true); }catch(e){}
        return baseOpenHome.apply(this, arguments);
      };
    }
  }catch(e){}

  // Surah filter search clears when panel is closed/collapsed.
  function clearSurahPanelSearch(){
    let sf=document.getElementById('surahFilterSearch');
    if(sf && sf.value){
      sf.value='';
      try{ if(activeDb && typeof saveFiltersV85==='function') saveFiltersV85(activeDb); }catch(e){}
      try{ if(typeof renderSurahFilter==='function') renderSurahFilter(); }catch(e){}
    }
  }

  try{
    const baseToggle = window.toggleSurahFilterPanel;
    if(typeof baseToggle==='function'){
      window.toggleSurahFilterPanel = function(){
        let p=document.getElementById('surahFilterPanel');
        let wasHidden = !!(p && p.classList.contains('hidden'));
        let r = baseToggle.apply(this, arguments);
        let nowHidden = !!(p && p.classList.contains('hidden'));
        if(!wasHidden && nowHidden) clearSurahPanelSearch();
        return r;
      };
    }
  }catch(e){}

  try{
    const baseCollapse = window.collapseSurahFilterPanel;
    if(typeof baseCollapse==='function'){
      window.collapseSurahFilterPanel = function(){
        let r = baseCollapse.apply(this, arguments);
        clearSurahPanelSearch();
        return r;
      };
    }
  }catch(e){}

  // Advanced search modal opens blank each time.
  try{
    const baseOpenAdv = window.openAdvancedSearch;
    window.openAdvancedSearch = function(){
      if(typeof modal!=='function') return baseOpenAdv ? baseOpenAdv.apply(this, arguments) : undefined;
      modal('advancedModal','بحث متقدم',
        `<div class="form-grid">
          <label class="field">الحالة
            <select id="advStatus">
              <option value="all">الكل</option>
              <option value="favorite">المفضلة</option>
              <option value="completed">المكتملة</option>
              <option value="notCompleted">غير مكتملة</option>
              <option value="locked">المقفلة</option>
              <option value="autoCandidate">مرشح آلي</option>
            </select>
          </label>
          <label class="field">نوع المرشح<input id="advKind" placeholder="same-opening / shared-phrase" /></label>
          <label class="field">أقل درجة<input id="advScore" type="number" /></label>
          <label class="field">السورة<input id="advSurah" /></label>
        </div>`,
        `<button class="primary" onclick="applyAdvancedSearch()">تطبيق</button>
         <button onclick="resetAdvancedSearch()">إعادة ضبط البحث المتقدم</button>
         ${typeof resetCurrentFiltersV85==='function' ? '<button onclick="resetCurrentFiltersV85()">مسح كل فلاتر هذه القاعدة</button>' : ''}
         <button onclick="closeModal('advancedModal')">إغلاق</button>`
      );
    };
  }catch(e){}
})();

/* =========================================================
   V87 — Settings behavior + Mobile icon-only buttons (Personal) + Hide legend colors
   Implemented:
   - Saving settings does NOT close Settings modal.
   - Shows toast confirmation while keeping Settings open.
   - GitHub token field stays available and can be revealed/hidden.
   - Mobile (<=850px) Personal toolbar uses icon-only buttons (CSS via body.db-personal).
   ========================================================= */

function toggleGhTokenVisibility(){
  let inp=document.getElementById('ghToken');
  if(!inp) return;
  inp.type = (inp.type === 'password') ? 'text' : 'password';
  try{ inp.focus(); }catch(e){}
}

function __setDbBodyClassV87(){
  try{
    document.body.classList.toggle('db-personal', activeDb === 'personal');
  }catch(e){}
}

// Override updateToggleAllButton to work with <span class="btn-text"> inside the button.
function updateToggleAllButton(){
  let b=document.getElementById('toggleAllBtn'),gs=[...document.querySelectorAll('.group')];
  if(!b) return;
  let all=gs.length && gs.every(g=>g.classList.contains('open'));
  let text = all ? 'طي الكل' : 'فتح الكل';
  let t=b.querySelector('.btn-text');
  if(t) t.textContent=text; else b.textContent=text;
}

// Override openAppSettings to include token reveal button.
function openAppSettings(){
  let s=getSettings();
  // Build the same settings modal structure used by V79, with token row + reveal.
  modal('settingsModal','إعدادات التطبيق',
    `<div class="settings-section github-settings-section">
      <h2 class="github-sync-heading"><span id="githubSyncDot" class="github-sync-dot gray"></span>GitHub Auto Sync ☁</h2>
      ${typeof githubStatusHtmlV78==='function' ? githubStatusHtmlV78(s) : ''}
      <div id="githubSyncStatusMount">${typeof ghStatusHtmlV79==='function' ? ghStatusHtmlV79() : ''}</div>

      <label class="field">Token
        <div class="token-row">
          <input id="ghToken" type="password" value="${escapeHtml(s.ghToken||'')}" autocomplete="off" />
          <button type="button" class="token-toggle-btn" onclick="toggleGhTokenVisibility()" aria-label="إظهار/إخفاء التوكن" title="إظهار/إخفاء">👁</button>
        </div>
      </label>

      <div class="form-grid">
        <label class="field">Owner<input id="ghOwner" value="${escapeHtml(s.ghOwner||'')}" /></label>
        <label class="field">Repo<input id="ghRepo" value="${escapeHtml(s.ghRepo||'')}" /></label>
        <label class="field">Branch<input id="ghBranch" value="${escapeHtml(s.ghBranch||'')}" /></label>
        <label class="field">Path<input id="ghPath" value="${escapeHtml(s.ghPath||'')}" /></label>
      </div>

      <label class="github-autosync-toggle"><input type="checkbox" id="ghAutoSyncCheck" ${s.ghAutoSync?'checked':''} /> تفعيل المزامنة التلقائية بعد تعديل قاعدة البيانات الشخصية</label>

      <div class="inline-actions">
        <button class="primary" onclick="saveSettings(false)">Save / حفظ</button>
        <button onclick="testGitHubConnectionV79()">Test Connection</button>
        <button onclick="syncToGitHub('manual')">Sync Now / مزامنة الآن</button>
      </div>

      <small class="github-sync-note">المسار الحالي للمزامنة: <code>V71/personal-data.js</code> — لا يتم إظهار النجاح إلا بعد رجوع GitHub بمعلومات Commit.</small>
    </div>

    <div class="settings-section">
      <h2>✏️ وضع التعديل / Edit Mode</h2>
      <label><input type="checkbox" id="editModeCheck" ${editMode?'checked':''} /> تفعيل وضع التعديل</label>
    </div>

    <div class="settings-section">
      <h2>🎨 المظهر / الخط</h2>
      <div class="form-grid">
        <label class="field">Theme
          <select id="setTheme">
            <option value="quran-classic">Quran Classic</option>
            <option value="apple-health">Apple Health</option>
            <option value="bevel-night">Bevel Night</option>
          </select>
        </label>
        <label class="field">Font
          <select id="setFont" onchange="updateFontPreview()">
            <option value="normal-quran">Normal Quran</option>
            <option value="mushaf-qpc-v2">Mushaf QPC V2</option>
          </select>
        </label>
      </div>
      <div id="fontPreviewBox" class="font-preview-box" data-font-preset="normal-quran">
        <b>معاينة الخط قبل الحفظ</b>
        <div class="font-preview-ayah">وَزَيَّنَ لَهُمُ الشَّيْطَانُ أَعْمَالَهُمْ فَصَدَّهُمْ عَنِ السَّبِيلِ فَهُمْ لَا يَهْتَدُونَ</div>
        <small id="fontPreviewHint">إذا كان مجلد fonts فارغاً سيظهر الخط الاحتياطي تلقائياً.</small>
      </div>
    </div>

    <div class="inline-actions">
      <button onclick="openReleaseNotes()">Release Notes</button>
      <button onclick="exportActiveDatabase()">Export data.js</button>
      <button onclick="resetDualDbCacheV68()">Reset Cache</button>
    </div>`,
    `<button class="primary" onclick="saveSettings(false)">حفظ</button>
     <button onclick="closeModal('settingsModal')">إغلاق</button>`
  );

  // apply dropdown values
  try{
    document.getElementById('setTheme').value=s.theme||'quran-classic';
    document.getElementById('setFont').value=s.font||'normal-quran';
    updateFontPreview();
  }catch(e){}

  // render sync status UI
  try{ if(typeof ghRenderV79==='function') ghRenderV79(); }catch(e){}
}

// Override saveSettings: do NOT close settings modal.
function saveSettings(closeAfter=false){
  // Keep modal open always; closeAfter parameter is ignored unless explicitly true.
  try{
    let s = (typeof ghCollectV79==='function') ? ghCollectV79() : {
      theme: document.getElementById('setTheme')?.value || getSettings().theme,
      font: document.getElementById('setFont')?.value || getSettings().font,
      ghToken: document.getElementById('ghToken')?.value || '',
      ghOwner: document.getElementById('ghOwner')?.value || '',
      ghRepo: document.getElementById('ghRepo')?.value || '',
      ghBranch: document.getElementById('ghBranch')?.value || 'main',
      ghPath: document.getElementById('ghPath')?.value || 'V71/personal-data.js',
      ghAutoSync: !!document.getElementById('ghAutoSyncCheck')?.checked
    };

    // edit mode
    let e=document.getElementById('editModeCheck');
    if(e){
      editMode=!!e.checked;
      localStorage.setItem('mutashabihat_v69_edit_mode', editMode);
    }

    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    applySettings();
    if(activeDb) renderActiveGroups();
    try{ if(typeof ghRenderV79==='function') ghRenderV79(); }catch(err){}

    // toast confirmation
    if(typeof toast==='function') toast('✓ تم حفظ الإعدادات', 'ok');
    else alert('✓ تم حفظ الإعدادات');

    // Never close on save
    if(closeAfter===true){
      // only if some future code explicitly requests close
      closeModal('settingsModal');
    }
  }catch(ex){
    console.error(ex);
    try{ if(typeof toast==='function') toast('فشل حفظ الإعدادات', 'err'); else alert('فشل حفظ الإعدادات'); }catch(e){}
  }
}

// Ensure body class is correct when opening database/home.
(function patchDbBodyClassV87(){
  try{
    const baseOpenDb = window.openDatabase;
    if(typeof baseOpenDb==='function'){
      window.openDatabase = async function(){
        let r = await baseOpenDb.apply(this, arguments);
        __setDbBodyClassV87();
        return r;
      };
    }
  }catch(e){}
  try{
    const baseOpenHome = window.openHome;
    if(typeof baseOpenHome==='function'){
      window.openHome = function(){
        let r = baseOpenHome.apply(this, arguments);
        __setDbBodyClassV87();
        return r;
      };
    }
  }catch(e){}
  // Also update once on load
  try{ window.addEventListener('DOMContentLoaded', ()=>setTimeout(__setDbBodyClassV87, 50)); }catch(e){}
})();

/* =========================================================
   V88 — GitHub manual sync + conflict safety (Personal DB)
   Implemented:
   - Main toolbar button: Sync GitHub (manual) with visual feedback.
   - Auto-sync remains enabled by default; shows warning when token missing.
   - Safety: local backup before sync + remote newer detection using latest commit time.
   ========================================================= */

const GH_LOCAL_MOD_KEY_V88='github_local_modified_time';
const GH_REMOTE_COMMIT_TIME_KEY_V88='github_last_remote_commit_time';
const GH_BACKUP_LIST_KEY_V88='github_personal_backups_v88';

function ghTouchLocalModifiedV88(){
  try{ localStorage.setItem(GH_LOCAL_MOD_KEY_V88, String(Date.now())); }catch(e){}
}

function ghLocalModifiedIsoV88(){
  let n=Number(localStorage.getItem(GH_LOCAL_MOD_KEY_V88)||0);
  if(!n) return '';
  try{ return new Date(n).toISOString(); }catch(e){ return String(n); }
}

function ghBackupPersonalV88(reason){
  try{
    let list=[];
    try{ list=JSON.parse(localStorage.getItem(GH_BACKUP_LIST_KEY_V88)||'[]'); }catch(e){ list=[]; }
    let stamp=new Date().toISOString().replace(/[:.]/g,'-');
    let key='gh_personal_backup_'+stamp;
    localStorage.setItem(key, JSON.stringify({time:new Date().toISOString(), reason:safeText(reason), data: personalData||[]}));
    list.unshift(key);
    list=list.slice(0,5);
    localStorage.setItem(GH_BACKUP_LIST_KEY_V88, JSON.stringify(list));
  }catch(e){}
}

function ghSetToolbarBtnStateV88(state, errMsg){
  let btn=document.getElementById('syncGitHubBtn');
  if(!btn) return;
  btn.classList.remove('syncing','ok','err');
  if(state==='syncing') btn.classList.add('syncing');
  if(state==='ok') btn.classList.add('ok');
  if(state==='err') btn.classList.add('err');
  if(state==='syncing') btn.title='Syncing...';
  if(state==='ok') btn.title='Synced successfully';
  if(state==='err') btn.title='Failed: '+safeText(errMsg||'');
}

async function ghLatestCommitTimeV88(s){
  // Uses commits API to get latest commit affecting the file path.
  // GET /repos/{owner}/{repo}/commits?path={path}&sha={branch}&per_page=1
  let url=`https://api.github.com/repos/${encodeURIComponent(s.ghOwner)}/${encodeURIComponent(s.ghRepo)}/commits?path=${encodeURIComponent(s.ghPath)}&sha=${encodeURIComponent(s.ghBranch)}&per_page=1`;
  let r=await fetch(url,{headers:{Authorization:'Bearer '+s.ghToken,Accept:'application/vnd.github+json'}});
  if(!r.ok) return null;
  let arr=await r.json();
  let dt=arr && arr[0] && arr[0].commit && (arr[0].commit.committer?.date || arr[0].commit.author?.date);
  return dt || null;
}

function manualSyncGitHub(){
  // Manual button: should work in addition to auto-sync.
  try{
    syncToGitHub('manual-toolbar');
  }catch(e){
    ghSetToolbarBtnStateV88('err', e.message||String(e));
    if(typeof toast==='function') toast('❌ GitHub sync failed: '+(e.message||e),'err');
  }
}

// Patch: show clear warning when auto-sync enabled but token missing.
(function patchGitHubWarningV88(){
  try{
    const baseStatusHtml = window.ghStatusHtmlV79;
    if(typeof baseStatusHtml==='function'){
      window.ghStatusHtmlV79 = function(){
        let html = baseStatusHtml.apply(this, arguments);
        try{
          let s=getSettings();
          if(s.ghAutoSync && !safeText(s.ghToken).trim()){
            // Add warning banner inside status card.
            html = html.replace('</div><div class="github-sync-actions"',
              '<div class="github-error-box"><strong>تنبيه:</strong> المزامنة التلقائية مفعلة ولكن GitHub Token غير موجود. عند إضافة Token ستعمل المزامنة تلقائياً.</div></div><div class="github-sync-actions"'
            );
          }
        }catch(e){}
        return html;
      };
    }
  }catch(e){}
})();

// Patch: touch local modified time whenever personal DB is saved.
(function patchSaveDbTouchV88(){
  try{
    const baseSaveDb = window.saveDb;
    if(typeof baseSaveDb==='function'){
      window.saveDb = function(w){
        let r = baseSaveDb.apply(this, arguments);
        if(w==='personal') ghTouchLocalModifiedV88();
        return r;
      };
    }
  }catch(e){}
})();

// Patch: enhance syncToGitHub with backup + remote newer detection.
(function patchSyncToGitHubSafetyV88(){
  try{
    const baseSync = window.syncToGitHub;
    if(typeof baseSync!=='function') return;

    window.syncToGitHub = async function(reason){
      // keep original behavior but add safety + button feedback.
      ghSetToolbarBtnStateV88('syncing');

      // Make local backup before any remote write.
      try{ ghBackupPersonalV88('before-github-sync:'+safeText(reason||'manual')); }catch(e){}

      // If config missing, let original set status failed; but keep clear feedback.
      let s=getSettings();
      if(!safeText(s.ghToken).trim()){
        ghSetToolbarBtnStateV88('err','Missing GitHub token');
        return baseSync.apply(this, arguments);
      }

      // Conflict detection only when there are local changes and remote is newer.
      try{
        let remoteTime = await ghLatestCommitTimeV88(s);
        if(remoteTime){
          try{ localStorage.setItem(GH_REMOTE_COMMIT_TIME_KEY_V88, remoteTime); }catch(e){}
          let localMs = Number(localStorage.getItem(GH_LOCAL_MOD_KEY_V88)||0);
          let remoteMs = Date.parse(remoteTime)||0;
          if(localMs && remoteMs && remoteMs>localMs){
            let msg = 'تحذير تعارض: يوجد تحديث أحدث على GitHub لهذا الملف.\n\nRemote: '+remoteTime+'\nLocal: '+ghLocalModifiedIsoV88()+'\n\nهل تريد المتابعة ورفع النسخة المحلية (overwrite)؟';
            if(!confirm(msg)){
              if(typeof ghSetV79==='function') ghSetV79('failed','Canceled بسبب تعارض: Remote أحدث');
              ghSetToolbarBtnStateV88('err','Conflict canceled');
              return;
            }
          }
        }
      }catch(e){
        // Non-fatal; continue with base sync.
      }

      try{
        await baseSync.apply(this, arguments);
        let st=localStorage.getItem(GH_KEYS_V79.status)||'none';
        if(st==='success' || st==='no_changes') ghSetToolbarBtnStateV88('ok');
        else if(st==='failed') ghSetToolbarBtnStateV88('err', localStorage.getItem(GH_KEYS_V79.error)||'');
        else ghSetToolbarBtnStateV88('ok');
      }catch(e){
        ghSetToolbarBtnStateV88('err', e.message||String(e));
        throw e;
      }
    };

    // Also reflect status changes triggered by auto-sync.
    const baseGhSet = window.ghSetV79;
    if(typeof baseGhSet==='function'){
      window.ghSetV79 = function(st, err){
        let r = baseGhSet.apply(this, arguments);
        if(st==='syncing') ghSetToolbarBtnStateV88('syncing');
        if(st==='success' || st==='no_changes') ghSetToolbarBtnStateV88('ok');
        if(st==='failed') ghSetToolbarBtnStateV88('err', err||localStorage.getItem(GH_KEYS_V79.error)||'');
        return r;
      };
    }

  }catch(e){}
})();

// Init button state on load
window.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{
  try{
    let st=localStorage.getItem(GH_KEYS_V79.status)||'none';
    if(st==='success' || st==='no_changes') ghSetToolbarBtnStateV88('ok');
    else if(st==='failed') ghSetToolbarBtnStateV88('err', localStorage.getItem(GH_KEYS_V79.error)||'');
  }catch(e){}
},500));


/* =========================================================
   V89 — Mobile compact counter label (badge shows number only)
   - Mobile only (<=768px): #counter becomes compact numeric pill (e.g., "208").
   - Desktop/tablet: restore original text.
   ========================================================= */

function __isMobileCompactV89(){
  try{ return window.matchMedia && window.matchMedia('(max-width: 768px)').matches; }catch(e){ return false; }
}

function __formatCounterV89(){
  let el=document.getElementById('counter');
  if(!el) return;
  let isMobile=__isMobileCompactV89();
  // Preserve full text for restore
  if(!el.dataset) return;
  if(!el.dataset.fullText) el.dataset.fullText = el.textContent || '';
  if(!isMobile){
    // restore
    if(el.dataset.fullText) el.textContent = el.dataset.fullText;
    return;
  }
  // update stored full text before compacting
  el.dataset.fullText = el.textContent || el.dataset.fullText || '';
  let txt = el.textContent || '';
  // Extract digits
  let m = txt.match(/(\d+)/);
  if(m){
    el.textContent = m[1];
  }else{
    // If it's a message like "اختر سورة..." then show a small dot
    el.textContent = '…';
  }
}

(function patchCounterUpdatesV89(){
  try{
    const baseRender = window.renderActiveGroups;
    if(typeof baseRender==='function'){
      window.renderActiveGroups = function(){
        let r = baseRender.apply(this, arguments);
        try{ __formatCounterV89(); }catch(e){}
        return r;
      };
    }
  }catch(e){}
  try{ window.addEventListener('resize', ()=>setTimeout(__formatCounterV89, 0)); }catch(e){}
  try{ window.addEventListener('DOMContentLoaded', ()=>setTimeout(__formatCounterV89, 500)); }catch(e){}
})();


/* =========================================================
   V90 — Mobile counter formatter (robust)
   Ensures #counter shows only digits on mobile (<=768px) without breaking desktop.
   ========================================================= */

function __isMobileCompactV90(){
  try{ return window.matchMedia && window.matchMedia('(max-width: 768px)').matches; }catch(e){ return false; }
}

function __formatCounterV90(){
  let el=document.getElementById('counter');
  if(!el) return;
  let isMobile=__isMobileCompactV90();
  // store latest full text each time
  if(el.dataset){
    if(!el.dataset.fullTextV90) el.dataset.fullTextV90='';
    // if not mobile, always restore from last known full text
    if(!isMobile){
      if(el.dataset.fullTextV90) el.textContent = el.dataset.fullTextV90;
      return;
    }
    // mobile: capture current full text, then compact
    if(el.textContent) el.dataset.fullTextV90 = el.textContent;
  }

  let txt = (el.dataset && el.dataset.fullTextV90) ? el.dataset.fullTextV90 : (el.textContent||'');
  let m = txt.match(/(\d+)/);
  el.textContent = m ? m[1] : '…';
}

(function patchCounterUpdatesV90(){
  try{
    const baseRender = window.renderActiveGroups;
    if(typeof baseRender==='function' && !window.__patchedCounterV90){
      window.__patchedCounterV90=true;
      window.renderActiveGroups = function(){
        let r = baseRender.apply(this, arguments);
        try{ __formatCounterV90(); }catch(e){}
        return r;
      };
    }
  }catch(e){}
  try{ window.addEventListener('resize', ()=>setTimeout(__formatCounterV90, 0)); }catch(e){}
  try{ window.addEventListener('DOMContentLoaded', ()=>setTimeout(__formatCounterV90, 600)); }catch(e){}
})();
