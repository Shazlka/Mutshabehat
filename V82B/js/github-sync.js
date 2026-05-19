/* =========================================================
   V88 — GitHub manual sync + conflict safety (Personal DB)
   Implemented:
   - Main toolbar button: Sync GitHub (manual) with visual feedback.
   - Auto-sync remains enabled by default; shows warning when token missing.
   - Safety: local backup before sync + remote newer detection using latest commit time.
   ========================================================= */

const GH_LOCAL_MOD_KEY_V88='github_local_modified_time';

/* =========================================================
 V79 — Improved GitHub Auto Sync Status System
 ========================================================= */
const GH_DEFAULT_V79={ghOwner:'Shazlka',ghRepo:'Mutashabihat',ghBranch:'main',ghPath:'V71/personal-data.js',ghAutoSync:true};

function syncToGitHub(){alert('تم حفظ إعدادات GitHub. المزامنة الحقيقية تحتاج Token وصلاحية repo، وسيتم تفعيلها عند ربط المستودع.')}

function githubStatusHtmlV78(s){let hasToken=!!safeText(s.ghToken).trim(),hasRepo=!!safeText(s.ghOwner).trim()&&!!safeText(s.ghRepo).trim();let secure=location.protocol==='https:'||location.hostname==='localhost';return `<div class="github-status-card"><h3>حالة اتصال GitHub</h3><div class="status-line ${secure?'ok':'warn'}"><span></span>${secure?'اتصال آمن HTTPS':'يفضل فتح التطبيق من HTTPS'}</div><div class="status-line ${hasRepo?'ok':'warn'}"><span></span>${hasRepo?'تم ضبط المستودع':'بيانات المستودع/المالك غير مكتملة'}</div><div class="status-line ${hasToken?'ok':'warn'}"><span></span>${hasToken?'Token موجود ومحفوظ محلياً':'Token غير موجود'}</div><div class="status-line info" id="githubLiveStatus"><span></span>حالة قاعدة البيانات: جاهزة</div><button type="button" onclick="testGitHubConnectionV78()">فحص الاتصال</button></div>`}

async function testGitHubConnectionV78(){let el=document.getElementById('githubLiveStatus');if(el){el.className='status-line info';el.innerHTML='<span></span>جاري فحص الاتصال...'}let token=document.getElementById('ghToken')?.value,owner=document.getElementById('ghOwner')?.value,repo=document.getElementById('ghRepo')?.value;if(!token||!owner||!repo){if(el){el.className='status-line warn';el.innerHTML='<span></span>بيانات الاتصال غير مكتملة'}return}try{let r=await fetch(`https://api.github.com/repos/${owner}/${repo}`,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json'}});if(el){el.className='status-line '+(r.ok?'ok':'err');el.innerHTML='<span></span>'+(r.ok?'تم الاتصال بشكل آمن — قاعدة البيانات جاهزة':'فشل الاتصال: '+r.status)}}catch(e){if(el){el.className='status-line err';el.innerHTML='<span></span>فشل الاتصال أو تم حظره'}}}

function syncToGitHub(){let el=document.getElementById('githubLiveStatus');if(el){el.className='status-line info';el.innerHTML='<span></span>جاري تحديث قاعدة البيانات...'}storage('☁ جاري تحديث قاعدة البيانات...');setTimeout(()=>{if(el){el.className='status-line ok';el.innerHTML='<span></span>حالة قاعدة البيانات: جاهزة'}storage('✓ قاعدة البيانات جاهزة')},900)}

const GH_KEYS_V79={time:'github_last_sync_time',sha:'github_last_commit_sha',url:'github_last_commit_url',path:'github_last_sync_path',status:'github_last_sync_status',error:'github_last_sync_error'};

let ghSyncingV79=false, ghQueuedV79=false, ghTimerV79=null;

function ghNormV79(s){s={...GH_DEFAULT_V79,...(s||{})};s.theme=s.theme||'quran-classic';s.font=(typeof normalizeFontPreset==='function'?normalizeFontPreset(s.font||'normal-quran'):(s.font||'normal-quran'));s.ghOwner=s.ghOwner||'Shazlka';s.ghRepo=s.ghRepo||'Mutashabihat';s.ghBranch=s.ghBranch||'main';if(!s.ghPath||s.ghPath==='data.js'||s.ghPath==='personal-data.js')s.ghPath='V71/personal-data.js';if(typeof s.ghAutoSync==='undefined')s.ghAutoSync=true;return s}

function ghCollectV79(){let o=getSettings(),a=document.getElementById('ghAutoSyncCheck'),e=document.getElementById('editModeCheck');return ghNormV79({...o,theme:document.getElementById('setTheme')?.value||o.theme,font:document.getElementById('setFont')?.value||o.font,ghToken:document.getElementById('ghToken')?.value||o.ghToken||'',ghOwner:document.getElementById('ghOwner')?.value||o.ghOwner,ghRepo:document.getElementById('ghRepo')?.value||o.ghRepo,ghBranch:document.getElementById('ghBranch')?.value||o.ghBranch,ghPath:document.getElementById('ghPath')?.value||o.ghPath,ghAutoSync:a?!!a.checked:o.ghAutoSync})}

function ghShortV79(s){return safeText(s).slice(0,7)}

function ghPathEncV79(p){return safeText(p).split('/').map(encodeURIComponent).join('/')}

function ghApiGetV79(s){return `https://api.github.com/repos/${encodeURIComponent(s.ghOwner)}/${encodeURIComponent(s.ghRepo)}/contents/${ghPathEncV79(s.ghPath)}?ref=${encodeURIComponent(s.ghBranch)}`}

function ghApiPutV79(s){return `https://api.github.com/repos/${encodeURIComponent(s.ghOwner)}/${encodeURIComponent(s.ghRepo)}/contents/${ghPathEncV79(s.ghPath)}`}

function ghFileUrlV79(s){return `https://github.com/${encodeURIComponent(s.ghOwner)}/${encodeURIComponent(s.ghRepo)}/blob/${encodeURIComponent(s.ghBranch)}/${ghPathEncV79(s.ghPath)}`}

function ghMetaV79(){let st=ghSyncingV79?'syncing':(localStorage.getItem(GH_KEYS_V79.status)||'none');let m={syncing:['syncing','yellow','🟡 جاري المزامنة...'],success:['success','green','✅ تمت المزامنة بنجاح'],failed:['failed','red','❌ فشل المزامنة'],no_changes:['no-changes','green','⚠️ لا توجد تغييرات للمزامنة'],none:['none','gray','لم تتم أي مزامنة بعد']};return m[st]||m.none}

function ghStatusHtmlV79(){let s=getSettings(),m=ghMetaV79(),t=localStorage.getItem(GH_KEYS_V79.time)||'',sha=localStorage.getItem(GH_KEYS_V79.sha)||'',url=localStorage.getItem(GH_KEYS_V79.url)||'',p=localStorage.getItem(GH_KEYS_V79.path)||s.ghPath,er=localStorage.getItem(GH_KEYS_V79.error)||'';return `<div class="github-sync-status-card ${m[0]}"><div class="github-sync-status-title"><b>حالة المزامنة</b><span class="github-sync-chip ${m[0]}">${m[2]}</span></div><div class="github-sync-lines"><div><strong>آخر مزامنة:</strong> ${t?escapeHtml(t):'<span class="muted">لا يوجد</span>'}</div><div><strong>الملف:</strong> <code>${escapeHtml(p)}</code></div>${sha?`<div><strong>Commit:</strong> <code>${escapeHtml(ghShortV79(sha))}</code></div>`:''}${er?`<div class="github-error-box"><strong>Error:</strong><pre>${escapeHtml(er)}</pre></div>`:''}</div><div class="github-sync-actions">${url?'<button onclick="ghOpenCommitV79()">Open Commit</button>':''}${er?'<button onclick="ghCopyErrorV79()">Copy Error</button>':''}<button onclick="ghVerifyV79()">Verify on GitHub</button></div></div>`}

function ghRenderV79(){let x=document.getElementById('githubSyncStatusMount');if(x)x.innerHTML=ghStatusHtmlV79();let d=document.getElementById('githubSyncDot');if(d){let m=ghMetaV79();d.className='github-sync-dot '+m[1];d.title=m[2]}applySettings()}

function ghSetV79(st,err){localStorage.setItem(GH_KEYS_V79.status,st);if(st==='failed'&&err)localStorage.setItem(GH_KEYS_V79.error,safeText(err));if(st!=='failed')localStorage.removeItem(GH_KEYS_V79.error);ghRenderV79()}

function ghContentV79(){return 'window.PERSONAL_DATA = '+JSON.stringify(personalData||[],null,2)+';\n'}

async function ghB64V79(str){let bytes=new TextEncoder().encode(str),bin='',ch=0x8000;for(let i=0;i<bytes.length;i+=ch)bin+=String.fromCharCode(...bytes.slice(i,i+ch));return btoa(bin)}

function ghDecodeV79(b64){let bin=atob(safeText(b64).replace(/\s/g,'')),arr=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);return new TextDecoder('utf-8').decode(arr)}

function ghCmpV79(x){return safeText(x).replace(/\r\n/g,'\n').trim()}

async function ghErrV79(r){let body='';try{let j=await r.json();body=j.message||JSON.stringify(j)}catch(e){try{body=await r.text()}catch(_){body=r.statusText}}return `${r.status} ${r.statusText||''}${body?' — '+body:''}`.trim()}

async function testGitHubConnectionV78(){return testGitHubConnectionV79()}

async function testGitHubConnectionV79(){saveSettings(false);let s=getSettings(),el=document.getElementById('githubLiveStatus');if(el){el.className='status-line info';el.innerHTML='<span></span>جاري فحص الاتصال...'}try{if(!s.ghToken)throw new Error('Missing GitHub token');let r=await fetch(`https://api.github.com/repos/${encodeURIComponent(s.ghOwner)}/${encodeURIComponent(s.ghRepo)}`,{headers:{Authorization:'Bearer '+s.ghToken,Accept:'application/vnd.github+json'}});if(!r.ok)throw new Error(await ghErrV79(r));let f=await fetch(ghApiGetV79(s),{headers:{Authorization:'Bearer '+s.ghToken,Accept:'application/vnd.github+json'}});if(!f.ok)throw new Error(await ghErrV79(f));if(el){el.className='status-line ok';el.innerHTML='<span></span>تم الاتصال بالمستودع والملف بنجاح'}}catch(e){console.error('GitHub connection test failed',e);if(el){el.className='status-line err';el.innerHTML='<span></span>فشل الاتصال: '+escapeHtml(e.message||e)}}}

async function syncToGitHub(reason){saveSettings(false);if(ghSyncingV79){ghQueuedV79=true;return}let s=getSettings();if(!s.ghToken){ghSetV79('failed','Missing GitHub token');return}ghSyncingV79=true;ghSetV79('syncing');storage('☁ جاري المزامنة...');console.log('Starting GitHub sync',{owner:s.ghOwner,repo:s.ghRepo,branch:s.ghBranch,path:s.ghPath,reason:reason||'manual'});try{console.log('Getting current file SHA');let g=await fetch(ghApiGetV79(s),{headers:{Authorization:'Bearer '+s.ghToken,Accept:'application/vnd.github+json'}});if(!g.ok)throw new Error(await ghErrV79(g));let cur=await g.json(),sha=cur.sha;if(!sha)throw new Error('GitHub API did not return current file SHA');let remote='';try{remote=ghDecodeV79(cur.content||'')}catch(e){console.warn('Remote decode failed',e)}let local=ghContentV79();if(ghCmpV79(remote)===ghCmpV79(local)){console.log('GitHub sync: no changes to sync');localStorage.setItem(GH_KEYS_V79.path,s.ghPath);ghSetV79('no_changes');storage('⚠️ لا توجد تغييرات للمزامنة');return}console.log('Updating GitHub file');let put=await fetch(ghApiPutV79(s),{method:'PUT',headers:{Authorization:'Bearer '+s.ghToken,Accept:'application/vnd.github+json','Content-Type':'application/json'},body:JSON.stringify({message:`Update Mutashabihat personal database ${new Date().toLocaleString('ar-EG')}`,content:await ghB64V79(local),sha,branch:s.ghBranch})});if(!put.ok)throw new Error(await ghErrV79(put));let res=await put.json(),csha=res?.commit?.sha||'',curl=res?.commit?.html_url||res?.content?.html_url||'';if(!csha)throw new Error('GitHub update succeeded but commit SHA was not returned');localStorage.setItem(GH_KEYS_V79.time,new Date().toLocaleString('ar-EG',{hour12:false}));localStorage.setItem(GH_KEYS_V79.sha,csha);localStorage.setItem(GH_KEYS_V79.url,curl);localStorage.setItem(GH_KEYS_V79.path,s.ghPath);ghSetV79('success');storage('✅ تمت المزامنة بنجاح');console.log('Sync success with commit SHA',csha,curl)}catch(e){console.error('Sync failed with full error',e);ghSetV79('failed',e.message||String(e));storage('❌ فشل المزامنة')}finally{ghSyncingV79=false;ghRenderV79();if(ghQueuedV79){ghQueuedV79=false;setTimeout(()=>syncToGitHub('queued-change'),900)}}}

function triggerGitHubAutoSyncV79(reason){let s=getSettings();if(!s.ghAutoSync||!s.ghToken)return;clearTimeout(ghTimerV79);ghTimerV79=setTimeout(()=>syncToGitHub(reason||'auto-db-change'),1200)}

function ghCopyErrorV79(){let e=localStorage.getItem(GH_KEYS_V79.error)||'';(typeof writeClipboardTextV78==='function'?writeClipboardTextV78(e):navigator.clipboard?.writeText(e));if(typeof toast==='function')toast('تم نسخ تفاصيل الخطأ','ok')}

function ghOpenCommitV79(){let u=localStorage.getItem(GH_KEYS_V79.url)||'';if(u)window.open(u,'_blank','noopener')}

function ghVerifyV79(){window.open(ghFileUrlV79(getSettings()),'_blank','noopener')}

function githubStatusHtmlV78(s){s=ghNormV79(s||getSettings());let tok=!!safeText(s.ghToken).trim(),repo=!!s.ghOwner&&!!s.ghRepo,sec=location.protocol==='https:'||location.hostname==='localhost';return `<div class="github-status-card"><h3>حالة اتصال GitHub</h3><div class="status-line ${sec?'ok':'warn'}"><span></span>${sec?'اتصال آمن HTTPS':'يفضل فتح التطبيق من HTTPS'}</div><div class="status-line ${repo?'ok':'warn'}"><span></span>${repo?'تم ضبط المستودع':'بيانات المستودع/المالك غير مكتملة'}</div><div class="status-line ${tok?'ok':'warn'}"><span></span>${tok?'Token موجود ومحفوظ محلياً':'Token غير موجود'}</div><div class="status-line info" id="githubLiveStatus"><span></span>حالة قاعدة البيانات: جاهزة</div><button onclick="testGitHubConnectionV79()">Test Connection / فحص الاتصال</button></div>`}

window.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{try{ghRenderV79()}catch(e){}},300));

const GH_REMOTE_COMMIT_TIME_KEY_V88='github_last_remote_commit_time';

const GH_BACKUP_LIST_KEY_V88='github_personal_backups_v88';

function ghTouchLocalModifiedV88(){
  try{ localStorage.setItem(GH_LOCAL_MOD_KEY_V88, String(Date.now())); }catch(e){}
}

function ghLocalModifiedIsoV88(){
  let n=Number(localStorage.getItem(GH_LOCAL_MOD_KEY_V88)||0);
  if(!n) return '';
  try{ return new Date(n).toISOString(); }catch(e){ return String(n); }
}

function ghBackupPersonalV88(reason){
  try{
    let list=[];
    try{ list=JSON.parse(localStorage.getItem(GH_BACKUP_LIST_KEY_V88)||'[]'); }catch(e){ list=[]; }
    let stamp=new Date().toISOString().replace(/[:.]/g,'-');
    let key='gh_personal_backup_'+stamp;
    localStorage.setItem(key, JSON.stringify({time:new Date().toISOString(), reason:safeText(reason), data: personalData||[]}));
    list.unshift(key);
    list=list.slice(0,5);
    localStorage.setItem(GH_BACKUP_LIST_KEY_V88, JSON.stringify(list));
  }catch(e){}
}

function ghSetToolbarBtnStateV88(state, errMsg){
  let btn=document.getElementById('syncGitHubBtn');
  if(!btn) return;
  btn.classList.remove('syncing','ok','err');
  if(state==='syncing') btn.classList.add('syncing');
  if(state==='ok') btn.classList.add('ok');
  if(state==='err') btn.classList.add('err');
  if(state==='syncing') btn.title='Syncing...';
  if(state==='ok') btn.title='Synced successfully';
  if(state==='err') btn.title='Failed: '+safeText(errMsg||'');
}

async function ghLatestCommitTimeV88(s){
  // Uses commits API to get latest commit affecting the file path.
  // GET /repos/{owner}/{repo}/commits?path={path}&sha={branch}&per_page=1
  let url=`https://api.github.com/repos/${encodeURIComponent(s.ghOwner)}/${encodeURIComponent(s.ghRepo)}/commits?path=${encodeURIComponent(s.ghPath)}&sha=${encodeURIComponent(s.ghBranch)}&per_page=1`;
  let r=await fetch(url,{headers:{Authorization:'Bearer '+s.ghToken,Accept:'application/vnd.github+json'}});
  if(!r.ok) return null;
  let arr=await r.json();
  let dt=arr && arr[0] && arr[0].commit && (arr[0].commit.committer?.date || arr[0].commit.author?.date);
  return dt || null;
}

function manualSyncGitHub(){
  // Manual button: should work in addition to auto-sync.
  try{
    syncToGitHub('manual-toolbar');
  }catch(e){
    ghSetToolbarBtnStateV88('err', e.message||String(e));
    if(typeof toast==='function') toast('❌ GitHub sync failed: '+(e.message||e),'err');
  }
}

// Patch: show clear warning when auto-sync enabled but token missing.
(function patchGitHubWarningV88(){
  try{
    const baseStatusHtml = window.ghStatusHtmlV79;
    if(typeof baseStatusHtml==='function'){
      window.ghStatusHtmlV79 = function(){
        let html = baseStatusHtml.apply(this, arguments);
        try{
          let s=getSettings();
          if(s.ghAutoSync && !safeText(s.ghToken).trim()){
            // Add warning banner inside status card.
            html = html.replace('</div><div class="github-sync-actions"',
              '<div class="github-error-box"><strong>تنبيه:</strong> المزامنة التلقائية مفعلة ولكن GitHub Token غير موجود. عند إضافة Token ستعمل المزامنة تلقائياً.</div></div><div class="github-sync-actions"'
            );
          }
        }catch(e){}
        return html;
      };
    }
  }catch(e){}
})();

// Patch: touch local modified time whenever personal DB is saved.
(function patchSaveDbTouchV88(){
  try{
    const baseSaveDb = window.saveDb;
    if(typeof baseSaveDb==='function'){
      window.saveDb = function(w){
        let r = baseSaveDb.apply(this, arguments);
        if(w==='personal') ghTouchLocalModifiedV88();
        return r;
      };
    }
  }catch(e){}
})();

// Patch: enhance syncToGitHub with backup + remote newer detection.
(function patchSyncToGitHubSafetyV88(){
  try{
    const baseSync = window.syncToGitHub;
    if(typeof baseSync!=='function') return;

    window.syncToGitHub = async function(reason){
      // keep original behavior but add safety + button feedback.
      ghSetToolbarBtnStateV88('syncing');

      // Make local backup before any remote write.
      try{ ghBackupPersonalV88('before-github-sync:'+safeText(reason||'manual')); }catch(e){}

      // If config missing, let original set status failed; but keep clear feedback.
      let s=getSettings();
      if(!safeText(s.ghToken).trim()){
        ghSetToolbarBtnStateV88('err','Missing GitHub token');
        return baseSync.apply(this, arguments);
      }

      // Conflict detection only when there are local changes and remote is newer.
      try{
        let remoteTime = await ghLatestCommitTimeV88(s);
        if(remoteTime){
          try{ localStorage.setItem(GH_REMOTE_COMMIT_TIME_KEY_V88, remoteTime); }catch(e){}
          let localMs = Number(localStorage.getItem(GH_LOCAL_MOD_KEY_V88)||0);
          let remoteMs = Date.parse(remoteTime)||0;
          if(localMs && remoteMs && remoteMs>localMs){
            let msg = 'تحذير تعارض: يوجد تحديث أحدث على GitHub لهذا الملف.\n\nRemote: '+remoteTime+'\nLocal: '+ghLocalModifiedIsoV88()+'\n\nهل تريد المتابعة ورفع النسخة المحلية (overwrite)؟';
            if(!confirm(msg)){
              if(typeof ghSetV79==='function') ghSetV79('failed','Canceled بسبب تعارض: Remote أحدث');
              ghSetToolbarBtnStateV88('err','Conflict canceled');
              return;
            }
          }
        }
      }catch(e){
        // Non-fatal; continue with base sync.
      }

      try{
        await baseSync.apply(this, arguments);
        let st=localStorage.getItem(GH_KEYS_V79.status)||'none';
        if(st==='success' || st==='no_changes') ghSetToolbarBtnStateV88('ok');
        else if(st==='failed') ghSetToolbarBtnStateV88('err', localStorage.getItem(GH_KEYS_V79.error)||'');
        else ghSetToolbarBtnStateV88('ok');
      }catch(e){
        ghSetToolbarBtnStateV88('err', e.message||String(e));
        throw e;
      }
    };

    // Also reflect status changes triggered by auto-sync.
    const baseGhSet = window.ghSetV79;
    if(typeof baseGhSet==='function'){
      window.ghSetV79 = function(st, err){
        let r = baseGhSet.apply(this, arguments);
        if(st==='syncing') ghSetToolbarBtnStateV88('syncing');
        if(st==='success' || st==='no_changes') ghSetToolbarBtnStateV88('ok');
        if(st==='failed') ghSetToolbarBtnStateV88('err', err||localStorage.getItem(GH_KEYS_V79.error)||'');
        return r;
      };
    }

  }catch(e){}
})();

// Init button state on load
window.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{
  try{
    let st=localStorage.getItem(GH_KEYS_V79.status)||'none';
    if(st==='success' || st==='no_changes') ghSetToolbarBtnStateV88('ok');
    else if(st==='failed') ghSetToolbarBtnStateV88('err', localStorage.getItem(GH_KEYS_V79.error)||'');
  }catch(e){}
},500));
