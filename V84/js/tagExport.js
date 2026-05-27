/**
 * tagExport.js — Tag backup/restore + enhanced group export
 *
 * Exports:
 *   exportTagsJSON()           — download tags-only JSON backup
 *   exportTagsCSV()            — download CSV (id, title, surahs, tag_ids, tag_labels)
 *   exportGroupsWithTagsJSON() — download activeData groups with _tags field attached
 *   importTagsFromJSON(str)    — parse + apply a JSON backup; returns { ok, imported, skipped, error? }
 *   openTagExportModal()       — opens the import/export UI modal
 *
 * Tags are keyed in localStorage as "mutshabehat_tags_<groupId>".
 * The export scans localStorage directly so partial DB loads don't cause gaps.
 */

import { getTag, loadGroupTags, saveGroupTags } from './tags.js';

const MODAL_ID = 'tagExportModal';
const STORAGE_NS = 'mutshabehat_tags_';

// ── Collection helpers ────────────────────────────────────────────────────────

/** Scan localStorage for every persisted tag entry (independent of loaded data). */
function _collectAllTagData() {
  const result = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(STORAGE_NS)) continue;
      const gId = key.slice(STORAGE_NS.length);
      try {
        const raw = localStorage.getItem(key);
        if (raw) result[gId] = JSON.parse(raw);
      } catch { /* malformed entry — skip */ }
    }
  } catch { /* localStorage unavailable */ }
  return result;
}

/** Find a group object across all loaded databases by id. */
function _findGroup(id) {
  const all = [...(window.activeData || []), ...(window.personalData || [])];
  return all.find(g => String(g.id) === String(id));
}

function _dateStr() {
  return new Date().toISOString().split('T')[0];
}

function _download(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ── Export: tags-only JSON ────────────────────────────────────────────────────

export function exportTagsJSON() {
  const tagData = _collectAllTagData();
  const count = Object.keys(tagData).length;
  if (count === 0) {
    if (typeof toast === 'function') toast('لا توجد وسوم للتصدير بعد', 'info');
    return;
  }
  const payload = {
    version: 1,
    app: 'mutshabehat',
    exported: new Date().toISOString(),
    taggedGroupCount: count,
    tags: tagData,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  _download(blob, `mutshabehat_tags_${_dateStr()}.json`);
  if (typeof toast === 'function') toast(`✅ تم تصدير وسوم ${count} مجموعة (JSON)`, 'ok');
}

// ── Export: CSV ───────────────────────────────────────────────────────────────

export function exportTagsCSV() {
  const tagData = _collectAllTagData();
  const count = Object.keys(tagData).length;
  if (count === 0) {
    if (typeof toast === 'function') toast('لا توجد وسوم للتصدير بعد', 'info');
    return;
  }

  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;

  const header = ['group_id', 'group_title', 'surahs', 'tag_ids', 'tag_labels', 'verse_count'];
  const rows = [header.map(esc).join(',')];

  Object.entries(tagData).forEach(([gId, tagIds]) => {
    const g = _findGroup(gId);
    const title = g ? (g.title || '') : '';
    const surahs = g
      ? (g.surahs || [...new Set((g.verses || []).map(v => v.surah).filter(Boolean))]).join(' / ')
      : '';
    const tagLabels = tagIds.map(id => { const d = getTag(id); return d ? d.label : id; });
    const verseCount = g ? (g.verses || []).length : '';
    rows.push([gId, title, surahs, tagIds.join(','), tagLabels.join(','), verseCount].map(esc).join(','));
  });

  // BOM prefix for Arabic compatibility in Excel/Sheets
  const csv = '﻿' + rows.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  _download(blob, `mutshabehat_tags_${_dateStr()}.csv`);
  if (typeof toast === 'function') toast(`✅ تم تصدير وسوم ${count} مجموعة (CSV)`, 'ok');
}

// ── Export: full groups + tags ────────────────────────────────────────────────

export function exportGroupsWithTagsJSON() {
  const data = window.activeData || [];
  if (data.length === 0) {
    if (typeof toast === 'function') toast('لا توجد مجموعات في قاعدة البيانات النشطة', 'info');
    return;
  }
  const enhanced = data.map(g => {
    const tags = loadGroupTags(g.id);
    return tags && tags.length > 0 ? { ...g, _tags: tags } : g;
  });
  const payload = {
    version: 1,
    app: 'mutshabehat',
    exported: new Date().toISOString(),
    db: window.activeDb || 'personal',
    groupCount: enhanced.length,
    groups: enhanced,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  _download(blob, `mutshabehat_groups_with_tags_${_dateStr()}.json`);
  if (typeof toast === 'function') toast(`✅ تم تصدير ${enhanced.length} مجموعة مع الوسوم`, 'ok');
}

// ── Import ────────────────────────────────────────────────────────────────────

/**
 * Parse and restore tags from a JSON backup string.
 * Accepts: { tags: { id: [tagIds] } } (own format) or raw { id: [tagIds] }.
 * Returns { ok: boolean, imported: number, skipped: number, error?: string }
 */
export function importTagsFromJSON(jsonStr) {
  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return { ok: false, imported: 0, skipped: 0, error: 'صيغة JSON غير صالحة — تحقق من محتوى الملف' };
  }

  const tagMap = (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.tags)
    ? parsed.tags
    : parsed;

  if (typeof tagMap !== 'object' || Array.isArray(tagMap) || tagMap === null) {
    return { ok: false, imported: 0, skipped: 0, error: 'تنسيق الملف غير معروف — يجب أن يحتوي على كائن { id: [وسوم] }' };
  }

  let imported = 0;
  let skipped = 0;
  Object.entries(tagMap).forEach(([gId, tagIds]) => {
    if (!Array.isArray(tagIds)) { skipped++; return; }
    const valid = tagIds.filter(id => typeof id === 'string' && id.trim());
    if (valid.length === 0) { skipped++; return; }
    saveGroupTags(gId, valid);
    imported++;
  });

  return { ok: true, imported, skipped };
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function _closeModal() {
  document.getElementById(MODAL_ID)?.remove();
  if (typeof unlockBodyScrollV78 === 'function' && !document.querySelector('.modal-backdrop')) {
    unlockBodyScrollV78();
  }
}

function _buildModal() {
  const backdrop = document.createElement('section');
  backdrop.id = MODAL_ID;
  backdrop.className = 'modal-backdrop';
  backdrop.addEventListener('click', e => { if (e.target === backdrop) _closeModal(); });

  const win = document.createElement('div');
  win.className = 'modal tagExportModal-window tex-window';
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-modal', 'true');
  win.dir = 'rtl';

  // ── Header ──────────────────────────────────────────────────────────────────
  const head = document.createElement('div');
  head.className = 'modal-head';
  head.innerHTML = '<span class="modal-drag-handle"></span><h2>تصدير واستيراد الوسوم</h2>';
  const xBtn = document.createElement('button');
  xBtn.className = 'modal-close-btn icon-outline';
  xBtn.setAttribute('aria-label', 'إغلاق');
  xBtn.textContent = '×';
  xBtn.addEventListener('click', _closeModal);
  head.appendChild(xBtn);
  win.appendChild(head);

  // ── Body ────────────────────────────────────────────────────────────────────
  const body = document.createElement('div');
  body.className = 'modal-body tex-body';

  // 1 — Export section
  const exportSec = document.createElement('div');
  exportSec.className = 'tex-section';

  const tagData = _collectAllTagData();
  const taggedCount = Object.keys(tagData).length;
  const exTitle = document.createElement('div');
  exTitle.className = 'tex-section-title';
  exTitle.textContent = `تصدير الوسوم — ${taggedCount} مجموعة موسومة`;
  exportSec.appendChild(exTitle);

  if (taggedCount === 0) {
    const hint = document.createElement('p');
    hint.className = 'tex-hint';
    hint.textContent = 'لم تُوسَّم أي مجموعة بعد. وسّم مجموعات أولاً ثم عُد هنا للتصدير.';
    exportSec.appendChild(hint);
  } else {
    const grid = document.createElement('div');
    grid.className = 'tex-btn-grid';
    [
      {
        label: 'تصدير JSON — وسوم فقط',
        desc: 'نسخة احتياطية صغيرة قابلة للاستيراد لاحقاً',
        fn: exportTagsJSON,
      },
      {
        label: 'تصدير CSV — جدول بيانات',
        desc: 'ملف CSV مناسب لـ Excel وGoogle Sheets',
        fn: exportTagsCSV,
      },
      {
        label: 'تصدير كامل — مجموعات + وسوم',
        desc: 'بيانات المجموعات الكاملة مع حقل _tags مدمج',
        fn: exportGroupsWithTagsJSON,
      },
    ].forEach(({ label, desc, fn }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tex-export-btn';
      btn.innerHTML =
        `<span class="tex-btn-label">${label}</span>` +
        `<span class="tex-btn-desc">${desc}</span>`;
      btn.addEventListener('click', fn);
      grid.appendChild(btn);
    });
    exportSec.appendChild(grid);
  }
  body.appendChild(exportSec);

  // 2 — Import section
  const importSec = document.createElement('div');
  importSec.className = 'tex-section';

  const impTitle = document.createElement('div');
  impTitle.className = 'tex-section-title';
  impTitle.textContent = 'استيراد الوسوم من ملف JSON';
  importSec.appendChild(impTitle);

  const impHint = document.createElement('p');
  impHint.className = 'tex-hint';
  impHint.textContent = 'اختر ملف JSON تم تصديره سابقاً، أو الصق محتواه مباشرة في الحقل.';
  importSec.appendChild(impHint);

  // File picker row
  const fileRow = document.createElement('div');
  fileRow.className = 'tex-file-row';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json,application/json';
  fileInput.id = 'texFileInput';
  fileInput.className = 'tex-file-input';

  const fileLbl = document.createElement('label');
  fileLbl.htmlFor = 'texFileInput';
  fileLbl.className = 'tex-file-label';
  fileLbl.textContent = 'اختر ملف JSON';

  const fileNameEl = document.createElement('span');
  fileNameEl.className = 'tex-file-name';
  fileNameEl.textContent = 'لم يتم اختيار ملف';

  const textarea = document.createElement('textarea');
  textarea.className = 'tex-textarea';
  textarea.placeholder = 'أو الصق محتوى ملف JSON هنا...';
  textarea.dir = 'ltr';
  textarea.rows = 5;
  textarea.spellcheck = false;

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    fileNameEl.textContent = file.name;
    const reader = new FileReader();
    reader.onload = e => { textarea.value = e.target.result || ''; };
    reader.readAsText(file, 'utf-8');
  });

  fileRow.appendChild(fileInput);
  fileRow.appendChild(fileLbl);
  fileRow.appendChild(fileNameEl);
  importSec.appendChild(fileRow);
  importSec.appendChild(textarea);

  // Status
  const statusEl = document.createElement('div');
  statusEl.className = 'tex-import-status tex-status-hidden';
  importSec.appendChild(statusEl);

  // Import button
  const importBtn = document.createElement('button');
  importBtn.type = 'button';
  importBtn.className = 'primary tex-import-btn';
  importBtn.textContent = 'استيراد وتطبيق الوسوم';
  importBtn.addEventListener('click', () => {
    const txt = textarea.value.trim();
    if (!txt) {
      statusEl.textContent = 'الحقل فارغ — اختر ملفاً أو الصق النص أولاً.';
      statusEl.className = 'tex-import-status tex-status-err';
      return;
    }
    const result = importTagsFromJSON(txt);
    if (!result.ok) {
      statusEl.textContent = result.error;
      statusEl.className = 'tex-import-status tex-status-err';
      return;
    }
    const extra = result.skipped > 0 ? ` (${result.skipped} مدخل متجاهل)` : '';
    statusEl.textContent = `✅ تم استيراد وسوم ${result.imported} مجموعة بنجاح${extra}`;
    statusEl.className = 'tex-import-status tex-status-ok';
    textarea.value = '';
    fileNameEl.textContent = 'لم يتم اختيار ملف';
    // Update export count label in this same modal
    exTitle.textContent = `تصدير الوسوم — ${Object.keys(_collectAllTagData()).length} مجموعة موسومة`;
    // Refresh groups list and stats bar
    window.renderActiveGroups?.();
  });
  importSec.appendChild(importBtn);
  body.appendChild(importSec);
  win.appendChild(body);

  // ── Footer ──────────────────────────────────────────────────────────────────
  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = 'إغلاق';
  closeBtn.addEventListener('click', _closeModal);
  footer.appendChild(closeBtn);
  win.appendChild(footer);

  backdrop.appendChild(win);
  return backdrop;
}

export function openTagExportModal() {
  document.getElementById(MODAL_ID)?.remove();
  const el = _buildModal();
  const root = document.getElementById('modalRoot');
  if (root) root.appendChild(el);
  if (typeof lockBodyScrollV78 === 'function') lockBodyScrollV78();
  if (typeof enableSwipeToClose === 'function') enableSwipeToClose(el, MODAL_ID);
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  window.openTagExportModal = openTagExportModal;
  window.exportTagsJSON = exportTagsJSON;
  window.exportTagsCSV = exportTagsCSV;

  // Add "تصدير الوسوم" to sidebar tools section (after bulk button from 2.3)
  const toolsSec = document.querySelector('.v83-side-sec:last-of-type');
  if (toolsSec) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tbm-sidebar-btn';
    btn.textContent = 'تصدير / استيراد الوسوم';
    btn.addEventListener('click', openTagExportModal);
    toolsSec.appendChild(btn);
  }
});
