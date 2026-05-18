function safeText(v){return v===undefined||v===null?'':String(v)}

function escapeHtml(v){return safeText(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}

function normalize(v){return safeText(v).toLowerCase().replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g,'').replace(/[إأآٱا]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/ـ/g,'').replace(/\s+/g,' ').trim()}

function clone(v){return JSON.parse(JSON.stringify(v||[]))}

function isTrue(v){return v===true||v==='true'||v===1||v==='1'}

function storage(t){let b=document.getElementById('storageBadge');if(b)b.textContent=t}

function safeRich(v){let s=safeText(v);return /<\/?(b|strong|u|span|br|div|p|ul|ol|li)/i.test(s)?s.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi,''):escapeHtml(s).replace(/\n/g,'<br>')}

function highlight(t){let q=safeText(document.getElementById('searchInput')?.value).trim();let s=escapeHtml(t);if(!q)return s;return s.replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'),m=>`<mark>${m}</mark>`)}

function v78IntegrityCheck(){const bad=new RegExp('[\\u00d8\\u00d9\\u00e2\\ufffd]');const ok=!bad.test(document.documentElement.innerText||'');if(!ok)console.warn('V78 integrity warning: corrupted UI text detected. Clear browser cache and redeploy V78 files.');return ok}

window.addEventListener('load',()=>setTimeout(v78IntegrityCheck,500));
