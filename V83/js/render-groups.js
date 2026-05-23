function renderChips(c){let chips=['المعروض: '+c];if(selectedSurahFilter)chips.push('السورة: '+selectedSurahFilter);if(advancedFilters.kind)chips.push('النوع: '+advancedFilters.kind);document.getElementById('activeFilterChips').innerHTML=chips.map(x=>`<span>${escapeHtml(x)}</span>`).join('')}

function renderSurahIndex(list){let bar=document.getElementById('surahIndexBar');if(displayMode!=='group-surah'){bar.innerHTML='';return}let m=new Map();list.forEach(g=>getTags(g).forEach(s=>m.set(s,(m.get(s)||0)+1)));bar.innerHTML=[...m].sort((a,b)=>getSurahNo(a[0])-getSurahNo(b[0])).map(([s,c])=>`<button onclick="document.getElementById('sec-${getSurahNo(s)}')?.scrollIntoView({behavior:'smooth'})">${escapeHtml(s)} (${c})</button>`).join('')}

function renderGrouped(list){let m=new Map();list.forEach(g=>(getTags(g).length?getTags(g):['غير محدد']).forEach(s=>{if(!m.has(s))m.set(s,[]);m.get(s).push(g)}));return [...m].sort((a,b)=>getSurahNo(a[0])-getSurahNo(b[0])).map(([s,items])=>`<section id="sec-${getSurahNo(s)}" class="surah-section"><div class="group-head" onclick="this.parentElement.classList.toggle('collapsed')"><div class="group-num">${getSurahNo(s)===9999?'؟':getSurahNo(s)}</div><div class="group-title-wrap"><div class="group-title">📖 سورة ${escapeHtml(s)}</div><div class="group-tags"><span class="tag">${items.length} مجموعة</span></div></div></div><div class="surah-section-groups">${items.map(renderCard).join('')}</div></section>`).join('')}

function renderVerse(v){return `<div class="verse-card"><div class="verse-ref"><span class="surah-name">${escapeHtml(v.surah)}</span><span class="ayah-num">${escapeHtml(v.ayah)}</span>${v.label?`<span class="verse-label">${escapeHtml(v.label)}</span>`:''}</div><div class="verse-text">${(v.parts||[]).map(p=>`<span class="${escapeHtml(p.type||'normal')}">${highlight(p.text)}</span>`).join(' ')}</div></div>`}

function toggleAllGroups(){let gs=[...document.querySelectorAll('.group')],all=gs.length&&gs.every(g=>g.classList.contains('open'));gs.forEach(g=>g.classList.toggle('open',!all));updateToggleAllButton()}

function partOptions(sel){return ['normal','shared','diff','diff2','diff3','addition','unique'].map(x=>`<option value="${x}" ${x===sel?'selected':''}>${x}</option>`).join('')}

function groupHasUniqueInSurah(g,s){return (g.verses||[]).some(v=>safeText(v.surah)===safeText(s)&&(v.parts||[]).some(p=>safeText(p.type)==='unique'))}

function renderSurahTag(g,s){return `<span class="tag ${groupHasUniqueInSurah(g,s)?'unique-surah-tag':''}">#${escapeHtml(s)}</span>`}

function renderGroupBody(g){return `${(g.verses||[]).map(renderVerse).join('')}${g.note?`<div class="note"><b>ملاحظة:</b><br>${safeRich(g.note)}</div>`:''}${g.unote?`<div class="unote"><b>فائدة إضافية:</b><br>${safeRich(g.unote)}</div>`:''}`}

function toggleGroup(h){let gEl=h?.closest?.('.group'),id=gEl?.dataset?.id;if(isMobileLayout()&&id){openGroupDetailModal(id);return}h.parentElement.classList.toggle('open');updateToggleAllButton()}

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
  if(!el.dataset) return;
  if(!el.dataset.fullText) el.dataset.fullText = el.textContent || '';
  if(!isMobile){
    if(el.dataset.fullText) el.textContent = el.dataset.fullText;
    return;
  }
  el.dataset.fullText = el.textContent || el.dataset.fullText || '';
  let txt = el.textContent || '';
  let m = txt.match(/(\d+)/);
  if(m){
    el.textContent = m[1];
  }else{
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
