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

function openAppSettings(){let s=getSettings();modal('settingsModal','إعدادات التطبيق',`<div class="settings-section"><h2>GitHub Auto Sync ☁</h2><label class="field">Token<input id="ghToken" type="password" value="${escapeHtml(s.ghToken||'')}"></label><div class="form-grid"><label class="field">Repo<input id="ghRepo" value="${escapeHtml(s.ghRepo||'')}"></label><label class="field">Owner<input id="ghOwner" value="${escapeHtml(s.ghOwner||'')}"></label><label class="field">Path<input id="ghPath" value="${escapeHtml(s.ghPath||'data.js')}"></label><label class="field">Branch<input id="ghBranch" value="${escapeHtml(s.ghBranch||'main')}"></label></div><div class="inline-actions"><button class="primary" onclick="saveSettings()">حفظ</button><button onclick="syncToGitHub()">مزامنة الآن</button></div></div><div class="settings-section"><h2>✏️ Edit Mode / وضع التعديل</h2><p>عند تفعيل وضع التعديل تظهر أيقونات التعديل والمقارنة والنقل والدمج وكشف التكرار.</p><label><input type="checkbox" id="editModeCheck" ${editMode?'checked':''}> تفعيل وضع التعديل</label></div><div class="settings-section"><h2>🎨 Theme / Font</h2><div class="form-grid"><label class="field">Theme<select id="setTheme"><option value="quran-classic">Quran Classic</option><option value="apple-health">Apple Health</option><option value="bevel-night">Bevel Night</option></select></label><label class="field">Font<select id="setFont" onchange="updateFontPreview()"><option value="normal-quran">Normal Quran — للبحث والتعديل والمقارنة</option><option value="mushaf-qpc-v2">Mushaf QPC V2 — للعرض والمراجعة</option><option value="classic-quran">Classic Quran (Legacy)</option><option value="modern-reader">Modern Reader (Legacy)</option><option value="mobile-clear">Mobile Clear (Legacy)</option></select></label></div><div id="fontPreviewBox" class="font-preview-box" data-font-preset="normal-quran"><b>معاينة الخط قبل الحفظ</b><div class="font-preview-ayah">وَزَيَّنَ لَهُمُ الشَّيْطَانُ أَعْمَالَهُمْ فَصَدَّهُمْ عَنِ السَّبِيلِ فَهُمْ لَا يَهْتَدُونَ</div><small id="fontPreviewHint">إذا كان مجلد fonts فارغاً سيظهر الخط الاحتياطي تلقائياً.</small></div></div><div class="inline-actions"><button onclick="openReleaseNotes()">Release Notes</button><button onclick="exportActiveDatabase()">Export data.js</button><button onclick="resetDualDbCacheV68()">Reset Cache</button></div>`,`<button class="primary" onclick="saveSettings()">حفظ</button><button onclick="closeModal('settingsModal')">إغلاق</button>`);document.getElementById('setTheme').value=s.theme;document.getElementById('setFont').value=s.font;updateFontPreview()}

function updateFontPreview(){let f=normalizeFontPreset(document.getElementById('setFont')?.value||getSettings().font),box=document.getElementById('fontPreviewBox'),hint=document.getElementById('fontPreviewHint');if(box)box.setAttribute('data-font-preset',f);if(hint)hint.textContent=f==='mushaf-qpc-v2'?'معاينة Mushaf QPC V2. إذا لم يظهر الاختلاف، ضع qpc-v2.woff2 أو qpc-v2.ttf داخل مجلد fonts.':'معاينة الخط العادي المستخدم للبحث والتعديل والمقارنة.'}

function normalizeFontPreset(v){v=safeText(v||'normal-quran');if(v==='classic-quran'||v==='modern-reader'||v==='mobile-clear')return 'normal-quran';if(v!=='normal-quran'&&v!=='mushaf-qpc-v2')return 'normal-quran';return v}

function getSettings(){try{let s={...{theme:'quran-classic',font:'normal-quran',ghPath:'data.js',ghBranch:'main'},...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')};s.font=normalizeFontPreset(s.font);return s}catch(e){return {theme:'quran-classic',font:'normal-quran',ghPath:'data.js',ghBranch:'main'}}}

function applySettings(){let s=getSettings();s.font=normalizeFontPreset(s.font);document.body.setAttribute('data-theme',s.theme);document.body.setAttribute('data-font-preset',s.font);let gh=document.getElementById('ghBadge');if(gh)gh.textContent=s.ghOwner&&s.ghRepo?'☁ GitHub ready':'☁ GitHub: not set'}

function saveSettings(){let s={theme:document.getElementById('setTheme')?.value||getSettings().theme,font:normalizeFontPreset(document.getElementById('setFont')?.value||getSettings().font),ghToken:document.getElementById('ghToken')?.value||'',ghRepo:document.getElementById('ghRepo')?.value||'',ghOwner:document.getElementById('ghOwner')?.value||'',ghPath:document.getElementById('ghPath')?.value||'data.js',ghBranch:document.getElementById('ghBranch')?.value||'main'};editMode=!!document.getElementById('editModeCheck')?.checked;localStorage.setItem('mutashabihat_v69_edit_mode',editMode);localStorage.setItem(SETTINGS_KEY,JSON.stringify(s));applySettings();closeModal('settingsModal');if(activeDb)renderActiveGroups()}

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

function openReleaseNotes(){modal('releaseModal','Release Notes — V70',`<div class="release-content">${escapeHtml(RELEASE)}</div>`,`<button onclick="navigator.clipboard?.writeText(RELEASE)">نسخ</button><button onclick="closeModal('releaseModal')">إغلاق</button>`)}

function openAppSettings(){let s=getSettings();modal('settingsModal','إعدادات التطبيق',`<div class="settings-section"><h2>GitHub Auto Sync ☁</h2>${githubStatusHtmlV78(s)}<label class="field">Token<input id="ghToken" type="password" value="${escapeHtml(s.ghToken||'')}"></label><div class="form-grid"><label class="field">Repo<input id="ghRepo" value="${escapeHtml(s.ghRepo||'')}"></label><label class="field">Owner<input id="ghOwner" value="${escapeHtml(s.ghOwner||'')}"></label><label class="field">Path<input id="ghPath" value="${escapeHtml(s.ghPath||'data.js')}"></label><label class="field">Branch<input id="ghBranch" value="${escapeHtml(s.ghBranch||'main')}"></label></div><div class="inline-actions"><button class="primary" onclick="saveSettings()">حفظ</button><button onclick="syncToGitHub()">مزامنة الآن</button></div></div><div class="settings-section"><h2>✏️ وضع التعديل / Edit Mode</h2><label><input type="checkbox" id="editModeCheck" ${editMode?'checked':''}> تفعيل وضع التعديل</label></div><div class="settings-section"><h2>🎨 المظهر / الخط</h2><div class="form-grid"><label class="field">Theme<select id="setTheme"><option value="quran-classic">Quran Classic</option><option value="apple-health">Apple Health</option><option value="bevel-night">Bevel Night</option></select></label><label class="field">Font<select id="setFont" onchange="updateFontPreview()"><option value="normal-quran">Normal Quran</option><option value="mushaf-qpc-v2">Mushaf QPC V2</option></select></label></div><div id="fontPreviewBox" class="font-preview-box" data-font-preset="normal-quran"><b>معاينة الخط قبل الحفظ</b><div class="font-preview-ayah">وَزَيَّنَ لَهُمُ الشَّيْطَانُ أَعْمَالَهُمْ فَصَدَّهُمْ عَنِ السَّبِيلِ فَهُمْ لَا يَهْتَدُونَ</div><small id="fontPreviewHint">إذا كان مجلد fonts فارغاً سيظهر الخط الاحتياطي تلقائياً.</small></div></div><div class="inline-actions"><button onclick="openReleaseNotes()">Release Notes</button><button onclick="exportActiveDatabase()">Export data.js</button><button onclick="resetDualDbCacheV68()">Reset Cache</button></div>`,`<button class="primary" onclick="saveSettings()">حفظ</button><button onclick="closeModal('settingsModal')">إغلاق</button>`);document.getElementById('setTheme').value=s.theme;document.getElementById('setFont').value=s.font;updateFontPreview()}

function getSettings(){try{return ghNormV79(JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}'))}catch(e){return ghNormV79({})}}

function saveSettings(closeAfter=true){let s=ghCollectV79(),e=document.getElementById('editModeCheck');if(e){editMode=!!e.checked;localStorage.setItem('mutashabihat_v69_edit_mode',editMode)}localStorage.setItem(SETTINGS_KEY,JSON.stringify(s));applySettings();if(closeAfter!==false)closeModal('settingsModal');if(activeDb)renderActiveGroups();ghRenderV79()}

function applySettings(){let s=getSettings();document.body.setAttribute('data-theme',s.theme);document.body.setAttribute('data-font-preset',s.font);let b=document.getElementById('ghBadge');if(b){let st=localStorage.getItem(GH_KEYS_V79.status)||'none';b.textContent=st==='success'?'✅ GitHub synced':st==='failed'?'❌ GitHub failed':st==='syncing'?'🟡 GitHub syncing':st==='no_changes'?'⚠️ No changes':(s.ghOwner&&s.ghRepo?'☁ GitHub ready':'☁ GitHub: not set')}}

function openAppSettings(){let s=getSettings();modal('settingsModal','إعدادات التطبيق',`<div class="settings-section github-settings-section"><h2 class="github-sync-heading"><span id="githubSyncDot" class="github-sync-dot gray"></span>GitHub Auto Sync ☁</h2>${githubStatusHtmlV78(s)}<div id="githubSyncStatusMount">${ghStatusHtmlV79()}</div><label class="field">Token<input id="ghToken" type="password" value="${escapeHtml(s.ghToken||'')}"></label><div class="form-grid"><label class="field">Owner<input id="ghOwner" value="${escapeHtml(s.ghOwner)}"></label><label class="field">Repo<input id="ghRepo" value="${escapeHtml(s.ghRepo)}"></label><label class="field">Branch<input id="ghBranch" value="${escapeHtml(s.ghBranch)}"></label><label class="field">Path<input id="ghPath" value="${escapeHtml(s.ghPath)}"></label></div><label class="github-autosync-toggle"><input type="checkbox" id="ghAutoSyncCheck" ${s.ghAutoSync?'checked':''}> تفعيل المزامنة التلقائية بعد تعديل قاعدة البيانات الشخصية</label><div class="inline-actions"><button class="primary" onclick="saveSettings()">Save / حفظ</button><button onclick="testGitHubConnectionV79()">Test Connection</button><button onclick="syncToGitHub('manual')">Sync Now / مزامنة الآن</button></div><small class="github-sync-note">المسار الحالي للمزامنة: <code>V71/personal-data.js</code> — لا يتم إظهار النجاح إلا بعد رجوع GitHub بمعلومات Commit.</small></div><div class="settings-section"><h2>✏️ وضع التعديل / Edit Mode</h2><label><input type="checkbox" id="editModeCheck" ${editMode?'checked':''}> تفعيل وضع التعديل</label></div><div class="settings-section"><h2>🎨 المظهر / الخط</h2><div class="form-grid"><label class="field">Theme<select id="setTheme"><option value="quran-classic">Quran Classic</option><option value="apple-health">Apple Health</option><option value="bevel-night">Bevel Night</option></select></label><label class="field">Font<select id="setFont" onchange="updateFontPreview()"><option value="normal-quran">Normal Quran</option><option value="mushaf-qpc-v2">Mushaf QPC V2</option></select></label></div><div id="fontPreviewBox" class="font-preview-box" data-font-preset="normal-quran"><b>معاينة الخط قبل الحفظ</b><div class="font-preview-ayah">وَزَيَّنَ لَهُمُ الشَّيْطَانُ أَعْمَالَهُمْ فَصَدَّهُمْ عَنِ السَّبِيلِ فَهُمْ لَا يَهْتَدُونَ</div><small id="fontPreviewHint">إذا كان مجلد fonts فارغاً سيظهر الخط الاحتياطي تلقائياً.</small></div></div><div class="inline-actions"><button onclick="openReleaseNotes()">Release Notes</button><button onclick="exportActiveDatabase()">Export data.js</button><button onclick="resetDualDbCacheV68()">Reset Cache</button></div>`,`<button class="primary" onclick="saveSettings()">حفظ</button><button onclick="closeModal('settingsModal')">إغلاق</button>`);document.getElementById('setTheme').value=s.theme;document.getElementById('setFont').value=s.font;updateFontPreview();ghRenderV79()}

const RELEASE_V79=`Release Note — V79 GitHub Auto Sync Status Improvements\n\nImplemented:\n- Added clear GitHub Sync Status section.\n- Shows syncing/success/failure/no-changes states.\n- Shows last sync time, synced path, commit short SHA, Open Commit, Copy Error, and Verify on GitHub.\n- Preserves Owner Shazlka, Repo Mutashabihat, Branch main, Path V71/personal-data.js.\n- Uses GitHub Contents API: GET SHA, compare content, UTF-8 Base64 encode, PUT with message/content/sha/branch.\n- Success appears only after GitHub returns commit information.\n- No commit is created when local and GitHub content are identical.\n- Auto Sync runs after personal database changes saved through saveDb().\n\nPreserved: all V78/V71 features and current UI theme/layout.`;

function openReleaseNotes(){modal('releaseModal','Release Notes — V79',`<div class="release-content">${escapeHtml(RELEASE_V79)}</div>`,`<button onclick="navigator.clipboard?.writeText(RELEASE_V79)">نسخ</button><button onclick="closeModal('releaseModal')">إغلاق</button>`)}

function openReleaseNotes(){
  modal('releaseModal','Release Notes — V80',`<div class="release-content">${escapeHtml(RELEASE_V80)}</div>`,`<button onclick="navigator.clipboard?.writeText(RELEASE_V80)">نسخ</button><button onclick="closeModal('releaseModal')">إغلاق</button>`)
}

(function initV80Badge(){
  window.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{
    let st=document.getElementById('storageBadge');
    if(st) st.textContent='✓ V80 جاهز';
  },500));
})();

function openReleaseNotes(){
  modal('releaseModal','Release Notes — V84',`<div class="release-content">${escapeHtml(RELEASE_V84_AUTO_LOADER_FIX)}</div>`,`<button onclick="navigator.clipboard?.writeText(RELEASE_V84_AUTO_LOADER_FIX)">نسخ</button><button onclick="closeModal('releaseModal')">إغلاق</button>`)
}

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
  }catch(e){}
}

// Override openAppSettings to include token reveal button.
function openAppSettings(){
  let s=getSettings();
  // Build the same settings modal structure used by V79, with token row + reveal.
  modal('settingsModal','إعدادات التطبيق',
    `<div class="settings-section github-settings-section">
      <h2 class="github-sync-heading"><span id="githubSyncDot" class="github-sync-dot gray"></span>GitHub Auto Sync ☁</h2>
      ${typeof githubStatusHtmlV78==='function' ? githubStatusHtmlV78(s) : ''}
      <div id="githubSyncStatusMount">${typeof ghStatusHtmlV79==='function' ? ghStatusHtmlV79() : ''}</div>

      <label class="field">Token
        <div class="token-row">
          <input id="ghToken" type="password" value="${escapeHtml(s.ghToken||'')}" autocomplete="off" />
          <button type="button" class="token-toggle-btn" onclick="toggleGhTokenVisibility()" aria-label="إظهار/إخفاء التوكن" title="إظهار/إخفاء">👁</button>
        </div>
      </label>

      <div class="form-grid">
        <label class="field">Owner<input id="ghOwner" value="${escapeHtml(s.ghOwner||'')}" /></label>
        <label class="field">Repo<input id="ghRepo" value="${escapeHtml(s.ghRepo||'')}" /></label>
        <label class="field">Branch<input id="ghBranch" value="${escapeHtml(s.ghBranch||'')}" /></label>
        <label class="field">Path<input id="ghPath" value="${escapeHtml(s.ghPath||'')}" /></label>
      </div>

      <label class="github-autosync-toggle"><input type="checkbox" id="ghAutoSyncCheck" ${s.ghAutoSync?'checked':''} /> تفعيل المزامنة التلقائية بعد تعديل قاعدة البيانات الشخصية</label>

      <div class="inline-actions">
        <button class="primary" onclick="saveSettings(false)">Save / حفظ</button>
        <button onclick="testGitHubConnectionV79()">Test Connection</button>
        <button onclick="syncToGitHub('manual')">Sync Now / مزامنة الآن</button>
      </div>

      <small class="github-sync-note">المسار الحالي للمزامنة: <code>V71/personal-data.js</code> — لا يتم إظهار النجاح إلا بعد رجوع GitHub بمعلومات Commit.</small>
    </div>

    <div class="settings-section">
      <h2>✏️ وضع التعديل / Edit Mode</h2>
      <label><input type="checkbox" id="editModeCheck" ${editMode?'checked':''} /> تفعيل وضع التعديل</label>
    </div>

    <div class="settings-section">
      <h2>🎨 المظهر / الخط</h2>
      <div class="form-grid">
        <label class="field">Theme
          <select id="setTheme">
            <option value="quran-classic">Quran Classic</option>
            <option value="apple-health">Apple Health</option>
            <option value="bevel-night">Bevel Night</option>
          </select>
        </label>
        <label class="field">Font
          <select id="setFont" onchange="updateFontPreview()">
            <option value="normal-quran">Normal Quran</option>
            <option value="mushaf-qpc-v2">Mushaf QPC V2</option>
          </select>
        </label>
      </div>
      <div id="fontPreviewBox" class="font-preview-box" data-font-preset="normal-quran">
        <b>معاينة الخط قبل الحفظ</b>
        <div class="font-preview-ayah">وَزَيَّنَ لَهُمُ الشَّيْطَانُ أَعْمَالَهُمْ فَصَدَّهُمْ عَنِ السَّبِيلِ فَهُمْ لَا يَهْتَدُونَ</div>
        <small id="fontPreviewHint">إذا كان مجلد fonts فارغاً سيظهر الخط الاحتياطي تلقائياً.</small>
      </div>
    </div>

    <div class="inline-actions">
      <button onclick="openReleaseNotes()">Release Notes</button>
      <button onclick="exportActiveDatabase()">Export data.js</button>
      <button onclick="resetDualDbCacheV68()">Reset Cache</button>
    </div>`,
    `<button class="primary" onclick="saveSettings(false)">حفظ</button>
     <button onclick="closeModal('settingsModal')">إغلاق</button>`
  );

  // apply dropdown values
  try{
    document.getElementById('setTheme').value=s.theme||'quran-classic';
    document.getElementById('setFont').value=s.font||'normal-quran';
    updateFontPreview();
  }catch(e){}

  // render sync status UI
  try{ if(typeof ghRenderV79==='function') ghRenderV79(); }catch(e){}
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
