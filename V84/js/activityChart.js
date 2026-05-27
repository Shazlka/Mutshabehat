/**
 * activityChart.js — Study activity line chart (Task 3.3)
 *
 * Exports:
 *   logActivity(n?)         — record n events for today (localStorage)
 *   readActivityLast30()    — array of { date, label, count, isToday }
 *   renderActivityChart(el) — SVG line chart into el
 *
 * Activity key pattern: mutshabehat_act_YYYY-MM-DD → integer count.
 * Hooks into window.openDatabase (once/session) and window.saveDb
 * (per-edit, capped at 15/day) to auto-populate the chart.
 *
 * On DOMContentLoaded, wraps openDashboard() to inject the activity
 * chart after .sc-charts-row in the modal body.
 */

const ACT_NS  = 'mutshabehat_act_';
const DAYS    = 30;
const DAY_CAP = 15;            // max logged events per day from saveDb

// SVG layout constants
const VW = 360, VH = 88;
const PT = 8, PR = 8, PB = 22, PL = 8;
const IW = VW - PL - PR;      // inner width  = 344
const IH = VH - PT - PB;      // inner height = 58
const NS = 'http://www.w3.org/2000/svg';

// ── Date helpers ──────────────────────────────────────────────────────────────

function _localStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function _shortLabel(d) {
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

// ── Activity log ──────────────────────────────────────────────────────────────

export function logActivity(n = 1) {
  try {
    const key = ACT_NS + _localStr(new Date());
    const cur = parseInt(localStorage.getItem(key) || '0', 10);
    localStorage.setItem(key, String(cur + n));
  } catch { /* localStorage unavailable */ }
}

export function readActivityLast30() {
  const today = new Date();
  return Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (DAYS - 1 - i));
    const key   = ACT_NS + _localStr(d);
    const count = parseInt(localStorage.getItem(key) || '0', 10);
    return {
      date:    d,
      label:   _shortLabel(d),
      count,
      isToday: i === DAYS - 1,
    };
  });
}

// ── SVG builder ───────────────────────────────────────────────────────────────

function _el(tag, attrs = {}, text) {
  const e = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Map a data point index + count to {x, y} in SVG space. */
function _pt(i, count, max) {
  return {
    x: PL + (i / (DAYS - 1)) * IW,
    y: PT + (1 - count / max) * IH,
  };
}

// ── Render ────────────────────────────────────────────────────────────────────

export function renderActivityChart(container) {
  if (!container) return;
  // Remove any previous chart (re-render safe)
  container.querySelector('.sc-activity-svg')?.remove();
  container.querySelector('.sc-act-caption')?.remove();

  const data = readActivityLast30();
  const max  = Math.max(...data.map(d => d.count), 1); // guard div/0
  const hasData = data.some(d => d.count > 0);

  const coords = data.map((d, i) => ({ ...d, ..._pt(i, d.count, max) }));

  const svg = _el('svg', {
    viewBox:             `0 0 ${VW} ${VH}`,
    preserveAspectRatio: 'none',
    class:               'sc-activity-svg',
    'aria-label':        'نشاط الدراسة — آخر 30 يوماً',
  });

  // ── Horizontal grid lines (3 levels) ──────────────────────────
  [0.33, 0.66, 1].forEach(t => {
    const y = PT + (1 - t) * IH;
    svg.appendChild(_el('line', { x1: PL, y1: y, x2: VW - PR, y2: y, class: 'sc-act-grid' }));
  });

  if (hasData) {
    // ── Area fill ────────────────────────────────────────────────
    const baseY = PT + IH;
    const areaPts = [
      `${coords[0].x},${baseY}`,
      ...coords.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`),
      `${coords[DAYS - 1].x},${baseY}`,
    ].join(' ');
    svg.appendChild(_el('polygon', { points: areaPts, class: 'sc-act-area' }));

    // ── Line ─────────────────────────────────────────────────────
    svg.appendChild(_el('polyline', {
      points: coords.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' '),
      class:  'sc-act-line',
    }));

    // ── Dots (non-zero + today) ───────────────────────────────────
    coords.forEach(p => {
      if (p.count === 0 && !p.isToday) return;
      const dot = _el('circle', {
        cx:    p.x.toFixed(2),
        cy:    p.y.toFixed(2),
        r:     p.isToday ? '3.5' : '2.5',
        class: p.isToday ? 'sc-act-dot sc-act-dot--today' : 'sc-act-dot',
      });
      dot.appendChild(_el('title', {}, `${p.label}: ${p.count}`));
      svg.appendChild(dot);
    });
  } else {
    // ── Flat dashed baseline when no data ────────────────────────
    const baseY = PT + IH;
    svg.appendChild(_el('line', {
      x1: PL, y1: baseY, x2: VW - PR, y2: baseY,
      class: 'sc-act-line sc-act-line--empty',
    }));
    // Still show today's dot at baseline
    const last = coords[DAYS - 1];
    svg.appendChild(_el('circle', {
      cx: last.x.toFixed(2), cy: baseY, r: '3', class: 'sc-act-dot sc-act-dot--today',
    }));
  }

  // ── X-axis labels (day 0, 7, 14, 21, today) ──────────────────
  [0, 7, 14, 21, DAYS - 1].forEach(i => {
    const p = coords[i];
    svg.appendChild(_el('text', {
      x:     p.x.toFixed(2),
      y:     VH - 4,
      class: p.isToday ? 'sc-act-label sc-act-label--today' : 'sc-act-label',
    }, p.isToday ? 'اليوم' : p.label));
  });

  container.appendChild(svg);

  // ── Caption ───────────────────────────────────────────────────
  const total      = data.reduce((s, d) => s + d.count, 0);
  const activeDays = data.filter(d => d.count > 0).length;
  const caption    = document.createElement('div');
  caption.className = 'sc-act-caption';
  caption.textContent = hasData
    ? `${activeDays} يوم نشاط · ${total} حدث خلال آخر 30 يوماً`
    : 'ابدأ استخدام التطبيق لتتبع نشاطك اليومي';
  container.appendChild(caption);
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

let _sessionLogged = false;

document.addEventListener('DOMContentLoaded', () => {
  window.renderActivityChart = renderActivityChart;
  window.logActivity         = logActivity;

  // Log once per page session when a database is opened
  const _origOpenDb = window.openDatabase;
  if (typeof _origOpenDb === 'function') {
    window.openDatabase = function () {
      if (!_sessionLogged) {
        _sessionLogged = true;
        logActivity(1);
      }
      return _origOpenDb.apply(this, arguments);
    };
  }

  // Log once per meaningful personal DB save (add/edit/delete/complete/favorite)
  const _origSaveDb = window.saveDb;
  if (typeof _origSaveDb === 'function') {
    window.saveDb = function (db) {
      if (db === 'personal') {
        try {
          const key = ACT_NS + _localStr(new Date());
          const cur = parseInt(localStorage.getItem(key) || '0', 10);
          if (cur < DAY_CAP) logActivity(1);
        } catch { /* ignore */ }
      }
      return _origSaveDb.apply(this, arguments);
    };
  }

  // Inject activity chart into the dashboard modal after .sc-charts-row
  const _origOpen = window.openDashboard;
  if (typeof _origOpen === 'function') {
    window.openDashboard = function () {
      _origOpen.apply(this, arguments);

      const body = document.querySelector('#dashboardModal .modal-body');
      if (!body) return;

      const box = document.createElement('div');
      box.className = 'sc-chart-box sc-activity-box';

      const title = document.createElement('div');
      title.className = 'sc-chart-title';
      title.textContent = 'نشاط الدراسة — آخر 30 يوماً';
      box.appendChild(title);

      renderActivityChart(box);

      const after = body.querySelector('.sc-charts-row');
      if (after) after.insertAdjacentElement('afterend', box);
      else        body.appendChild(box);
    };
  }
});
