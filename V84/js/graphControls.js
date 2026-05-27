/**
 * graphControls.js — Graph filter & highlight controls panel (Task 5.3)
 *
 * Injects a collapsible panel into #ngControlsSlot each time
 * openNetworkGraph() is called. Panel is rebuilt fresh on each open so
 * slider maxima always reflect the current dataset.
 *
 * Structural filters (require simulation rebuild on Apply):
 *   minWeight  — hide edges with co-occurrence count below threshold
 *   minCount   — hide nodes referenced by fewer groups than threshold
 *
 * Visual option (no rebuild needed):
 *   colorMode  — 'juz' (default) | 'type' (مكي/مدني)
 *
 * Highlight (no rebuild, calls window.selectGraphNode):
 *   surah search — type a name, press Enter or click تمييز
 */

import { buildGraphData }      from './graphDataBuilder.js';
import { getSurahByNameFuzzy } from '../data/quranMeta.js';

const SLOT_ID   = 'ngControlsSlot';
const CANVAS_ID = 'ngCanvas';
const DEFAULTS  = { minWeight: 1, minCount: 1, colorMode: 'juz' };

let _open = false; // panel collapsed by default

// ── Panel builder ─────────────────────────────────────────────────────────────

function _buildControls() {
  const slot = document.getElementById(SLOT_ID);
  if (!slot) return;
  slot.innerHTML = '';
  _open = false; // reset to collapsed on each graph open

  // Read current opts and dataset meta for slider ranges
  const cur  = { ...DEFAULTS, ...(window.getGraphOpts?.() ?? {}) };
  const { meta } = buildGraphData({ minWeight: 1, minCount: 1 });
  const maxW = Math.max(meta.maxWeight, 1);
  const maxC = Math.max(meta.maxCount,  1);

  // ── Toggle button ──────────────────────────────────────────────────────────
  const toggle = document.createElement('button');
  toggle.id        = 'ngcToggle';
  toggle.className = 'ngc-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'ngcPanel');
  toggle.innerHTML =
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
    ' stroke-width="2.5" stroke-linecap="round" aria-hidden="true">' +
    '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/>' +
    '<line x1="3" y1="18" x2="9" y2="18"/></svg> فلاتر';
  toggle.addEventListener('click', () => _togglePanel());
  slot.appendChild(toggle);

  // ── Panel ──────────────────────────────────────────────────────────────────
  const panel = document.createElement('div');
  panel.id        = 'ngcPanel';
  panel.className = 'ngc-panel'; // starts collapsed
  slot.appendChild(panel);

  // Panel header
  const hdr = document.createElement('div');
  hdr.className = 'ngc-hdr';
  const hdrTitle = document.createElement('span');
  hdrTitle.className   = 'ngc-hdr-title';
  hdrTitle.textContent = 'فلاتر الشبكة';
  const closeBtn = document.createElement('button');
  closeBtn.className   = 'ngc-close';
  closeBtn.setAttribute('aria-label', 'إغلاق');
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', () => _togglePanel(false));
  hdr.appendChild(hdrTitle);
  hdr.appendChild(closeBtn);
  panel.appendChild(hdr);

  // ── minWeight slider ───────────────────────────────────────────────────────
  panel.appendChild(_buildSlider({
    id: 'ngcMinWeight', label: 'أقل تكرار مشترك',
    hint: 'إظهار الروابط ذات تكرار ≥',
    min: 1, max: maxW, value: Math.min(cur.minWeight, maxW),
    disabled: maxW <= 1,
  }));

  // ── minCount slider ────────────────────────────────────────────────────────
  panel.appendChild(_buildSlider({
    id: 'ngcMinCount', label: 'أقل عدد مجموعات',
    hint: 'إظهار السور ذات مجموعات ≥',
    min: 1, max: maxC, value: Math.min(cur.minCount, maxC),
    disabled: maxC <= 1,
  }));

  // ── Color mode ─────────────────────────────────────────────────────────────
  const colorSec = _section('تلوين العقد');
  const radioRow = document.createElement('div');
  radioRow.className = 'ngc-radio-row';
  [{ v: 'juz', lbl: 'الجزء' }, { v: 'type', lbl: 'مكي / مدني' }].forEach(opt => {
    const lbl = document.createElement('label');
    lbl.className = 'ngc-radio-lbl';
    const inp = document.createElement('input');
    inp.type    = 'radio';
    inp.name    = 'ngcColorMode';
    inp.value   = opt.v;
    inp.checked = cur.colorMode === opt.v;
    lbl.appendChild(inp);
    lbl.append(' ' + opt.lbl); // non-breaking space
    radioRow.appendChild(lbl);
  });
  colorSec.appendChild(radioRow);
  panel.appendChild(colorSec);

  // ── Surah search / highlight ───────────────────────────────────────────────
  const searchSec = _section('تمييز سورة');
  const searchRow = document.createElement('div');
  searchRow.className = 'ngc-search-row';

  const searchInp = document.createElement('input');
  searchInp.id          = 'ngcSurahSearch';
  searchInp.type        = 'text';
  searchInp.className   = 'ngc-search';
  searchInp.placeholder = 'اسم السورة...';
  searchInp.dir         = 'rtl';
  searchInp.autocomplete = 'off';

  const highlightBtn = document.createElement('button');
  highlightBtn.className   = 'ngc-btn ngc-btn--ghost';
  highlightBtn.textContent = 'تمييز';

  const doHighlight = () => {
    const name = searchInp.value.trim();
    if (!name) { window.deselectGraphNodes?.(); return; }
    const s = getSurahByNameFuzzy(name);
    if (s) {
      window.selectGraphNode?.(s.number);
    } else {
      searchInp.classList.add('ngc-search--miss');
      setTimeout(() => searchInp.classList.remove('ngc-search--miss'), 900);
    }
  };

  searchInp.addEventListener('keydown', ev => { if (ev.key === 'Enter') doHighlight(); });
  highlightBtn.addEventListener('click', doHighlight);
  // Clear selection when field is emptied
  searchInp.addEventListener('input', () => {
    if (!searchInp.value.trim()) window.deselectGraphNodes?.();
  });

  searchRow.appendChild(searchInp);
  searchRow.appendChild(highlightBtn);
  searchSec.appendChild(searchRow);
  panel.appendChild(searchSec);

  // ── Action buttons ─────────────────────────────────────────────────────────
  const btnRow = document.createElement('div');
  btnRow.className = 'ngc-btn-row';

  const applyBtn = document.createElement('button');
  applyBtn.className   = 'ngc-btn ngc-btn--primary';
  applyBtn.textContent = 'تطبيق الفلاتر';
  applyBtn.addEventListener('click', _apply);

  const resetBtn = document.createElement('button');
  resetBtn.className   = 'ngc-btn ngc-btn--ghost';
  resetBtn.textContent = 'إعادة تعيين';
  resetBtn.addEventListener('click', _reset);

  btnRow.appendChild(applyBtn);
  btnRow.appendChild(resetBtn);
  panel.appendChild(btnRow);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function _section(title) {
  const sec = document.createElement('div');
  sec.className = 'ngc-section';
  const lbl = document.createElement('div');
  lbl.className   = 'ngc-sec-label';
  lbl.textContent = title;
  sec.appendChild(lbl);
  return sec;
}

function _buildSlider({ id, label, hint, min, max, value, disabled }) {
  const sec = _section('');
  sec.querySelector('.ngc-sec-label').remove();

  const row = document.createElement('div');
  row.className = 'ngc-slider-row';

  const lbl = document.createElement('label');
  lbl.className   = 'ngc-sec-label';
  lbl.setAttribute('for', id);
  lbl.textContent = label;

  const valSpan = document.createElement('span');
  valSpan.id        = id + 'Val';
  valSpan.className = 'ngc-slider-val';
  valSpan.textContent = String(value);

  row.appendChild(lbl);
  row.appendChild(valSpan);
  sec.appendChild(row);

  const inp = document.createElement('input');
  inp.type      = 'range';
  inp.id        = id;
  inp.className = 'ngc-slider';
  inp.min       = String(min);
  inp.max       = String(max);
  inp.value     = String(value);
  inp.disabled  = disabled;
  inp.addEventListener('input', () => {
    valSpan.textContent = inp.value;
    if (hintEl) hintEl.textContent = `${hint} ${inp.value}`;
  });
  sec.appendChild(inp);

  let hintEl = null;
  if (hint && !disabled) {
    hintEl = document.createElement('div');
    hintEl.className   = 'ngc-hint';
    hintEl.textContent = `${hint} ${value}`;
    sec.appendChild(hintEl);
  }

  return sec;
}

// ── Apply / reset ──────────────────────────────────────────────────────────────

function _readOpts() {
  const mw = document.getElementById('ngcMinWeight');
  const mc = document.getElementById('ngcMinCount');
  const cm = document.querySelector('input[name="ngcColorMode"]:checked');
  return {
    minWeight: mw ? Number(mw.value) : DEFAULTS.minWeight,
    minCount:  mc ? Number(mc.value) : DEFAULTS.minCount,
    colorMode: cm ? cm.value         : DEFAULTS.colorMode,
  };
}

function _apply() {
  const canvas = document.getElementById(CANVAS_ID);
  if (canvas && window.renderNetworkGraph) {
    window.renderNetworkGraph(canvas, _readOpts());
  }
}

function _reset() {
  const mw = document.getElementById('ngcMinWeight');
  const mc = document.getElementById('ngcMinCount');
  if (mw) { mw.value = '1'; mw.dispatchEvent(new Event('input')); }
  if (mc) { mc.value = '1'; mc.dispatchEvent(new Event('input')); }
  const juzRadio = document.querySelector('input[name="ngcColorMode"][value="juz"]');
  if (juzRadio) juzRadio.checked = true;
  const si = document.getElementById('ngcSurahSearch');
  if (si) si.value = '';
  const canvas = document.getElementById(CANVAS_ID);
  if (canvas && window.renderNetworkGraph) {
    window.renderNetworkGraph(canvas, DEFAULTS);
  }
}

// ── Panel open/close ──────────────────────────────────────────────────────────

function _togglePanel(force) {
  _open = force !== undefined ? force : !_open;
  document.getElementById('ngcPanel')?.classList.toggle('ngc-panel--open', _open);
  const t = document.getElementById('ngcToggle');
  if (t) t.setAttribute('aria-expanded', String(_open));
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Wrap openNetworkGraph: inject controls after canvas renders
  const _origOpen = window.openNetworkGraph;
  if (typeof _origOpen === 'function') {
    window.openNetworkGraph = function () {
      const r = _origOpen.apply(this, arguments);
      // Build after renderNetworkGraph's own setTimeout(0) has run
      setTimeout(_buildControls, 10);
      return r;
    };
  }
});
