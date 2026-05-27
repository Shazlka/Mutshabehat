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
 * Save an array of tag IDs for a group.
 * Unknown IDs are silently stored (allows custom/future tags).
 */
export function saveGroupTags(groupId, tagIds) {
  try {
    localStorage.setItem(STORAGE_NS + groupId, JSON.stringify(tagIds));
  } catch { /* storage unavailable */ }
}

/**
 * Load persisted tag IDs for a group.
 * Returns null if nothing has been saved yet.
 */
export function loadGroupTags(groupId) {
  try {
    const raw = localStorage.getItem(STORAGE_NS + groupId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Remove all persisted tags for a group. */
export function clearGroupTags(groupId) {
  try { localStorage.removeItem(STORAGE_NS + groupId); } catch {}
}

/**
 * Merge seed tags from the group data model (g.tags) with any persisted edits.
 * localStorage takes precedence if the user has made changes; otherwise seed is used.
 */
export function resolveGroupTags(group) {
  const persisted = loadGroupTags(group.id);
  if (persisted !== null) return persisted;
  // Seed from existing data: use g.tags if they are known tag IDs,
  // otherwise fall back to g.diffType (which overlaps the change-type taxonomy)
  const seed = [];
  if (Array.isArray(group.tags)) {
    group.tags.forEach(t => { if (TAG_REGISTRY.has(t)) seed.push(t); });
  }
  if (group.diffType && TAG_REGISTRY.has(group.diffType) && !seed.includes(group.diffType)) {
    seed.push(group.diffType);
  }
  return seed;
}
