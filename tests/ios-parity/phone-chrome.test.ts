import assert from 'node:assert/strict'
import test from 'node:test'
import { phoneChromeHideDelay, reducePhoneChrome } from '../../src/app/mushaf-1441/_components/phone/usePhoneChrome'
import { morePopoverRows, phoneFooterItems, qiraatPopoverRows } from '../../src/app/mushaf-1441/_components/phone/models'

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
