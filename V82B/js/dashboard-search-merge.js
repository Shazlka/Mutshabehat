function openCompareModal(id){let g=findActive(id);if(!g)return;modal('compareModal','المقارنة البصرية — '+escapeHtml(g.title),`<div>${(g.verses||[]).map(v=>`<div class="compare-card"><b>${escapeHtml(v.surah)} آية ${escapeHtml(v.ayah)} ${escapeHtml(v.label||'')}</b><div class="compare-text">${(v.parts||[]).map(p=>`<span class="${p.type==='normal'?'base':p.type==='shared'?'same':'cmpdiff'}">${escapeHtml(p.text)}</span>`).join(' ')}</div></div>`).join('')}</div>`,`<button onclick="closeModal('compareModal')">إغلاق</button>`)}

function openMergeWindow(){modal('mergeWindow','دمج / نقل من الآلية إلى الشخصية',`<div class="tools"><input id="mergeSearch" placeholder="ابحث في الآلية..." oninput="renderMergeList()"><button onclick="selectAllMerge(true)">تحديد المعروض</button><button onclick="selectAllMerge(false)">إلغاء التحديد</button><button class="primary" onclick="copySelectedToPersonal()">نقل المحدد</button></div><div id="mergeList"></div>`,`<button onclick="closeModal('mergeWindow')">إغلاق</button>`);renderMergeList()}

function renderMergeList(){let q=normalize(document.getElementById('mergeSearch')?.value||''),list=automatedData.filter(g=>!q||normalize(groupText(g)).includes(q));document.getElementById('mergeList').innerHTML=list.map(g=>`<label class="merge-item"><input type="checkbox" class="merge-check" value="${automatedData.indexOf(g)}"><div><b>${escapeHtml(g.title)}</b><br><small>${getTags(g).join('، ')} — ${(g.verses||[]).length} آيات</small></div><button onclick="copyOneToPersonal(${automatedData.indexOf(g)})">نسخ</button></label>`).join('')||'<div class="hint">لا توجد نتائج</div>'}

function selectAllMerge(s){document.querySelectorAll('.merge-check').forEach(x=>x.checked=s)}

function copyOneToPersonal(i){let g=clone([automatedData[i]])[0];g.id=nextPersonalId();g.autoCandidate=false;g.source='automated';personalData.push(g);saveDb('personal');updateHomeCounts();alert('تم النسخ')}

function copySelectedToPersonal(){let ids=[...document.querySelectorAll('.merge-check:checked')].map(x=>+x.value);ids.forEach(copyOneToPersonal)}

function openDashboard(){let d=activeDb?activeData:personalData.concat(automatedData),ayah=d.reduce((s,g)=>s+(g.verses||[]).length,0),surahs=new Set(d.flatMap(getTags)).size;let cards=[['الشخصية',personalData.length],['الآلية',automatedData.length],['المجموعات',d.length],['الآيات',ayah],['السور',surahs],['المفضلة',d.filter(g=>isTrue(g.favorite)).length],['المكتملة',d.filter(g=>isTrue(g.completed)).length],['المقفلة',d.filter(g=>isTrue(g.locked)).length]];modal('dashboardModal','الإحصائيات',`<div class="dashboard-grid">${cards.map(c=>`<div class="dash-card"><div class="dash-value">${c[1]}</div><div>${c[0]}</div></div>`).join('')}</div>`,`<button onclick="closeModal('dashboardModal')">إغلاق</button>`)}

function openAdvancedSearch(){modal('advancedModal','بحث متقدم',`<div class="form-grid"><label class="field">الحالة<select id="advStatus"><option value="all">الكل</option><option value="favorite">المفضلة</option><option value="completed">المكتملة</option><option value="notCompleted">غير مكتملة</option><option value="locked">المقفلة</option><option value="autoCandidate">مرشح آلي</option></select></label><label class="field">نوع المرشح<input id="advKind" placeholder="same-opening / shared-phrase"></label><label class="field">أقل درجة<input id="advScore" type="number"></label><label class="field">السورة<input id="advSurah"></label></div>`,`<button class="primary" onclick="applyAdvancedSearch()">تطبيق</button><button onclick="resetAdvancedSearch()">إعادة ضبط</button><button onclick="closeModal('advancedModal')">إغلاق</button>`);document.getElementById('advStatus').value=advancedFilters.status;document.getElementById('advKind').value=advancedFilters.kind;document.getElementById('advScore').value=advancedFilters.minScore;document.getElementById('advSurah').value=advancedFilters.surah}

function applyAdvancedSearch(){advancedFilters={status:document.getElementById('advStatus').value,kind:document.getElementById('advKind').value.trim(),minScore:document.getElementById('advScore').value,surah:document.getElementById('advSurah').value.trim()};closeModal('advancedModal');renderActiveGroups()}

function resetAdvancedSearch(){advancedFilters={status:'all',kind:'',minScore:'',surah:''};closeModal('advancedModal');renderActiveGroups()}

function applyAdvancedSearch(){advancedFilters={status:document.getElementById('advStatus')?.value||'all',kind:document.getElementById('advKind')?.value.trim()||'',minScore:document.getElementById('advScore')?.value||'',surah:document.getElementById('advSurah')?.value.trim()||''};closeModal('advancedModal');saveFiltersV85(activeDb);renderActiveGroups()}

function resetAdvancedSearch(){advancedFilters=defaultAdvancedFiltersV85();closeModal('advancedModal');saveFiltersV85(activeDb);renderActiveGroups()}

function openAdvancedSearch(){modal('advancedModal','بحث متقدم',`<div class="form-grid"><label class="field">الحالة<select id="advStatus"><option value="all">الكل</option><option value="favorite">المفضلة</option><option value="completed">المكتملة</option><option value="notCompleted">غير مكتملة</option><option value="locked">المقفلة</option><option value="autoCandidate">مرشح آلي</option></select></label><label class="field">نوع المرشح<input id="advKind" placeholder="same-opening / shared-phrase"></label><label class="field">أقل درجة<input id="advScore" type="number"></label><label class="field">السورة<input id="advSurah"></label></div>`,`<button class="primary" onclick="applyAdvancedSearch()">تطبيق</button><button onclick="resetAdvancedSearch()">إعادة ضبط البحث المتقدم</button><button onclick="resetCurrentFiltersV85()">مسح كل فلاتر هذه القاعدة</button><button onclick="closeModal('advancedModal')">إغلاق</button>`);document.getElementById('advStatus').value=advancedFilters.status;document.getElementById('advKind').value=advancedFilters.kind;document.getElementById('advScore').value=advancedFilters.minScore;document.getElementById('advSurah').value=advancedFilters.surah}

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
