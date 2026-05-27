/**
 * graphDetail.js — Graph node detail side panel (Task 5.4)
 *
 * Listens for graph:node-click on #networkGraph (events bubble up from #ngCanvas).
 * Injects a slide-in panel into #ngDetailSlot showing surah metadata, group
 * count, and a sorted list of connected surahs with co-occurrence weights.
 *
 * graph:deselect closes the panel.
 */

import { buildGraphData } from './graphDataBuilder.js';

const PAGE_ID = 'networkGraph';
const SLOT_ID = 'ngDetailSlot';

let _panel = null;  // built once, reused
let _body  = null;  // scrollable content area (updated on each click)

// ── Panel builder (called once) ───────────────────────────────────────────────

function _ensurePanel() {
  if (_panel) return;
  const slot = document.getElementById(SLOT_ID);
  if (!slot) return;

  _panel = document.createElement('div');
  _panel.id        = 'ngdPanel';
  _panel.className = 'ngd-panel';
  _panel.setAttribute('role', 'complementary');
  _panel.setAttribute('aria-label', 'تفاصيل السورة');

  // Header
  const hdr = document.createElement('div');
  hdr.className = 'ngd-hdr';

  const titleEl = document.createElement('span');
  titleEl.id        = 'ngdTitle';
  titleEl.className = 'ngd-hdr-title';
  titleEl.textContent = '—';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'ngd-close';
  closeBtn.setAttribute('aria-label', 'إغلاق التفاصيل');
  closeBtn.innerHTML =
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
    ' stroke-width="2.5" stroke-linecap="round" aria-hidden="true">' +
    '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  closeBtn.addEventListener('click', () => {
    window.deselectGraphNodes?.();
  });

  hdr.appendChild(titleEl);
  hdr.appendChild(closeBtn);
  _panel.appendChild(hdr);

  // Body (scrollable)
  _body = document.createElement('div');
  _body.className = 'ngd-body';
  _panel.appendChild(_body);

  slot.appendChild(_panel);
}

// ── Show detail ───────────────────────────────────────────────────────────────

function _show(node, allNeighbourIds) {
  _ensurePanel();
  if (!_panel || !_body) return;

  // Update header
  const titleEl = document.getElementById('ngdTitle');
  if (titleEl) titleEl.textContent = node.name;

  // Build edge weight lookup (respects current filter opts)
  const opts = window.getGraphOpts?.() ?? {};
  const { edges, nodes: graphNodes } = buildGraphData({
    minWeight: opts.minWeight ?? 1,
    minCount:  opts.minCount  ?? 1,
  });

  const weightMap = new Map();
  edges.forEach(e => {
    const s = typeof e.source === 'object' ? e.source.id : e.source;
    const t = typeof e.target === 'object' ? e.target.id : e.target;
    if (s === node.id) weightMap.set(t, e.weight);
    if (t === node.id) weightMap.set(s, e.weight);
  });

  const nodeMap = new Map(graphNodes.map(n => [n.id, n]));

  const neighbourIds = allNeighbourIds
    .filter(id => id !== node.id)
    .sort((a, b) => (weightMap.get(b) ?? 0) - (weightMap.get(a) ?? 0));

  const maxW = Math.max(...neighbourIds.map(id => weightMap.get(id) ?? 0), 1);

  _body.innerHTML = '';

  // ── Node card ──────────────────────────────────────────────────────────────
  const card = document.createElement('div');
  card.className = 'ngd-card';

  const nameRow = document.createElement('div');
  nameRow.className = 'ngd-name-row';
  const nameEl = document.createElement('span');
  nameEl.className   = 'ngd-name';
  nameEl.textContent = node.name;
  const numBadge = document.createElement('span');
  numBadge.className   = 'ngd-badge';
  numBadge.textContent = node.id;
  nameRow.appendChild(nameEl);
  nameRow.appendChild(numBadge);
  card.appendChild(nameRow);

  if (node.nameEn) {
    const nameEnEl = document.createElement('div');
    nameEnEl.className   = 'ngd-name-en';
    nameEnEl.textContent = node.nameEn;
    card.appendChild(nameEnEl);
  }

  const metaRow = document.createElement('div');
  metaRow.className = 'ngd-meta';
  [`الجزء ${node.juz}`, node.type, `${node.verses} آية`].forEach(text => {
    const chip = document.createElement('span');
    chip.className   = 'ngd-chip';
    chip.textContent = text;
    metaRow.appendChild(chip);
  });
  card.appendChild(metaRow);

  const groupRow = document.createElement('div');
  groupRow.className = 'ngd-group-row';
  groupRow.innerHTML =
    '<svg class="ngd-group-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
    ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>' +
    '<path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
  const groupCount = document.createElement('span');
  groupCount.className   = 'ngd-group-count';
  groupCount.textContent = `${node.count} مجموعة`;
  groupRow.appendChild(groupCount);
  card.appendChild(groupRow);

  _body.appendChild(card);

  // ── Filter button ──────────────────────────────────────────────────────────
  const filterBtn = document.createElement('button');
  filterBtn.className = 'ngd-filter-btn';
  filterBtn.innerHTML =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
    ' stroke-width="2.5" stroke-linecap="round" aria-hidden="true">' +
    '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg> تصفية بهذه السورة';
  filterBtn.addEventListener('click', () => _filterBySurah(node));
  _body.appendChild(filterBtn);

  // ── Neighbours section ─────────────────────────────────────────────────────
  if (neighbourIds.length > 0) {
    const sec = document.createElement('div');
    sec.className = 'ngd-section';

    const secLbl = document.createElement('div');
    secLbl.className   = 'ngd-sec-label';
    secLbl.textContent = `السور المرتبطة (${neighbourIds.length})`;
    sec.appendChild(secLbl);

    const list = document.createElement('div');
    list.className = 'ngd-nb-list';

    neighbourIds.forEach(nid => {
      const nData   = nodeMap.get(nid);
      const nWeight = weightMap.get(nid) ?? 1;
      const barPct  = Math.round((nWeight / maxW) * 100);

      const row = document.createElement('div');
      row.className = 'ngd-nb-row';
      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');
      row.title = `انتقل إلى ${nData?.name ?? nid}`;
      row.addEventListener('click', () => window.selectGraphNode?.(nid));
      row.addEventListener('keydown', ev => {
        if (ev.key === 'Enter' || ev.key === ' ') window.selectGraphNode?.(nid);
      });

      const dot = document.createElement('span');
      dot.className = 'ngd-nb-dot';

      const nameSpan = document.createElement('span');
      nameSpan.className   = 'ngd-nb-name';
      nameSpan.textContent = nData?.name ?? String(nid);

      const right = document.createElement('span');
      right.className = 'ngd-nb-right';

      const weightBadge = document.createElement('span');
      weightBadge.className   = 'ngd-nb-weight';
      weightBadge.textContent = `×${nWeight}`;

      const bar = document.createElement('span');
      bar.className = 'ngd-nb-bar';
      const fill = document.createElement('span');
      fill.className   = 'ngd-nb-bar-fill';
      fill.style.width = `${barPct}%`;
      bar.appendChild(fill);

      right.appendChild(weightBadge);
      right.appendChild(bar);
      row.appendChild(dot);
      row.appendChild(nameSpan);
      row.appendChild(right);
      list.appendChild(row);
    });

    sec.appendChild(list);
    _body.appendChild(sec);
  }

  _panel.classList.add('ngd-panel--open');
}

// ── Hide ──────────────────────────────────────────────────────────────────────

function _hide() {
  _panel?.classList.remove('ngd-panel--open');
}

// ── Filter action ─────────────────────────────────────────────────────────────

async function _filterBySurah(node) {
  const db = window.activeDb || 'personal';
  if (typeof window.openDatabase === 'function') {
    window.openDatabase(db);
  } else {
    window.closeNetworkGraph?.();
  }
  if (typeof window.filterBySurahNo === 'function') {
    await window.filterBySurahNo(node.id);
  }
  if (typeof window.toast === 'function') {
    window.toast(`المعروض: ${node.name}`, 'ok');
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const page = document.getElementById(PAGE_ID);
  if (!page) return;

  page.addEventListener('graph:node-click', e => _show(e.detail.node, e.detail.neighbours));
  page.addEventListener('graph:deselect',   ()  => _hide());
});
