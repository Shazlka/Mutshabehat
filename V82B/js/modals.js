function modal(id,title,body,footer){closeModal(id);let e=document.createElement('section');e.id=id;e.className='modal-backdrop';let modalClass='modal '+id+'-window';e.innerHTML=`<div class="${modalClass}" role="dialog" aria-modal="true"><div class="modal-head"><h2>${title}</h2><button class="modal-close-btn" aria-label="إغلاق" onclick="closeModal('${id}')">×</button></div><div class="modal-body">${body}</div><div class="modal-footer">${footer||''}</div></div>`;e.onclick=x=>{if(x.target===e)closeModal(id)};document.getElementById('modalRoot').appendChild(e)}

function closeModal(id){document.getElementById(id)?.remove()}

function openMobileMenu(){let items=[['الرئيسية','openHome()'],['الشخصية',"openDatabase('personal')"],['الآلية',"openDatabase('auto')"],['إضافة','openAddModal()'],['الإحصائيات','openDashboard()'],['الإعدادات','openAppSettings()'],['بحث متقدم','openAdvancedSearch()'],['دمج','openMergeWindow()'],['Release Notes','openReleaseNotes()']];let e=document.createElement('section');e.id='mobileMenu';e.className='modal-backdrop';e.innerHTML=`<div class="mobile-menu-panel"><button onclick="closeModal('mobileMenu')">× إغلاق</button>${items.map(i=>`<button onclick="closeModal('mobileMenu');${i[1]}">${i[0]}</button>`).join('')}</div>`;document.getElementById('modalRoot').appendChild(e)}

function lockBodyScrollV78(){if(document.body.classList.contains('modal-open-v78'))return;__modalScrollY_V78=window.scrollY||document.documentElement.scrollTop||0;document.body.style.top=`-${__modalScrollY_V78}px`;document.body.classList.add('modal-open-v78')}

function unlockBodyScrollV78(){if(document.querySelector('.modal-backdrop'))return;document.body.classList.remove('modal-open-v78');document.body.style.top='';window.scrollTo(0,__modalScrollY_V78||0)}

function modal(id,title,body,footer){closeModal(id);let e=document.createElement('section');e.id=id;e.className='modal-backdrop';let modalClass='modal '+id+'-window';e.innerHTML=`<div class="${modalClass}" data-testid="modal-${id}" role="dialog" aria-modal="true"><div class="modal-head"><span class="modal-drag-handle"></span><h2>${title}</h2><button class="modal-close-btn icon-outline" aria-label="إغلاق" onclick="closeModal('${id}')">×</button></div><div class="modal-body">${body}</div><div class="modal-footer">${footer||''}</div></div>`;e.onclick=x=>{if(x.target===e)closeModal(id)};document.getElementById('modalRoot').appendChild(e);lockBodyScrollV78();enableSwipeToClose(e,id)}

function closeModal(id){document.getElementById(id)?.remove();setTimeout(unlockBodyScrollV78,0)}

function isMobileLayout(){return window.matchMedia&&window.matchMedia('(max-width: 900px)').matches}

function enableSwipeToClose(backdrop,id){let panel=backdrop.querySelector('.modal,.mobile-menu-panel');if(!panel)return;panel.addEventListener('touchstart',e=>{if(!isMobileLayout())return;let t=e.touches[0];__touchStartY_V78=t.clientY;__touchStartX_V78=t.clientX;__touchStartedOnHead_V78=!!e.target.closest('.modal-head,.modal-drag-handle')},{passive:true});panel.addEventListener('touchmove',e=>{if(!isMobileLayout())return;if(e.target.closest('.modal-body'))return;e.preventDefault()},{passive:false});panel.addEventListener('touchend',e=>{if(!isMobileLayout())return;let t=e.changedTouches[0],dy=t.clientY-__touchStartY_V78,dx=Math.abs(t.clientX-__touchStartX_V78);let body=panel.querySelector('.modal-body');let atTop=!body||body.scrollTop<=2;if(dy>95&&dx<80&&(__touchStartedOnHead_V78||atTop))closeModal(id)},{passive:true})}

function openMobileMenu(){
  const items = [
    { icon: '🏠', label: 'الرئيسية',    action: 'openHome()',                primary: false },
    { icon: '📖', label: 'الشخصية',     action: "openDatabase('personal')",  primary: true  },
    { icon: '🤖', label: 'الآلية',      action: "openDatabase('auto')",      primary: false },
    { icon: '➕', label: 'إضافة متشابه',action: 'openAddModal()',             primary: true  },
    { icon: '🔍', label: 'بحث متقدم',   action: 'openAdvancedSearch()',      primary: false },
    { icon: '📊', label: 'الإحصائيات', action: 'openDashboard()',            primary: false },
    { icon: '⚙️', label: 'الإعدادات',  action: 'openAppSettings()',          primary: false },
    { icon: '☁️', label: 'مزامنة',      action: 'manualSyncGitHub()',         primary: false },
    { icon: '📤', label: 'تصدير',       action: 'exportActiveDatabase()',     primary: false },
  ];
  const e = document.createElement('section');
  e.id = 'mobileMenu';
  e.className = 'modal-backdrop';
  e.innerHTML = `
    <div class="mobile-menu-panel">
      <div class="mobile-menu-header">
        <span class="mobile-menu-title">القائمة</span>
        <button class="mobile-menu-close" onclick="closeModal('mobileMenu')">✕</button>
      </div>
      <div class="mobile-menu-separator"></div>
      <div class="mobile-menu-grid">
        ${items.map(i => `
          <button class="mobile-nav-item ${i.primary ? 'mobile-nav-primary' : ''}"
            onclick="closeModal('mobileMenu');${i.action}">
            <span class="nav-icon">${i.icon}</span>
            <span class="nav-label">${i.label}</span>
          </button>
        `).join('')}
      </div>
    </div>`;
  document.getElementById('modalRoot').appendChild(e);
  lockBodyScrollV78();
  enableSwipeToClose(e, 'mobileMenu');
}