/* V81 automated-data-loader.js
   Static multi-file loader for the V75 extended automated database.
   Load all automated-data-part-XXX.js files first, then this loader, then app.js.
   This recreates window.AUTOMATED_DATA for the existing app.
*/
(function(){
  window.AUTOMATED_DATA_CHUNKS = window.AUTOMATED_DATA_CHUNKS || [];
  window.AUTOMATED_DATA = [];
  for (var i = 0; i < window.AUTOMATED_DATA_CHUNKS.length; i++) {
    window.AUTOMATED_DATA = window.AUTOMATED_DATA.concat(window.AUTOMATED_DATA_CHUNKS[i]);
  }
  window.AUTOMATED_DATA_READY = true;
  window.dispatchEvent(new CustomEvent('automatedDataReady', {
    detail: {
      totalGroups: window.AUTOMATED_DATA.length,
      totalParts: window.AUTOMATED_DATA_CHUNKS.length,
      manifest: window.AUTOMATED_DATA_MANIFEST || null
    }
  }));
  console.log('[Mutashabihat V81] Extended automated database loaded:', window.AUTOMATED_DATA.length, 'groups from', window.AUTOMATED_DATA_CHUNKS.length, 'parts');
})();
