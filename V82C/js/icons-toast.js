function iconSvg(name){
  const common='width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  const icons={
    star:`<svg ${common}><path d="M12 3.5l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17.4 6.6 20.3l1-6.1-4.4-4.3 6.1-.9L12 3.5z"/></svg>`,
    lock:`<svg ${common}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`,
    copy:`<svg ${common}><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    camera:`<svg ${common}><path d="M4 8h3l1.6-2h6.8L17 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z"/><circle cx="12" cy="14" r="3.4"/></svg>`,
    edit:`<svg ${common}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>`,
    compare:`<svg ${common}><path d="M8 7h13"/><path d="M8 17h13"/><path d="M3 7h.01"/><path d="M3 17h.01"/></svg>`
  };
  return icons[name]||'';
}

function toast(msg,type){let t=document.getElementById('v78Toast');if(!t){t=document.createElement('div');t.id='v78Toast';document.body.appendChild(t)}t.className='v78-toast '+(type||'');t.textContent=msg;t.classList.add('show');clearTimeout(t._tm);t._tm=setTimeout(()=>t.classList.remove('show'),2600)}
