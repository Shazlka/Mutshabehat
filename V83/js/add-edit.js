function openAddModal(){if(activeDb==='auto'){alert('الإضافة في الشخصية فقط');openDatabase('personal')}draftVerses=[];modal('addModal','إضافة متشابه جديد',addBody(),`<button class="primary" onclick="createNewGroup()">حفظ في الصفحة</button><button onclick="closeModal('addModal')">إغلاق</button>`);populateSurah('addSurah');onAddSurah();renderDraft();runQuranSearch('add')}

function addBody(){return `<div class="quran-search-box"><div class="search-stats"><span id="addExact">0 :Exact</span><span id="addClose">0 :Close</span><span id="addTotal">0 :Total</span></div><h3>بحث في quran-reference.js</h3><p>بحث ذكي يتجاهل التشكيل واختلافات الحروف. النتائج المطابقة حرفياً أولاً ثم القريبة.</p><input class="wide-input" id="addQSearch" placeholder="اكتب كلمة أو جزء من آية..." oninput="runQuranSearch('add')"><div id="addQResults" class="quran-results hint">اكتب كلمة لعرض النتائج.</div></div><label class="field">عنوان المتشابه<input id="addTitle" placeholder="مثال: الرجفة / الصيحة"></label><button onclick="generateTitleFromDraft()">توليد عنوان تلقائي</button><div class="color-row"><b>لون المجموعة</b><input type="color" id="addColor" value="#55b94f" oninput="document.getElementById('addColorPrev').style.background=this.value"><span id="addColorPrev" class="color-preview">معاينة اللون</span></div><div class="form-grid"><label class="field">السورة<select id="addSurah" onchange="onAddSurah()"></select></label><label class="field">رقم الآية<select id="addAyah" onchange="previewAddAyah()"></select></label><label class="field">نوع التلوين<select id="addType">${partOptions('shared')}</select></label><label class="field">وصف قصير للآية / Label<input id="addLabel"></label></div><label class="field">نص الآية من quran-reference.js<textarea id="addPreview" readonly></textarea></label><label class="field">معاينة مباشرة:<div id="addLive" class="live-preview verse-text"></div></label><label class="field">تحديد جزء من الآية فقط<textarea id="addSelectedPart"></textarea></label><div class="inline-actions"><button class="primary" onclick="addVerseToDraft()">إضافة الآية للمجموعة</button><button onclick="clearDraft()">مسح الآيات المؤقتة</button></div><h3>الآيات المؤقتة</h3><div id="draftVerses"></div>${richEditor('addNote','ملاحظة','#1d4ed8')}${richEditor('addUnote','فائدة فريدة / إضافية','#b91c1c')}`}

function richEditor(id,label,color){return `<label class="field">${label}<div class="rt-box"><div class="rt-toolbar"><button onclick="rt('${id}','bold')"><b>B</b></button><button onclick="rt('${id}','underline')"><u>U</u></button><button onclick="rt('${id}','insertUnorderedList')">• قائمة</button><input type="color" value="${color}" onchange="rtColor('${id}',this.value)"><button onclick="rt('${id}','removeFormat')">مسح تنسيق</button></div><div id="${id}" class="rt-editor" contenteditable="true"></div></div></label>`}

function rt(id,cmd){let e=document.getElementById(id);e.focus();document.execCommand(cmd,false,null)}

function rtColor(id,c){let e=document.getElementById(id);e.focus();document.execCommand('foreColor',false,c)}

function onAddSurah(){populateAyah('addAyah',document.getElementById('addSurah').value);previewAddAyah()}

function previewAddAyah(){let a=getRef(document.getElementById('addSurah').value,document.getElementById('addAyah').value);let p=document.getElementById('addPreview'),l=document.getElementById('addLive');if(p)p.value=a?a.text:'لم يتم العثور';if(l)l.innerHTML=a?`<span class="${document.getElementById('addType').value}">${escapeHtml(a.text)}</span>`:''}

function addVerseToDraft(){let a=getRef(document.getElementById('addSurah').value,document.getElementById('addAyah').value);if(!a)return alert('لم يتم العثور');draftVerses.push({surah:a.surah,ayah:a.ayahNo,label:document.getElementById('addLabel').value.trim(),parts:[{type:document.getElementById('addType').value,text:document.getElementById('addSelectedPart').value.trim()||a.text}]});renderDraft()}

function renderDraft(){let b=document.getElementById('draftVerses');if(!b)return;b.innerHTML=draftVerses.length?draftVerses.map((v,i)=>`<div class="draft-item"><b>${v.surah} ${v.ayah}</b><button class="danger" onclick="draftVerses.splice(${i},1);renderDraft()">حذف</button><div class="verse-text"><span class="${v.parts[0].type}">${escapeHtml(v.parts[0].text)}</span></div></div>`).join(''):'<div class="hint">لا توجد آيات مضافة بعد.</div>'}

function clearDraft(){draftVerses=[];renderDraft()}

function generateTitleFromDraft(){if(draftVerses.length)document.getElementById('addTitle').value=draftVerses.map(v=>v.surah+' '+v.ayah).join(' / ')}

function createNewGroup(){let title=document.getElementById('addTitle').value.trim();if(!title||!draftVerses.length)return alert('أدخل العنوان والآيات');personalData.push({id:nextPersonalId(),title,color:document.getElementById('addColor').value,surahs:[...new Set(draftVerses.map(v=>v.surah))],verses:clone(draftVerses),note:document.getElementById('addNote').innerHTML,unote:document.getElementById('addUnote').innerHTML,favorite:false,completed:false,locked:false});saveDb('personal');closeModal('addModal');openDatabase('personal')}

/* =========================================================
   V83 Phase 1 — Modify Window map
   Existing edit flow kept unchanged:
   openEditModal -> editBody -> renderEditVerses -> saveEditGroup/deleteEditGroup.
   Future phases should reshape this section without changing personal-data save logic.
   ========================================================= */
let editActiveTab='ayahs', editNoteBuffer='', editUnoteBuffer='';
/* Phase 4: tracks which verse cards are expanded in the الآيات tab */
let editVerseExpanded=[];

function openEditModal(id){let g=personalData.find(x=>+x.id===+id);if(!g)return;if(isTrue(g.locked))return alert('المجموعة مقفلة');editGroupId=id;editActiveTab='ayahs';editNoteBuffer=g.note||'';editUnoteBuffer=g.unote||'';editVersesBuffer=clone(g.verses||[]);editVerseExpanded=(g.verses||[]).map(()=>false);modal('editModal','تعديل المتشابه',editBody(g),'');renderEditTab()}

function editStatusText(g){if(g.status)return escapeHtml(g.status);if(isTrue(g.verified))return 'Verified';if(isTrue(g.reviewed))return 'Reviewed';return 'Draft'}

function editSimilarityText(g){let s=g.candidateScore||g.similarity||g.similarityScore||'';if(!s)return 'غير متاح';s=String(s);return /%/.test(s)?escapeHtml(s):escapeHtml(s)+'%'}

function editTagsHtml(g){let tags=(typeof getTags==='function'?getTags(g):(Array.isArray(g.surahs)?g.surahs:[])).filter(Boolean);return tags.length?tags.map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join(''):'<span class="tag">بدون وسوم</span>'}

function editTabsHtml(){let tabs=[['ayahs','الآيات'],['differences','الفروقات'],['notes','الملاحظات'],['tags','التصنيفات'],['preview','المعاينة']];return `<nav class="v83-edit-tabs" aria-label="تبويبات التحرير">${tabs.map(([key,label])=>`<button type="button" class="v83-edit-tab ${editActiveTab===key?'active':''}" aria-selected="${editActiveTab===key?'true':'false'}" onclick="setEditTab('${key}')">${label}</button>`).join('')}</nav>`}

function syncEditTabBuffers(){let note=document.getElementById('editNote'),unote=document.getElementById('editUnote');if(note)editNoteBuffer=note.innerHTML;if(unote)editUnoteBuffer=unote.innerHTML}

function setEditTab(tab){syncEditTabBuffers();editActiveTab=tab;renderEditTab()}

function ensureEditAyahsTab(){if(editActiveTab!=='ayahs'){syncEditTabBuffers();editActiveTab='ayahs';renderEditTab()}}

function editPlaceholder(title){return `<section class="v83-edit-section"><div class="v83-edit-placeholder"><h3>${title}</h3><p>سيتم إضافة هذا القسم لاحقاً</p></div></section>`}

function editAyahsTabHtml(){return `<div class="quran-search-box edit-quran-search"><div class="search-stats"><span id="editExact">0 :Exact</span><span id="editClose">0 :Close</span><span id="editTotal">0 :Total</span></div><h3>بحث ذكي في القرآن</h3><p>يتجاهل التشكيل واختلافات الهمزات والألف وى/ي وة/ه وؤ/و وئ/ي. النتائج المطابقة أولاً ثم القريبة.</p><input class="wide-input" id="editQSearch" placeholder="ابحث داخل quran-reference.js ثم أضف الآية أو النص المحدد..." oninput="runQuranSearch('edit')"><div id="editQResults" class="quran-results hint">اكتب كلمة لعرض النتائج.</div></div><section class="v83-edit-section"><div class="v83-edit-section-head"><h3>الآيات</h3><small>كل حقول الآيات الحالية محفوظة كما هي</small></div><div id="editVerses"></div></section>`}

function editNotesTabHtml(){return `<div class="nt-card v83-edit-card"><div class="v83-edit-section-head"><h3><span class="df-dot" style="background:#1d4ed8"></span>ملاحظة</h3><small>تظهر أسفل المجموعة في العرض العادي</small></div>${richEditor('editNote','','#1d4ed8')}</div><div class="nt-card v83-edit-card"><div class="v83-edit-section-head"><h3><span class="df-dot" style="background:#b91c1c"></span>فائدة فريدة / إضافية</h3><small>تُعرض بإطار بنفسجي مميز</small></div>${richEditor('editUnote','','#b91c1c')}</div>`}

function editDifferencesTabHtml(){if(!editVersesBuffer.length)return`<section class="v83-edit-section"><div class="v83-edit-placeholder"><h3>الفروقات</h3><p>لا توجد آيات — أضف آيات من تبويب الآيات أولاً.</p></div></section>`;const cats=[{k:'shared',l:'النص المشترك'},{k:'diff',l:'الاختلاف'},{k:'diff2',l:'الاختلاف الثاني'},{k:'diff3',l:'الاختلاف الثالث'},{k:'addition',l:'الزيادة'},{k:'unique',l:'الفريد / النقص'}];const byType={};editVersesBuffer.forEach(v=>(v.parts||[]).forEach(p=>{if(p.text){if(!byType[p.type])byType[p.type]=[];byType[p.type].push({v,p})}}));const used=cats.filter(c=>byType[c.k]);const empty=cats.filter(c=>!byType[c.k]);if(!used.length)return`<section class="v83-edit-section"><div class="v83-edit-placeholder"><h3>الفروقات</h3><p>لا توجد أجزاء مصنّفة — افتح الآيات وصنّف أجزاء النص.</p></div></section>`;return used.map(c=>{const items=byType[c.k];return`<section class="v83-edit-section"><div class="v83-edit-section-head"><h3><span class="df-dot ${c.k}"></span>${c.l}</h3><small>${items.length} جزء</small></div><div class="df-list">${items.map(({v,p})=>`<div class="df-item"><span class="df-ref"><span class="surah-name">${escapeHtml(v.surah)}</span><span class="ayah-num">${escapeHtml(String(v.ayah||1))}</span></span><span class="df-text ${c.k}">${escapeHtml(p.text)}</span></div>`).join('')}</div></section>`}).join('')+(empty.length?`<section class="v83-edit-section"><div class="v83-edit-section-head"><h3>أنواع غير مستخدمة</h3><small>${empty.length} نوع</small></div><div class="df-empty-chips">${empty.map(c=>`<span class="df-empty-chip">${c.l}</span>`).join('')}</div></section>`:'')}

function editTagsTabHtml(){const surahs=[...new Set(editVersesBuffer.map(v=>v.surah).filter(Boolean))];const g=personalData.find(x=>+x.id===+editGroupId)||{};const flags=[];if(isTrue(g.favorite))flags.push({cls:'fav',l:'مفضّلة ★'});if(isTrue(g.completed))flags.push({cls:'done',l:'مكتملة ✓'});if(isTrue(g.locked))flags.push({cls:'locked',l:'مقفلة 🔒'});if(!flags.length)flags.push({cls:'draft',l:'Draft'});return`<section class="v83-edit-section"><div class="v83-edit-section-head"><h3>السور المرتبطة</h3><small>تُحدَّث تلقائياً عند الحفظ</small></div>${surahs.length?`<div class="tg-chip-row">${surahs.map(s=>`<span class="tg-chip tg-surah">${escapeHtml(s)}</span>`).join('')}</div>`:'<div class="hint">لا توجد آيات بعد — أضف آيات من تبويب الآيات.</div>'}</section><section class="v83-edit-section"><div class="v83-edit-section-head"><h3>الحالة</h3><small>حالة المجموعة الحالية</small></div><div class="tg-chip-row">${flags.map(f=>`<span class="tg-chip tg-status ${f.cls}">${f.l}</span>`).join('')}</div></section>`}

function editPreviewTabHtml(){const title=document.getElementById('editTitle')?.value.trim()||'—';const g={id:editGroupId,title,verses:editVersesBuffer,note:editNoteBuffer,unote:editUnoteBuffer,surahs:[...new Set(editVersesBuffer.map(v=>v.surah).filter(Boolean))]};const tags=g.surahs.map(s=>`<span class="tag">${escapeHtml(s)}</span>`).join('')+`<span class="tag">${g.verses.length} آية</span>`;const body=renderGroupBody(g);const hasContent=g.verses.length||g.note||g.unote;return`<div class="hint pv-notice">معاينة حية — تعكس التعديلات الحالية قبل الحفظ</div><section class="v83-edit-section"><div class="pv-card-head"><div class="group-num">${escapeHtml(String(editGroupId))}</div><div class="pv-title-wrap"><div class="group-title">${escapeHtml(title)}</div><div class="group-tags">${tags}</div></div></div><div class="pv-card-body">${hasContent?body:'<div class="hint">لا توجد محتويات — أضف آيات أو ملاحظات من التبويبات الأخرى.</div>'}</div></section>`}

function refreshEditPreviewPanel(){const p=document.getElementById('editPreviewPanelContent');if(!p)return;const g={id:editGroupId,verses:editVersesBuffer,note:editNoteBuffer,unote:editUnoteBuffer};const body=renderGroupBody(g);p.innerHTML=body||'<div class="hint">لا توجد محتويات بعد.</div>'}

function renderEditTab(){let root=document.getElementById('editTabContent'),tabs=document.getElementById('editTabsMount');if(tabs)tabs.innerHTML=editTabsHtml();if(!root)return;if(editActiveTab==='ayahs'){root.innerHTML=editAyahsTabHtml();renderEditVerses();runQuranSearch('edit');return}if(editActiveTab==='notes'){root.innerHTML=editNotesTabHtml();let note=document.getElementById('editNote'),unote=document.getElementById('editUnote');if(note)note.innerHTML=editNoteBuffer;if(unote)unote.innerHTML=editUnoteBuffer;refreshEditPreviewPanel();return}if(editActiveTab==='differences'){root.innerHTML=editDifferencesTabHtml();refreshEditPreviewPanel();return}if(editActiveTab==='tags'){root.innerHTML=editTagsTabHtml();refreshEditPreviewPanel();return}root.innerHTML=editPreviewTabHtml();refreshEditPreviewPanel()}

function editBody(g){return `<section class="v83-edit-shell" dir="rtl"><div class="v83-edit-toolbar"><div class="v83-edit-toolbar-title"><b>تعديل المتشابه</b><small>مساحة تحرير مدمجة مع نفس منطق الحفظ الحالي</small></div><div class="v83-edit-toolbar-actions"><button class="primary" onclick="saveEditGroup()">حفظ التعديل</button><button class="danger" onclick="deleteEditGroup()">حذف المجموعة</button><button onclick="closeModal('editModal')">إغلاق</button></div></div><div class="v83-edit-layout"><aside class="v83-edit-props" aria-label="خصائص المجموعة"><section class="v83-edit-card"><h3>خصائص المجموعة</h3><label class="field">عنوان المتشابه<input id="editTitle" value="${escapeHtml(g.title||'')}"></label><div class="v83-edit-metrics"><span><b>#${escapeHtml(g.id)}</b><small>رقم المجموعة</small></span><span><b>${(g.verses||[]).length}</b><small>عدد الآيات</small></span><span><b>${editSimilarityText(g)}</b><small>درجة التشابه</small></span><span><b>${editStatusText(g)}</b><small>الحالة</small></span></div></section><section class="v83-edit-card"><h3>الوسوم</h3><div class="v83-edit-chip-row">${editTagsHtml(g)}</div></section><section class="v83-edit-card"><h3>إجراءات سريعة</h3><div class="v83-edit-quick-actions"><button class="primary" onclick="addBlankEditVerse()">+ إضافة آية</button><button onclick="sortEditVersesByMushaf()">ترتيب حسب المصحف</button></div></section></aside><main class="v83-edit-main"><div id="editTabsMount">${editTabsHtml()}</div><div id="editTabContent" class="v83-edit-tab-panel"></div></main><aside class="v83-edit-preview-panel" id="editPreviewPanel"><div class="v83-edit-section-head"><h3>معاينة مباشرة</h3><small>تتحدث مع كل تعديل</small></div><div class="pv-card-body" id="editPreviewPanelContent"><div class="hint">سيظهر المحتوى هنا.</div></div></aside></div></section>`}

/* =========================================================
   V83 Phase 4 — Compact verse editor cards (الآيات tab)
   Each card shows: surah / ayah badge + text preview when collapsed.
   Click the edit (✏️) button or the preview text to expand the full form.
   All existing fields and save logic are preserved unchanged.
   ========================================================= */
function toggleEditVerse(vi){editVerseExpanded[vi]=!editVerseExpanded[vi];renderEditVerses()}

function deleteEditVerse(vi){editVersesBuffer.splice(vi,1);editVerseExpanded.splice(vi,1);renderEditVerses()}

function renderEditVerses(){
  /* sync expanded array length to buffer length */
  while(editVerseExpanded.length<editVersesBuffer.length)editVerseExpanded.push(false);
  editVerseExpanded.length=editVersesBuffer.length;
  let b=document.getElementById('editVerses');
  if(!b)return;
  if(!editVersesBuffer.length){b.innerHTML='<div class="hint">لا توجد آيات. اضغط "+ إضافة آية" لبدء.</div>';refreshEditPreviewPanel();return}
  b.innerHTML=editVersesBuffer.map((v,vi)=>{
    let sno=getValidSurahNo(v.surah),ayah=v.ayah||1,isOpen=!!editVerseExpanded[vi];
    let preview=(v.parts||[]).map(p=>`<span class="${p.type}">${escapeHtml(p.text)}</span>`).join(' ')||'<em style="opacity:.4">لا يوجد نص</em>';
    let bodyHtml=isOpen?`<div class="ev-card-body"><div class="form-grid"><label class="field">السورة<select onchange="setEditSurah(${vi},this.value)">${surahOptionsHtml(sno)}</select></label><label class="field">رقم الآية<select onchange="setEditAyah(${vi},this.value)">${ayahOptionsHtml(sno,ayah)}</select></label><label class="field">Label<input value="${escapeHtml(v.label||'')}" onchange="editVersesBuffer[${vi}].label=this.value"></label></div><div class="ev-card-fill-row"><button type="button" onclick="fillEditAyah(${vi})">ملء نص الآية من المرجع</button></div><div class="ev-card-parts-head"><b>أجزاء النص</b></div>${(v.parts||[]).map((p,pi)=>partRow(vi,pi,p)).join('')}<button type="button" class="ev-add-part" onclick="addEditPart(${vi})">+ إضافة جزء نص</button></div>`:'';
    return `<div class="ev-card${isOpen?' ev-card--open':''}"><div class="ev-card-head"><div class="ev-card-meta"><span class="ev-card-num">${vi+1}</span><span class="surah-name">${escapeHtml(v.surah)}</span><span class="ayah-num">${escapeHtml(String(ayah))}</span>${v.label?`<span class="verse-label">${escapeHtml(v.label)}</span>`:''}</div><div class="ev-card-actions"><button type="button" class="ev-btn-edit${isOpen?' active':''}" title="${isOpen?'طي':'تعديل'}" onclick="toggleEditVerse(${vi})">${isOpen?'🔼':'✏️'}</button><button type="button" title="أعلى" onclick="moveEditVerse(${vi},-1)"${vi===0?' disabled':''}>↑</button><button type="button" title="أسفل" onclick="moveEditVerse(${vi},1)"${vi===editVersesBuffer.length-1?' disabled':''}>↓</button><button type="button" class="danger" title="حذف الآية" onclick="deleteEditVerse(${vi})">×</button></div></div><div class="ev-card-preview verse-text" onclick="toggleEditVerse(${vi})">${preview}</div>${bodyHtml}</div>`}).join('');
  refreshEditPreviewPanel();
}

function partRow(vi,pi,p){return `<div class="part-row"><select aria-label="نوع الجزء" onchange="editVersesBuffer[${vi}].parts[${pi}].type=this.value;renderEditVerses()">${partOptions(p.type)}</select><textarea aria-label="نص الجزء" onchange="editVersesBuffer[${vi}].parts[${pi}].text=this.value">${escapeHtml(p.text)}</textarea><div class="part-actions"><button title="تحريك لأعلى" onclick="moveEditPart(${vi},${pi},-1)">↑</button><button title="تحريك لأسفل" onclick="moveEditPart(${vi},${pi},1)">↓</button><button title="إضافة قبل" onclick="insertEditPart(${vi},${pi})">+ قبل</button><button title="إضافة بعد" onclick="insertEditPart(${vi},${pi}+1)">+ بعد</button><button class="danger" title="حذف" onclick="removeEditPart(${vi},${pi})">حذف</button></div></div>`}

function addBlankEditVerse(){editVersesBuffer.push({surah:'الفاتحة',ayah:1,label:'',parts:[{type:'normal',text:''}]});editVerseExpanded.push(true);ensureEditAyahsTab();renderEditVerses()}

function moveEditVerse(i,d){let j=i+d;if(j<0||j>=editVersesBuffer.length)return;[editVersesBuffer[i],editVersesBuffer[j]]=[editVersesBuffer[j],editVersesBuffer[i]];[editVerseExpanded[i],editVerseExpanded[j]]=[editVerseExpanded[j],editVerseExpanded[i]];renderEditVerses()}

function addEditPart(vi){editVersesBuffer[vi].parts.push({type:'normal',text:''});renderEditVerses()}

function insertEditPart(vi,pi){editVersesBuffer[vi].parts.splice(pi+1,0,{type:'normal',text:''});renderEditVerses()}

function removeEditPart(vi,pi){editVersesBuffer[vi].parts.splice(pi,1);renderEditVerses()}

function moveEditPart(vi,pi,d){let a=editVersesBuffer[vi].parts,j=pi+d;if(j<0||j>=a.length)return;[a[pi],a[j]]=[a[j],a[pi]];renderEditVerses()}

function setEditSurah(vi,no){let names=surahNames(),sno=getValidSurahNo(no),arr=[];try{arr=getSurahAyahs(sno)||[]}catch(e){};if(!editVersesBuffer[vi])return;editVersesBuffer[vi].surah=names[sno]||String(no);editVersesBuffer[vi].ayah=(arr[0]&&arr[0].ayahNo)||1;renderEditVerses()}

function setEditAyah(vi,ayah){if(!editVersesBuffer[vi])return;editVersesBuffer[vi].ayah=parseInt(ayah,10)||ayah}

function fillEditAyah(vi){let v=editVersesBuffer[vi],a=getRef(getSurahNo(v.surah),v.ayah);if(!a)return alert('لم يتم العثور');v.surah=a.surah;v.ayah=a.ayahNo;v.parts=[{type:'normal',text:a.text}];renderEditVerses()}

function sortEditVersesByMushaf(){editVersesBuffer.sort((a,b)=>getSurahNo(a.surah)-getSurahNo(b.surah)||(+a.ayah||0)-(+b.ayah||0));editVerseExpanded=editVersesBuffer.map(()=>false);ensureEditAyahsTab();renderEditVerses()}

function saveEditGroup(){syncEditTabBuffers();let i=personalData.findIndex(g=>+g.id===+editGroupId);if(i<0)return;personalData[i]={...personalData[i],title:document.getElementById('editTitle').value.trim(),verses:clone(editVersesBuffer),surahs:[...new Set(editVersesBuffer.map(v=>v.surah))],note:editNoteBuffer,unote:editUnoteBuffer};saveDb('personal');closeModal('editModal');renderActiveGroups()}

function deleteEditGroup(){if(confirm('حذف المجموعة؟')){personalData=personalData.filter(g=>+g.id!==+editGroupId);saveDb('personal');closeModal('editModal');renderActiveGroups();updateHomeCounts()}}
/* End V83 Phase 1 — Modify Window map */
