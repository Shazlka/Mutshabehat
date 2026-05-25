(function(){
  var v83DetailState={groupId:null,tab:'verses',compareMode:'side'};
  var v83MobileState={open:false,touchX:0,touchY:0};
  var V83_TABS=[
    {id:'verses',label:'الآيات'},
    {id:'differences',label:'الاختلافات'},
    {id:'notes',label:'الملاحظات'},
    {id:'tafsir',label:'التفسير'},
    {id:'related',label:'مرتبط'}
  ];

  function esc(v){
    return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function getActiveGroup(){
    if(!window.findActive||v83DetailState.groupId==null) return null;
    return window.findActive(v83DetailState.groupId);
  }

  function renderVerseBlock(v){
    var surah=esc(v&&v.surah||'');
    var ayah=esc(v&&v.ayah||'');
    var label=v&&v.label?'<span class="verse-label">'+esc(v.label)+'</span>':'';
    var parts=(v&&v.parts||[]).map(function(p){
      var t=esc(p&&p.text||'');
      var cls=esc(p&&p.type||'normal');
      return '<span class="'+cls+'">'+t+'</span>';
    }).join(' ');
    return '<div class="verse-card"><div class="verse-ref"><span class="surah-name">'+surah+'</span><span class="ayah-num">'+ayah+'</span>'+label+'</div><div class="verse-text">'+parts+'</div></div>';
  }

  function normalizeWord(w){
    return String(w||'')
      .replace(/[ًٌٍَُِّْـ]/g,'')
      .replace(/[أإآٱ]/g,'ا')
      .replace(/[ى]/g,'ي')
      .replace(/[ة]/g,'ه')
      .replace(/[ؤ]/g,'و')
      .replace(/[ئ]/g,'ي')
      .replace(/[^\u0600-\u06FF0-9A-Za-z]/g,'')
      .trim();
  }

  function tokenizeVerse(v){
    var full=(v&&v.parts||[]).map(function(p){return (p&&p.text)||'';}).join(' ').trim();
    if(!full) return [];
    return full.split(/\s+/).filter(Boolean);
  }

  function classifyToken(baseToken,currentToken){
    if(baseToken==null&&currentToken!=null) return 'added';
    if(baseToken!=null&&currentToken==null) return 'removed';
    if(baseToken==null&&currentToken==null) return 'shared';
    if(normalizeWord(baseToken)===normalizeWord(currentToken)) return 'shared';
    return 'changed';
  }

  function tokenSpan(token,state){
    return '<span class="v83-cmp-token is-'+state+'">'+esc(token||'∅')+'</span>';
  }

  function buildAlignedRows(group){
    var verses=(group&&group.verses)||[];
    if(!verses.length) return [];
    var baseTokens=tokenizeVerse(verses[0]);
    return verses.map(function(v,idx){
      var tokens=tokenizeVerse(v);
      var n=Math.max(baseTokens.length,tokens.length);
      var pairs=[];
      for(var i=0;i<n;i++){
        var b=baseTokens[i];
        var c=tokens[i];
        pairs.push({base:b,current:c,state:classifyToken(b,c)});
      }
      return {idx:idx,verse:v,pairs:pairs};
    });
  }

  function renderComparisonModeSelector(){
    var modes=[
      {id:'side',label:'متوازي'},
      {id:'inline',label:'سطر واحد'},
      {id:'diff',label:'الفروقات فقط'}
    ];
    return '<div class="v83-cmp-modes">'+modes.map(function(m){
      var active=v83DetailState.compareMode===m.id?' active':'';
      return '<button class="v83-cmp-mode-btn'+active+'" data-v83-cmp-mode="'+m.id+'">'+m.label+'</button>';
    }).join('')+'</div>';
  }

  function renderSideBySide(rows){
    return '<div class="v83-cmp-table">'
      +rows.map(function(r){
        var left=r.pairs.map(function(p){return tokenSpan(p.base,p.state);}).join(' ');
        var right=r.pairs.map(function(p){return tokenSpan(p.current,p.state);}).join(' ');
        return '<div class="v83-cmp-row">'
          +'<div class="v83-cmp-ref">'+esc(r.verse&&r.verse.surah||'')+' '+esc(r.verse&&r.verse.ayah||'')+'</div>'
          +'<div class="v83-cmp-col base">'+left+'</div>'
          +'<div class="v83-cmp-col current">'+right+'</div>'
          +'</div>';
      }).join('')
      +'</div>';
  }

  function renderInline(rows){
    return '<div class="v83-cmp-inline-list">'
      +rows.map(function(r){
        var line=r.pairs.map(function(p){
          if(p.state==='shared') return tokenSpan(p.current,'shared');
          if(p.state==='removed') return '<span class="v83-cmp-inline-change">'+tokenSpan(p.base,'removed')+' → '+tokenSpan('∅','removed')+'</span>';
          if(p.state==='added') return '<span class="v83-cmp-inline-change">'+tokenSpan('∅','added')+' → '+tokenSpan(p.current,'added')+'</span>';
          return '<span class="v83-cmp-inline-change">'+tokenSpan(p.base,'changed')+' → '+tokenSpan(p.current,'changed')+'</span>';
        }).join(' ');
        return '<div class="v83-cmp-inline-item"><div class="v83-cmp-ref">'+esc(r.verse&&r.verse.surah||'')+' '+esc(r.verse&&r.verse.ayah||'')+'</div><div class="v83-cmp-inline-line">'+line+'</div></div>';
      }).join('')
      +'</div>';
  }

  function renderDiffOnly(rows){
    return '<div class="v83-cmp-diff-only">'
      +rows.map(function(r){
        var changes=r.pairs.filter(function(p){return p.state!=='shared';});
        if(!changes.length){
          return '<div class="v83-cmp-diff-item"><div class="v83-cmp-ref">'+esc(r.verse&&r.verse.surah||'')+' '+esc(r.verse&&r.verse.ayah||'')+'</div><div class="v83-cmp-nochange">لا توجد فروقات مع الآية المرجعية.</div></div>';
        }
        var body=changes.map(function(p){
          if(p.state==='removed') return '<div class="v83-cmp-diff-line">'+tokenSpan(p.base,'removed')+' <span class="v83-cmp-arrow">حُذفت</span></div>';
          if(p.state==='added') return '<div class="v83-cmp-diff-line">'+tokenSpan(p.current,'added')+' <span class="v83-cmp-arrow">أُضيفت</span></div>';
          return '<div class="v83-cmp-diff-line">'+tokenSpan(p.base,'changed')+' <span class="v83-cmp-arrow">↔</span> '+tokenSpan(p.current,'changed')+'</div>';
        }).join('');
        return '<div class="v83-cmp-diff-item"><div class="v83-cmp-ref">'+esc(r.verse&&r.verse.surah||'')+' '+esc(r.verse&&r.verse.ayah||'')+'</div>'+body+'</div>';
      }).join('')
      +'</div>';
  }

  function renderComparisonTab(group){
    var rows=buildAlignedRows(group);
    if(!rows.length){
      return '<div class="v83-tab-panel"><div class="v83-empty">لا توجد آيات كافية للمقارنة.</div></div>';
    }
    var legend='<div class="v83-cmp-legend">'
      +'<span class="v83-cmp-token is-shared">مشترك</span>'
      +'<span class="v83-cmp-token is-added">مضاف</span>'
      +'<span class="v83-cmp-token is-changed">متغير</span>'
      +'<span class="v83-cmp-token is-removed">محذوف</span>'
      +'</div>';
    var body='';
    if(v83DetailState.compareMode==='inline') body=renderInline(rows);
    else if(v83DetailState.compareMode==='diff') body=renderDiffOnly(rows);
    else body=renderSideBySide(rows);
    return '<div class="v83-tab-panel v83-cmp-panel">'+renderComparisonModeSelector()+legend+body+'</div>';
  }

  function collectByType(group){
    var map={shared:[],diff:[],diff2:[],diff3:[],addition:[],unique:[]};
    (group.verses||[]).forEach(function(v){
      (v.parts||[]).forEach(function(p){
        var type=(p&&p.type)||'shared';
        if(!map[type]) map[type]=[];
        if(p&&p.text) map[type].push(p.text);
      });
    });
    return map;
  }

  function renderTabContent(group){
    if(!group) return '<div class="v83-empty">اختر مجموعة من العمود الأوسط لعرض تفاصيلها هنا.</div>';
    if(v83DetailState.tab==='verses'){
      return '<div class="v83-tab-panel">'+(group.verses||[]).map(renderVerseBlock).join('')+'</div>';
    }
    if(v83DetailState.tab==='differences'){
      return renderComparisonTab(group);
    }
    if(v83DetailState.tab==='notes'){
      var note=group.note?group.note:'';
      var unote=group.unote?group.unote:'';
      return '<div class="v83-tab-panel"><div class="note"><b>ملاحظات شخصية</b><br>'+note+'</div><div class="unote"><b>ملاحظات إضافية</b><br>'+unote+'</div></div>';
    }
    if(v83DetailState.tab==='tafsir'){
      return '<div class="v83-tab-panel"><div class="v83-empty">سيتم ربط التفسير في Phase 6/10. حالياً يمكنك فتح التفسير الكامل من أزرار المجموعة.</div></div>';
    }
    return '<div class="v83-tab-panel"><div class="v83-empty">مجموعات مرتبطة ستظهر هنا لاحقاً بناءً على الوسوم/السور/التطابق.</div></div>';
  }

  function renderDetailPane(){
    var pane=document.getElementById('detailContent');
    var title=document.querySelector('.v83-detail-title');
    if(!pane||!title) return;
    var g=getActiveGroup();
    title.textContent=g?((typeof stripTashkeel==='function'?stripTashkeel(g.title):g.title)||('مجموعة '+g.id)):'مساحة التفاصيل';
    var tabs='<div class="v83-tabs">'+V83_TABS.map(function(t){
      var active=t.id===v83DetailState.tab?' active':'';
      return '<button class="v83-tab-btn'+active+'" data-v83-tab="'+t.id+'">'+t.label+'</button>';
    }).join('')+'</div>';
    var html=tabs+renderTabContent(g);
    pane.innerHTML=html;
    renderMobileSheetContent(g,html);
  }

  function isMobileLayout(){
    return !!(window.matchMedia&&window.matchMedia('(max-width: 850px)').matches);
  }

  function visibleGroupIds(){
    return Array.prototype.slice.call(document.querySelectorAll('#groups .group[data-id]'))
      .map(function(el){return Number(el.getAttribute('data-id'));})
      .filter(function(n){return !isNaN(n);});
  }

  function moveMobileGroup(step){
    var ids=visibleGroupIds();
    if(!ids.length||v83DetailState.groupId==null) return;
    var i=ids.indexOf(Number(v83DetailState.groupId));
    if(i<0) i=0;
    var next=i+step;
    if(next<0||next>=ids.length) return;
    v83DetailState.groupId=ids[next];
    renderDetailPane();
  }

  function ensureMobileSheet(){
    var root=document.getElementById('v83MobileDetailSheet');
    if(root) return root;
    root=document.createElement('section');
    root.id='v83MobileDetailSheet';
    root.className='v83-mobile-sheet';
    root.innerHTML='<div class="v83-mobile-sheet-card"><div class="v83-mobile-sheet-head"><button class="v83-mobile-close" data-v83-mobile-close="1">رجوع</button><h3 class="v83-mobile-title">التفاصيل</h3><div class="v83-mobile-nav-steps"><button class="v83-mobile-edit" data-v83-mobile-edit="1" hidden>تعديل</button><button data-v83-mobile-prev="1">السابق</button><button data-v83-mobile-next="1">التالي</button></div></div><div class="v83-mobile-sheet-body" id="v83MobileDetailContent"></div></div>';
    document.body.appendChild(root);
    return root;
  }

  function renderMobileSheetContent(group,html){
    var body=document.getElementById('v83MobileDetailContent');
    var title=document.querySelector('#v83MobileDetailSheet .v83-mobile-title');
    var edit=document.querySelector('#v83MobileDetailSheet [data-v83-mobile-edit]');
    if(!body||!title) return;
    title.textContent=group?((typeof stripTashkeel==='function'?stripTashkeel(group.title):group.title)||('مجموعة '+group.id)):'التفاصيل';
    if(edit){
      var canEdit=!!(group&&typeof activeDb!=='undefined'&&activeDb==='personal');
      edit.hidden=!canEdit;
      edit.setAttribute('data-group-id',canEdit?String(group.id):'');
    }
    body.innerHTML=html||'<div class="v83-empty">اختر مجموعة</div>';
  }

  function openMobileSheetForGroup(id){
    if(!isMobileLayout()) return false;
    ensureMobileSheet();
    v83DetailState.groupId=Number(id);
    v83MobileState.open=true;
    document.body.classList.add('v83-mobile-sheet-open');
    renderDetailPane();
    return true;
  }

  function closeMobileSheet(){
    v83MobileState.open=false;
    document.body.classList.remove('v83-mobile-sheet-open');
  }

  function patchMobileGroupDetail(){
    var base=window.openGroupDetailModal;
    if(typeof base!=='function') return;
    window.openGroupDetailModal=function(id){
      if(openMobileSheetForGroup(id)) return;
      return base.apply(this,arguments);
    };
  }

  function syncDetailFromGroup(groupEl){
    if(!groupEl) return;
    var id=groupEl.getAttribute('data-id');
    if(id==null) return;
    v83DetailState.groupId=Number(id);
    Array.prototype.slice.call(document.querySelectorAll('#groups .group.is-selected,#groups .group.open')).forEach(function(el){
      el.classList.remove('is-selected');
      el.classList.remove('open');
    });
    groupEl.classList.add('is-selected');
    renderDetailPane();
  }

  window.selectV83DetailGroup=function(id){
    var groupEl=document.querySelector('#groups .group[data-id="'+String(id).replace(/"/g,'\\"')+'"]');
    if(groupEl) syncDetailFromGroup(groupEl);
    else {
      v83DetailState.groupId=Number(id);
      renderDetailPane();
    }
  };

  document.addEventListener('click',function(e){
    if(e.target.closest('[data-v83-mobile-close]')){
      closeMobileSheet();
      return;
    }
    var editBtn=e.target.closest('[data-v83-mobile-edit]');
    if(editBtn){
      var editId=editBtn.getAttribute('data-group-id');
      if(editId&&typeof openEditModal==='function'){
        closeMobileSheet();
        openEditModal(editId);
      }
      return;
    }
    if(e.target.closest('[data-v83-mobile-prev]')){
      moveMobileGroup(-1);
      return;
    }
    if(e.target.closest('[data-v83-mobile-next]')){
      moveMobileGroup(1);
      return;
    }
    var modeBtn=e.target.closest('.v83-cmp-mode-btn');
    if(modeBtn){
      v83DetailState.compareMode=modeBtn.getAttribute('data-v83-cmp-mode')||'side';
      renderDetailPane();
      return;
    }
    var tabBtn=e.target.closest('.v83-tab-btn');
    if(tabBtn){
      v83DetailState.tab=tabBtn.getAttribute('data-v83-tab')||'verses';
      renderDetailPane();
      return;
    }
    var head=e.target.closest('#groups .group-head');
    if(!head) return;
    var groupEl=head.closest('.group');
    if(groupEl) setTimeout(function(){syncDetailFromGroup(groupEl)},0);
  });

  document.addEventListener('touchstart',function(e){
    var body=e.target.closest('#v83MobileDetailContent');
    if(!body) return;
    var t=e.touches&&e.touches[0];
    if(!t) return;
    v83MobileState.touchX=t.clientX;
    v83MobileState.touchY=t.clientY;
  },{passive:true});

  document.addEventListener('touchend',function(e){
    var body=e.target.closest('#v83MobileDetailContent');
    if(!body) return;
    var t=e.changedTouches&&e.changedTouches[0];
    if(!t) return;
    var dx=t.clientX-v83MobileState.touchX;
    var dy=t.clientY-v83MobileState.touchY;
    if(Math.abs(dx)<65||Math.abs(dx)<Math.abs(dy)) return;
    if(dx<0) moveMobileGroup(1); else moveMobileGroup(-1);
  },{passive:true});

  document.addEventListener('DOMContentLoaded',function(){
    renderDetailPane();
    patchMobileGroupDetail();
  });
})();
