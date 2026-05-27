/**
 * statsKPI.js — KPI Cards Row (Task 3.1)
 *
 * Exports:
 *   computeKPIData()   — pure stats snapshot from activeData
 *   renderKPICards(el) — renders 5 KPI cards into el (sets kpi-row class)
 *
 * On DOMContentLoaded, wraps window.openDashboard() to prepend
 * the KPI row to the existing dashboard modal body.
 */

import { loadGroupTags } from './tags.js';

const _isTrue = v => v === true || v === 'true' || v === 1;
const RING_R    = 20;
const RING_CIRC = +(2 * Math.PI * RING_R).toFixed(4); // ≈ 125.6637

// ── Data ──────────────────────────────────────────────────────────────────────

export function computeKPIData() {
  const data = (window.activeDb && window.activeData)
    ? window.activeData
    : [...(window.personalData || []), ...(window.automatedData || [])];

  const totalGroups = data.length;
  const totalVerses = data.reduce((s, g) => s + (g.verses || []).length, 0);

  const surahSet = new Set();
  data.forEach(g => {
    (g.surahs || []).forEach(s => surahSet.add(s));
    (g.verses  || []).forEach(v => { if (v.surah) surahSet.add(v.surah); });
  });

  const completed    = data.filter(g => _isTrue(g.completed)).length;
  const taggedGroups = data.filter(g => {
    const t = loadGroupTags(g.id);
    return t && t.length > 0;
  }).length;

  return {
    totalGroups,
    totalVerses,
    totalSurahs:  surahSet.size,
    completed,
    completedPct: totalGroups > 0 ? Math.round((completed    / totalGroups) * 100) : 0,
    taggedGroups,
    taggedPct:    totalGroups > 0 ? Math.round((taggedGroups / totalGroups) * 100) : 0,
  };
}

// ── SVG Progress Ring ─────────────────────────────────────────────────────────

function _buildRing(pct, color) {
  const clamped = Math.min(100, Math.max(0, pct));
  const offset  = +(RING_CIRC * (1 - clamped / 100)).toFixed(4);

  const wrap = document.createElement('div');
  wrap.className = 'kpi-ring-wrap';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 50 50');
  svg.setAttribute('class', 'kpi-ring-svg');
  svg.setAttribute('aria-hidden', 'true');

  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bg.setAttribute('cx', '25');
  bg.setAttribute('cy', '25');
  bg.setAttribute('r',  String(RING_R));
  bg.setAttribute('class', 'kpi-ring-bg');
  svg.appendChild(bg);

  const fg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  fg.setAttribute('cx', '25');
  fg.setAttribute('cy', '25');
  fg.setAttribute('r',  String(RING_R));
  fg.setAttribute('class', 'kpi-ring-fg');
  fg.style.stroke = color;
  fg.style.setProperty('stroke-dasharray',  String(RING_CIRC));
  fg.style.setProperty('stroke-dashoffset', String(offset));
  svg.appendChild(fg);

  const pctEl = document.createElement('span');
  pctEl.className = 'kpi-ring-pct';
  pctEl.textContent = pct + '%';

  wrap.appendChild(svg);
  wrap.appendChild(pctEl);
  return wrap;
}

// ── Card builder ──────────────────────────────────────────────────────────────

function _card({ iconHtml, value, label, ring }) {
  const card = document.createElement('div');
  card.className = 'kpi-card';

  const top = document.createElement('div');
  top.className = 'kpi-card-top';

  const iconEl = document.createElement('div');
  iconEl.className = 'kpi-icon';
  iconEl.innerHTML = iconHtml;
  top.appendChild(iconEl);

  if (ring) top.appendChild(_buildRing(ring.pct, ring.color));
  card.appendChild(top);

  const valEl = document.createElement('div');
  valEl.className = 'kpi-value';
  valEl.textContent = String(value);
  card.appendChild(valEl);

  const lblEl = document.createElement('div');
  lblEl.className = 'kpi-label';
  lblEl.textContent = label;
  card.appendChild(lblEl);

  return card;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const _IC = {
  grid: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>',
  book: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  moon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  check:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  tag:  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
};

// ── Public render ─────────────────────────────────────────────────────────────

export function renderKPICards(container) {
  if (!container) return;
  const d = computeKPIData();

  container.innerHTML = '';
  container.className = 'kpi-row';

  [
    { iconHtml: _IC.grid,  value: d.totalGroups,   label: 'مجموعة إجمالاً'      },
    { iconHtml: _IC.book,  value: d.totalVerses,   label: 'آية في المجموعات'    },
    { iconHtml: _IC.moon,  value: d.totalSurahs,   label: 'سورة مشمولة'         },
    { iconHtml: _IC.check, value: d.completed,     label: 'مجموعة مكتملة',
      ring: { pct: d.completedPct, color: '#22c55e' } },
    { iconHtml: _IC.tag,   value: d.taggedGroups,  label: 'مجموعة موسومة',
      ring: { pct: d.taggedPct, color: 'var(--v83-gold, #c8a95b)' } },
  ].forEach(def => container.appendChild(_card(def)));
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  window.renderKPICards  = renderKPICards;
  window.computeKPIData  = computeKPIData;

  // Prepend KPI row to the existing openDashboard() modal
  const _origOpen = window.openDashboard;
  if (typeof _origOpen === 'function') {
    window.openDashboard = function () {
      _origOpen.apply(this, arguments);
      const body = document.querySelector('#dashboardModal .modal-body');
      if (!body) return;
      const row = document.createElement('div');
      body.insertBefore(row, body.firstChild);
      renderKPICards(row);
    };
  }
});
