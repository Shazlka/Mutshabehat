/**
 * statsCharts.js — Bar chart + Donut chart (Task 3.2)
 *
 * Exports:
 *   computeBarData()         — top-N surahs by group count
 *   computeDonutData()       — tag category distribution
 *   renderTopSurahsChart(el) — horizontal RTL bar chart
 *   renderTagDonutChart(el)  — SVG donut chart
 *   renderChartsRow(el)      — both side-by-side in .sc-charts-row
 *
 * On DOMContentLoaded, wraps openDashboard() to inject the charts row
 * after the KPI row (inserted by statsKPI.js) in the modal body.
 */

import { getTag, loadGroupTags } from './tags.js';

const BAR_LIMIT = 10;
const NS        = 'http://www.w3.org/2000/svg';
const CX = 60, CY = 60, R_OUT = 52, R_IN = 34;

// ── Shared data helper ────────────────────────────────────────────────────────

function _data() {
  return (window.activeDb && window.activeData)
    ? window.activeData
    : [...(window.personalData || []), ...(window.automatedData || [])];
}

// ── Bar data ──────────────────────────────────────────────────────────────────

export function computeBarData() {
  const counts = new Map();
  _data().forEach(g => {
    const surahs = (g.surahs && g.surahs.length)
      ? g.surahs
      : [...new Set((g.verses || []).map(v => v.surah).filter(Boolean))];
    surahs.forEach(s => counts.set(s, (counts.get(s) || 0) + 1));
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, BAR_LIMIT);
}

// ── Donut data ────────────────────────────────────────────────────────────────

export function computeDonutData() {
  const cats = [
    { id: 'change',  label: 'نوع التغيير', color: '#0ea5e9', count: 0 },
    { id: 'theme',   label: 'الموضوع',    color: '#8b5cf6', count: 0 },
    { id: 'context', label: 'السياق',     color: '#64748b', count: 0 },
    { id: 'status',  label: 'الحالة',     color: '#10b981', count: 0 },
  ];
  const byGroup = Object.fromEntries(cats.map(c => [c.id, c]));
  _data().forEach(g => {
    const tags = loadGroupTags(g.id);
    if (!tags) return;
    tags.forEach(id => {
      const def = getTag(id);
      if (def && byGroup[def.group]) byGroup[def.group].count++;
    });
  });
  return cats.filter(c => c.count > 0);
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

function _svgEl(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

function _arcPath(cx, cy, ro, ri, a1, a2) {
  const c = Math.cos, s = Math.sin;
  const f = n => n.toFixed(3);
  const large = (a2 - a1) > Math.PI ? 1 : 0;
  return [
    `M ${f(cx + ro * c(a1))} ${f(cy + ro * s(a1))}`,
    `A ${ro} ${ro} 0 ${large} 1 ${f(cx + ro * c(a2))} ${f(cy + ro * s(a2))}`,
    `L ${f(cx + ri * c(a2))} ${f(cy + ri * s(a2))}`,
    `A ${ri} ${ri} 0 ${large} 0 ${f(cx + ri * c(a1))} ${f(cy + ri * s(a1))}`,
    'Z',
  ].join(' ');
}

// ── Render: donut ─────────────────────────────────────────────────────────────

export function renderTagDonutChart(container) {
  if (!container) return;
  container.innerHTML = '';

  const segments = computeDonutData();
  const total    = segments.reduce((s, c) => s + c.count, 0);

  if (!total) {
    const msg = document.createElement('div');
    msg.className = 'sc-empty';
    msg.textContent = 'لم يُطبَّق أي وسم بعد — وسّم المجموعات لعرض التوزيع.';
    container.appendChild(msg);
    return;
  }

  // SVG donut
  const svg = _svgEl('svg', {
    viewBox: '0 0 120 120',
    class:   'sc-donut-svg',
    'aria-label': 'توزيع فئات الوسوم',
  });

  let angle = -Math.PI / 2; // start from top
  segments.forEach(seg => {
    const span = (seg.count / total) * 2 * Math.PI;
    const path = _svgEl('path', {
      d:            _arcPath(CX, CY, R_OUT, R_IN, angle, angle + span),
      fill:         seg.color,
      stroke:       'var(--surface, #fff)',
      'stroke-width': '2',
      class:        'sc-donut-seg',
    });
    svg.appendChild(path);
    angle += span;
  });

  // Center labels
  const numTxt = _svgEl('text', { x: '60', y: '56', class: 'sc-donut-center-num' });
  numTxt.textContent = String(total);
  svg.appendChild(numTxt);

  const lblTxt = _svgEl('text', { x: '60', y: '69', class: 'sc-donut-center-lbl' });
  lblTxt.textContent = 'وسم';
  svg.appendChild(lblTxt);

  container.appendChild(svg);

  // Legend
  const legend = document.createElement('div');
  legend.className = 'sc-donut-legend';

  segments.forEach(seg => {
    const item = document.createElement('div');
    item.className = 'sc-donut-legend-item';

    const dot = document.createElement('span');
    dot.className = 'sc-donut-dot';
    dot.style.background = seg.color;

    const lbl = document.createElement('span');
    lbl.className = 'sc-donut-legend-label';
    lbl.textContent = seg.label;

    const cnt = document.createElement('span');
    cnt.className = 'sc-donut-legend-count';
    cnt.textContent = String(seg.count);

    item.appendChild(dot);
    item.appendChild(lbl);
    item.appendChild(cnt);
    legend.appendChild(item);
  });

  container.appendChild(legend);
}

// ── Render: bar chart ─────────────────────────────────────────────────────────

export function renderTopSurahsChart(container) {
  if (!container) return;
  container.innerHTML = '';

  const entries = computeBarData();

  if (!entries.length) {
    const msg = document.createElement('div');
    msg.className = 'sc-empty';
    msg.textContent = 'لا توجد بيانات متاحة.';
    container.appendChild(msg);
    return;
  }

  const max = entries[0][1];

  entries.forEach(([surah, count], i) => {
    const row = document.createElement('div');
    row.className = 'sc-bar-row';

    const lbl = document.createElement('span');
    lbl.className = 'sc-bar-label';
    lbl.textContent = surah;

    const track = document.createElement('div');
    track.className = 'sc-bar-track';

    const fill = document.createElement('div');
    fill.className = 'sc-bar-fill';
    fill.style.width = Math.round((count / max) * 100) + '%';
    fill.style.animationDelay = (i * 45) + 'ms';
    track.appendChild(fill);

    const cnt = document.createElement('span');
    cnt.className = 'sc-bar-count';
    cnt.textContent = String(count);

    row.appendChild(lbl);
    row.appendChild(track);
    row.appendChild(cnt);
    container.appendChild(row);
  });
}

// ── Render: combined row ──────────────────────────────────────────────────────

export function renderChartsRow(container) {
  if (!container) return;
  container.innerHTML = '';
  container.className = 'sc-charts-row';

  // Bar box
  const barBox = document.createElement('div');
  barBox.className = 'sc-chart-box sc-chart-box--bar';

  const barTitle = document.createElement('div');
  barTitle.className = 'sc-chart-title';
  barTitle.textContent = 'أكثر السور تكراراً';
  barBox.appendChild(barTitle);

  const barBody = document.createElement('div');
  barBody.className = 'sc-bar-chart';
  renderTopSurahsChart(barBody);
  barBox.appendChild(barBody);

  // Donut box
  const donutBox = document.createElement('div');
  donutBox.className = 'sc-chart-box sc-chart-box--donut';

  const donutTitle = document.createElement('div');
  donutTitle.className = 'sc-chart-title';
  donutTitle.textContent = 'توزيع فئات الوسوم';
  donutBox.appendChild(donutTitle);

  const donutBody = document.createElement('div');
  donutBody.className = 'sc-donut-wrap';
  renderTagDonutChart(donutBody);
  donutBox.appendChild(donutBody);

  container.appendChild(barBox);
  container.appendChild(donutBox);
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  window.renderChartsRow  = renderChartsRow;
  window.computeBarData   = computeBarData;
  window.computeDonutData = computeDonutData;

  // Inject charts row after the KPI row in the dashboard modal
  const _origOpen = window.openDashboard;
  if (typeof _origOpen === 'function') {
    window.openDashboard = function () {
      _origOpen.apply(this, arguments);
      const body = document.querySelector('#dashboardModal .modal-body');
      if (!body) return;
      const row = document.createElement('div');
      const kpiRow = body.querySelector('.kpi-row');
      if (kpiRow) kpiRow.insertAdjacentElement('afterend', row);
      else        body.insertBefore(row, body.firstChild);
      renderChartsRow(row);
    };
  }
});
