function lockBodyScrollV78(){if(document.body.classList.contains('modal-open-v78'))return;__modalScrollY_V78=window.scrollY||document.documentElement.scrollTop||0;document.body.style.top=`-${__modalScrollY_V78}px`;document.body.classList.add('modal-open-v78')}

function unlockBodyScrollV78(){if(document.querySelector('.modal-backdrop'))return;document.body.classList.remove('modal-open-v78');document.body.style.top='';window.scrollTo(0,__modalScrollY_V78||0)}

function modal(id,title,body,footer){closeModal(id);let e=document.createElement('section');e.id=id;e.className='modal-backdrop';let modalClass='modal '+id+'-window';e.innerHTML=`<div class="${modalClass}" role="dialog" aria-modal="true"><div class="modal-head"><span class="modal-drag-handle"></span><h2>${title}</h2><button class="modal-close-btn icon-outline" aria-label="إغلاق" onclick="closeModal('${id}')">×</button></div><div class="modal-body">${body}</div><div class="modal-footer">${footer||''}</div></div>`;e.onclick=x=>{if(x.target===e)closeModal(id)};document.getElementById('modalRoot').appendChild(e);lockBodyScrollV78();enableSwipeToClose(e,id)}

function closeModal(id){document.getElementById(id)?.remove();setTimeout(unlockBodyScrollV78,0)}

function isMobileLayout(){return window.matchMedia&&window.matchMedia('(max-width: 900px)').matches}

function enableSwipeToClose(backdrop,id){let panel=backdrop.querySelector('.modal,.mobile-menu-panel,.v83-burger-drawer');if(!panel)return;panel.addEventListener('touchstart',e=>{if(!isMobileLayout())return;let t=e.touches[0];__touchStartY_V78=t.clientY;__touchStartX_V78=t.clientX;__touchStartedOnHead_V78=!!e.target.closest('.modal-head,.modal-drag-handle,.v83-burger-head')},{passive:true});panel.addEventListener('touchmove',e=>{if(!isMobileLayout())return;if(e.target.closest('.modal-body,.v83-burger-body'))return;e.preventDefault()},{passive:false});panel.addEventListener('touchend',e=>{if(!isMobileLayout())return;let t=e.changedTouches[0],dy=t.clientY-__touchStartY_V78,dx=Math.abs(t.clientX-__touchStartX_V78);let body=panel.querySelector('.modal-body,.v83-burger-body');let atTop=!body||body.scrollTop<=2;if(dy>95&&dx<80&&(__touchStartedOnHead_V78||atTop))closeModal(id)},{passive:true})}

function openMobileMenu(){let items=[['الرئيسية','openHome()'],['المتشابهات',"openDatabase('personal')"],['المفضلة','openDashboard()'],['المحفوظات',"openDatabase('auto')"],['الملاحظات','openDashboard()'],['الإعدادات','openAppSettings()']];let e=document.createElement('section');e.id='mobileMenu';e.className='modal-backdrop';e.innerHTML=`<div class="mobile-menu-panel"><button onclick="closeModal('mobileMenu')">× إغلاق</button>${items.map(i=>`<button onclick="closeModal('mobileMenu');${i[1]}">${i[0]}</button>`).join('')}</div>`;document.getElementById('modalRoot').appendChild(e);lockBodyScrollV78();enableSwipeToClose(e,'mobileMenu')}

function openV83MobileBurgerMenu() {
  closeModal('v83MobileBurgerMenu');
  if (typeof getSettings !== 'function') return;
  let s = getSettings();
  let activeDbName = (typeof activeDb !== 'undefined') ? activeDb : 'personal';
  let personalCount = (typeof personalData !== 'undefined') ? personalData.length : 0;
  let autoCount = 0;
  if (typeof automatedData !== 'undefined') autoCount = automatedData.length;
  else if (typeof activeData !== 'undefined' && activeDbName === 'auto') autoCount = activeData.length;
  
  let names = (typeof surahNames === 'function') ? surahNames() : {};
  let activeSurahNo = selectedSurahFilter ? (typeof getSurahNo === 'function' ? getSurahNo(selectedSurahFilter) : '') : '';
  let surahSelectOptions = '<option value="">-- كل السور (عرض الكل) --</option>' + 
    Object.keys(names).map(no => {
      return `<option value="${no}" ${Number(no) === Number(activeSurahNo) ? 'selected' : ''}>${no} - ${names[no]}</option>`;
    }).join('');

  let currentSort = (typeof displayMode !== 'undefined') ? displayMode : 'original';
  let scale = Number(localStorage.getItem('v83_verse_font_scale') || '1.0');
  
  let bodyHtml = `
    <div class="v83-burger-drawer">
      <div class="v83-burger-head">
        <h3>قائمة التحكم والتنقل</h3>
        <button class="v83-burger-close-btn" onclick="closeModal('v83MobileBurgerMenu')">×</button>
      </div>
      
      <div class="v83-burger-body">
        <!-- Databases Selector -->
        <div class="v83-burger-section">
          <h4>🗄️ قاعدة البيانات النشطة</h4>
          <div class="v83-db-grid">
            <button class="v83-db-card ${activeDbName === 'personal' ? 'active' : ''}" onclick="closeModal('v83MobileBurgerMenu'); openDatabase('personal');">
              <span class="icon">★</span>
              <div class="info">
                <b>قاعدة المتشابهات الشخصية</b>
                <small>${personalCount} مجموعة مضافة</small>
              </div>
            </button>
            <button class="v83-db-card ${activeDbName === 'auto' ? 'active' : ''}" onclick="closeModal('v83MobileBurgerMenu'); openDatabase('auto');">
              <span class="icon">⚙</span>
              <div class="info">
                <b>قاعدة المتشابهات الآلية</b>
                <small>مرشحات المراجعة والنسخ</small>
              </div>
            </button>
          </div>
        </div>

        <!-- Surah Selector -->
        <div class="v83-burger-section">
          <h4>🔍 تصفية وتحميل حسب السورة</h4>
          <div class="v83-pref-row">
            <span>اختر سورة لعرض متشابهاتها وتنزيلها:</span>
            <div class="v83-surah-select-wrap">
              <select id="v83BurgerSurahSelect" onchange="v83BurgerSelectSurah(this.value)" class="v83-burger-select">
                ${surahSelectOptions}
              </select>
            </div>
            ${activeDbName === 'auto' && !selectedSurahFilter ? `
              <div class="v83-burger-hint">
                ⚠️ يرجى اختيار سورة لتحميل وعرض المتشابهات الآلية الخاصة بها.
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Sorting Selector -->
        <div class="v83-burger-section">
          <h4>🔀 ترتيب وعرض المجموعات</h4>
          <div class="v83-sort-list">
            <button class="v83-sort-row ${currentSort === 'original' ? 'active' : ''}" onclick="closeModal('v83MobileBurgerMenu'); setDisplayMode('original'); if(typeof renderActiveGroups==='function')renderActiveGroups();">
              <span class="check">✓</span> الترتيب الأصلي (حسب الرقم)
            </button>
            <button class="v83-sort-row ${currentSort === 'sort-surah' ? 'active' : ''}" onclick="closeModal('v83MobileBurgerMenu'); setDisplayMode('sort-surah'); if(typeof renderActiveGroups==='function')renderActiveGroups();">
              <span class="check">✓</span> ترتيب سور المصحف الشريف
            </button>
            <button class="v83-sort-row ${currentSort === 'group-surah' ? 'active' : ''}" onclick="closeModal('v83MobileBurgerMenu'); setDisplayMode('group-surah'); if(typeof renderActiveGroups==='function')renderActiveGroups();">
              <span class="check">✓</span> تقسيم وتجميع حسب السورة
            </button>
            <button class="v83-sort-row ${currentSort === 'newest' ? 'active' : ''}" onclick="closeModal('v83MobileBurgerMenu'); setDisplayMode('newest'); if(typeof renderActiveGroups==='function')renderActiveGroups();">
              <span class="check">✓</span> المجموعات الأحدث أولاً
            </button>
            <button class="v83-sort-row ${currentSort === 'most-verses' ? 'active' : ''}" onclick="closeModal('v83MobileBurgerMenu'); setDisplayMode('most-verses'); if(typeof renderActiveGroups==='function')renderActiveGroups();">
              <span class="check">✓</span> الأكثر آيات في المجموعة أولاً
            </button>
          </div>
        </div>

        <!-- Quick Settings -->
        <div class="v83-burger-section">
          <h4>⚙️ إعدادات الواجهة السريعة</h4>
          
          <div class="v83-pref-row">
            <span>مظهر التطبيق اللوني:</span>
            <div class="v83-chips-row">
              <button class="v83-theme-chip ${s.theme === 'quran-classic' ? 'active' : ''}" data-theme="quran-classic" onclick="changeV83Theme('quran-classic')">🌿 كلاسيك</button>
              <button class="v83-theme-chip ${s.theme === 'quran-night' ? 'active' : ''}" data-theme="quran-night" onclick="changeV83Theme('quran-night')">🌙 ليلي</button>
              <button class="v83-theme-chip ${s.theme === 'bevel-night' ? 'active' : ''}" data-theme="bevel-night" onclick="changeV83Theme('bevel-night')">💻 داكن</button>
              <button class="v83-theme-chip ${s.theme === 'apple-health' ? 'active' : ''}" data-theme="apple-health" onclick="changeV83Theme('apple-health')">☀️ مضيء</button>
            </div>
          </div>
          
          <div class="v83-pref-row">
            <span>تنسيق ونوع الخط:</span>
            <div class="v83-chips-row">
              <button class="v83-font-chip ${s.font === 'mushaf-qpc-v2' ? 'active' : ''}" data-font="mushaf-qpc-v2" onclick="changeV83FontPreset('mushaf-qpc-v2')">خط المصحف (QPC)</button>
              <button class="v83-font-chip ${s.font === 'normal-quran' ? 'active' : ''}" data-font="normal-quran" onclick="changeV83FontPreset('normal-quran')">خط القراءة السلس</button>
            </div>
          </div>

          <div class="v83-pref-row flex-between">
            <span>تخصيص حجم خط الآيات:</span>
            <div class="v83-size-ctrls">
              <button onclick="changeV83FontSize(-0.1)">- تصغير</button>
              <span id="v83FontSizeVal">${Math.round(scale * 100)}%</span>
              <button onclick="changeV83FontSize(0.1)">+ تكبير</button>
            </div>
          </div>
        </div>

        <!-- Quick Links -->
        <div class="v83-burger-section no-border">
          <h4>📊 إجراءات وروابط سريعة</h4>
          <div class="v83-action-grid">
            <button class="v83-action-card" onclick="closeModal('v83MobileBurgerMenu'); openDashboard();">
              <span>📈</span> الإحصائيات واللوحة
            </button>
            <button class="v83-action-card" onclick="closeModal('v83MobileBurgerMenu'); openAppSettings();">
              <span>⚙️</span> الإعدادات الكاملة
            </button>
            ${activeDbName === 'personal' ? `
              <button class="v83-action-card primary" onclick="closeModal('v83MobileBurgerMenu'); openAddModal();">
                <span>➕</span> إضافة متشابه جديد
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
  `;

  let e = document.createElement('section');
  e.id = 'v83MobileBurgerMenu';
  e.className = 'modal-backdrop';
  e.innerHTML = bodyHtml;
  e.onclick = x => { if (x.target === e) closeModal('v83MobileBurgerMenu'); };
  document.getElementById('modalRoot').appendChild(e);
  lockBodyScrollV78();
  enableSwipeToClose(e, 'v83MobileBurgerMenu');
}

function changeV83Theme(themeId) {
  if (typeof getSettings !== 'function' || typeof applySettings !== 'function') return;
  let s = getSettings();
  s.theme = themeId;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  applySettings();
  document.querySelectorAll('.v83-theme-chip').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-theme') === themeId);
  });
}

function changeV83FontPreset(fontId) {
  if (typeof getSettings !== 'function' || typeof applySettings !== 'function') return;
  let s = getSettings();
  s.font = fontId;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  applySettings();
  document.querySelectorAll('.v83-font-chip').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-font') === fontId);
  });
}

function changeV83FontSize(delta) {
  let scale = Number(localStorage.getItem('v83_verse_font_scale') || '1.0');
  scale = Math.max(0.7, Math.min(1.8, scale + delta));
  localStorage.setItem('v83_verse_font_scale', String(scale));
  applyV83FontSizeScale(scale);
}

function applyV83FontSizeScale(scale) {
  let desktopSize = (1.35 * scale).toFixed(2) + 'rem';
  let mobileSize = (1.1 * scale).toFixed(2) + 'rem';
  document.documentElement.style.setProperty('--verse-fs', desktopSize);
  document.documentElement.style.setProperty('--verse-fs-mobile', mobileSize);
  let valEl = document.getElementById('v83FontSizeVal');
  if (valEl) valEl.textContent = Math.round(scale * 100) + '%';
}

// Auto-run font scale on startup
setTimeout(() => {
  let scale = Number(localStorage.getItem('v83_verse_font_scale') || '1.0');
  applyV83FontSizeScale(scale);
}, 300);

async function v83BurgerSelectSurah(val) {
  if (val === '') {
    if (typeof clearSurahFilter === 'function') clearSurahFilter();
  } else {
    let isAuto = (typeof isAutoDbV84 === 'function') ? isAutoDbV84() : (activeDb === 'auto');
    if (isAuto && typeof toast === 'function') {
      toast('جاري تحميل بيانات السورة سحابياً...', 'info');
    }
    closeModal('v83MobileBurgerMenu');
    if (typeof filterBySurahNo === 'function') await filterBySurahNo(Number(val));
    if (isAuto && typeof toast === 'function') {
      toast('✅ تم تحميل السورة وتحديث الواجهة', 'ok');
    }
  }
  closeModal('v83MobileBurgerMenu');
}
