/**
 * tagFilter.js — Tag-based filter panel injected into the groups sidebar.
 *
 * - Adds "فلتر الوسوم" toggle section below the existing surah filter buttons.
 * - Maintains a Set of active tag IDs; groups must have ANY active tag to pass.
 * - Patches window.passFilters to add tag gate (wraps without breaking existing logic).
 * - Calls window.renderActiveGroups() after each toggle.
 */

import { TAG_GROUPS, loadGroupTags } from './tags.js';

// ── State ─────────────────────────────────────────────────────────────────────

const _activeTagIds = new Set();
let _panelOpen = false;
let _root = null;

// ── Filter logic ──────────────────────────────────────────────────────────────

function _passTagFilter(g) {
  if (_activeTagIds.size === 0) return true;
  const persisted = loadGroupTags(g.id);
  if (!persisted || persisted.length === 0) return false;
  return persisted.some(id => _activeTagIds.has(id));
}

function _patchPassFilters() {
  const orig = window.passFilters;
  if (typeof orig !== 'function') return;
  window.passFilters = function (g) {
    return orig(g) && _passTagFilter(g);
  };
}

// ── Actions ───────────────────────────────────────────────────────────────────

function _toggleTag(tagId) {
  if (_activeTagIds.has(tagId)) {
    _activeTagIds.delete(tagId);
  } else {
    _activeTagIds.add(tagId);
  }
  _renderPanel();
  window.renderActiveGroups?.();
}

function _clearAll() {
  _activeTagIds.clear();
  _renderPanel();
  window.renderActiveGroups?.();
}

// ── UI builders ───────────────────────────────────────────────────────────────

function _buildToggleBtn() {
  const btn = document.createElement('button');
  btn.id = 'tagFilterToggleBtn';
  btn.className = 'tf-toggle-btn' + (_activeTagIds.size > 0 ? ' has-active' : '');
  btn.setAttribute('aria-expanded', _panelOpen ? 'true' : 'false');
  btn.dir = 'rtl';

  const label = document.createElement('span');
  label.textContent = 'فلتر الوسوم';

  const right = document.createElement('span');
  right.className = 'tf-toggle-right';

  if (_activeTagIds.size > 0) {
    const badge = document.createElement('span');
    badge.className = 'tf-count-badge';
    badge.textContent = _activeTagIds.size;
    right.appendChild(badge);
  }

  const arrow = document.createElement('span');
  arrow.className = 'tf-arrow';
  arrow.textContent = _panelOpen ? '▴' : '▾';
  right.appendChild(arrow);

  btn.appendChild(label);
  btn.appendChild(right);

  btn.addEventListener('click', () => {
    _panelOpen = !_panelOpen;
    _renderPanel();
  });

  return btn;
}

function _buildPanelBody() {
  const wrap = document.createElement('div');
  wrap.id = 'tagFilterPanel';
  wrap.className = 'tf-panel' + (_panelOpen ? '' : ' tf-hidden');

  TAG_GROUPS.forEach(group => {
    const section = document.createElement('div');
    section.className = 'tf-group';

    const label = document.createElement('div');
    label.className = 'tf-group-label';
    label.textContent = group.label;
    section.appendChild(label);

    const pills = document.createElement('div');
    pills.className = 'tf-pills';

    group.tags.forEach(tag => {
      const isActive = _activeTagIds.has(tag.id);
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'tf-pill' + (isActive ? ' active' : '');
      pill.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      pill.setAttribute('data-tag-id', tag.id);
      pill.textContent = tag.label;

      if (isActive) {
        pill.style.cssText = `color:${tag.color};background:${tag.bg};border-color:${tag.border}`;
      }

      pill.addEventListener('click', () => _toggleTag(tag.id));
      pills.appendChild(pill);
    });

    section.appendChild(pills);
    wrap.appendChild(section);
  });

  if (_activeTagIds.size > 0) {
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'tf-clear-btn';
    clearBtn.textContent = 'مسح فلتر الوسوم';
    clearBtn.addEventListener('click', _clearAll);
    wrap.appendChild(clearBtn);
  }

  return wrap;
}

// ── Render ────────────────────────────────────────────────────────────────────

function _renderPanel() {
  if (!_root) return;
  _root.innerHTML = '';
  _root.appendChild(_buildToggleBtn());
  _root.appendChild(_buildPanelBody());
}

// ── Injection ─────────────────────────────────────────────────────────────────

function _inject() {
  const filtersSection = document.querySelector('.v83-side-filters');
  if (!filtersSection) return;

  _root = document.createElement('div');
  _root.className = 'tf-root';
  _renderPanel();
  filtersSection.appendChild(_root);
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  _patchPassFilters();
  _inject();
});
