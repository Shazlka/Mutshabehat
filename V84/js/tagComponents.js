/**
 * tagComponents.js — TagBadge + TagSelector UI components
 *
 * Exports:
 *   createTagBadge(tagId, options?)  → HTMLElement
 *   createTagSelector(group, options?) → HTMLElement
 *
 * createTagBadge options:
 *   removable : boolean         — show × button (default false)
 *   onRemove  : function(tagId) — called when × clicked
 *   size      : 'sm' | 'md'    — default 'sm'
 *
 * createTagSelector options:
 *   onChange  : function(tagIds[]) — fired after each debounced save
 *
 * The selector element exposes:
 *   element.getTags() → string[]   — current selected tag IDs
 */

import {
  TAG_GROUPS,
  TAG_REGISTRY,
  getTag,
  saveGroupTags,
  resolveGroupTags,
} from './tags.js';

const SAVE_DELAY = 600;

// ── TagBadge ──────────────────────────────────────────────────────────────────

/**
 * Renders a single colored pill for a tag.
 * Falls back gracefully for unknown tag IDs (renders grey).
 */
export function createTagBadge(tagId, options = {}) {
  const def = getTag(tagId);
  const { removable = false, onRemove, size = 'sm' } = options;

  const badge = document.createElement('span');
  badge.className = `tb-badge tb-${size}`;
  badge.setAttribute('data-tag-id', tagId);

  if (def) {
    badge.style.cssText = [
      `color:${def.color}`,
      `background:${def.bg}`,
      `border-color:${def.border}`,
    ].join(';');
    badge.textContent = def.label;
  } else {
    // Unknown tag — render as neutral grey chip
    badge.textContent = tagId.replace(/_/g, ' ');
    badge.classList.add('tb-unknown');
  }

  if (removable) {
    const btn = document.createElement('button');
    btn.className = 'tb-remove';
    btn.type = 'button';
    btn.setAttribute('aria-label', `إزالة وسم ${def ? def.label : tagId}`);
    btn.innerHTML =
      `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (typeof onRemove === 'function') onRemove(tagId);
    });
    badge.appendChild(btn);
  }

  return badge;
}

// ── TagSelector ───────────────────────────────────────────────────────────────

/**
 * Multi-select tag picker for a group.
 * Persists selections to localStorage via tags.saveGroupTags.
 */
export function createTagSelector(group, options = {}) {
  let selectedIds = resolveGroupTags(group);
  let saveTimer = null;
  let searchQuery = '';

  const root = document.createElement('div');
  root.className = 'ts-root';
  root.dir = 'rtl';

  // Public accessor
  root.getTags = () => [...selectedIds];

  function render() {
    root.innerHTML = '';
    root.appendChild(_buildSelected());
    root.appendChild(_buildSearch());
    root.appendChild(_buildAvailable());
  }

  // ── Selected tags row ──────────────────────────────────────────────────────

  function _buildSelected() {
    const wrap = document.createElement('div');
    wrap.className = 'ts-selected';

    if (selectedIds.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'ts-empty-hint';
      empty.textContent = 'لم يتم اختيار أي وسوم بعد';
      wrap.appendChild(empty);
      return wrap;
    }

    selectedIds.forEach(id => {
      wrap.appendChild(createTagBadge(id, {
        size: 'sm',
        removable: true,
        onRemove: (tagId) => {
          selectedIds = selectedIds.filter(t => t !== tagId);
          _scheduleSave();
          render();
        },
      }));
    });

    return wrap;
  }

  // ── Search input ───────────────────────────────────────────────────────────

  function _buildSearch() {
    const wrap = document.createElement('div');
    wrap.className = 'ts-search-wrap';

    const input = document.createElement('input');
    input.className = 'ts-search';
    input.type = 'search';
    input.placeholder = 'ابحث في الوسوم…';
    input.value = searchQuery;
    input.dir = 'rtl';
    input.setAttribute('aria-label', 'بحث في الوسوم');

    input.addEventListener('input', () => {
      searchQuery = input.value.trim();
      // Rebuild only the available section to preserve focus
      const existing = root.querySelector('.ts-available');
      const fresh = _buildAvailable();
      if (existing) root.replaceChild(fresh, existing);
    });

    // Prevent form submit on Enter
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') e.preventDefault();
    });

    wrap.appendChild(input);
    return wrap;
  }

  // ── Available tags list ────────────────────────────────────────────────────

  function _buildAvailable() {
    const wrap = document.createElement('div');
    wrap.className = 'ts-available';

    const q = searchQuery.replace(/_/g, ' ').toLowerCase();

    TAG_GROUPS.forEach(group => {
      const matchingTags = group.tags.filter(tag => {
        if (!q) return true;
        const label = tag.label.toLowerCase();
        const id    = tag.id.replace(/_/g, ' ').toLowerCase();
        return label.includes(q) || id.includes(q);
      });
      if (matchingTags.length === 0) return;

      const section = document.createElement('div');
      section.className = 'ts-group';

      const groupLabel = document.createElement('div');
      groupLabel.className = 'ts-group-label';
      groupLabel.textContent = group.label;
      section.appendChild(groupLabel);

      const pills = document.createElement('div');
      pills.className = 'ts-pills';

      matchingTags.forEach(tag => {
        const isSelected = selectedIds.includes(tag.id);
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'ts-pill' + (isSelected ? ' selected' : '');
        pill.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        pill.setAttribute('data-tag-id', tag.id);
        pill.textContent = tag.label;

        if (isSelected) {
          pill.style.cssText = [
            `color:${tag.color}`,
            `background:${tag.bg}`,
            `border-color:${tag.border}`,
          ].join(';');
        }

        pill.addEventListener('click', () => {
          if (isSelected) {
            selectedIds = selectedIds.filter(t => t !== tag.id);
          } else {
            selectedIds = [...selectedIds, tag.id];
          }
          _scheduleSave();
          render();
        });

        pills.appendChild(pill);
      });

      section.appendChild(pills);
      wrap.appendChild(section);
    });

    if (wrap.childElementCount === 0) {
      const empty = document.createElement('div');
      empty.className = 'ts-no-results';
      empty.textContent = 'لا توجد وسوم تطابق البحث';
      wrap.appendChild(empty);
    }

    return wrap;
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  function _scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveGroupTags(group.id, selectedIds);
      if (typeof options.onChange === 'function') {
        options.onChange([...selectedIds]);
      }
    }, SAVE_DELAY);
  }

  render();
  return root;
}
