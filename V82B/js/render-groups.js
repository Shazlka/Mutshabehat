function renderActiveGroups(){if(!activeDb)return;if(activeDb==='automated'&&!selectedSurahFilter){document.getElementById('counter').textContent='اختر سورة لتحميل بياناتها فقط';renderChips(0);renderSurahIndex([]);document.getElementById('groups').innerHTML=automatedPromptHtml();updateToggleAllButton();buildSurahFilter();return}let list=sortGroups(activeData.filter(passFilters));document.getElementById('counter').textContent='عدد النتائج: '+list.length;renderChips(list.length);renderSurahIndex(list);document.getElementById('groups').innerHTML=list.length?(displayMode==='group-surah'?renderGrouped(list):list.map(renderCard).join('')):'<div class="hint">لا توجد نتائج</div>';updateToggleAllButton();buildSurahFilter()}

function renderChips(c){let chips=['المعروض: '+c];if(selectedSurahFilter)chips.push('السورة: '+selectedSurahFilter);if(advancedFilters.kind)chips.push('النوع: '+advancedFilters.kind);document.getElementById('activeFilterChips').innerHTML=chips.map(x=>`<span>${escapeHtml(x)}</span>`).join('')}

function renderSurahIndex(list){let bar=document.getElementById('surahIndexBar');if(displayMode!=='group-surah'){bar.innerHTML='';return}let m=new Map();list.forEach(g=>getTags(g).forEach(s=>m.set(s,(m.get(s)||0)+1)));bar.innerHTML=[...m].sort((a,b)=>getSurahNo(a[0])-getSurahNo(b[0])).map(([s,c])=>`<button onclick="document.getElementById('sec-${getSurahNo(s)}')?.scrollIntoView({behavior:'smooth'})">${escapeHtml(s)} (${c})</button>`).join('')}

function renderGrouped(list){let m=new Map();list.forEach(g=>(getTags(g).length?getTags(g):['غير محدد']).forEach(s=>{if(!m.has(s))m.set(s,[]);m.get(s).push(g)}));return [...m].sort((a,b)=>getSurahNo(a[0])-getSurahNo(b[0])).map(([s,items])=>`<section id="sec-${getSurahNo(s)}" class="surah-section"><div class="group-head" onclick="this.parentElement.classList.toggle('collapsed')"><div class="group-num">${getSurahNo(s)===9999?'؟':getSurahNo(s)}</div><div class="group-title-wrap"><div class="group-title">📖 سورة ${escapeHtml(s)}</div><div class="group-tags"><span class="tag">${items.length} مجموعة</span></div></div></div><div class="surah-section-groups">${items.map(renderCard).join('')}</div></section>`).join('')}

function renderCard(g){let fav=isTrue(g.favorite),done=isTrue(g.completed),locked=isTrue(g.locked),ro=activeDb==='auto';let actions=`<button class="icon-btn star ${fav?'active':''}" onclick="event.stopPropagation();toggleFlag(${g.id},'favorite')">★</button><button class="icon-btn done ${done?'active':''}" onclick="event.stopPropagation();toggleFlag(${g.id},'completed')">✓</button>`;if(editMode)actions+=`<button class="icon-btn lock ${locked?'active':''}" onclick="event.stopPropagation();toggleFlag(${g.id},'locked')">🔒</button><button onclick="event.stopPropagation();openCompareModal(${g.id})">مقارنة</button>${ro?`<button onclick="event.stopPropagation();copyAutoGroupToPersonal(${g.id})">نسخ للشخصية</button>`:`<button onclick="event.stopPropagation();openEditModal(${g.id})">✏️ تعديل</button>`}`;let cls=(fav?' is-favorite':'')+(done?' is-completed':'')+(locked?' is-locked':'');return `<article class="group${cls}" data-id="${g.id}"><div class="group-head" onclick="toggleGroup(this)"><div class="group-num">${escapeHtml(g.id)}</div><div class="group-title-wrap"><div class="group-tags">${getTags(g).map(s=>`<span class="tag">#${escapeHtml(s)}</span>`).join('')}<span class="tag">${(g.verses||[]).length} آية</span>${g.candidateScore?`<span class="tag">score ${g.candidateScore}</span>`:''}</div><div class="group-title">${highlight(g.title||'بدون عنوان')}</div></div><div class="group-actions">${actions}<button class="icon-btn" onclick="event.stopPropagation();copyGroupText(${g.id})">⧉</button></div></div><div class="group-body">${(g.verses||[]).map(renderVerse).join('')}${g.note?`<div class="note">${safeRich(g.note)}</div>`:''}${g.unote?`<div class="unote">${safeRich(g.unote)}</div>`:''}</div></article>`}

function renderVerse(v){return `<div class="verse-card"><div class="verse-ref"><span class="surah-name">${escapeHtml(v.surah)}</span><span class="ayah-num">${escapeHtml(v.ayah)}</span>${v.label?`<span class="verse-label">${escapeHtml(v.label)}</span>`:''}</div><div class="verse-text">${(v.parts||[]).map(p=>`<span class="${escapeHtml(p.type||'normal')}">${highlight(p.text)}</span>`).join(' ')}</div></div>`}

function toggleGroup(h){h.parentElement.classList.toggle('open');updateToggleAllButton()}

function toggleAllGroups(){let gs=[...document.querySelectorAll('.group')],all=gs.length&&gs.every(g=>g.classList.contains('open'));gs.forEach(g=>g.classList.toggle('open',!all));updateToggleAllButton()}

function updateToggleAllButton(){let b=document.getElementById('toggleAllBtn'),gs=[...document.querySelectorAll('.group')];if(b)b.textContent=gs.length&&gs.every(g=>g.classList.contains('open'))?'طي الكل':'فتح الكل'}

function partOptions(sel){return ['normal','shared','diff','diff2','addition','unique'].map(x=>`<option value="${x}" ${x===sel?'selected':''}>${x}</option>`).join('')}

function partOptions(sel){return ['normal','shared','diff','diff2','diff3','addition','unique'].map(x=>`<option value="${x}" ${x===sel?'selected':''}>${x}</option>`).join('')}

function groupHasUniqueInSurah(g,s){return (g.verses||[]).some(v=>safeText(v.surah)===safeText(s)&&(v.parts||[]).some(p=>safeText(p.type)==='unique'))}

function renderSurahTag(g,s){return `<span class="tag ${groupHasUniqueInSurah(g,s)?'unique-surah-tag':''}">#${escapeHtml(s)}</span>`}

function renderGroupBody(g){return `${(g.verses||[]).map(renderVerse).join('')}${g.note?`<div class="note"><b>ملاحظة:</b><br>${safeRich(g.note)}</div>`:''}${g.unote?`<div class="unote"><b>فائدة إضافية:</b><br>${safeRich(g.unote)}</div>`:''}`}

function renderCard(g){let fav=isTrue(g.favorite),done=isTrue(g.completed),locked=isTrue(g.locked),ro=activeDb==='auto';let actions=`<button class="icon-btn outline-icon star ${fav?'active':''}" title="مفضلة" onclick="event.stopPropagation();toggleFlag(${g.id},'favorite')">${iconSvg('star')}</button>`;if(editMode)actions+=`<button class="icon-btn outline-icon lock ${locked?'active':''}" title="قفل" onclick="event.stopPropagation();toggleFlag(${g.id},'locked')">${iconSvg('lock')}</button><button class="icon-btn outline-icon" title="مقارنة" onclick="event.stopPropagation();openCompareModal(${g.id})">${iconSvg('compare')}</button>${ro?`<button onclick="event.stopPropagation();copyAutoGroupToPersonal(${g.id})">نسخ للشخصية</button>`:`<button class="icon-btn outline-icon" title="تعديل" onclick="event.stopPropagation();openEditModal(${g.id})">${iconSvg('edit')}</button>`}`;let cls=(fav?' is-favorite':'')+(done?' is-completed':'')+(locked?' is-locked':'');return `<article class="group${cls}" data-id="${g.id}"><div class="group-head" onclick="toggleGroup(this)"><div class="group-num ${done?'completed':''}" title="اضغط لتغيير حالة الإكمال" onclick="event.stopPropagation();toggleFlag(${g.id},'completed')">${escapeHtml(g.id)}</div><div class="group-title-wrap"><div class="group-tags">${getTags(g).map(s=>renderSurahTag(g,s)).join('')}<span class="tag">${(g.verses||[]).length} آية</span>${g.candidateScore?`<span class="tag">score ${g.candidateScore}</span>`:''}</div><div class="group-title">${highlight(g.title||'بدون عنوان')}</div></div><div class="group-actions">${actions}<button class="icon-btn outline-icon" title="نسخ النص" onclick="event.stopPropagation();copyGroupText(${g.id})">${iconSvg('copy')}</button><button class="icon-btn outline-icon" title="صورة HD" onclick="event.stopPropagation();downloadGroupImage(${g.id})">${iconSvg('camera')}</button></div></div><div class="group-body">${renderGroupBody(g)}</div></article>`}

function toggleGroup(h){let gEl=h?.closest?.('.group'),id=gEl?.dataset?.id;if(isMobileLayout()&&id){openGroupDetailModal(id);return}h.parentElement.classList.toggle('open');updateToggleAllButton()}

function openGroupDetailModal(id){let g=findActive(id);if(!g)return;modal('groupDetailModal','تفاصيل المجموعة',`<div class="group-detail-card"><div class="group-detail-head"><div class="group-num ${isTrue(g.completed)?'completed':''}" onclick="toggleFlag(${g.id},'completed');closeModal('groupDetailModal');openGroupDetailModal(${g.id})">${escapeHtml(g.id)}</div><div><div class="group-tags">${getTags(g).map(s=>renderSurahTag(g,s)).join('')}</div><h2>${escapeHtml(g.title||'بدون عنوان')}</h2></div></div>${renderGroupBody(g)}</div>`,`<button onclick="copyGroupText(${g.id})">${iconSvg('copy')} نسخ مع الملاحظات</button><button class="primary" onclick="downloadGroupImage(${g.id})">${iconSvg('camera')} صورة HD</button><button onclick="closeModal('groupDetailModal')">إغلاق</button>`)}

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

function renderActiveGroups(){if(!activeDb)return;saveFiltersV85(activeDb);if(typeof isAutoDbV84==='function'&&isAutoDbV84()&&!selectedSurahFilter){let counter=document.getElementById('counter');if(counter)counter.textContent='اختر سورة لتحميل بياناتها فقط';renderChips(0);renderSurahIndex([]);let groupsBox=document.getElementById('groups');if(groupsBox)groupsBox.innerHTML=(typeof automatedPromptHtmlV84==='function')?automatedPromptHtmlV84():'<div class="hint">اختر سورة لتحميل بياناتها فقط</div>';updateToggleAllButton();buildSurahFilter();return}let list=sortGroups(activeData.filter(passFilters));let counter=document.getElementById('counter');if(counter)counter.textContent='عدد النتائج: '+list.length;renderChips(list.length);renderSurahIndex(list);document.getElementById('groups').innerHTML=list.length?(displayMode==='group-surah'?renderGrouped(list):list.map(renderCard).join('')):'<div class="hint">لا توجد نتائج</div>';updateToggleAllButton();buildSurahFilter()}

// Override updateToggleAllButton to work with <span class="btn-text"> inside the button.
function updateToggleAllButton(){
  let b=document.getElementById('toggleAllBtn'),gs=[...document.querySelectorAll('.group')];
  if(!b) return;
  let all=gs.length && gs.every(g=>g.classList.contains('open'));
  let text = all ? 'طي الكل' : 'فتح الكل';
  let t=b.querySelector('.btn-text');
  if(t) t.textContent=text; else b.textContent=text;
}

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

let activeDetailGroupIdV82C = null;

function isDesktopDetailLayoutV82C() {
  try {
    return !isMobileLayout() && window.matchMedia("(min-width: 1101px)").matches;
  } catch (e) {
    return false;
  }
}

function renderWorkspaceGuideV82C() {
  let mount = document.getElementById("workspaceGuideCard");
  if (!mount) return;
  let isAuto = activeDb === "auto";
  mount.innerHTML = isAuto
    ? `<div class="workspace-side-label">القاعدة الآلية</div>
       <h3>اختيار سريع للسورة</h3>
       <p>ابدأ من السورة ثم راجع المجموعات في الوسط وافتح التفاصيل الكاملة في اللوحة الجانبية.</p>
       <div class="inline-actions">
         <button onclick="toggleSurahFilterPanel()">فتح الفلتر</button>
         <button onclick="clearSurahFilter()">إعادة الضبط</button>
       </div>`
    : `<div class="workspace-side-label">القاعدة الشخصية</div>
       <h3>مراجعة مركزة</h3>
       <p>ابحث أو صفِّ النتائج من اليسار، ثم افتح تفاصيل المجموعة في اللوحة الجانبية للنسخ أو التعديل السريع.</p>
       <div class="inline-actions">
         <button onclick="openAddModal()">إضافة مجموعة</button>
         <button onclick="openAdvancedSearch()">بحث متقدم</button>
       </div>`;
}

function detailEmptyHtmlV82C() {
  if (activeDb === "auto" && !selectedSurahFilter) {
    let manifest = typeof autoManifestV84 === "function" ? autoManifestV84() : autoManifest();
    let items = (manifest.surahs || []).slice().sort(function (a, b) {
      return Number(b.count || 0) - Number(a.count || 0);
    }).slice(0, 6);
    return `<div class="detail-empty workspace-hero-state">
      <div class="workspace-side-label">مراجعة الآلي</div>
      <h3>ابدأ بسورة واحدة</h3>
      <p>القاعدة الآلية محمّلة حسب السورة. اختر سورة من الفلتر أو من القائمة السريعة هنا حتى نحمّل مجموعاتها فقط ونبقي الواجهة خفيفة.</p>
      <div class="workspace-hero-grid">
        <div class="workspace-hero-stat"><b>${escapeHtml(String((manifest.surahs || []).length || 0))}</b><span>سورة متاحة</span></div>
        <div class="workspace-hero-stat"><b>${escapeHtml(String(autoTotalCountV84 ? autoTotalCountV84() : autoTotalCount()))}</b><span>مجموعة في الفهرس</span></div>
      </div>
      <div class="workspace-hero-actions">
        <button class="primary" onclick="toggleSurahFilterPanel()">اختيار من الفلتر</button>
        <button onclick="openDatabase('personal')">فتح الشخصية</button>
      </div>
      <div class="detail-stack">
        <h3>الأكثر وجوداً</h3>
        <div class="surah-grid top">${items.map(pill).join("")}</div>
      </div>
    </div>`;
  }

  return `<div class="detail-empty">
    <div class="workspace-side-label">تفاصيل المجموعة</div>
    <h3>اختر مجموعة من القائمة</h3>
    <p>التفاصيل الكاملة ستظهر هنا: الآيات، الملاحظات، والعمليات السريعة مثل النسخ والتعديل والتصدير.</p>
  </div>`;
}

function setActiveDetailGroupV82C(id) {
  activeDetailGroupIdV82C = id === null || id === undefined ? null : Number(id);
  renderDetailPanelV82C();
}

function renderDetailPanelV82C() {
  let mount = document.getElementById("detailPanelContent");
  let panel = document.getElementById("detailPanel");
  if (!mount || !panel) return;

  renderWorkspaceGuideV82C();

  if (!isDesktopDetailLayoutV82C()) {
    panel.classList.add("hidden");
    mount.innerHTML = "";
    return;
  }

  panel.classList.remove("hidden");

  let group = activeDetailGroupIdV82C !== null ? findActive(activeDetailGroupIdV82C) : null;
  if (!group) {
    mount.innerHTML = detailEmptyHtmlV82C();
    return;
  }

  let isAuto = activeDb === "auto";
  let editAction = isAuto
    ? `<button onclick="copyAutoGroupToPersonal(${group.id})">نسخ للشخصية</button>`
    : `<button onclick="openEditModal(${group.id})">تعديل</button>`;
  let deleteAction = isAuto && editMode
    ? `<button class="danger" onclick="deleteAutoGroup(${group.id});setActiveDetailGroupV82C(null)">حذف من الآلية</button>`
    : "";

  mount.innerHTML = `<div class="group-detail-card">
    <div class="detail-card-head">
      <div class="detail-header-row">
        <div>
          <div class="group-tags">${getTags(group).map(function (s) { return renderSurahTag(group, s); }).join("")}</div>
          <h3>${escapeHtml(group.title || "بدون عنوان")}</h3>
        </div>
        <div class="group-num ${isTrue(group.completed) ? "completed" : ""}">${escapeHtml(group.id)}</div>
      </div>
      <p id="detailPanelMeta" class="detail-meta-line">عدد الآيات: ${(group.verses || []).length} ${selectedSurahFilter ? `| السورة الحالية: ${escapeHtml(selectedSurahFilter)}` : ""}</p>
      <div class="detail-actions">
        <button onclick="copyGroupText(${group.id})">${iconSvg("copy")} نسخ</button>
        <button onclick="downloadGroupImage(${group.id})">${iconSvg("camera")} صورة</button>
        <button onclick="openCompareModal(${group.id})">${iconSvg("compare")} مقارنة</button>
        ${editAction}
        ${deleteAction}
      </div>
    </div>
    ${renderGroupBody(group)}
  </div>`;
}

function renderCard(g) {
  let fav = isTrue(g.favorite), done = isTrue(g.completed), locked = isTrue(g.locked), ro = activeDb === "auto";
  let selected = activeDetailGroupIdV82C !== null && Number(g.id) === Number(activeDetailGroupIdV82C);
  let actions = `<button class="icon-btn outline-icon star ${fav ? "active" : ""}" title="مفضلة" onclick="event.stopPropagation();toggleFlag(${g.id},'favorite')">${iconSvg("star")}</button>`;
  if (editMode) {
    actions += `<button class="icon-btn outline-icon lock ${locked ? "active" : ""}" title="قفل" onclick="event.stopPropagation();toggleFlag(${g.id},'locked')">${iconSvg("lock")}</button><button class="icon-btn outline-icon" title="مقارنة" onclick="event.stopPropagation();openCompareModal(${g.id})">${iconSvg("compare")}</button>${ro ? `<button onclick="event.stopPropagation();copyAutoGroupToPersonal(${g.id})">نسخ للشخصية</button><button class="danger" title="حذف من القاعدة الآلية" onclick="event.stopPropagation();deleteAutoGroup(${g.id})">حذف من الآلية</button>` : `<button class="icon-btn outline-icon" title="تعديل" onclick="event.stopPropagation();openEditModal(${g.id})">${iconSvg("edit")}</button>`}`;
  }
  let cls = (fav ? " is-favorite" : "") + (done ? " is-completed" : "") + (locked ? " is-locked" : "") + (selected ? " is-selected" : "");
  return `<article class="group${cls}" data-id="${g.id}"><div class="group-head" onclick="toggleGroup(this)"><div class="group-num ${done ? "completed" : ""}" title="اضغط لتغيير حالة الإكمال" onclick="event.stopPropagation();toggleFlag(${g.id},'completed')">${escapeHtml(g.id)}</div><div class="group-title-wrap"><div class="group-tags">${getTags(g).map(function (s) { return renderSurahTag(g, s); }).join("")}<span class="tag">${(g.verses || []).length} آية</span>${g.candidateScore ? `<span class="tag">score ${g.candidateScore}</span>` : ""}</div><div class="group-title">${highlight(g.title || "بدون عنوان")}</div></div><div class="group-actions">${actions}<button class="icon-btn outline-icon" title="نسخ النص" onclick="event.stopPropagation();copyGroupText(${g.id})">${iconSvg("copy")}</button><button class="icon-btn outline-icon" title="صورة HD" onclick="event.stopPropagation();downloadGroupImage(${g.id})">${iconSvg("camera")}</button></div></div><div class="group-body">${renderGroupBody(g)}</div></article>`;
}

function toggleGroup(h) {
  let groupEl = h && typeof h.closest === "function" ? h.closest(".group") : null;
  let id = groupEl && groupEl.dataset ? groupEl.dataset.id : null;
  if (isMobileLayout() && id) {
    openGroupDetailModal(id);
    return;
  }
  if (isDesktopDetailLayoutV82C() && id) {
    setActiveDetailGroupV82C(id);
    renderActiveGroups();
    return;
  }
  h.parentElement.classList.toggle("open");
  updateToggleAllButton();
}

function renderChips(c) {
  let dbLabel = activeDb === "personal" ? "الشخصية" : activeDb === "auto" ? "الآلية" : "الرئيسية";
  let chips = [
    `القاعدة: ${dbLabel}`,
    `النتائج: ${c}`,
    `الفرز: ${displayMode}`,
  ];
  if (selectedSurahFilter) chips.push(`السورة: ${selectedSurahFilter}`);
  if (advancedFilters.kind) chips.push(`النوع: ${advancedFilters.kind}`);
  if (advancedFilters.status && advancedFilters.status !== "all") chips.push(`الحالة: ${advancedFilters.status}`);
  document.getElementById("activeFilterChips").innerHTML = chips.map(function (x) {
    return `<span>${escapeHtml(x)}</span>`;
  }).join("");
}

function renderActiveGroups() {
  if (!activeDb) return;
  saveFiltersV85(activeDb);

  let counter = document.getElementById("counter");
  let groupsBox = document.getElementById("groups");

  if (typeof isAutoDbV84 === "function" && isAutoDbV84() && !selectedSurahFilter) {
    if (counter) counter.textContent = "اختر سورة لتحميل بياناتها فقط";
    renderChips(0);
    renderSurahIndex([]);
    if (groupsBox) groupsBox.innerHTML = detailEmptyHtmlV82C();
    activeDetailGroupIdV82C = null;
    renderDetailPanelV82C();
    updateToggleAllButton();
    buildSurahFilter();
    return;
  }

  let list = sortGroups(activeData.filter(passFilters));
  if (counter) counter.textContent = "عدد النتائج: " + list.length;

  if (isDesktopDetailLayoutV82C()) {
    let exists = activeDetailGroupIdV82C !== null && list.some(function (group) {
      return Number(group.id) === Number(activeDetailGroupIdV82C);
    });
    activeDetailGroupIdV82C = exists ? activeDetailGroupIdV82C : (list[0] ? Number(list[0].id) : null);
  } else if (!isMobileLayout()) {
    activeDetailGroupIdV82C = null;
  }

  renderChips(list.length);
  renderSurahIndex(list);
  if (groupsBox) {
    groupsBox.innerHTML = list.length
      ? (displayMode === "group-surah" ? renderGrouped(list) : list.map(renderCard).join(""))
      : '<div class="hint">لا توجد نتائج</div>';
  }
  renderDetailPanelV82C();
  updateToggleAllButton();
  buildSurahFilter();
}

window.addEventListener("resize", function () {
  setTimeout(function () {
    renderDetailPanelV82C();
  }, 0);
});
