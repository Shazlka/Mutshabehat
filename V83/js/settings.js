/* =========================================================
 V84 PATCH — Fix Automated Surah Loader DB name
 IMPORTANT: Append this block at the VERY END of your existing V82 app.js.
 Do not replace the full app.js with this patch only.
 ========================================================= */
const RELEASE_V84_AUTO_LOADER_FIX = `Release Note — V84 Auto Loader Name Fix

Fixed:
- The app uses activeDb value "auto" for the Automated database.
- The Surah lazy loader now checks the actual database name used by your app: "auto".
- Surah filter buttons load chunks by Surah number using automated-surahs/surah-###.js.
- Automated Home count is read from automated-manifest.js.
- Automated page shows an instruction message until a Surah is selected.

Required files on GitHub:
- index.html must load automated-manifest.js before app.js.
- automated-surahs folder must be uploaded with all surah-001.js to surah-114.js.
`;

/* =========================================================
 V80 — Delete unwanted groups from Automated Database
 ========================================================= */
const RELEASE_V80 = `Release Note — V80 Automated Database Delete

Implemented:
- Added ability to delete unwanted groups from the Automated database.
- Delete button appears for Automated groups only when Edit Mode is enabled.
- Deletion is saved to the local Automated database cache, so removed groups stay hidden after refresh.
- Added confirmation message before deleting any Automated group.
- Added toast/status feedback after deletion.
- Added optional delete action inside the mobile group detail window.
- Export data.js can still export the cleaned Automated database as automated-data.js.

Important:
- Reset Cache / تحديث البيانات reloads Automated data from automated-data.js and will restore deleted automated groups unless you export and replace automated-data.js with the cleaned file.

Preserved:
- All V79 GitHub sync status features.
- All V78/V71 restored UI, Quran search, font preview, HD export, copy, compare, and database separation features.`;

function updateFontPreview(){let f=normalizeFontPreset(document.getElementById('setFont')?.value||getSettings().font),box=document.getElementById('fontPreviewBox'),hint=document.getElementById('fontPreviewHint');if(box)box.setAttribute('data-font-preset',f);if(hint)hint.textContent=f==='mushaf-qpc-v2'?'معاينة Mushaf QPC V2. إذا لم يظهر الاختلاف، ضع qpc-v2.woff2 أو qpc-v2.ttf داخل مجلد fonts.':'معاينة الخط العادي المستخدم للبحث والتعديل والمقارنة.'}

function normalizeFontPreset(v){v=safeText(v||'normal-quran');if(v==='classic-quran'||v==='modern-reader'||v==='mobile-clear')return 'normal-quran';if(v!=='normal-quran'&&v!=='mushaf-qpc-v2')return 'normal-quran';return v}

const RELEASE=`V78 — Clean V71 + Restored Features

Implemented:
- Added Normal Quran font mode for search, edit, and comparison screens.
- Added Mushaf QPC V2 display/review mode for beautiful reading in group cards.
- Search result textareas, edit part textareas, edit live preview, and comparison view stay on Normal Quran font for readability and accurate editing.
- Group display/review can use Mushaf QPC V2 via Settings > Font.
- Added CSS font-face references ready for local /fonts files: QPC V2, KFGQPCNastaleeq-Regular, surah-name-v4.
- Updated settings font dropdown with the two clear modes.
- Fixed modification modal header color and X close button to follow the current app theme.

Preserved:
- Personal/Automated database separation.
- Smart Quran search in add/edit windows.
- Inline Surah filter and display mode dropdown.
- Added Surah dropdown and dependent Ayah dropdown in the modification window.
- Added live font preview in Settings before saving.
- Clarified that empty fonts folder is optional; place qpc-v2.woff2 or qpc-v2.ttf only if you have the real file.
- Existing Quran reference APIs and data files.`;

function getSettings(){try{return ghNormV79(JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}'))}catch(e){return ghNormV79({})}}

function applySettings(){let s=getSettings();document.body.setAttribute('data-theme',s.theme);document.body.setAttribute('data-font-preset',s.font);let b=document.getElementById('ghBadge');if(b){let st=localStorage.getItem(GH_KEYS_V79.status)||'none';b.textContent=st==='success'?'✅ GitHub synced':st==='failed'?'❌ GitHub failed':st==='syncing'?'🟡 GitHub syncing':st==='no_changes'?'⚠️ No changes':(s.ghOwner&&s.ghRepo?'☁ GitHub ready':'☁ GitHub: not set')}}

const RELEASE_V79=`Release Note — V79 GitHub Auto Sync Status Improvements\n\nImplemented:\n- Added clear GitHub Sync Status section.\n- Shows syncing/success/failure/no-changes states.\n- Shows last sync time, synced path, commit short SHA, Open Commit, Copy Error, and Verify on GitHub.\n- Preserves Owner Shazlka, Repo Mutashabihat, Branch main, Path V71/personal-data.js.\n- Uses GitHub Contents API: GET SHA, compare content, UTF-8 Base64 encode, PUT with message/content/sha/branch.\n- Success appears only after GitHub returns commit information.\n- No commit is created when local and GitHub content are identical.\n- Auto Sync runs after personal database changes saved through saveDb().\n\nPreserved: all V78/V71 features and current UI theme/layout.`;

(function initV80Badge(){
  window.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{
    let st=document.getElementById('storageBadge');
    if(st) st.textContent='✓ V80 جاهز';
  },500));
})();

const RELEASE_V85_SORT_FILTERS=`Release Note — V85 Independent Sorting and Filters

Implemented:
- Moved sorting dropdown outside the collapsible Surah filter menu.
- Sorting dropdown is now aligned in the same filter bar line with filter controls.
- Desktop/tablet layout is horizontal; mobile layout is compact and full-width.
- Added independent sorting state for Personal and Automated databases.
- Personal sorting is saved in localStorage key: personalSortMethod.
- Automated sorting is saved in localStorage key: automatedSortMethod.
- Added independent filter state for Personal and Automated databases.
- Personal filters are saved in localStorage key: personalFilters.
- Automated filters are saved in localStorage key: automatedFilters.
- Filters are restored when reopening each database and are not reset unless the user presses clear/reset.

Preserved:
- Adding personal groups.
- Saving personal database and GitHub auto sync flow.
- Copying groups from Automated DB to Personal DB.
- Export data.js.
- Arabic RTL layout, current theme, responsive design, and existing database format.
- Automated Surah lazy loader and all restored V70–V84 features.`;

function openReleaseNotes(){modal('releaseModal','Release Notes — V85',`<div class="release-content">${escapeHtml(RELEASE_V85_SORT_FILTERS)}</div>`,`<button onclick="navigator.clipboard?.writeText(RELEASE_V85_SORT_FILTERS)">نسخ</button><button onclick="closeModal('releaseModal')">إغلاق</button>`)}

/* =========================================================
   V87 — Settings behavior + Mobile icon-only buttons (Personal) + Hide legend colors
   Implemented:
   - Saving settings does NOT close Settings modal.
   - Shows toast confirmation while keeping Settings open.
   - GitHub token field stays available and can be revealed/hidden.
   - Mobile (<=850px) Personal toolbar uses icon-only buttons (CSS via body.db-personal).
   ========================================================= */

function toggleGhTokenVisibility(){
  let inp=document.getElementById('ghToken');
  if(!inp) return;
  inp.type = (inp.type === 'password') ? 'text' : 'password';
  try{ inp.focus(); }catch(e){}
}

function __setDbBodyClassV87(){
  try{
    document.body.classList.toggle('db-personal', activeDb === 'personal');
    document.body.classList.toggle('db-auto', activeDb === 'auto' || activeDb === 'automated');
    document.body.classList.toggle('db-workspace', activeDb === 'personal' || activeDb === 'auto' || activeDb === 'automated');
  }catch(e){}
}

// V83 Settings Dashboard — two-column compact layout.
function openAppSettings(){
  let s=getSettings();
  modal('settingsModal',
    `إعدادات التطبيق<span class="sett-head-sub">تخصيص التطبيق والمزامنة</span>`,
    `<div class="sett-shell"><div class="sett-cols">

<div class="sett-col">

<div class="sett-card">
<div class="sett-card-title"><span id="githubSyncDot" class="github-sync-dot gray"></span>GitHub Auto Sync ☁<span id="sett-gh-state-chip" class="sett-gh-state-chip none">—</span></div>
<div class="sett-gh-chips" id="sett-gh-chips"></div>
<div id="githubLiveStatus" class="sett-gh-live"></div>
<div class="sett-gh-meta" id="sett-gh-meta"></div>
<div id="sett-gh-error"></div>
<div class="sett-card-actions">
<button onclick="testGitHubConnectionV79()">Test Connection</button><button onclick="syncToGitHub('manual')">Sync Now</button><button onclick="ghVerifyV79()">Verify on GitHub</button>
</div>
<label class="github-autosync-toggle sett-gh-autosync"><input type="checkbox" id="ghAutoSyncCheck" ${s.ghAutoSync?'checked':''}/> تفعيل المزامنة التلقائية</label>
</div>

<div class="sett-card">
<div class="sett-card-title">🔗 GitHub Repository Settings</div>
<label class="field">Token
<div class="token-row">
<input id="ghToken" type="password" value="${escapeHtml(s.ghToken||'')}" autocomplete="off" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"/>
<button type="button" class="token-toggle-btn" onclick="toggleGhTokenVisibility()" aria-label="إظهار/إخفاء التوكن" title="إظهار/إخفاء">👁</button>
</div>
</label>
<div class="sett-repo-grid sett-repo-grid-sep">
<label class="field">Owner<input id="ghOwner" value="${escapeHtml(s.ghOwner||'')}" placeholder="Shazlka"/></label>
<label class="field">Repo<input id="ghRepo" value="${escapeHtml(s.ghRepo||'')}" placeholder="Mutashabihat"/></label>
<label class="field">Branch<input id="ghBranch" value="${escapeHtml(s.ghBranch||'')}" placeholder="main"/></label>
<label class="field">Path<input id="ghPath" value="${escapeHtml(s.ghPath||'')}" placeholder="V71/personal-data.js"/></label>
</div>
<small class="github-sync-note">المسار الحالي للمزامنة: <code>V71/personal-data.js</code> — لا يتم إظهار النجاح إلا بعد رجوع GitHub بمعلومات Commit.</small>
</div>

<div class="sett-card">
<div class="sett-card-title">✏️ وضع التعديل</div>
<label class="sett-toggle-label"><input type="checkbox" id="editModeCheck" ${editMode?'checked':''}/><span>تفعيل وضع التعديل — يتيح حذف وتعديل المجموعات</span></label>
</div>

</div>

<div class="sett-col">

<div class="sett-card">
<div class="sett-card-title">🎨 المظهر</div>
<label class="field">Theme
<select id="setTheme">
<option value="quran-classic">Quran Classic</option>
<option value="apple-health">Apple Health</option>
<option value="bevel-night">Bevel Night</option>
<option value="quran-night">🌙 Quran Night</option>
</select>
</label>
</div>

<div class="sett-card">
<div class="sett-card-title">خط القرآن</div>
<label class="field">Font
<select id="setFont" onchange="updateFontPreview()">
<option value="normal-quran">Normal Quran</option>
<option value="mushaf-qpc-v2">Mushaf QPC V2</option>
</select>
</label>
<div id="fontPreviewBox" class="font-preview-box" data-font-preset="normal-quran">
<b>معاينة الخط قبل الحفظ</b>
<div class="font-preview-ayah">وَزَيَّنَ لَهُمُ الشَّيْطَانُ أَعْمَالَهُمْ فَصَدَّهُمْ عَنِ السَّبِيلِ فَهُمْ لَا يَهْتَدُونَ</div>
<small id="fontPreviewHint">إذا كان مجلد fonts فارغاً سيظهر الخط الاحتياطي تلقائياً.</small>
</div>
</div>

<div class="sett-card">
<div class="sett-card-title">🔧 أدوات البيانات</div>
<div class="sett-data-tools">
<div class="sett-data-tool">
<div class="sett-data-tool-info"><b>إعادة تحميل البيانات</b><small>مسح الكاش المحلي وإعادة التهيئة</small></div>
<button onclick="resetDualDbCacheV68()">Reset Cache</button>
</div>
<div class="sett-data-tool">
<div class="sett-data-tool-info"><b>تصدير قاعدة البيانات</b><small>تنزيل personal-data.js محلياً</small></div>
<button onclick="exportActiveDatabase()">Export data.js</button>
</div>
<div class="sett-data-tool">
<div class="sett-data-tool-info"><b>ملاحظات الإصدار</b><small>عرض آخر التغييرات والتحسينات</small></div>
<button onclick="openReleaseNotes()">Release Notes</button>
</div>
</div>
</div>

</div>

</div></div>`,
    `<button onclick="resetDualDbCacheV68()">🔄 Reset Cache</button><button onclick="exportActiveDatabase()">📤 Export data.js</button><button onclick="openReleaseNotes()">📋 Release Notes</button><button class="primary" onclick="saveSettings(false)">✓ حفظ</button>`
  );
  try{
    document.getElementById('setTheme').value=s.theme||'quran-classic';
    document.getElementById('setFont').value=s.font||'normal-quran';
    updateFontPreview();
  }catch(e){}
  try{if(typeof ghRenderV79==='function')ghRenderV79();}catch(e){}
}

// Override saveSettings: do NOT close settings modal.
function saveSettings(closeAfter=false){
  // Keep modal open always; closeAfter parameter is ignored unless explicitly true.
  try{
    let s = (typeof ghCollectV79==='function') ? ghCollectV79() : {
      theme: document.getElementById('setTheme')?.value || getSettings().theme,
      font: document.getElementById('setFont')?.value || getSettings().font,
      ghToken: document.getElementById('ghToken')?.value || '',
      ghOwner: document.getElementById('ghOwner')?.value || '',
      ghRepo: document.getElementById('ghRepo')?.value || '',
      ghBranch: document.getElementById('ghBranch')?.value || 'main',
      ghPath: document.getElementById('ghPath')?.value || 'V71/personal-data.js',
      ghAutoSync: !!document.getElementById('ghAutoSyncCheck')?.checked
    };

    // edit mode
    let e=document.getElementById('editModeCheck');
    if(e){
      editMode=!!e.checked;
      localStorage.setItem('mutashabihat_v69_edit_mode', editMode);
    }

    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    applySettings();
    if(activeDb) renderActiveGroups();
    try{ if(typeof ghRenderV79==='function') ghRenderV79(); }catch(err){}

    // toast confirmation
    if(typeof toast==='function') toast('✓ تم حفظ الإعدادات', 'ok');
    else alert('✓ تم حفظ الإعدادات');

    // Never close on save
    if(closeAfter===true){
      // only if some future code explicitly requests close
      closeModal('settingsModal');
    }
  }catch(ex){
    console.error(ex);
    try{ if(typeof toast==='function') toast('فشل حفظ الإعدادات', 'err'); else alert('فشل حفظ الإعدادات'); }catch(e){}
  }
}

// Ensure body class is correct when opening database/home.
(function patchDbBodyClassV87(){
  try{
    const baseOpenDb = window.openDatabase;
    if(typeof baseOpenDb==='function'){
      window.openDatabase = async function(){
        let r = await baseOpenDb.apply(this, arguments);
        __setDbBodyClassV87();
        return r;
      };
    }
  }catch(e){}
  try{
    const baseOpenHome = window.openHome;
    if(typeof baseOpenHome==='function'){
      window.openHome = function(){
        let r = baseOpenHome.apply(this, arguments);
        __setDbBodyClassV87();
        return r;
      };
    }
  }catch(e){}
  // Also update once on load
  try{ window.addEventListener('DOMContentLoaded', ()=>setTimeout(__setDbBodyClassV87, 50)); }catch(e){}
})();

/* =========================================================
   V83 — Compact GitHub status renderer
   Patches ghRenderV79 to update individual chip/meta elements
   inside the compact card instead of replacing a full status card.
   All existing element IDs (#githubSyncDot, #githubLiveStatus) kept.
   ========================================================= */
(function patchGhRenderCompactV83(){
  const _orig=window.ghRenderV79;
  window.ghRenderV79=function(){
    // 1. Sync dot (also updated when settings is closed)
    try{
      let d=document.getElementById('githubSyncDot');
      let m=typeof ghMetaV79==='function'?ghMetaV79():null;
      if(d&&m){d.className='github-sync-dot '+m[1];d.title=m[2]}
    }catch(e){}

    // 2. State chip in card title
    try{
      let chip=document.getElementById('sett-gh-state-chip');
      let m=typeof ghMetaV79==='function'?ghMetaV79():null;
      if(chip&&m){
        let labels={'syncing':'🟡 جاري...','success':'✅ متزامن','failed':'❌ فشل','no-changes':'✓ محدث','none':'—'};
        chip.textContent=labels[m[0]]||'—';
        chip.className='sett-gh-state-chip sett-gh-chip-'+m[0];
      }
    }catch(e){}

    // 3. Four status chips (computed from live settings + protocol)
    try{
      let chips=document.getElementById('sett-gh-chips');
      if(chips){
        let s=typeof getSettings==='function'?getSettings():{};
        let sec=location.protocol==='https:'||location.hostname==='localhost';
        let tok=!!(typeof safeText==='function'?safeText(s.ghToken||'').trim():s.ghToken);
        let repo=!!(s.ghOwner&&s.ghRepo);
        chips.innerHTML=
          '<span class="sett-gh-chip '+(sec?'ok':'warn')+'">'+(sec?'🔒 HTTPS آمن':'⚠ HTTP')+'</span>'+
          '<span class="sett-gh-chip '+(repo?'ok':'warn')+'">'+(repo?'✓ المستودع مضبوط':'⚠ المستودع غير مضبوط')+'</span>'+
          '<span class="sett-gh-chip '+(tok?'ok':'warn')+'">'+(tok?'✓ Token موجود':'⚠ Token غير موجود')+'</span>'+
          '<span class="sett-gh-chip info">قاعدة البيانات جاهزة</span>';
      }
    }catch(e){}

    // 4. Sync meta: last time, path, commit SHA
    try{
      let meta=document.getElementById('sett-gh-meta');
      if(meta){
        let t=localStorage.getItem('github_last_sync_time')||'';
        let s=typeof getSettings==='function'?getSettings():{};
        let p=localStorage.getItem('github_last_sync_path')||s.ghPath||'';
        let sha=localStorage.getItem('github_last_commit_sha')||'';
        let h='<span class="sett-gh-meta-item">'+(t?'🕐 '+(typeof escapeHtml==='function'?escapeHtml(t):t):'لم تتم أي مزامنة بعد')+'</span>';
        if(p) h+='<span class="sett-gh-meta-item"><code>'+(typeof escapeHtml==='function'?escapeHtml(p):p)+'</code></span>';
        if(sha) h+='<span class="sett-gh-meta-item">SHA: <code>'+(typeof escapeHtml==='function'?escapeHtml(sha.slice(0,7)):sha.slice(0,7))+'</code></span>';
        meta.innerHTML=h;
      }
    }catch(e){}

    // 5. Error box
    try{
      let errBox=document.getElementById('sett-gh-error');
      if(errBox){
        let er=localStorage.getItem('github_last_sync_error')||'';
        let st=localStorage.getItem('github_last_sync_status')||'none';
        errBox.innerHTML=(er&&st==='failed')?'<div class="github-error-box" style="margin-top:8px"><strong>Error:</strong><pre>'+(typeof escapeHtml==='function'?escapeHtml(er):er)+'</pre></div>':'';
      }
    }catch(e){}

    // Always call applySettings (original side-effect)
    try{if(typeof applySettings==='function')applySettings();}catch(e){}
  };
})();
