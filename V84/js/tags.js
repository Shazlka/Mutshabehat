/**
 * tags.js — Tag taxonomy and persistence utilities
 *
 * Exports:
 *   TAG_GROUPS   — array of { id, label, tags[] } category objects
 *   TAG_REGISTRY — Map<id, TagDef> for O(1) lookup
 *   getTag(id)           → TagDef | undefined
 *   saveGroupTags(groupId, tagIds[]) → void
 *   loadGroupTags(groupId)           → string[] | null
 *   clearGroupTags(groupId)          → void
 *
 * TagDef shape: { id, label, color, bg, border, group }
 */

// ── Taxonomy ──────────────────────────────────────────────────────────────────

export const TAG_GROUPS = [
  {
    id: 'change',
    label: 'نوع التغيير',
    tags: [
      { id: 'زيادة',        label: 'زيادة',          color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
      { id: 'نقصان',        label: 'نقصان',          color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
      { id: 'إبدال_حرف',   label: 'إبدال حرف',      color: '#0284c7', bg: '#f0f9ff', border: '#7dd3fc' },
      { id: 'إبدال_كلمة',  label: 'إبدال كلمة',     color: '#7c3aed', bg: '#faf5ff', border: '#c4b5fd' },
      { id: 'تقديم_تأخير', label: 'تقديم وتأخير',   color: '#c2410c', bg: '#fff7ed', border: '#fdba74' },
      { id: 'صرفي',         label: 'اختلاف صرفي',    color: '#0f766e', bg: '#f0fdfa', border: '#5eead4' },
    ],
  },
  {
    id: 'theme',
    label: 'الموضوع',
    tags: [
      { id: 'عقيدة',        label: 'عقيدة',          color: '#1d4ed8', bg: '#eff6ff', border: '#93c5fd' },
      { id: 'نبوة',         label: 'نبوة ورسل',      color: '#0f5a45', bg: '#ecfdf5', border: '#6ee7b7' },
      { id: 'قصص',          label: 'قصص الأنبياء',   color: '#6d28d9', bg: '#f5f3ff', border: '#a78bfa' },
      { id: 'أحكام',        label: 'أحكام فقهية',    color: '#b91c1c', bg: '#fef2f2', border: '#fca5a5' },
      { id: 'أخلاق',        label: 'أخلاق وسلوك',   color: '#0369a1', bg: '#f0f9ff', border: '#7dd3fc' },
      { id: 'دعاء',         label: 'دعاء وتسبيح',    color: '#92400e', bg: '#fffbeb', border: '#fcd34d' },
      { id: 'جنة_ونار',     label: 'جنة ونار',       color: '#7e22ce', bg: '#fdf4ff', border: '#d8b4fe' },
    ],
  },
  {
    id: 'context',
    label: 'السياق',
    tags: [
      { id: 'مكي',            label: 'مكي',              color: '#6b21a8', bg: '#fdf4ff', border: '#e9d5ff' },
      { id: 'مدني',           label: 'مدني',             color: '#1e3a8a', bg: '#eff6ff', border: '#bfdbfe' },
      { id: 'بين_سورتين',     label: 'بين سورتين',       color: '#374151', bg: '#f9fafb', border: '#d1d5db' },
      { id: 'في_سورة_واحدة',  label: 'في سورة واحدة',   color: '#1f2937', bg: '#f3f4f6', border: '#e5e7eb' },
    ],
  },
  {
    id: 'status',
    label: 'الحالة',
    tags: [
      { id: 'محفوظ',       label: 'محفوظ',           color: '#047857', bg: '#ecfdf5', border: '#6ee7b7' },
      { id: 'صعب',         label: 'صعب التمييز',     color: '#b45309', bg: '#fffbeb', border: '#fcd34d' },
      { id: 'مراجعة',      label: 'يحتاج مراجعة',   color: '#b91c1c', bg: '#fef2f2', border: '#fca5a5' },
      { id: 'مميز',        label: 'مميز',            color: '#0f5a45', bg: '#ecfdf5', border: '#6ee7b7' },
    ],
  },
];

// ── Registry ──────────────────────────────────────────────────────────────────

export const TAG_REGISTRY = new Map();

TAG_GROUPS.forEach(group => {
  group.tags.forEach(tag => {
    TAG_REGISTRY.set(tag.id, { ...tag, group: group.id });
  });
});

/** Look up a tag definition by ID. Returns undefined for unknown tags. */
export function getTag(id) {
  return TAG_REGISTRY.get(id);
}

// ── Persistence ───────────────────────────────────────────────────────────────

const STORAGE_NS = 'mutshabehat_tags_';

/**
 * Save tag IDs for a group.
 *
 * For personal-DB groups: writes directly to group.tags on the personalData
 * object and calls saveDb('personal'), so tags travel with the DB on every
 * GitHub sync and import. No separate localStorage key is needed.
 *
 * For automated/unknown groups: falls back to a localStorage key (automated
 * data is read-only and is not synced to GitHub).
 */
export function saveGroupTags(groupId, tagIds) {
  const pd = window.personalData;
  if (Array.isArray(pd)) {
    const g = pd.find(x => String(x.id) === String(groupId));
    if (g) {
      g.tags = [...tagIds];
      try { window.saveDb('personal'); } catch { /* saveDb not ready yet */ }
      return; // stored in DB — no separate localStorage key needed
    }
  }
  // Automated DB or group not found: localStorage fallback
  try {
    localStorage.setItem(STORAGE_NS + groupId, JSON.stringify(tagIds));
  } catch { /* storage unavailable */ }
}

/**
 * Load persisted tag IDs for a group.
 *
 * For personal-DB groups: reads group.tags directly from personalData
 * (the source of truth after a GitHub sync / import).
 * Returns null (not []) when tags have never been set, so resolveGroupTags
 * can still fall through to seed from diffType.
 *
 * For automated/unknown groups: falls back to localStorage.
 */
export function loadGroupTags(groupId) {
  const pd = window.personalData;
  if (Array.isArray(pd)) {
    const g = pd.find(x => String(x.id) === String(groupId));
    if (g) {
      // Array.isArray check: undefined → null (triggers seed); [] → [] (explicitly empty)
      return Array.isArray(g.tags) ? [...g.tags] : null;
    }
  }
  // Automated DB or personalData not loaded yet: localStorage fallback
  try {
    const raw = localStorage.getItem(STORAGE_NS + groupId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Remove all tags for a group.
 * Clears group.tags from personalData (and saves) for personal groups;
 * removes the localStorage key for automated groups.
 */
export function clearGroupTags(groupId) {
  const pd = window.personalData;
  if (Array.isArray(pd)) {
    const g = pd.find(x => String(x.id) === String(groupId));
    if (g && 'tags' in g) {
      delete g.tags;
      try { window.saveDb('personal'); } catch {}
    }
  }
  try { localStorage.removeItem(STORAGE_NS + groupId); } catch {}
}

/**
 * Merge seed tags from the group data model (g.tags) with any persisted edits.
 * loadGroupTags() takes precedence (personalData.group.tags or localStorage);
 * otherwise seeds from g.diffType which overlaps the change-type taxonomy.
 */
export function resolveGroupTags(group) {
  const persisted = loadGroupTags(group.id);
  if (persisted !== null) return persisted;
  // Seed from diffType if no explicit tags have been saved yet
  const seed = [];
  if (group.diffType && TAG_REGISTRY.has(group.diffType)) {
    seed.push(group.diffType);
  }
  return seed;
}

// ── One-time migration ────────────────────────────────────────────────────────

/**
 * Migrate any tags stored in legacy localStorage keys (mutshabehat_tags_<id>)
 * into personalData[].tags so they are included in the next GitHub sync.
 * Runs once on DOMContentLoaded — after init() has loaded personalData.
 * Safe to call multiple times (idempotent).
 */
function _migrateTagsToPersonalDb() {
  const pd = window.personalData;
  if (!Array.isArray(pd) || pd.length === 0) return;
  let dirty = false;
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(STORAGE_NS)) keys.push(k);
  }
  keys.forEach(key => {
    const groupId = key.slice(STORAGE_NS.length);
    const g = pd.find(x => String(x.id) === String(groupId));
    if (!g) return; // automated group — leave in localStorage
    try {
      const tags = JSON.parse(localStorage.getItem(key) || 'null');
      if (Array.isArray(tags) && tags.length > 0 && !Array.isArray(g.tags)) {
        g.tags = tags;
        dirty = true;
      }
      localStorage.removeItem(key); // clean up legacy key regardless
    } catch { /* malformed entry — ignore */ }
  });
  if (dirty) {
    try { window.saveDb('personal'); } catch {}
  }
}

// Run migration after init() (navigation.js) has populated personalData
document.addEventListener('DOMContentLoaded', _migrateTagsToPersonalDb);
