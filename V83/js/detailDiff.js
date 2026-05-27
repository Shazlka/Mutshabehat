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
 * Adapter: the old data model uses { surah, ayah, parts[] } — we join
 * parts[].text into a single string so arabicDiff.js can run LCS on it.
 */

import { createDiffHighlighter } from './diffHighlighter.js';
import { createAnnotationPanel  } from './annotationPanel.js';

// Tracks the ID of the last group the user opened (set in capture phase)
let _lastGroupId = null;

// ── Format adapter ────────────────────────────────────────────────────────────

function adaptGroup(g) {
  if (!g) return null;

  const verses = (g.verses || []).map(v => {
    // Join all parts into one continuous text string
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
  }).filter(v => v.text);

  // Need at least two verses with text for a meaningful diff
  if (verses.length < 2) return null;

  return {
    id:       String(g.id),
    title:    g.title  || '',
    diffType: g.diffType || '',
    notes:    g.note   || g.notes || '',
    verses,
  };
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
  const adapted = adaptGroup(g);

  if (!adapted) {
    panel.innerHTML =
      '<div class="v83-empty">لا توجد آيات كافية للمقارنة المتقدمة — المجموعة تحتاج آيتين على الأقل.</div>';
    return;
  }

  panel.innerHTML = '';

  panel.appendChild(createDiffHighlighter(adapted));
  panel.appendChild(createAnnotationPanel(adapted, {
    onChange({ diffType, notes }) {
      // Sync back to the in-memory personal group so edits persist in session
      if (typeof window.activeDb !== 'undefined' && window.activeDb === 'personal' && g) {
        if ('diffType' in g) g.diffType = diffType;
        if ('note'    in g) g.note     = notes;
      }
    },
  }));
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
