function filePersonal(){return Array.isArray(window.PERSONAL_DATA)?window.PERSONAL_DATA:[]}

function fileAuto(){return Array.isArray(window.AUTOMATED_DATA)?window.AUTOMATED_DATA:[]}

function loadDb(k,f){try{let s=JSON.parse(localStorage.getItem(k)||'null');if(Array.isArray(s)&&s.length)return s}catch(e){}return clone(f)}

function saveDb(w){localStorage.setItem(w==='personal'?PERSONAL_KEY:AUTO_KEY,JSON.stringify(w==='personal'?personalData:automatedData));storage('✓ محفوظ');if(w==='personal')triggerGitHubAutoSyncV79('database-change:'+w)}

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

function automatedPromptHtmlV84(){
  return '<div class="hint"><b>قاعدة المتشابهات الآلية جاهزة للتحميل حسب السورة.</b><br>افتح الفلتر واختر سورة ليتم تحميل ملفها فقط من <code>automated-surahs</code>.</div>';
}
