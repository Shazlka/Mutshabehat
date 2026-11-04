import { expect, test, type Page } from '@playwright/test'

// Web parity with the Qiraat iOS app (branch web/ios-parity). One describe per feature of the plan
// docs/superpowers/plans/2026-11-04-web-ios-parity-qiraat-ux.md.

async function openQiraatPage(page: Page, pageNumber: number) {
  await page.goto(`/mushaf-1441?page=${pageNumber}`)
  await expect(page.locator('[data-page-slot-current] [data-quran-word-id]').first()).toBeVisible()
  const enable = page.getByRole('button', { name: /تفعيل عرض القراءات/ })
  if (await enable.count()) await enable.click()
  await expect(page.locator('[data-page-slot-current] [data-qiraat-marked="true"]').first()).toBeVisible()
}

const MARKED_WORDS = '[data-page-slot-current] [data-qiraat-marked="true"]'

/** Press a marked word, then step back to the first marked word of the visible page(s). */
async function openFirstMarkedWord(page: Page) {
  await page.locator(MARKED_WORDS).first().click()
  const back = sheet(page).getByRole('button', { name: 'الكلمة السابقة' })
  await expect(back).toBeVisible()
  while (await back.isEnabled()) await back.click()
  await expect(page.getByTestId('word-sheet-position')).toHaveText(/^1 من \d+$/)
}

function sheet(page: Page) {
  // The word sheet renders in the permanent sidebar on desktop/iPad and in the bottom sheet on phones;
  // only one of them is mounted at a time, so the nav test id is unique.
  return page.getByTestId('word-sheet-nav')
}

test.describe('word sheet', () => {
  test('word sheet steps through marked words', async ({ page }) => {
    await openQiraatPage(page, 17)
    await openFirstMarkedWord(page)
    const nav = sheet(page)
    // previous is disabled on the first marked word
    await expect(nav.getByRole('button', { name: 'الكلمة السابقة' })).toBeDisabled()
    await nav.getByRole('button', { name: 'الكلمة التالية' }).click()
    await expect(page.getByTestId('word-sheet-position')).toHaveText(/^2 من \d+$/)
    await expect(nav.getByRole('button', { name: 'الكلمة السابقة' })).toBeEnabled()
    await nav.getByRole('button', { name: 'الكلمة السابقة' }).click()
    await expect(page.getByTestId('word-sheet-position')).toHaveText(/^1 من \d+$/)
  })

  test('only a word with several faces shows face numbers', async ({ page }) => {
    await openQiraatPage(page, 17)
    await openFirstMarkedWord(page)
    const position = page.getByTestId('word-sheet-position')
    const total = Number((await position.textContent())!.split('من')[1].trim())
    const numbered: string[][] = []
    for (let i = 0; i < total; i += 1) {
      const badges = await page.getByTestId('face-badge').allTextContents()
      if (badges.length > 0) numbered.push(badges)
      if (i < total - 1) await sheet(page).getByRole('button', { name: 'الكلمة التالية' }).click()
    }
    // Page 17 has one two-word locus with two faces (2:112 «خوف عليهم»): both of its words show the
    // numbers, and every other marked word, which has a single face, shows none.
    expect(numbered).toEqual([['وجه 1', 'وجه 2'], ['وجه 1', 'وجه 2']])
  })

  test('each card names its classification', async ({ page }) => {
    await openQiraatPage(page, 17)
    await openFirstMarkedWord(page)
    const lines = await page.getByTestId('classification').allTextContents()
    expect(lines.length).toBeGreaterThan(0)
    for (const line of lines) expect(line).toMatch(/^(فرش الحروف|أصول القراءات)/)
  })
})

test.describe('أبواب الأصول switches', () => {
  test('farsh-only hides the أصول marks and the choice survives a reload', async ({ page }) => {
    await openQiraatPage(page, 17)
    const marked = page.locator(MARKED_WORDS)
    const before = await marked.count()
    expect(before).toBeGreaterThan(1)

    await page.getByTestId('usul-prefs').locator('summary').click()
    await page.getByTestId('usul-farsh-only').check()
    await expect.poll(() => marked.count()).toBeLessThan(before)
    const farshOnly = await marked.count()
    expect(farshOnly).toBeGreaterThan(0) // the فرش variants of page 17 stay

    await page.reload()
    await expect(page.locator('[data-page-slot-current] [data-quran-word-id]').first()).toBeVisible()
    await expect.poll(() => page.locator(MARKED_WORDS).count()).toBe(farshOnly)

    await page.getByTestId('usul-prefs').locator('summary').click()
    await page.getByTestId('usul-farsh-only').uncheck()
    await expect.poll(() => page.locator(MARKED_WORDS).count()).toBe(before)
  })

  test('switching one باب off removes only its words', async ({ page }) => {
    await openQiraatPage(page, 17)
    const marked = page.locator(MARKED_WORDS)
    const before = await marked.count()
    await page.getByTestId('usul-prefs').locator('summary').click()
    await page.getByTestId('usul-switch-IMALAH_TAQLIL').uncheck()
    await expect.poll(() => marked.count()).toBeLessThan(before)
    await page.getByTestId('usul-switch-IMALAH_TAQLIL').check()
    await expect.poll(() => marked.count()).toBe(before)
  })
})

test.describe('reader picker and filter chip', () => {
  test('picking Warsh filters the page and the chip names him', async ({ page }) => {
    await openQiraatPage(page, 17)
    const marked = page.locator(MARKED_WORDS)
    const before = await marked.count()
    await expect(page.getByTestId('filter-chip').first()).toHaveText('الكل')

    await page.getByTestId('filter-chip').first().click()
    const picker = page.getByTestId('reader-picker')
    await expect(picker).toBeVisible()
    await picker.getByRole('button', { name: /ورش عن نافع/ }).click()
    await expect(picker).toBeHidden()
    await expect(page.getByTestId('filter-chip').first()).toContainText('ورش عن نافع')
    await expect.poll(() => marked.count()).toBeLessThan(before)

    await page.getByTestId('filter-chip').first().click()
    await page.getByTestId('reader-picker').getByRole('button', { name: /^الكل/ }).click()
    await expect.poll(() => marked.count()).toBe(before)
  })

  test('the picker searches and closes with Escape', async ({ page }) => {
    await openQiraatPage(page, 17)
    await page.getByTestId('filter-chip').first().click()
    const picker = page.getByTestId('reader-picker')
    await picker.getByRole('searchbox').fill('الدوري')
    await expect(picker.getByRole('button', { name: /الدوري عن أبي عمرو/ })).toBeVisible()
    await expect(picker.getByRole('button', { name: /الدوري عن الكسائي/ })).toBeVisible()
    await expect(picker.getByRole('button', { name: /نافع/ })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(picker).toBeHidden()
  })
})

