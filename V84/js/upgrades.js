/* ==========================================================
   V83 UI/UX Upgrades — JS patches
   - Search bar: always visible on desktop, has-text class toggle
   - Mobile nav: active state tracking
   - Empty state: enhanced message
   ========================================================== */

(function initUpgradesV83(){

  /* ── Search bar: always visible + has-text class ── */
  function patchSearchBar(){
    var wrap = document.getElementById('mainSearchWrap');
    var inp  = document.getElementById('searchInput');
    if(!wrap || !inp) return;

    // Always visible on desktop — remove 'hidden' class if desktop
    function ensureVisible(){
      if(window.innerWidth > 850){
        wrap.classList.remove('hidden');
      }
    }
    ensureVisible();
    window.addEventListener('resize', ensureVisible);

    // has-text class for showing/hiding the clear button
    function updateHasText(){
      wrap.classList.toggle('has-text', inp.value.trim().length > 0);
    }
    inp.addEventListener('input', updateHasText);
    updateHasText();

    // When user clears via clear button, also sync sidebar search
    var clearBtn = wrap.querySelector('.outline-icon');
    if(clearBtn){
      var orig = clearBtn.onclick;
      clearBtn.onclick = function(e){
        if(typeof clearSearch === 'function') clearSearch();
        updateHasText();
        var globalSearch = document.getElementById('v83GlobalSearch');
        if(globalSearch) globalSearch.value = '';
      };
    }
  }

  /* ── Mobile nav: active state ── */
  window.setMobileNavActive = function(activeId){
    var navBtns = document.querySelectorAll('.v83-mobile-nav button');
    navBtns.forEach(function(btn){
      btn.classList.toggle('nav-active', btn.id === activeId);
    });
  };

  // Also patch openHome/openDatabase to update active state
  function patchNavHighlights(){
    var baseOpenHome = window.openHome;
    if(typeof baseOpenHome === 'function'){
      window.openHome = function(){
        var r = baseOpenHome.apply(this, arguments);
        setMobileNavActive('mnavHome');
        return r;
      };
    }
    var baseOpenDb = window.openDatabase;
    if(typeof baseOpenDb === 'function'){
      window.openDatabase = function(){
        var r = baseOpenDb.apply(this, arguments);
        setMobileNavActive('mnavDb');
        return r;
      };
    }
  }

  /* ── Detail pane: richer empty state ── */
  function patchEmptyState(){
    var pane = document.getElementById('detailContent');
    if(!pane) return;
    var observer = new MutationObserver(function(){
      var empty = pane.querySelector('.v83-empty');
      if(empty && !empty.dataset.upgraded){
        empty.dataset.upgraded = '1';
        if(!empty.querySelector('.v83-empty-hint')){
          var hint = document.createElement('p');
          hint.className = 'v83-empty-hint';
          hint.style.cssText = 'margin:0;font-size:.88rem;opacity:.75;position:relative;z-index:1';
          hint.textContent = 'انقر على أي مجموعة من القائمة لعرض آياتها ومقارنتها هنا';
          var icon = document.createElement('div');
          icon.style.cssText = 'font-size:2.2rem;position:relative;z-index:1';
          icon.textContent = '📖';
          empty.innerHTML = '';
          empty.appendChild(icon);
          empty.appendChild(hint);
        }
      }
    });
    observer.observe(pane, { childList: true, subtree: true });
  }

  /* ── Init ── */
  function onReady(){
    patchSearchBar();
    patchNavHighlights();
    patchEmptyState();
    // Set initial mobile nav active state
    try{
      var last = localStorage.getItem('mutashabihat_v78_last_view') || 'home';
      if(last === 'home') setMobileNavActive('mnavHome');
      else if(last === 'personal' || last === 'auto') setMobileNavActive('mnavDb');
    }catch(e){}
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    setTimeout(onReady, 0);
  }

})();
