/**
 * annotationPanel.js — Collapsible annotation panel (vanilla JS)
 *
 * API:
 *   createAnnotationPanel(group, options?) → HTMLElement
 *
 * options:
 *   open:     boolean   — initial open state (default true)
 *   onChange: function  — callback({ diffType, notes }) fired after each auto-save
 *
 * Persists { diffType, notes } to localStorage under:
 *   "mutshabehat_annotation_<group.id>"
 *
 * The returned element exposes one method:
 *   element.getData() → { diffType, notes }
 */

const DIFF_TYPES = [
  { value: 'زيادة',        label: 'زيادة' },
  { value: 'نقصان',        label: 'نقصان' },
  { value: 'إبدال_حرف',   label: 'إبدال حرف' },
  { value: 'تقديم_تأخير', label: 'تقديم وتأخير' },
  { value: 'إبدال_كلمة',  label: 'إبدال كلمة' },
  { value: 'صرفي',         label: 'اختلاف صرفي' },
];

const STORAGE_NS = 'mutshabehat_annotation_';
const SAVE_DELAY = 800; // ms debounce

export function createAnnotationPanel(group, options = {}) {
  let isOpen = options.open !== false;
  let saveTimer = null;

  // ── Load persisted state ────────────────────────────────────────────────────
  const storageKey = STORAGE_NS + group.id;
  let saved = {};
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) saved = JSON.parse(raw);
  } catch { /* localStorage unavailable */ }

  let currentDiffType = saved.diffType !== undefined ? saved.diffType : (group.diffType || '');
  let currentNotes    = saved.notes    !== undefined ? saved.notes    : (group.notes    || '');

  // ── Root element ────────────────────────────────────────────────────────────
  const root = document.createElement('div');
  root.className = 'ap-root';
  root.dir = 'rtl';

  // Expose data accessor on the element for parent components to read
  root.getData = () => ({ diffType: currentDiffType, notes: currentNotes });

  // ── Render ──────────────────────────────────────────────────────────────────
  function render() {
    root.innerHTML = '';
    root.appendChild(_buildHeader());
    root.appendChild(_buildBody());
  }

  // ── Header (toggle button) ──────────────────────────────────────────────────
  function _buildHeader() {
    const btn = document.createElement('button');
    btn.className = 'ap-header';
    btn.type = 'button';
    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    btn.setAttribute('aria-controls', `ap-body-${group.id}`);

    const title = document.createElement('span');
    title.className = 'ap-title';
    title.textContent = 'التعليقات والتصنيف';

    const chevron = document.createElement('span');
    chevron.className = 'ap-chevron' + (isOpen ? ' open' : '');
    chevron.setAttribute('aria-hidden', 'true');
    chevron.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;

    btn.appendChild(title);
    btn.appendChild(chevron);
    btn.addEventListener('click', () => {
      isOpen = !isOpen;
      render();
    });

    return btn;
  }

  // ── Body (collapsible) ──────────────────────────────────────────────────────
  function _buildBody() {
    const body = document.createElement('div');
    body.className = 'ap-body' + (isOpen ? ' open' : '');
    body.id = `ap-body-${group.id}`;
    body.setAttribute('aria-hidden', isOpen ? 'false' : 'true');

    body.appendChild(_buildDiffTypeSection());
    body.appendChild(_buildNotesSection());
    body.appendChild(_buildFooter());

    return body;
  }

  // ── diffType pill selector ──────────────────────────────────────────────────
  function _buildDiffTypeSection() {
    const section = document.createElement('div');
    section.className = 'ap-section';

    const lbl = document.createElement('div');
    lbl.className = 'ap-section-label';
    lbl.textContent = 'نوع الفرق';
    section.appendChild(lbl);

    const pills = document.createElement('div');
    pills.className = 'ap-pills';
    pills.setAttribute('role', 'group');
    pills.setAttribute('aria-label', 'اختر نوع الفرق');

    DIFF_TYPES.forEach(({ value, label }) => {
      const pill = document.createElement('button');
      pill.className = 'ap-pill' + (currentDiffType === value ? ' active' : '');
      pill.type = 'button';
      pill.textContent = label;
      pill.dataset.value = value;
      pill.setAttribute('aria-pressed', currentDiffType === value ? 'true' : 'false');

      pill.addEventListener('click', () => {
        // Toggle off if same pill clicked again
        currentDiffType = currentDiffType === value ? '' : value;
        _syncPills(pills);
        _scheduleSave();
      });

      pills.appendChild(pill);
    });

    section.appendChild(pills);
    return section;
  }

  function _syncPills(container) {
    container.querySelectorAll('.ap-pill').forEach(pill => {
      const active = pill.dataset.value === currentDiffType;
      pill.classList.toggle('active', active);
      pill.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  // ── Notes textarea ──────────────────────────────────────────────────────────
  function _buildNotesSection() {
    const section = document.createElement('div');
    section.className = 'ap-section';

    const notesId = `ap-notes-${group.id}`;
    const lbl = document.createElement('label');
    lbl.className = 'ap-section-label';
    lbl.htmlFor = notesId;
    lbl.textContent = 'ملاحظات علمية';
    section.appendChild(lbl);

    const textarea = document.createElement('textarea');
    textarea.className = 'ap-textarea';
    textarea.id = notesId;
    textarea.value = currentNotes;
    textarea.placeholder = 'أضف ملاحظاتك العلمية هنا…';
    textarea.rows = 3;
    textarea.dir = 'rtl';
    textarea.lang = 'ar';

    textarea.addEventListener('input', () => {
      currentNotes = textarea.value;
      _scheduleSave();
    });

    section.appendChild(textarea);
    return section;
  }

  // ── Footer (save status indicator) ─────────────────────────────────────────
  function _buildFooter() {
    const footer = document.createElement('div');
    footer.className = 'ap-footer';

    const status = document.createElement('span');
    status.className = 'ap-save-status';
    // ID used by _showSaveStatus to locate element without full re-render
    status.dataset.groupId = group.id;

    footer.appendChild(status);
    return footer;
  }

  // ── Persistence ─────────────────────────────────────────────────────────────
  function _scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(_save, SAVE_DELAY);
  }

  function _save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        diffType: currentDiffType,
        notes: currentNotes,
      }));
      _showSaveStatus();
      if (typeof options.onChange === 'function') {
        options.onChange({ diffType: currentDiffType, notes: currentNotes });
      }
    } catch { /* storage full or unavailable */ }
  }

  function _showSaveStatus() {
    const el = root.querySelector('.ap-save-status');
    if (!el) return;
    el.textContent = 'تم الحفظ';
    el.classList.add('visible');
    setTimeout(() => {
      el.classList.remove('visible');
    }, 2000);
  }

  render();
  return root;
}

/**
 * loadAnnotation(groupId) → { diffType, notes } | null
 * Utility for reading persisted annotation data without creating the panel UI.
 */
export function loadAnnotation(groupId) {
  try {
    const raw = localStorage.getItem(STORAGE_NS + groupId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * clearAnnotation(groupId) — remove persisted annotation for a group.
 */
export function clearAnnotation(groupId) {
  try { localStorage.removeItem(STORAGE_NS + groupId); } catch {}
}
