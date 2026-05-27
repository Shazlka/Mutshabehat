/**
 * statsDashboard.js — Full Statistics Dashboard Page (Task 3.4)
 *
 * Creates #statsDashboard as a sibling to #home / #workspace
 * (same show/hide pattern, no z-index fighting).
 * Replaces window.openDashboard() with openStatsDashboard().
 *
 * Composes:
 *   Task 3.1 — renderKPICards()      (statsKPI.js)
 *   Task 3.2 — renderChartsRow()     (statsCharts.js)
 *   Task 3.3 — renderActivityChart() (activityChart.js)
 * Plus a coloured detail grid mirroring the original dash-card data.
 */

import { renderKPICards }      from './statsKPI.js';
import { renderChartsRow }     from './statsCharts.js';
import { renderActivityChart } from './activityChart.js';

const PAGE_ID = 'statsDashboard';
const _isTrue  = v => v === true || v === 'true' || v === 1;

let _prevSection = 'home'; // track what was visible before opening

// ── Page builder ──────────────────────────────────────────────────────────────

function _buildPage() {
  const page = document.createElement('section');
  page.id        = PAGE_ID;
  page.className = 'stats-dash-page hidden';
  page.dir       = 'rtl';
  page.setAttribute('aria-label', 'لوحة الإحصائيات');

  // Header (non-sticky — sits at top of scrolling page)
  const hdr = document.createElement('div');
  hdr.className = 'stats-dash-hdr';

  const backBtn = document.createElement('button');
  backBtn.className = 'stats-dash-nav-btn';
  backBtn.setAttribute('aria-label', 'العودة');
  backBtn.innerHTML =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>' +
    ' العودة';
  backBtn.addEventListener('click', closeStatsDashboard);

  const titleEl = document.createElement('h2');
  titleEl.className = 'stats-dash-title';
  titleEl.textContent = 'الإحصائيات';

  const refreshBtn = document.createElement('button');
  refreshBtn.className = 'stats-dash-nav-btn';
  refreshBtn.setAttribute('aria-label', 'تحديث');
  refreshBtn.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>' +
    ' تحديث';
  refreshBtn.addEventListener('click', () => {
    _renderBody();
    if (typeof toast === 'function') toast('تم تحديث الإحصائيات', 'ok');
  });

  hdr.appendChild(backBtn);
  hdr.appendChild(titleEl);
  hdr.appendChild(refreshBtn);
  page.appendChild(hdr);

  // Scrollable body (content injected by _renderBody)
  const body = document.createElement('div');
  body.className = 'stats-dash-body';
  body.id = 'statsDashBody';
  page.appendChild(body);

  return page;
}

// ── Body renderer ─────────────────────────────────────────────────────────────

function _renderBody() {
  const body = document.getElementById('statsDashBody');
  if (!body) return;
  body.innerHTML = '';

  // 1 — KPI row
  const kpiWrap = document.createElement('div');
  renderKPICards(kpiWrap);
  body.appendChild(kpiWrap);

  // 2 — Bar + donut charts
  const chartsWrap = document.createElement('div');
  renderChartsRow(chartsWrap);
  body.appendChild(chartsWrap);

  // 3 — Activity line chart
  const actBox = document.createElement('div');
  actBox.className = 'sc-chart-box sc-activity-box';
  const actTitle = document.createElement('div');
  actTitle.className = 'sc-chart-title';
  actTitle.textContent = 'نشاط الدراسة — آخر 30 يوماً';
  actBox.appendChild(actTitle);
  renderActivityChart(actBox);
  body.appendChild(actBox);

  // 4 — Detail summary grid
  body.appendChild(_buildDetailGrid());
}

// ── Detail grid ───────────────────────────────────────────────────────────────

function _buildDetailGrid() {
  const active   = (window.activeDb && window.activeData)
    ? window.activeData
    : [...(window.personalData || []), ...(window.automatedData || [])];
  const personal = window.personalData  || [];
  const auto     = window.automatedData || [];

  const sSet = new Set();
  active.forEach(g => {
    (g.surahs || []).forEach(s => sSet.add(s));
    (g.verses  || []).forEach(v => { if (v.surah) sSet.add(v.surah); });
  });

  const rows = [
    { label: 'الشخصية',   value: personal.length,                                       color: '#8b5cf6' },
    { label: 'الآلية',    value: auto.length,                                            color: '#0ea5e9' },
    { label: 'المجموع',   value: active.length,                                          color: 'var(--primary)' },
    { label: 'الآيات',    value: active.reduce((s, g) => s + (g.verses || []).length, 0), color: '#10b981' },
    { label: 'السور',     value: sSet.size,                                              color: '#f59e0b' },
    { label: 'المفضلة',   value: active.filter(g => _isTrue(g.favorite)).length,         color: '#ec4899' },
    { label: 'المكتملة',  value: active.filter(g => _isTrue(g.completed)).length,        color: '#22c55e' },
    { label: 'المقفلة',   value: active.filter(g => _isTrue(g.locked)).length,           color: '#64748b' },
  ];

  const sec = document.createElement('div');
  sec.className = 'stats-dash-detail-sec';

  const secTitle = document.createElement('div');
  secTitle.className = 'sc-chart-title';
  secTitle.textContent = 'ملخص تفصيلي';
  sec.appendChild(secTitle);

  const grid = document.createElement('div');
  grid.className = 'stats-dash-detail-grid';
  rows.forEach(({ label, value, color }) => {
    const card = document.createElement('div');
    card.className = 'stats-dash-detail-card';

    const val = document.createElement('div');
    val.className = 'stats-dash-detail-val';
    val.style.color = color;
    val.textContent = String(value);

    const lbl = document.createElement('div');
    lbl.className = 'stats-dash-detail-lbl';
    lbl.textContent = label;

    card.appendChild(val);
    card.appendChild(lbl);
    grid.appendChild(card);
  });
  sec.appendChild(grid);
  return sec;
}

// ── Navigation helpers ────────────────────────────────────────────────────────

function _setNavActive(key) {
  document.querySelectorAll('.header-actions [data-nav]').forEach(b => b.classList.remove('active'));
  if (key) document.querySelector(`.header-actions [data-nav="${key}"]`)?.classList.add('active');
}

/** Close dashboard without restoring the previous section (used by nav patches). */
function _closeSilently() {
  document.getElementById(PAGE_ID)?.classList.add('hidden');
  _setNavActive(null);
}

export function openStatsDashboard() {
  // Remember context
  _prevSection = document.getElementById('workspace')?.classList.contains('hidden') === false
    ? 'workspace' : 'home';

  document.getElementById('home')?.classList.add('hidden');
  document.getElementById('workspace')?.classList.add('hidden');
  document.getElementById(PAGE_ID)?.classList.remove('hidden');
  _setNavActive('dashboard');
  _renderBody();

  // Scroll to top of page
  window.scrollTo({ top: 0, behavior: 'instant' });
}

export function closeStatsDashboard() {
  document.getElementById(PAGE_ID)?.classList.add('hidden');
  document.getElementById(_prevSection)?.classList.remove('hidden');

  // Restore header active state
  const navKey = _prevSection === 'workspace'
    ? (window.activeDb === 'personal' ? 'personal' : 'automated')
    : 'home';
  _setNavActive(navKey);
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Inject page before #modalRoot (so modals render above it at z-index 600)
  const page      = _buildPage();
  const modalRoot = document.getElementById('modalRoot');
  if (modalRoot) modalRoot.before(page);
  else           document.body.appendChild(page);

  // Expose globally
  window.openStatsDashboard  = openStatsDashboard;
  window.closeStatsDashboard = closeStatsDashboard;

  // Replace the old modal-based openDashboard entirely
  window.openDashboard = openStatsDashboard;

  // Patch openHome() so clicking "الرئيسية" while dashboard is open works cleanly
  const _origOpenHome = window.openHome;
  if (typeof _origOpenHome === 'function') {
    window.openHome = function () {
      _closeSilently();
      return _origOpenHome.apply(this, arguments);
    };
  }

  // Patch openDatabase() (already wrapped by activityChart.js — we wrap again)
  const _origOpenDb = window.openDatabase;
  if (typeof _origOpenDb === 'function') {
    window.openDatabase = function () {
      _closeSilently();
      return _origOpenDb.apply(this, arguments);
    };
  }
});
