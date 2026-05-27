// V83 bootstrap shim.
// app-core is loaded directly by index.html to avoid async race conditions on mobile.
(function(){
  if(typeof window==='undefined') return;
  if(typeof window.init==='function' && document.readyState!=='loading'){
    try{ window.init(); }catch(e){}
  }
})();
