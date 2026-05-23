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

function openEditModal(id){let g=personalData.find(x=>+x.id===+id);if(!g)return;if(isTrue(g.locked))return alert('المجموعة مقفلة');editGroupId=id;editVersesBuffer=clone(g.verses||[]);modal('editModal','تعديل المتشابه',editBody(g),`<button class="primary" onclick="saveEditGroup()">حفظ التعديل</button><button class="danger" onclick="deleteEditGroup()">حذف المجموعة</button><button onclick="closeModal('editModal')">إغلاق</button>`);renderEditVerses();runQuranSearch('edit')}

function editBody(g){return `<div class="quran-search-box edit-quran-search"><div class="search-stats"><span id="editExact">0 :Exact</span><span id="editClose">0 :Close</span><span id="editTotal">0 :Total</span></div><h3>بحث ذكي في القرآن</h3><p>يتجاهل التشكيل واختلافات الهمزات والألف وى/ي وة/ه وؤ/و وئ/ي. النتائج المطابقة أولاً ثم القريبة.</p><input class="wide-input" id="editQSearch" placeholder="ابحث داخل quran-reference.js ثم أضف الآية أو النص المحدد..." oninput="runQuranSearch('edit')"><div id="editQResults" class="quran-results hint">اكتب كلمة لعرض النتائج.</div></div><label class="field">عنوان المتشابه<input id="editTitle" value="${escapeHtml(g.title)}"></label><div class="inline-actions"><button class="primary" onclick="addBlankEditVerse()">+ إضافة آية</button><button onclick="sortEditVersesByMushaf()">ترتيب حسب المصحف</button></div><div id="editVerses"></div>${richEditor('editNote','ملاحظة','#1d4ed8')}${richEditor('editUnote','فائدة فريدة / إضافية','#b91c1c')}`}

function renderEditVerses(){let b=document.getElementById('editVerses');if(!b)return;b.innerHTML=editVersesBuffer.map((v,vi)=>{let sno=getValidSurahNo(v.surah),ayah=v.ayah||1;return `<div class="edit-verse"><div class="edit-verse-title"><b>آية ${vi+1}</b><div><button onclick="moveEditVerse(${vi},-1)">↑</button><button onclick="moveEditVerse(${vi},1)">↓</button><button class="danger" onclick="editVersesBuffer.splice(${vi},1);renderEditVerses()">حذف الآية</button></div></div><div class="form-grid"><label class="field">السورة<select onchange="setEditSurah(${vi},this.value)">${surahOptionsHtml(sno)}</select></label><label class="field">رقم الآية<select onchange="setEditAyah(${vi},this.value)">${ayahOptionsHtml(sno,ayah)}</select></label><label class="field">Label<input value="${escapeHtml(v.label||'')}" onchange="editVersesBuffer[${vi}].label=this.value"></label></div><button onclick="fillEditAyah(${vi})">ملء نص الآية من المرجع</button><h4>أجزاء النص</h4>${(v.parts||[]).map((p,pi)=>partRow(vi,pi,p)).join('')}<button onclick="addEditPart(${vi})">+ إضافة جزء نص</button><div class="live-preview verse-text">${(v.parts||[]).map(p=>`<span class="${p.type}">${escapeHtml(p.text)}</span>`).join(' ')}</div></div>`}).join('')}

function partRow(vi,pi,p){return `<div class="part-row"><select aria-label="نوع الجزء" onchange="editVersesBuffer[${vi}].parts[${pi}].type=this.value;renderEditVerses()">${partOptions(p.type)}</select><textarea aria-label="نص الجزء" onchange="editVersesBuffer[${vi}].parts[${pi}].text=this.value">${escapeHtml(p.text)}</textarea><div class="part-actions"><button title="تحريك لأعلى" onclick="moveEditPart(${vi},${pi},-1)">↑</button><button title="تحريك لأسفل" onclick="moveEditPart(${vi},${pi},1)">↓</button><button title="إضافة قبل" onclick="insertEditPart(${vi},${pi})">+ قبل</button><button title="إضافة بعد" onclick="insertEditPart(${vi},${pi}+1)">+ بعد</button><button class="danger" title="حذف" onclick="removeEditPart(${vi},${pi})">حذف</button></div></div>`}

function addBlankEditVerse(){editVersesBuffer.push({surah:'الفاتحة',ayah:1,label:'',parts:[{type:'normal',text:''}]});renderEditVerses()}

function moveEditVerse(i,d){let j=i+d;if(j<0||j>=editVersesBuffer.length)return;[editVersesBuffer[i],editVersesBuffer[j]]=[editVersesBuffer[j],editVersesBuffer[i]];renderEditVerses()}

function addEditPart(vi){editVersesBuffer[vi].parts.push({type:'normal',text:''});renderEditVerses()}

function insertEditPart(vi,pi){editVersesBuffer[vi].parts.splice(pi+1,0,{type:'normal',text:''});renderEditVerses()}

function removeEditPart(vi,pi){editVersesBuffer[vi].parts.splice(pi,1);renderEditVerses()}

function moveEditPart(vi,pi,d){let a=editVersesBuffer[vi].parts,j=pi+d;if(j<0||j>=a.length)return;[a[pi],a[j]]=[a[j],a[pi]];renderEditVerses()}

function setEditSurah(vi,no){let names=surahNames(),sno=getValidSurahNo(no),arr=[];try{arr=getSurahAyahs(sno)||[]}catch(e){};if(!editVersesBuffer[vi])return;editVersesBuffer[vi].surah=names[sno]||String(no);editVersesBuffer[vi].ayah=(arr[0]&&arr[0].ayahNo)||1;renderEditVerses()}

function setEditAyah(vi,ayah){if(!editVersesBuffer[vi])return;editVersesBuffer[vi].ayah=parseInt(ayah,10)||ayah}

function fillEditAyah(vi){let v=editVersesBuffer[vi],a=getRef(getSurahNo(v.surah),v.ayah);if(!a)return alert('لم يتم العثور');v.surah=a.surah;v.ayah=a.ayahNo;v.parts=[{type:'normal',text:a.text}];renderEditVerses()}

function sortEditVersesByMushaf(){editVersesBuffer.sort((a,b)=>getSurahNo(a.surah)-getSurahNo(b.surah)||(+a.ayah||0)-(+b.ayah||0));renderEditVerses()}

function saveEditGroup(){let i=personalData.findIndex(g=>+g.id===+editGroupId);if(i<0)return;personalData[i]={...personalData[i],title:document.getElementById('editTitle').value.trim(),verses:clone(editVersesBuffer),surahs:[...new Set(editVersesBuffer.map(v=>v.surah))],note:document.getElementById('editNote').innerHTML,unote:document.getElementById('editUnote').innerHTML};saveDb('personal');closeModal('editModal');renderActiveGroups()}

function deleteEditGroup(){if(confirm('حذف المجموعة؟')){personalData=personalData.filter(g=>+g.id!==+editGroupId);saveDb('personal');closeModal('editModal');renderActiveGroups();updateHomeCounts()}}
