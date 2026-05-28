/**
 * detailDiff.js — Wires DiffHighlighter + AnnotationPanel into the detail pane.
 *
 * The "الاختلافات" tab (data-v83-tab="differences") is rendered by an IIFE
 * in layout.js using innerHTML — we can't patch it directly. Instead:
 *
 *  1. Capture the clicked group ID in the capture phase (before the IIFE's
 *     bubble listener runs and calls renderDetailPane).
 *  2. MutationObserver on #detailContent detects each innerHTML update.
 *  3. If the active tab is "differences", replace the old comparison table
 *     with createDiffHighlighter + createAnnotationPanel.
 *  4. Same approach for the mobile bottom sheet (#v83MobileDetailContent).
 *
 * Master / Slave comparison:
 *  - A selector bar lets the user pick which verse is the "master" (مرجع).
 *  - All other verses are compared against the master using star-topology diff.
 *  - Part selector: when the master verse has multiple parts, the user can
 *    toggle individual parts on/off to narrow the comparison base text.
 *
 * Adapter: the old data model uses { surah, ayah, parts[] } — we join
 * parts[].text into a single string so arabicDiff.js can run LCS on it.
 */

import { createDiffHighlighter } from './diffHighlighter.js?v=v84_diff_20260528_6';
import { createAnnotationPanel  } from './annotationPanel.js?v=v84_diff_20260527_1';

// Tracks the ID of the last group the user opened (set in capture phase)
let _lastGroupId = null;

// Per-group master state: Map<String(groupId), { masterIndex, partSet, slavePartSets }>
// slavePartSets: Map<verseIndex, Set<partIndex>> — undefined entry = all parts selected
const _masterMap = new Map();

// ── Part-type context menu ────────────────────────────────────────────────────

let _typeMenu = null;

const _PART_TYPES = [
  { key: 'shared',   label: 'مشترك' },
  { key: 'diff',     label: 'اختلاف ١' },
  { key: 'diff2',    label: 'اختلاف ٢' },
  { key: 'diff3',    label: 'اختلاف ٣' },
  { key: 'addition', label: 'زيادة' },
  { key: 'unique',   label: 'فريد' },
  { key: 'normal',   label: 'عادي' },
];

function _hideTypeMenu() {
  if (_typeMenu) { _typeMenu.remove(); _typeMenu = null; }
}

function _showTypeMenu(e, part, onSelect) {
  e.preventDefault();
  _hideTypeMenu();

  const menu = document.createElement('div');
  menu.className = 'dh-type-menu';
  menu.dir = 'rtl';
  menu.setAttribute('role', 'menu');

  const hdr = document.createElement('div');
  hdr.className = 'dh-type-menu-hdr';
  hdr.textContent = 'نوع الجزء';
  menu.appendChild(hdr);

  _PART_TYPES.forEach(({ key, label }) => {
    const item = document.createElement('button');
    item.type = 'button';
    const current = part.type || 'normal';
    item.className = 'dh-type-menu-item' + (key === current ? ' active' : '');
    item.setAttribute('role', 'menuitem');

    const dot = document.createElement('span');
    dot.className = `dh-type-dot dh-part-${key}`;
    item.appendChild(dot);

    const txt = document.createElement('span');
    txt.textContent = label;
    item.appendChild(txt);

    if (key === current) {
      const ck = document.createElement('span');
      ck.className = 'dh-type-check';
      ck.textContent = '✓';
      item.appendChild(ck);
    }

    item.addEventListener('click', () => { onSelect(key); _hideTypeMenu(); });
    menu.appendChild(item);
  });

  document.body.appendChild(menu);
  _typeMenu = menu;

  menu.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px`;
  requestAnimationFrame(() => {
    if (!_typeMenu) return;
    const r = _typeMenu.getBoundingClientRect();
    if (r.right  > window.innerWidth)  _typeMenu.style.left = (e.clientX - r.width)  + 'px';
    if (r.bottom > window.innerHeight) _typeMenu.style.top  = (e.clientY - r.height) + 'px';
  });
}

// Single dismiss listener set up once
(function () {
  document.addEventListener('mousedown', ev => {
    if (_typeMenu && !_typeMenu.contains(ev.target)) _hideTypeMenu();
  }, true);
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') _hideTypeMenu();
  }, true);
}());

function _getMasterState(g) {
  const key = String(g.id);
  if (!_masterMap.has(key)) {
    // Seed from persisted fields on the group object (if any)
    const masterIdx = typeof g.masterIndex === 'number' ? g.masterIndex : 0;
    const masterVerse = (g.verses || [])[masterIdx];
    const parts = masterVerse ? (masterVerse.parts || []) : [];
    let partSet;
    if (Array.isArray(g.masterParts)) {
      partSet = new Set(g.masterParts.filter(i => i >= 0 && i < parts.length));
      if (partSet.size === 0) partSet = new Set(parts.map((_, i) => i)); // fallback: all
    } else {
      partSet = new Set(parts.map((_, i) => i));
    }
    // Restore per-slave part selections
    const slavePartSets = new Map();
    if (g.slaveParts && typeof g.slaveParts === 'object' && !Array.isArray(g.slaveParts)) {
      for (const [k, arr] of Object.entries(g.slaveParts)) {
        const idx = Number(k);
        if (!isNaN(idx) && Array.isArray(arr) && arr.length > 0)
          slavePartSets.set(idx, new Set(arr));
      }
    }
    _masterMap.set(key, { masterIndex: masterIdx, partSet, slavePartSets });
  }
  return _masterMap.get(key);
}

function _resetPartSet(ms, g) {
  const masterVerse = (g.verses || [])[ms.masterIndex];
  const parts = masterVerse ? (masterVerse.parts || []) : [];
  ms.partSet = new Set(parts.map((_, i) => i));
  ms.slavePartSets = new Map(); // clear slave selections when master changes
}

// Write master state back to the group object and save to personal DB + GitHub
function _persistMasterState(g, ms) {
  if (typeof window.activeDb === 'undefined' || window.activeDb !== 'personal') return;
  g.masterIndex = ms.masterIndex;
  const masterVerse = (g.verses || [])[ms.masterIndex];
  const totalParts = masterVerse ? (masterVerse.parts || []).length : 0;
  // null = all parts selected (saves space); array = partial selection
  g.masterParts = (ms.partSet.size >= totalParts)
    ? null
    : [...ms.partSet].sort((a, b) => a - b);
  // Persist slave part sets
  const slaveParts = {};
  let hasSlave = false;
  for (const [verseIdx, pSet] of ms.slavePartSets) {
    const sv = (g.verses || [])[verseIdx];
    if (!sv) continue;
    const total = (sv.parts || []).length;
    if (pSet && pSet.size > 0 && pSet.size < total) {
      slaveParts[String(verseIdx)] = [...pSet].sort((a, b) => a - b);
      hasSlave = true;
    }
  }
  g.slaveParts = hasSlave ? slaveParts : null;
  if (typeof window.saveDb === 'function') window.saveDb('personal');
}

// ── Format adapter ────────────────────────────────────────────────────────────

function _adaptVerse(v) {
  const text = (v.parts || [])
    .map(p => (p && p.text) || '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  const ayahNumber = parseInt(v.ayah || v.ayahNo || 0, 10);
  const surahNumber = typeof window.getSurahNo === 'function'
    ? (window.getSurahNo(v.surah) || 0)
    : 0;
  return { surahName: v.surah || '', surahNumber, ayahNumber, text };
}

function adaptGroupWithMaster(g, ms) {
  if (!g) return null;

  const allVerses = g.verses || [];
  const masterIdx = Math.min(ms.masterIndex, allVerses.length - 1);
  const masterVerse = allVerses[masterIdx];
  if (!masterVerse) return null;

  const masterParts = masterVerse.parts || [];
  const allSelected = ms.partSet.size === 0 || ms.partSet.size >= masterParts.length;
  const masterText = masterParts
    .filter((_, i) => allSelected || ms.partSet.has(i))
    .map(p => (p && p.text) || '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!masterText) return null;

  const join = arr => arr.map(p => (p && p.text) || '').join(' ').replace(/\s+/g, ' ').trim();

  // Helper: split parts into before/diff/after relative to the selected index range
  function _splitContext(parts) {
    if (allSelected || ms.partSet.size === 0) return { before: '', diff: null, after: '' };
    const minIdx = Math.min(...ms.partSet);
    const maxIdx = Math.max(...ms.partSet);
    return {
      before: join(parts.slice(0, minIdx)),
      diff:   join(parts.slice(minIdx, maxIdx + 1)),
      after:  join(parts.slice(maxIdx + 1)),
    };
  }

  const masterCtx = _splitContext(masterParts);
  const adaptedMaster = { ..._adaptVerse(masterVerse), text: masterText };
  if (masterCtx.diff !== null) {
    if (masterCtx.before) adaptedMaster.contextBefore = masterCtx.before;
    if (masterCtx.after)  adaptedMaster.contextAfter  = masterCtx.after;
  }

  const slaves = allVerses
    .map((v, origIdx) => ({ v, origIdx }))
    .filter(({ origIdx }) => origIdx !== masterIdx)
    .map(({ v, origIdx }) => {
      const adapted = _adaptVerse(v);
      const rawParts = v.parts || [];
      const slavePartSet = ms.slavePartSets.get(origIdx);

      if (slavePartSet && slavePartSet.size > 0) {
        // Explicit slave part selection — use those parts as the diff text
        const minIdx = Math.min(...slavePartSet);
        const maxIdx = Math.max(...slavePartSet);
        const diff = join(rawParts.slice(minIdx, maxIdx + 1));
        if (diff) {
          adapted.text = diff;
          const before = join(rawParts.slice(0, minIdx));
          const after  = join(rawParts.slice(maxIdx + 1));
          if (before) adapted.contextBefore = before;
          if (after)  adapted.contextAfter  = after;
        }
      } else if (!allSelected) {
        // Fall back to master-index-based splitting
        const ctx = _splitContext(rawParts);
        if (ctx.diff) {
          adapted.text = ctx.diff;
          if (ctx.before) adapted.contextBefore = ctx.before;
          if (ctx.after)  adapted.contextAfter  = ctx.after;
        } else {
          adapted.trimContext = true; // full text used; trim outer adds during rendering
        }
      }

      return adapted;
    })
    .filter(v => v.text);

  const verses = [adaptedMaster, ...slaves];
  if (verses.length < 2) return null;

  return {
    id:       String(g.id),
    title:    g.title    || '',
    diffType: g.diffType || '',
    notes:    g.note     || g.notes || '',
    verses,
  };
}

// ── Master selector UI ────────────────────────────────────────────────────────

function _buildMasterUI(g, onRefresh) {
  const ms = _getMasterState(g);
  const verses = g.verses || [];

  const bar = document.createElement('div');
  bar.className = 'dh-master-bar';

  // Row 1: "الآية المرجع:" label + verse selector pills
  const row1 = document.createElement('div');
  row1.className = 'dh-master-row1';

  const lbl1 = document.createElement('span');
  lbl1.className = 'dh-master-label';
  lbl1.textContent = 'الآية المرجع:';
  row1.appendChild(lbl1);

  const pills = document.createElement('div');
  pills.className = 'dh-master-pills';

  verses.forEach((v, i) => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'dh-master-pill' + (i === ms.masterIndex ? ' active' : '');
    const ayahNo = v.ayah || v.ayahNo || (i + 1);
    pill.textContent = `${v.surah || ''} (${ayahNo})`;
    pill.addEventListener('click', () => {
      if (ms.masterIndex === i) return;
      ms.masterIndex = i;
      _resetPartSet(ms, g);
      _persistMasterState(g, ms);
      onRefresh();
    });
    pills.appendChild(pill);
  });

  row1.appendChild(pills);
  bar.appendChild(row1);

  // Row 2: part selector (only when master has 2+ parts)
  const masterVerse = verses[ms.masterIndex];
  const rawParts = masterVerse ? (masterVerse.parts || []) : [];
  const visibleParts = rawParts.filter(p => p && p.text);

  if (visibleParts.length > 1) {
    // Ensure partSet is properly initialised for this master
    if (ms.partSet.size === 0) _resetPartSet(ms, g);

    const row2 = document.createElement('div');
    row2.className = 'dh-master-row2';

    const lbl2 = document.createElement('span');
    lbl2.className = 'dh-master-label';
    lbl2.textContent = 'جزء المرجع:';
    row2.appendChild(lbl2);

    const chipWrap = document.createElement('div');
    chipWrap.className = 'dh-part-chips';

    rawParts.forEach((part, realIdx) => {
      if (!part || !part.text) return;
      const isSelected = ms.partSet.has(realIdx);

      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className =
        `dh-part-chip dh-part-${part.type || 'normal'}${isSelected ? ' selected' : ''}`;

      // Show first 5 words, tooltip has full text
      const words = part.text.trim().split(/\s+/);
      chip.textContent = words.slice(0, 5).join(' ') + (words.length > 5 ? '…' : '');
      chip.title = part.text;

      chip.addEventListener('click', () => {
        if (isSelected) {
          if (ms.partSet.size > 1) ms.partSet.delete(realIdx); // keep at least one
        } else {
          ms.partSet.add(realIdx);
        }
        _persistMasterState(g, ms);
        onRefresh();
      });
      chip.addEventListener('contextmenu', e => {
        if (typeof window.activeDb === 'undefined' || window.activeDb !== 'personal') return;
        _showTypeMenu(e, part, newType => {
          part.type = newType;
          if (typeof window.saveDb === 'function') window.saveDb('personal');
          onRefresh();
        });
      });
      chipWrap.appendChild(chip);
    });

    // "Select all" shortcut
    const allSelected = rawParts.every((p, i) => !p || !p.text || ms.partSet.has(i));
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'dh-part-all-btn' + (allSelected ? ' active' : '');
    allBtn.textContent = 'الكل';
    allBtn.addEventListener('click', () => {
      _resetPartSet(ms, g);
      _persistMasterState(g, ms);
      onRefresh();
    });
    chipWrap.appendChild(allBtn);

    row2.appendChild(chipWrap);
    bar.appendChild(row2);
  }

  // Rows 3+: per-slave part selectors (only for slaves with 2+ visible parts)
  verses.forEach((v, verseIdx) => {
    if (verseIdx === ms.masterIndex) return;
    const slaveParts = (v.parts || []).filter(p => p && p.text);
    if (slaveParts.length <= 1) return;

    const rowS = document.createElement('div');
    rowS.className = 'dh-master-row2';

    const lblS = document.createElement('span');
    lblS.className = 'dh-master-label';
    const ayahNo = v.ayah || v.ayahNo || '';
    lblS.textContent = `جزء ${v.surah || ''} (${ayahNo}):`;
    rowS.appendChild(lblS);

    const chipWrapS = document.createElement('div');
    chipWrapS.className = 'dh-part-chips';

    const slavePartSet = ms.slavePartSets.get(verseIdx);

    (v.parts || []).forEach((part, realIdx) => {
      if (!part || !part.text) return;
      const isSelected = !slavePartSet || slavePartSet.has(realIdx);

      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className =
        `dh-part-chip dh-part-${part.type || 'normal'}${isSelected ? ' selected' : ''}`;

      const words = part.text.trim().split(/\s+/);
      chip.textContent = words.slice(0, 5).join(' ') + (words.length > 5 ? '…' : '');
      chip.title = part.text;

      chip.addEventListener('click', () => {
        let cur = ms.slavePartSets.get(verseIdx);
        if (!cur) {
          cur = new Set((v.parts || []).map((p, i) => (p && p.text ? i : null)).filter(i => i !== null));
          ms.slavePartSets.set(verseIdx, cur);
        }
        if (cur.has(realIdx)) {
          if (cur.size > 1) cur.delete(realIdx);
        } else {
          cur.add(realIdx);
        }
        _persistMasterState(g, ms);
        onRefresh();
      });
      chip.addEventListener('contextmenu', e => {
        if (typeof window.activeDb === 'undefined' || window.activeDb !== 'personal') return;
        _showTypeMenu(e, part, newType => {
          part.type = newType;
          if (typeof window.saveDb === 'function') window.saveDb('personal');
          onRefresh();
        });
      });
      chipWrapS.appendChild(chip);
    });

    const slaveAllSelected = !slavePartSet;
    const allBtnS = document.createElement('button');
    allBtnS.type = 'button';
    allBtnS.className = 'dh-part-all-btn' + (slaveAllSelected ? ' active' : '');
    allBtnS.textContent = 'الكل';
    allBtnS.addEventListener('click', () => {
      ms.slavePartSets.delete(verseIdx);
      _persistMasterState(g, ms);
      onRefresh();
    });
    chipWrapS.appendChild(allBtnS);

    rowS.appendChild(chipWrapS);
    bar.appendChild(rowS);
  });

  return bar;
}

// ── Inject into a rendered pane ───────────────────────────────────────────────

function injectIntoPane(pane) {
  if (!pane) return;

  // Only act when the "differences" tab is active
  const activeBtn = pane.querySelector('.v83-tab-btn.active');
  if (!activeBtn || activeBtn.getAttribute('data-v83-tab') !== 'differences') return;

  const panel = pane.querySelector('.v83-tab-panel');
  if (!panel) return;

  if (!_lastGroupId || typeof window.findActive !== 'function') return;

  const g = window.findActive(_lastGroupId);

  function refresh() {
    panel.innerHTML = '';

    const ms = _getMasterState(g);
    const adapted = adaptGroupWithMaster(g, ms);

    if (!adapted) {
      panel.innerHTML =
        '<div class="v83-empty">لا توجد آيات كافية للمقارنة المتقدمة — المجموعة تحتاج آيتين على الأقل.</div>';
      return;
    }

    panel.appendChild(_buildMasterUI(g, refresh));
    panel.appendChild(createDiffHighlighter(adapted, { starMode: true }));
    panel.appendChild(createAnnotationPanel(adapted, {
      onChange({ diffType, notes }) {
        if (typeof window.activeDb !== 'undefined' && window.activeDb === 'personal' && g) {
          if ('diffType' in g) g.diffType = diffType;
          if ('note'    in g) g.note     = notes;
        }
      },
    }));
  }

  refresh();
}

// ── Observer factory ──────────────────────────────────────────────────────────

function observePane(el) {
  const obs = new MutationObserver(() => {
    requestAnimationFrame(() => injectIntoPane(el));
  });
  obs.observe(el, { childList: true });
}

// ── Capture group ID BEFORE the IIFE's bubble listeners run ──────────────────

document.addEventListener('click', e => {
  const groupEl = e.target.closest('#groups .group[data-id]');
  if (groupEl) {
    const id = Number(groupEl.getAttribute('data-id'));
    if (!isNaN(id)) _lastGroupId = id;
  }
}, true /* capture phase */);

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Desktop detail pane — always present in the DOM
  const desktop = document.getElementById('detailContent');
  if (desktop) observePane(desktop);

  // Mobile sheet — created lazily by ensureMobileSheet() on first open.
  // Watch document.body so we catch the insertion.
  const bodyObs = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.id === 'v83MobileDetailSheet') {
          const content = node.querySelector('#v83MobileDetailContent');
          if (content) observePane(content);
        }
      }
    }
  });
  bodyObs.observe(document.body, { childList: true });

  // In case the sheet already exists (e.g., after hot-reload in dev)
  const existingMobile = document.getElementById('v83MobileDetailContent');
  if (existingMobile) observePane(existingMobile);

  // Also patch selectV83DetailGroup so tab-switches after a keyboard/API
  // navigation (not from a click) still have the right group ID.
  const origSelect = window.selectV83DetailGroup;
  if (typeof origSelect === 'function') {
    window.selectV83DetailGroup = function(id) {
      _lastGroupId = Number(id);
      return origSelect.apply(this, arguments);
    };
  }
});
