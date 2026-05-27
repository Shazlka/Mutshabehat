/**
 * heatmap.js — Quran Surah Heatmap (Task 4.2)
 *
 * Exports:
 *   computeHeatmapData() — Map<surahNumber, groupCount>
 *   renderHeatmap(el)    — renders 30-juz grid into el
 *
 * Each cell = one surah coloured by reference density (levels 0–4).
 * Click dispatches CustomEvent 'hm:surah-click' with { surahNumber, surahName, count }.
 */

import { SURAHS, JUZ, getSurahByNameFuzzy } from '../data/quranMeta.js';

// ── Data builder ──────────────────────────────────────────────────────────────

export function computeHeatmapData() {
  const data = (window.activeDb && window.activeData)
    ? window.activeData
    : [...(window.personalData || []), ...(window.automatedData || [])];

  const counts = new Map(); // surahNumber → groupCount

  data.forEach(g => {
    const seen = new Set(); // one count per surah per group
    const addName = name => {
      if (!name) return;
      const s = getSurahByNameFuzzy(name);
      if (s && !seen.has(s.number)) {
        seen.add(s.number);
        counts.set(s.number, (counts.get(s.number) || 0) + 1);
      }
    };
    (g.surahs || []).forEach(addName);
    (g.verses  || []).forEach(v => addName(v?.surah));
  });

  return counts;
}

// ── Density level (0–4) ───────────────────────────────────────────────────────

function _level(count, max) {
  if (!count || !max) return 0;
  const r = count / max;
  if (r <= 0.15) return 1;
  if (r <= 0.40) return 2;
  if (r <= 0.70) return 3;
  return 4;
}

// ── Render ────────────────────────────────────────────────────────────────────

export function renderHeatmap(container) {
  if (!container) return;
  container.querySelector('.hm-wrap')?.remove();

  const counts = computeHeatmapData();
  const max    = counts.size > 0 ? Math.max(...counts.values()) : 0;

  const wrap = document.createElement('div');
  wrap.className = 'hm-wrap';

  if (max === 0) {
    const empty = document.createElement('div');
    empty.className = 'sc-empty';
    empty.textContent = 'أضف مجموعات لعرض خريطة توزيعها على سور القرآن الكريم';
    wrap.appendChild(empty);
    container.appendChild(wrap);
    return;
  }

  // ── Grid ──────────────────────────────────────────────────────
  const grid = document.createElement('div');
  grid.className = 'hm-grid';
  grid.setAttribute('role', 'img');
  grid.setAttribute('aria-label', 'خريطة حرارة توزيع المجموعات على سور القرآن');

  JUZ.forEach(juz => {
    const row = document.createElement('div');
    row.className = 'hm-juz-row';

    const lbl = document.createElement('div');
    lbl.className = 'hm-juz-lbl';
    lbl.textContent = String(juz.number);
    row.appendChild(lbl);

    const cellsEl = document.createElement('div');
    cellsEl.className = 'hm-cells';

    if (juz.surahs.length === 0) {
      // Juz 2 (2:142) and Juz 5 (4:24) — no surah starts
      const cont = document.createElement('div');
      cont.className = 'hm-continue';
      cont.textContent = '↩ تابع السورة السابقة';
      cellsEl.appendChild(cont);
    } else {
      juz.surahs.forEach(sNum => {
        const s     = SURAHS[sNum - 1];
        const count = counts.get(sNum) || 0;
        const level = _level(count, max);

        const cell = document.createElement('div');
        cell.className       = `hm-cell hm-cell--${level}`;
        cell.dataset.surah   = sNum;
        cell.dataset.tooltip = count > 0
          ? `${s.name} · ${count} مجموعة`
          : `${s.name} · لا توجد مجموعات`;
        cell.setAttribute('aria-label', `${s.name}: ${count} مجموعة`);

        cell.addEventListener('click', () => {
          cell.dispatchEvent(new CustomEvent('hm:surah-click', {
            bubbles: true,
            detail:  { surahNumber: sNum, surahName: s.name, count },
          }));
        });

        cellsEl.appendChild(cell);
      });
    }

    row.appendChild(cellsEl);
    grid.appendChild(row);
  });

  wrap.appendChild(grid);
  wrap.appendChild(_buildLegend(max));
  container.appendChild(wrap);
}

function _buildLegend(max) {
  const wrap = document.createElement('div');
  wrap.className = 'hm-legend';

  const lblLow = document.createElement('span');
  lblLow.className = 'hm-legend-lbl';
  lblLow.textContent = 'لا توجد';

  const dots = document.createElement('div');
  dots.className = 'hm-legend-dots';
  [0, 1, 2, 3, 4].forEach(l => {
    const d = document.createElement('div');
    d.className = `hm-cell hm-legend-cell hm-cell--${l}`;
    d.setAttribute('aria-hidden', 'true');
    dots.appendChild(d);
  });

  const lblHigh = document.createElement('span');
  lblHigh.className = 'hm-legend-lbl';
  lblHigh.textContent = `${max}+ مجموعة`;

  wrap.appendChild(lblLow);
  wrap.appendChild(dots);
  wrap.appendChild(lblHigh);
  return wrap;
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  window.renderHeatmap      = renderHeatmap;
  window.computeHeatmapData = computeHeatmapData;
});
