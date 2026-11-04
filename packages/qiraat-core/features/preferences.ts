// Per-باب switches and «فرش فقط» (iOS QiraatPreferences: hidesUsul + hiddenUsulCategories). Pure; storage is
// injected so every access can fail without breaking the page.
import { USUL_RULE_REGISTRY } from '../usulRegistry'
import type { QiraatRuling } from '../types'

export interface QiraatUsulPrefs {
  /** Show only فرش: hide every أصول ruling. */
  farshOnly: boolean
  /** Ruling category codes the reader switched off. */
  disabledCategories: string[]
}

export const QIRAAT_USUL_PREFS_KEY = 'mushaf1441:qiraat-usul-prefs:v1'
export const DEFAULT_USUL_PREFS: QiraatUsulPrefs = { farshOnly: false, disabledCategories: [] }

export function loadUsulPrefs(storage: Pick<Storage, 'getItem'>): QiraatUsulPrefs {
  try {
    const raw = storage.getItem(QIRAAT_USUL_PREFS_KEY)
    if (!raw) return DEFAULT_USUL_PREFS
    const parsed = JSON.parse(raw) as Partial<QiraatUsulPrefs>
    return {
      farshOnly: parsed.farshOnly === true,
      disabledCategories: Array.isArray(parsed.disabledCategories)
        ? parsed.disabledCategories.filter((c): c is string => typeof c === 'string')
        : [],
    }
  } catch {
    return DEFAULT_USUL_PREFS
  }
}

export function saveUsulPrefs(storage: Pick<Storage, 'setItem'>, prefs: QiraatUsulPrefs): void {
  try {
    storage.setItem(QIRAAT_USUL_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // Storage unavailable: the choice lasts for this visit only.
  }
}

export function isRulingVisible(ruling: QiraatRuling, prefs: QiraatUsulPrefs): boolean {
  return !prefs.farshOnly && !prefs.disabledCategories.includes(ruling.category)
}

/** The same array when nothing is hidden, so memoised consumers do not re-render for nothing. */
export function filterRulingsByPrefs(rulings: QiraatRuling[], prefs: QiraatUsulPrefs): QiraatRuling[] {
  if (!prefs.farshOnly && prefs.disabledCategories.length === 0) return rulings
  return rulings.filter((r) => isRulingVisible(r, prefs))
}

export function toggleUsulCategory(prefs: QiraatUsulPrefs, code: string, shown: boolean): QiraatUsulPrefs {
  const rest = prefs.disabledCategories.filter((c) => c !== code)
  return { ...prefs, disabledCategories: shown ? rest : [...rest, code] }
}

export interface UsulCategoryOption {
  code: string
  label: string
  /** Ruling family colour when a loaded ruling carries it; the label is always shown beside it. */
  color?: string
}

/** Every باب of the registry plus any category only the loaded data carries (e.g. USUL_MIM_JAM). */
export function usulCategoryOptions(loadedRulings: readonly QiraatRuling[]): UsulCategoryOption[] {
  const options = new Map<string, UsulCategoryOption>()
  for (const rule of USUL_RULE_REGISTRY) {
    options.set(rule.rawCategories[0], { code: rule.rawCategories[0], label: rule.rawLabels[0] })
  }
  for (const r of loadedRulings) {
    options.set(r.category, { code: r.category, label: r.categoryAr, color: r.color })
  }
  return Array.from(options.values())
}
