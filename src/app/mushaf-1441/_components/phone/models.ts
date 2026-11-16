export type PhoneFooterItemId = 'index' | 'search' | 'bookmarks' | 'qiraat' | 'more' | 'settings'

export interface PhoneFooterItemModel {
  id: PhoneFooterItemId
  label: string
  value?: string
}

export const phoneFooterItems = (qiraatEnabled: boolean): PhoneFooterItemModel[] => [
  { id: 'index', label: 'الفهرس' },
  { id: 'search', label: 'بحث' },
  { id: 'bookmarks', label: 'الفواصل' },
  { id: 'qiraat', label: 'القراءات', value: qiraatEnabled ? 'مفعّلة' : 'متوقفة' },
  { id: 'more', label: 'المزيد' },
  { id: 'settings', label: 'الإعدادات' },
]

export type QiraatPopoverRowId = 'toggle' | 'filter' | 'legend' | 'pageSummary' | 'search' | 'usulIndex'

export interface QiraatPopoverRowModel {
  id: QiraatPopoverRowId
  label: string
  disabled?: boolean
  checked?: boolean
}

export function qiraatPopoverRows(options: {
  enabled: boolean
  farshOnly: boolean
  filterName: string
}): QiraatPopoverRowModel[] {
  const rows: QiraatPopoverRowModel[] = [
    { id: 'toggle', label: 'إظهار علامات القراءات', checked: options.enabled },
    { id: 'filter', label: options.filterName, disabled: !options.enabled },
    { id: 'legend', label: 'مفتاح الألوان' },
    { id: 'pageSummary', label: 'خلافات الصفحة' },
    { id: 'search', label: 'البحث في القراءات' },
  ]
  if (!options.farshOnly) rows.push({ id: 'usulIndex', label: 'أصول القراءات' })
  return rows
}

export const morePopoverRows = (memorizationReady: boolean) => [
  { id: 'mutshabehat' as const, label: 'المتشابهات' },
  { id: 'memorization' as const, label: 'الحفظ', disabled: !memorizationReady, hint: memorizationReady ? undefined : 'قريبًا' },
  { id: 'mutoon' as const, label: 'المتون' },
]
