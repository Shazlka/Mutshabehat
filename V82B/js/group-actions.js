function findActive(id){return activeData.find(g=>Number(g.id)===Number(id))}

function toggleFlag(id,f){let g=findActive(id);if(!g)return;g[f]=!isTrue(g[f]);saveDb(activeDb);renderActiveGroups();updateHomeCounts()}

function nextPersonalId(){return Math.max(0,...personalData.map(g=>Number(g.id)||0))+1}

function copyAutoGroupToPersonal(id){let g=automatedData.find(x=>Number(x.id)===Number(id));if(!g)return;let c=clone([g])[0];c.id=nextPersonalId();c.autoCandidate=false;c.source='automated';personalData.push(c);saveDb('personal');alert('تم النسخ إلى الشخصية');updateHomeCounts()}

function copyGroupText(id){let g=findActive(id);if(!g)return;let txt=`${g.title}\n`+(g.verses||[]).map(v=>`${v.surah} ${v.ayah}: ${(v.parts||[]).map(p=>p.text).join('')}`).join('\n');navigator.clipboard?.writeText(txt);alert('تم النسخ')}

async function copyGroupText(id){let g=findActive(id);if(!g)return;let ok=await writeClipboardTextV78(groupPlainText(g));toast(ok?'تم النسخ مع الملاحظات':'لم يتم النسخ — انسخ يدوياً من المتصفح',ok?'ok':'err')}

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
