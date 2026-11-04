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
})
