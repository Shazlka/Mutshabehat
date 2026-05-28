/**
 * networkGraph.js — Force-directed Surah Co-occurrence Network (Task 5.2)
 *
 * Creates #networkGraph as a sibling page (same .hidden show/hide pattern).
 * Imports D3 v7 via ESM CDN and buildGraphData() from graphDataBuilder.js.
 *
 * Exports:
 *   renderNetworkGraph(container, opts) — (re)builds force simulation into el
 *   openNetworkGraph()  — navigate to graph page
 *   closeNetworkGraph() — navigate back
 *
 * Events dispatched on the canvas element:
 *   graph:node-click  { node, neighbours: number[] }
 *   graph:deselect    {}
 *
 * Slots for future tasks:
 *   #ngControlsSlot — Task 5.3 injects filter controls here
 *   #ngDetailSlot   — Task 5.4 injects node-detail panel here
 */

// D3 loaded as a UMD <script> tag in index.html — more reliable than ESM CDN import
const d3 = window.d3;
import { buildGraphData } from './graphDataBuilder.js';

const PAGE_ID   = 'networkGraph';
const CANVAS_ID = 'ngCanvas';

// ── Visual constants ───────────────────────────────────────────────────────────
const R_MIN           = 5;   // minimum node radius (px)
const R_MAX           = 28;  // maximum node radius (px)
const W_MIN           = 1;   // minimum edge stroke-width
const W_MAX           = 7;   // maximum edge stroke-width
const LABEL_THRESHOLD = 4;   // always-visible label when node count ≥ this

// Juz-band colours: early / middle / late Quran
const _JUZ_HUE   = ['#3b82f6', '#8b5cf6', '#14b8a6'];
const _juzColor  = n => n.juz <= 10 ? _JUZ_HUE[0] : n.juz <= 20 ? _JUZ_HUE[1] : _JUZ_HUE[2];

// Revelation-type colours (used when colorMode === 'type')
const _TYPE_COLOR = { 'مكي': '#f59e0b', 'مدني': '#0ea5e9' };
const _nodeColor  = d => _curOpts.colorMode === 'type'
  ? (_TYPE_COLOR[d.type] ?? '#94a3b8')
  : _juzColor(d);

// ── Module state ───────────────────────────────────────────────────────────────
let _sim      = null;
let _prevSec  = 'home';
let _curOpts  = {};

// Live D3 selections — updated on every render, used by selectGraphNode
let _nodeSel  = null;
let _linkSel  = null;
let _canvasEl = null;

// ── Helpers ────────────────────────────────────────────────────────────────────

/** D3 resolves link source/target from integers to node objects after layout starts. */
const _nid = x => (x && typeof x === 'object') ? x.id : x;

// ── Page builder ───────────────────────────────────────────────────────────────

function _buildPage() {
  const page = document.createElement('section');
  page.id        = PAGE_ID;
  page.className = 'ng-page hidden';
  page.dir       = 'rtl';
  page.setAttribute('aria-label', 'شبكة سور القرآن الكريم');

  // ── Header ───────────────────────────────────────────────────────────────────
  const hdr = document.createElement('div');
  hdr.className = 'ng-hdr';

  const backBtn = document.createElement('button');
  backBtn.className = 'ng-nav-btn';
  backBtn.setAttribute('aria-label', 'العودة');
  backBtn.innerHTML =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg> العودة';
  backBtn.addEventListener('click', closeNetworkGraph);

  const titleEl = document.createElement('h2');
  titleEl.className   = 'ng-title';
  titleEl.textContent = 'شبكة السور';

  const refreshBtn = document.createElement('button');
  refreshBtn.className = 'ng-nav-btn';
  refreshBtn.setAttribute('aria-label', 'تحديث');
  refreshBtn.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> تحديث';
  refreshBtn.addEventListener('click', () => _initRender());

  hdr.appendChild(backBtn);
  hdr.appendChild(titleEl);
  hdr.appendChild(refreshBtn);
  page.appendChild(hdr);

  // ── Main area ─────────────────────────────────────────────────────────────────
  const main = document.createElement('div');
  main.className = 'ng-main';

  // Canvas (D3 SVG injected here)
  const canvas = document.createElement('div');
  canvas.id        = CANVAS_ID;
  canvas.className = 'ng-canvas';
  main.appendChild(canvas);

  // Stats badge (bottom-left overlay)
  const stats = document.createElement('div');
  stats.id        = 'ngStats';
  stats.className = 'ng-stats';
  main.appendChild(stats);

  // Legend (bottom-right overlay)
  const legend = document.createElement('div');
  legend.className = 'ng-legend';
  legend.innerHTML =
    `<div class="ng-legend-item"><span class="ng-legend-dot" style="background:${_JUZ_HUE[0]}"></span>جزء ١–١٠</div>` +
    `<div class="ng-legend-item"><span class="ng-legend-dot" style="background:${_JUZ_HUE[1]}"></span>جزء ١١–٢٠</div>` +
    `<div class="ng-legend-item"><span class="ng-legend-dot" style="background:${_JUZ_HUE[2]}"></span>جزء ٢١–٣٠</div>`;
  main.appendChild(legend);

  // Slots for Tasks 5.3 and 5.4
  const ctrlSlot = document.createElement('div');
  ctrlSlot.id        = 'ngControlsSlot';
  ctrlSlot.className = 'ng-controls-slot';
  main.appendChild(ctrlSlot);

  const detailSlot = document.createElement('div');
  detailSlot.id        = 'ngDetailSlot';
  detailSlot.className = 'ng-detail-slot';
  main.appendChild(detailSlot);

  page.appendChild(main);
  return page;
}

// ── Renderer ───────────────────────────────────────────────────────────────────

export function renderNetworkGraph(container, options = {}) {
  _sim?.stop();
  container.innerHTML = '';
  _curOpts = { ...options };

  const { minWeight = 1, minCount = 1 } = _curOpts;
  const { nodes, edges, meta } = buildGraphData({ minWeight, minCount });

  _updateStats(meta);

  if (nodes.length === 0) {
    const empty = document.createElement('div');
    empty.className   = 'ng-empty';
    empty.textContent = 'لا توجد بيانات كافية — أضف مجموعات لبناء الشبكة';
    container.appendChild(empty);
    return;
  }

  const W = container.clientWidth  || 800;
  const H = container.clientHeight || 560;

  // Scale functions
  const rScale = d3.scaleSqrt()
    .domain([1, Math.max(meta.maxCount, 1)])
    .range([R_MIN, R_MAX])
    .clamp(true);

  const wScale = d3.scaleLinear()
    .domain([1, Math.max(meta.maxWeight, 1)])
    .range([W_MIN, W_MAX])
    .clamp(true);

  // Clone data — D3 mutates objects in-place for simulation
  const simNodes = nodes.map(n => ({ ...n }));
  const simEdges = edges.map(e => ({ ...e }));

  // ── Circular Mushaf-order layout ──────────────────────────────────────────────
  // Sort by surah number so they appear 1→114 clockwise from 12 o'clock
  simNodes.sort((a, b) => a.id - b.id);

  const cx = W / 2, cy = H / 2;
  // Radius large enough that R_MIN nodes don't overlap (min spacing = 2*R_MIN + 6px)
  const minSpacing = 2 * R_MIN + 6;
  const R_CIRCLE = Math.max(
    (simNodes.length * minSpacing) / (2 * Math.PI),
    Math.min(W, H) * 0.35
  );

  simNodes.forEach((n, i) => {
    const angle = (i / simNodes.length) * 2 * Math.PI - Math.PI / 2; // start at 12 o'clock
    n._angle = angle;
    n.x = n.fx = cx + R_CIRCLE * Math.cos(angle);
    n.y = n.fy = cy + R_CIRCLE * Math.sin(angle);
  });

  // ── SVG ──────────────────────────────────────────────────────────────────────
  const svg = d3.select(container)
    .append('svg')
    .attr('class', 'ng-svg')
    .attr('width',  '100%')
    .attr('height', '100%')
    .attr('aria-label', 'شبكة سور القرآن الكريم');

  const root = svg.append('g').attr('class', 'ng-root');

  const zoomBehavior = d3.zoom()
    .scaleExtent([0.05, 5])
    .on('zoom', ev => root.attr('transform', ev.transform));

  svg.call(zoomBehavior);

  // Fit the full circle + labels in viewport on first render
  const fitScale = Math.min((W - 100) / (2 * R_CIRCLE + 80), (H - 100) / (2 * R_CIRCLE + 80));
  if (fitScale < 0.95) {
    svg.call(
      zoomBehavior.transform,
      d3.zoomIdentity.translate(W / 2, H / 2).scale(fitScale).translate(-cx, -cy)
    );
  }

  // ── Circle guide ring (Mushaf-order rail) ─────────────────────────────────────
  root.append('circle')
    .attr('cx', cx).attr('cy', cy)
    .attr('r', R_CIRCLE)
    .attr('class', 'ng-circle-guide');

  // ── Links ─────────────────────────────────────────────────────────────────────
  const link = root.append('g')
    .attr('class', 'ng-links')
    .selectAll('line')
    .data(simEdges)
    .join('line')
    .attr('class', 'ng-link')
    .style('stroke-width', e => wScale(e.weight));

  // ── Nodes ─────────────────────────────────────────────────────────────────────
  const node = root.append('g')
    .attr('class', 'ng-nodes')
    .selectAll('g')
    .data(simNodes, d => d.id)
    .join('g')
    .attr('class', 'ng-node')
    .call(
      d3.drag()
        .on('start', (ev, d) => { if (!ev.active) _sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag',  (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
        .on('end',   (ev)    => { if (!ev.active) _sim.alphaTarget(0); })
    );

  node.append('circle')
    .attr('class', 'ng-node-circle')
    .attr('r',    d => rScale(d.count))
    .style('fill', _nodeColor);

  // Labels point radially outward from the circle center
  node.append('text')
    .attr('class', d => 'ng-node-lbl' + (d.count >= LABEL_THRESHOLD ? ' ng-node-lbl--show' : ''))
    .attr('dx', d => Math.cos(d._angle) * (rScale(d.count) + 9))
    .attr('dy', d => Math.sin(d._angle) * (rScale(d.count) + 9) + 4)
    .attr('text-anchor', d => {
      const cos = Math.cos(d._angle);
      return cos < -0.25 ? 'end' : cos > 0.25 ? 'start' : 'middle';
    })
    .text(d => d.name);

  node.append('title').text(d =>
    `${d.name} (${d.id})\n${d.count} مجموعة · الجزء ${d.juz} · ${d.type}`
  );

  // ── Interactions ──────────────────────────────────────────────────────────────
  node
    .on('click', (ev, d) => {
      ev.stopPropagation();
      _selectNode(d, node, link, container);
    })
    .on('dblclick', (ev, d) => {
      ev.stopPropagation();
      d.fx = null;
      d.fy = null;
      _sim.alphaTarget(0.1).restart();
    });

  svg.on('click', () => _deselectAll(node, link, container));

  // Store live selections for selectGraphNode / deselectGraphNodes
  _nodeSel  = node;
  _linkSel  = link;
  _canvasEl = container;

  _updateLegend();

  // ── Simulation (minimal — nodes pinned via fx/fy; only needed to resolve link
  //   source/target references and support drag dynamics) ────────────────────────
  _sim = d3.forceSimulation(simNodes)
    .force('link',
      d3.forceLink(simEdges).id(d => d.id).strength(0)
    )
    .force('charge', d3.forceManyBody().strength(-15))
    .on('tick', () => {
      link
        .attr('x1', e => e.source.x ?? 0)
        .attr('y1', e => e.source.y ?? 0)
        .attr('x2', e => e.target.x ?? 0)
        .attr('y2', e => e.target.y ?? 0);
      node.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });
}

// ── Selection ─────────────────────────────────────────────────────────────────

function _selectNode(d, node, link, container) {
  // Collect all surah ids connected to d (including d itself)
  const connected = new Set([d.id]);
  link.each(e => {
    const s = _nid(e.source), t = _nid(e.target);
    if (s === d.id) connected.add(t);
    if (t === d.id) connected.add(s);
  });

  node
    .classed('ng-node--sel', n => n.id === d.id)
    .classed('ng-node--dim', n => !connected.has(n.id));

  link
    .classed('ng-link--hi',  e => _nid(e.source) === d.id || _nid(e.target) === d.id)
    .classed('ng-link--dim', e => _nid(e.source) !== d.id && _nid(e.target) !== d.id);

  container.dispatchEvent(new CustomEvent('graph:node-click', {
    bubbles: true,
    detail:  { node: d, neighbours: [...connected] },
  }));
}

function _deselectAll(node, link, container) {
  node.classed('ng-node--sel', false).classed('ng-node--dim', false);
  link.classed('ng-link--hi',  false).classed('ng-link--dim', false);
  container.dispatchEvent(new CustomEvent('graph:deselect', { bubbles: true }));
}

// ── Stats badge ───────────────────────────────────────────────────────────────

function _updateStats(meta) {
  const el = document.getElementById('ngStats');
  if (!el || !meta) return;
  el.textContent = `${meta.totalNodes} سورة · ${meta.totalEdges} رابط`;
}

// ── Legend ────────────────────────────────────────────────────────────────────

function _updateLegend() {
  const el = document.querySelector('.ng-legend');
  if (!el) return;
  if (_curOpts.colorMode === 'type') {
    el.innerHTML =
      `<div class="ng-legend-item"><span class="ng-legend-dot" style="background:${_TYPE_COLOR['مكي']}"></span>مكي</div>` +
      `<div class="ng-legend-item"><span class="ng-legend-dot" style="background:${_TYPE_COLOR['مدني']}"></span>مدني</div>`;
  } else {
    el.innerHTML =
      `<div class="ng-legend-item"><span class="ng-legend-dot" style="background:${_JUZ_HUE[0]}"></span>جزء ١–١٠</div>` +
      `<div class="ng-legend-item"><span class="ng-legend-dot" style="background:${_JUZ_HUE[1]}"></span>جزء ١١–٢٠</div>` +
      `<div class="ng-legend-item"><span class="ng-legend-dot" style="background:${_JUZ_HUE[2]}"></span>جزء ٢١–٣٠</div>`;
  }
}

// ── External selection API (used by graphControls + graphDetail) ──────────────

/** Highlight a surah node by number without rebuilding the simulation. */
export function selectGraphNode(surahNum) {
  if (!_nodeSel || !_linkSel || !_canvasEl) return;
  const d = _nodeSel.data().find(n => n.id === surahNum);
  if (d) _selectNode(d, _nodeSel, _linkSel, _canvasEl);
}

/** Clear all selection state without rebuilding the simulation. */
export function deselectGraphNodes() {
  if (!_nodeSel || !_linkSel || !_canvasEl) return;
  _deselectAll(_nodeSel, _linkSel, _canvasEl);
}

// ── Init / re-render ──────────────────────────────────────────────────────────

function _initRender() {
  const canvas = document.getElementById(CANVAS_ID);
  if (!canvas) return;
  // setTimeout(0) lets the browser finish layout before reading clientWidth/Height
  setTimeout(() => renderNetworkGraph(canvas, _curOpts), 0);
}

// ── Navigation ────────────────────────────────────────────────────────────────

function _setNavActive(key) {
  document.querySelectorAll('.header-actions [data-nav]').forEach(b => b.classList.remove('active'));
  if (key) document.querySelector(`.header-actions [data-nav="${key}"]`)?.classList.add('active');
}

function _closeSilently() {
  _sim?.stop();
  document.getElementById(PAGE_ID)?.classList.add('hidden');
  _setNavActive(null);
}

export function openNetworkGraph() {
  _prevSec = document.getElementById('workspace')?.classList.contains('hidden') === false
    ? 'workspace' : 'home';

  ['home', 'workspace', 'statsDashboard'].forEach(id =>
    document.getElementById(id)?.classList.add('hidden')
  );
  document.getElementById(PAGE_ID)?.classList.remove('hidden');
  _setNavActive('graph');
  _initRender();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

export function closeNetworkGraph() {
  _sim?.stop();
  document.getElementById(PAGE_ID)?.classList.add('hidden');
  document.getElementById(_prevSec)?.classList.remove('hidden');
  const navKey = _prevSec === 'workspace'
    ? (window.activeDb === 'personal' ? 'personal' : 'automated')
    : 'home';
  _setNavActive(navKey);
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const page      = _buildPage();
  const modalRoot = document.getElementById('modalRoot');
  if (modalRoot) modalRoot.before(page);
  else           document.body.appendChild(page);

  window.openNetworkGraph    = openNetworkGraph;
  window.closeNetworkGraph   = closeNetworkGraph;
  window.renderNetworkGraph  = renderNetworkGraph;
  window.selectGraphNode     = selectGraphNode;
  window.deselectGraphNodes  = deselectGraphNodes;
  window.getGraphOpts        = () => ({ ..._curOpts });

  // Close graph cleanly when navigating via header buttons
  const _origOpenHome = window.openHome;
  if (typeof _origOpenHome === 'function') {
    window.openHome = function () { _closeSilently(); return _origOpenHome.apply(this, arguments); };
  }
  const _origOpenDb = window.openDatabase;
  if (typeof _origOpenDb === 'function') {
    window.openDatabase = function () { _closeSilently(); return _origOpenDb.apply(this, arguments); };
  }
});
