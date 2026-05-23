function addQuranVerseObject(target, surah, ayah, text, type){let obj={surah:safeText(surah),ayah:safeText(ayah),label:'',parts:[{type:type||'shared',text:safeText(text)}]};if(target==='edit'){editVersesBuffer.push(obj);renderEditVerses();setTimeout(()=>document.getElementById('editVerses')?.lastElementChild?.scrollIntoView({behavior:'smooth',block:'center'}),50)}else{draftVerses.push(obj);renderDraft()}}

function removeQuranVerseObject(target, surah, ayah){let arr=target==='edit'?editVersesBuffer:draftVerses;let idx=arr.findIndex(v=>safeText(v.surah)===safeText(surah)&&safeText(v.ayah)===safeText(ayah));if(idx>=0){arr.splice(idx,1);target==='edit'?renderEditVerses():renderDraft();return true}return false}

function quranItemExists(target, surah, ayah){let arr=target==='edit'?editVersesBuffer:draftVerses;return arr.some(v=>safeText(v.surah)===safeText(surah)&&safeText(v.ayah)===safeText(ayah))}

function quranResultText(prefix, i, fullText){let sel=getSelectedTextareaText(prefix+'QText_'+i);return sel||safeText(fullText)}

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
