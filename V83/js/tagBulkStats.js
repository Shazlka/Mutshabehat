/**
 * tagBulkStats.js — TagStatsBar + BulkTagModal
 *
 * TagStatsBar  : compact strip above #groups showing tag usage counts.
 * BulkTagModal : apply/replace tags on multiple groups at once.
 *
 * Exposed on window: openBulkTagModal()
 */

import { TAG_GROUPS, getTag, loadGroupTags, saveGroupTags } from './tags.js';

const MODAL_ID = 'bulkTagModal';

// ── TagStatsBar ───────────────────────────────────────────────────────────────

function _countTags() {
  const counts = new Map();
  (window.activeData || []).forEach(g => {
    const tags = loadGroupTags(g.id);
    if (tags) tags.forEach(id => counts.set(id, (counts.get(id) || 0) + 1));
  });
  return counts;
}

function renderTagStatsBar() {
  const bar = document.getElementById('tagStatsBar');
  if (!bar) return;
  const counts = _countTags();

  bar.innerHTML = '';

  if (counts.size === 0) {
    bar.classList.add('tf-stats-empty');
    return;
  }
  bar.classList.remove('tf-stats-empty');

  const lbl = document.createElement('span');
  lbl.className = 'tf-stats-lbl';
  lbl.textContent = 'الوسوم:';
  bar.appendChild(lbl);

  [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([tagId, count]) => {
      const def = getTag(tagId);
      if (!def) return;
      const chip = document.createElement('span');
      chip.className = 'tf-stat-chip';
      chip.style.cssText = `color:${def.color};background:${def.bg};border-color:${def.border}`;
      chip.title = `${def.label}: ${count} مجموعة`;
      chip.innerHTML =
        `<span class="tf-stat-label">${def.label}</span>` +
        `<span class="tf-stat-num">${count}</span>`;
      bar.appendChild(chip);
    });

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tf-bulk-btn';
  btn.textContent = 'وسم جماعي';
  btn.addEventListener('click', openBulkTagModal);
  bar.appendChild(btn);
}

function _injectStatsBar() {
  if (document.getElementById('tagStatsBar')) return;
  const groups = document.getElementById('groups');
  if (!groups) return;
  const bar = document.createElement('div');
  bar.id = 'tagStatsBar';
  bar.className = 'tf-stats-bar tf-stats-empty';
  groups.parentElement.insertBefore(bar, groups);
}

// ── BulkTagModal — state ──────────────────────────────────────────────────────

let _selGroupIds = new Set();
let _selTagIds = new Set();
let _applyMode = 'add';

function _getVisible() {
  const data = window.activeData || [];
  const pf = window.passFilters;
  return typeof pf === 'function' ? data.filter(pf) : data;
}

// ── BulkTagModal — helpers ────────────────────────────────────────────────────

function _updateApplyBtn() {
  const btn = document.querySelector(`#${MODAL_ID} .tbm-apply-btn`);
  if (!btn) return;
  const n = _selGroupIds.size;
  const t = _selTagIds.size;
  const ready = n > 0 && t > 0;
  btn.disabled = !ready;
  btn.classList.toggle('tbm-btn-dim', !ready);
  if (n === 0) btn.textContent = 'اختر مجموعات أولاً';
  else if (t === 0) btn.textContent = 'اختر وسوماً أولاً';
  else btn.textContent = `تطبيق ${t} وسم على ${n} مجموعة`;
}

function _buildGroupList(visible) {
  const wrap = document.createElement('div');
  wrap.className = 'tbm-group-list';

  if (visible.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'tbm-empty';
    empty.textContent = 'لا توجد مجموعات مرئية حالياً';
    wrap.appendChild(empty);
    return wrap;
  }

  visible.forEach(g => {
    const row = document.createElement('label');
    row.className = 'tbm-group-row' + (_selGroupIds.has(g.id) ? ' is-checked' : '');

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.className = 'tbm-checkbox';
    chk.checked = _selGroupIds.has(g.id);
    chk.addEventListener('change', () => {
      if (chk.checked) { _selGroupIds.add(g.id); row.classList.add('is-checked'); }
      else             { _selGroupIds.delete(g.id); row.classList.remove('is-checked'); }
      _updateApplyBtn();
    });

    const num = document.createElement('span');
    num.className = 'tbm-grp-num';
    num.textContent = g.id;

    const title = document.createElement('span');
    title.className = 'tbm-grp-title';
    const raw = typeof stripTashkeel === 'function'
      ? stripTashkeel(g.title || '')
      : (g.title || '');
    title.textContent = raw || 'بدون عنوان';

    row.appendChild(chk);
    row.appendChild(num);
    row.appendChild(title);

    const existing = loadGroupTags(g.id);
    if (existing && existing.length > 0) {
      const tagWrap = document.createElement('span');
      tagWrap.className = 'tbm-grp-tags';
      existing.slice(0, 3).forEach(id => {
        const def = getTag(id);
        if (!def) return;
        const chip = document.createElement('span');
        chip.className = 'tbm-grp-tag-chip';
        chip.style.cssText = `color:${def.color};background:${def.bg};border-color:${def.border}`;
        chip.textContent = def.label;
        tagWrap.appendChild(chip);
      });
      if (existing.length > 3) {
        const more = document.createElement('span');
        more.className = 'tbm-grp-tag-more';
        more.textContent = `+${existing.length - 3}`;
        tagWrap.appendChild(more);
      }
      row.appendChild(tagWrap);
    }

    wrap.appendChild(row);
  });

  return wrap;
}

function _buildTagPicker() {
  const wrap = document.createElement('div');
  wrap.className = 'tbm-tag-picker';

  TAG_GROUPS.forEach(grp => {
    const row = document.createElement('div');
    row.className = 'tbm-tag-row';

    const cat = document.createElement('span');
    cat.className = 'tbm-tag-cat';
    cat.textContent = grp.label;
    row.appendChild(cat);

    const pills = document.createElement('span');
    pills.className = 'tbm-tag-pills';
    grp.tags.forEach(tag => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'tf-pill' + (_selTagIds.has(tag.id) ? ' active' : '');
      pill.setAttribute('aria-pressed', _selTagIds.has(tag.id) ? 'true' : 'false');
      pill.setAttribute('data-tag-id', tag.id);
      pill.textContent = tag.label;
      if (_selTagIds.has(tag.id)) {
        pill.style.cssText = `color:${tag.color};background:${tag.bg};border-color:${tag.border}`;
      }
      pill.addEventListener('click', () => {
        if (_selTagIds.has(tag.id)) {
          _selTagIds.delete(tag.id);
          pill.classList.remove('active');
          pill.setAttribute('aria-pressed', 'false');
          pill.style.cssText = '';
        } else {
          _selTagIds.add(tag.id);
          pill.classList.add('active');
          pill.setAttribute('aria-pressed', 'true');
          pill.style.cssText = `color:${tag.color};background:${tag.bg};border-color:${tag.border}`;
        }
        _updateApplyBtn();
      });
      pills.appendChild(pill);
    });
    row.appendChild(pills);
    wrap.appendChild(row);
  });

  return wrap;
}

// ── BulkTagModal — builder ────────────────────────────────────────────────────

function _buildModal() {
  const visible = _getVisible();

  const backdrop = document.createElement('section');
  backdrop.id = MODAL_ID;
  backdrop.className = 'modal-backdrop';
  backdrop.addEventListener('click', e => { if (e.target === backdrop) _closeModal(); });

  const win = document.createElement('div');
  win.className = 'modal bulkTagModal-window tbm-window';
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-modal', 'true');
  win.dir = 'rtl';

  // ── Header ──────────────────────────────────────────────────────────────────
  const head = document.createElement('div');
  head.className = 'modal-head';
  head.innerHTML = '<span class="modal-drag-handle"></span><h2>وسم المجموعات بشكل جماعي</h2>';
  const xBtn = document.createElement('button');
  xBtn.className = 'modal-close-btn icon-outline';
  xBtn.setAttribute('aria-label', 'إغلاق');
  xBtn.textContent = '×';
  xBtn.addEventListener('click', _closeModal);
  head.appendChild(xBtn);
  win.appendChild(head);

  // ── Body ────────────────────────────────────────────────────────────────────
  const body = document.createElement('div');
  body.className = 'modal-body tbm-body';

  // 1 — Groups section
  const grpSec = document.createElement('div');
  grpSec.className = 'tbm-section';

  const grpHdr = document.createElement('div');
  grpHdr.className = 'tbm-section-hdr';
  grpHdr.innerHTML = `<span class="tbm-section-title">اختر المجموعات (${visible.length} ظاهرة الآن)</span>`;

  const grpActions = document.createElement('span');
  grpActions.className = 'tbm-hdr-actions';

  const selAll = document.createElement('button');
  selAll.type = 'button';
  selAll.className = 'tbm-txt-btn';
  selAll.textContent = 'اختر الكل';
  selAll.addEventListener('click', () => {
    visible.forEach(g => _selGroupIds.add(g.id));
    groupList.querySelectorAll('.tbm-group-row').forEach(r => r.classList.add('is-checked'));
    groupList.querySelectorAll('.tbm-checkbox').forEach(c => { c.checked = true; });
    _updateApplyBtn();
  });

  const deselAll = document.createElement('button');
  deselAll.type = 'button';
  deselAll.className = 'tbm-txt-btn';
  deselAll.textContent = 'إلغاء الكل';
  deselAll.addEventListener('click', () => {
    _selGroupIds.clear();
    groupList.querySelectorAll('.tbm-group-row').forEach(r => r.classList.remove('is-checked'));
    groupList.querySelectorAll('.tbm-checkbox').forEach(c => { c.checked = false; });
    _updateApplyBtn();
  });

  grpActions.appendChild(selAll);
  grpActions.appendChild(document.createTextNode(' / '));
  grpActions.appendChild(deselAll);
  grpHdr.appendChild(grpActions);
  grpSec.appendChild(grpHdr);

  const groupList = _buildGroupList(visible);
  grpSec.appendChild(groupList);
  body.appendChild(grpSec);

  // 2 — Tag picker section
  const tagSec = document.createElement('div');
  tagSec.className = 'tbm-section';
  const tagTitle = document.createElement('div');
  tagTitle.className = 'tbm-section-title tbm-tag-sec-title';
  tagTitle.textContent = 'اختر الوسوم المراد تطبيقها';
  tagSec.appendChild(tagTitle);
  tagSec.appendChild(_buildTagPicker());

  // 3 — Apply mode
  const modeRow = document.createElement('div');
  modeRow.className = 'tbm-mode-row';
  const modeLabel = document.createElement('span');
  modeLabel.className = 'tbm-mode-label';
  modeLabel.textContent = 'طريقة التطبيق:';
  modeRow.appendChild(modeLabel);

  [['add', 'إضافة للوسوم الموجودة'], ['replace', 'استبدال الوسوم الحالية']].forEach(([val, lbl]) => {
    const wrap = document.createElement('label');
    wrap.className = 'tbm-radio-wrap';
    const inp = document.createElement('input');
    inp.type = 'radio';
    inp.name = 'tbm-apply-mode';
    inp.value = val;
    inp.checked = val === 'add';
    inp.addEventListener('change', () => { if (inp.checked) _applyMode = val; });
    wrap.appendChild(inp);
    wrap.appendChild(document.createTextNode(' ' + lbl));
    modeRow.appendChild(wrap);
  });

  tagSec.appendChild(modeRow);
  body.appendChild(tagSec);
  win.appendChild(body);

  // ── Footer ──────────────────────────────────────────────────────────────────
  const footer = document.createElement('div');
  footer.className = 'modal-footer';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'إلغاء';
  cancelBtn.addEventListener('click', _closeModal);

  const applyBtn = document.createElement('button');
  applyBtn.type = 'button';
  applyBtn.className = 'primary tbm-apply-btn tbm-btn-dim';
  applyBtn.disabled = true;
  applyBtn.textContent = 'اختر مجموعات أولاً';
  applyBtn.addEventListener('click', _applyTags);

  footer.appendChild(cancelBtn);
  footer.appendChild(applyBtn);
  win.appendChild(footer);

  backdrop.appendChild(win);
  return backdrop;
}

// ── BulkTagModal — actions ────────────────────────────────────────────────────

function _applyTags() {
  if (_selGroupIds.size === 0 || _selTagIds.size === 0) return;

  _selGroupIds.forEach(gId => {
    let next;
    if (_applyMode === 'replace') {
      next = [..._selTagIds];
    } else {
      const current = loadGroupTags(gId) || [];
      next = [...new Set([...current, ..._selTagIds])];
    }
    saveGroupTags(gId, next);
  });

  if (typeof toast === 'function') {
    toast(`✅ تم تطبيق الوسوم على ${_selGroupIds.size} مجموعة`, 'ok');
  }

  _closeModal();
  renderTagStatsBar();
  window.renderActiveGroups?.();
}

function _closeModal() {
  document.getElementById(MODAL_ID)?.remove();
  if (typeof unlockBodyScrollV78 === 'function' && !document.querySelector('.modal-backdrop')) {
    unlockBodyScrollV78();
  }
}

export function openBulkTagModal() {
  // Reset state for new opening
  _selGroupIds = new Set();
  _selTagIds = new Set();
  _applyMode = 'add';

  document.getElementById(MODAL_ID)?.remove();
  const el = _buildModal();
  const root = document.getElementById('modalRoot');
  if (root) root.appendChild(el);
  if (typeof lockBodyScrollV78 === 'function') lockBodyScrollV78();
  if (typeof enableSwipeToClose === 'function') enableSwipeToClose(el, MODAL_ID);
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  _injectStatsBar();
  renderTagStatsBar();

  window.openBulkTagModal = openBulkTagModal;

  // Keep stats bar in sync after every renderActiveGroups call
  const _origRender = window.renderActiveGroups;
  if (typeof _origRender === 'function') {
    window.renderActiveGroups = function () {
      const r = _origRender.apply(this, arguments);
      try { renderTagStatsBar(); } catch (_) {}
      return r;
    };
  }

  // Add "وسم جماعي" button to sidebar tools section
  const toolsSec = document.querySelector('.v83-side-sec:last-of-type');
  if (toolsSec) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tbm-sidebar-btn';
    btn.textContent = 'وسم جماعي';
    btn.addEventListener('click', openBulkTagModal);
    toolsSec.appendChild(btn);
  }
});
