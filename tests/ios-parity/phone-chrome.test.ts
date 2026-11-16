import assert from 'node:assert/strict'
import test from 'node:test'
import { phoneChromeHideDelay, reducePhoneChrome } from '../../src/app/mushaf-1441/_components/phone/usePhoneChrome'
import { morePopoverRows, phoneFooterItems, phonePopoverStyle, qiraatPopoverRows } from '../../src/app/mushaf-1441/_components/phone/models'
import { indexBookmarksFromAnnotations } from '../../src/app/mushaf-1441/_components/phone/bookmarks'

test('phone chrome reducer toggles, resets activity and hides only on timer action', () => {
  const initial = { visible: true, activity: 0 }
  assert.deepEqual(reducePhoneChrome(initial, { type: 'toggle' }), { visible: false, activity: 1 })
  assert.deepEqual(reducePhoneChrome({ visible: false, activity: 3 }, { type: 'interact' }), { visible: true, activity: 4 })
  assert.deepEqual(reducePhoneChrome({ visible: true, activity: 4 }, { type: 'hide' }), { visible: false, activity: 4 })
  assert.deepEqual(reducePhoneChrome({ visible: false, activity: 4 }, { type: 'show' }), { visible: true, activity: 4 })
})

test('phone chrome timer runs only while visible, enabled and free of an open overlay', () => {
  assert.equal(phoneChromeHideDelay({ autoHidesFooter: true, autoHideAfterMs: 10_000, visible: true, forceVisible: false }), 10_000)
  assert.equal(phoneChromeHideDelay({ autoHidesFooter: false, autoHideAfterMs: 10_000, visible: true, forceVisible: false }), null)
  assert.equal(phoneChromeHideDelay({ autoHidesFooter: true, autoHideAfterMs: 10_000, visible: false, forceVisible: false }), null)
  assert.equal(phoneChromeHideDelay({ autoHidesFooter: true, autoHideAfterMs: 10_000, visible: true, forceVisible: true }), null)
})

test('footer items keep the native RTL order and Qiraat state value', () => {
  assert.deepEqual(phoneFooterItems(true).map((item) => item.label), [
    'الفهرس', 'بحث', 'الفواصل', 'القراءات', 'المزيد', 'الإعدادات',
  ])
  assert.equal(phoneFooterItems(true)[3]?.value, 'مفعّلة')
  assert.equal(phoneFooterItems(false)[3]?.value, 'متوقفة')
})

test('Qiraat menu disables its filter while off and hides Usul in Farsh-only mode', () => {
  const off = qiraatPopoverRows({ enabled: false, farshOnly: false, filterName: 'الكل' })
  assert.equal(off.find((row) => row.id === 'filter')?.disabled, true)
  assert.equal(off.find((row) => row.id === 'toggle')?.checked, false)
  assert.equal(off.find((row) => row.id === 'pageSummary')?.label, 'خلافات الصفحة')
  assert.ok(off.some((row) => row.id === 'usulIndex'))

  const farshOnly = qiraatPopoverRows({ enabled: true, farshOnly: true, filterName: 'ورش عن نافع' })
  assert.equal(farshOnly.find((row) => row.id === 'filter')?.disabled, false)
  assert.equal(farshOnly.some((row) => row.id === 'usulIndex'), false)
})

test('More menu keeps memorization visible but disabled until its flag is ready', () => {
  const rows = morePopoverRows(false)
  assert.deepEqual(rows.map((row) => row.label), ['المتشابهات', 'الحفظ', 'المتون'])
  assert.equal(rows[1]?.disabled, true)
  assert.equal(rows[1]?.hint, 'قريبًا')
})

test('phonePopoverStyle bounds popovers within safe areas and above footer', () => {
  const style = phonePopoverStyle()
  assert.ok(style.bottom.includes('env(safe-area-inset-bottom'))
  assert.ok(style.top.includes('env(safe-area-inset-top'))
  assert.ok(style.left.includes('env(safe-area-inset-left'))
  assert.ok(style.right.includes('env(safe-area-inset-right'))
})

test('indexBookmarksFromAnnotations extracts only bookmarks with valid surah/ayah', () => {
  const annotations = [
    {
      id: 'a1',
      annotationType: 'bookmark' as const,
      ayahKey: '2:255',
      pageNumber: 42,
      targetType: 'ayah' as const,
      title: 'آية الكرسي',
      tags: [],
      createdAt: '2026-11-16T00:00:00Z',
      updatedAt: '2026-11-16T00:00:00Z',
    },
    {
      id: 'a2',
      annotationType: 'note' as const,
      ayahKey: '2:256',
      pageNumber: 42,
      targetType: 'ayah' as const,
      body: 'ملاحظة',
      tags: [],
      createdAt: '2026-11-16T00:00:00Z',
      updatedAt: '2026-11-16T00:00:00Z',
    },
    {
      id: 'a3',
      annotationType: 'bookmark' as const,
      ayahKey: 'invalid-key',
      pageNumber: 42,
      targetType: 'ayah' as const,
      tags: [],
      createdAt: '2026-11-16T00:00:00Z',
      updatedAt: '2026-11-16T00:00:00Z',
    },
    {
      id: 'a4',
      annotationType: 'bookmark' as const,
      ayahKey: '1:1',
      pageNumber: 1,
      targetType: 'ayah' as const,
      body: 'بداية الفاتحة',
      tags: [],
      createdAt: '2026-11-16T00:00:00Z',
      updatedAt: '2026-11-16T00:00:00Z',
    },
  ]

  const bookmarks = indexBookmarksFromAnnotations(annotations as unknown as Parameters<typeof indexBookmarksFromAnnotations>[0])
  assert.equal(bookmarks.length, 2)
  assert.deepEqual(bookmarks[0], {
    id: 'a1',
    type: 'ayah',
    surah: 2,
    ayah: 255,
    page: 42,
    note: 'آية الكرسي',
    createdAt: '2026-11-16T00:00:00Z',
  })
  assert.deepEqual(bookmarks[1], {
    id: 'a4',
    type: 'ayah',
    surah: 1,
    ayah: 1,
    page: 1,
    note: 'بداية الفاتحة',
    createdAt: '2026-11-16T00:00:00Z',
  })
})
