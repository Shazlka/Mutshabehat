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

test.describe('colour key', () => {
  test('the hub opens the colour key with readers, أبواب and marks', async ({ page }) => {
    await openQiraatPage(page, 17)
    await page.getByTestId('qiraat-hub').first().locator('summary').click()
    await page.getByTestId('hub-legend').first().click()
    const sheet = page.getByTestId('legend-sheet')
    await expect(sheet).toBeVisible()
    await expect(sheet.getByTestId('legend-row-Q01')).toContainText('نافع المدني')
    await expect(sheet.getByTestId('legend-row-Q01-R02')).toContainText('ورش عن نافع')
    await sheet.getByRole('tab', { name: 'الأبواب' }).click()
    await expect(sheet.getByTestId('legend-row-IMALAH_TAQLIL')).toBeVisible()
    await sheet.getByRole('tab', { name: 'العلامات' }).click()
    await expect(sheet.getByTestId('legend-row-mark-dotted')).toContainText('ذو وجهين')
    await sheet.getByRole('button', { name: 'إغلاق' }).click()
    await expect(sheet).toBeHidden()
  })
})

test.describe('page summary', () => {
  test('the summary lists the marked words and a tap opens that word in the sheet', async ({ page }) => {
    await openQiraatPage(page, 17)
    await page.getByTestId('qiraat-hub').first().locator('summary').click()
    await page.getByTestId('hub-pageSummary').first().click()
    const summary = page.getByTestId('page-summary')
    await expect(summary).toBeVisible()
    const items = summary.getByTestId('summary-item')
    expect(await items.count()).toBeGreaterThan(2)
    const second = items.nth(1)
    const wordText = (await second.locator('span').nth(1).innerText()).trim()
    await second.click()
    await expect(summary).toBeHidden()
    // The pointer is left over a page word, whose hover card takes the sidebar; park it on the page margin.
    await page.mouse.move(2, 400)
    await expect(sheet(page)).toBeVisible()
    expect(wordText.length).toBeGreaterThan(0)
    await expect(page.locator('aside[data-reader-sidebar="qiraat"]')).toContainText(wordText)
  })
})

test.describe('usul index', () => {
  test('the index lists the أبواب and a place opens its page and word', async ({ page }) => {
    await openQiraatPage(page, 17)
    await page.getByTestId('qiraat-hub').first().locator('summary').click()
    await page.getByTestId('hub-usulIndex').first().click()
    const index = page.getByTestId('usul-index')
    await expect(index).toBeVisible()
    // all 604 pages load (from the bundled data here, since the dummy backend is unreachable)
    await expect(page.getByTestId('usul-index-progress')).toBeHidden({ timeout: 120_000 })
    const category = index.getByTestId('usul-category-IMALAH_TAQLIL')
    await expect(category).toBeVisible()
    await category.click()
    const places = index.getByTestId('usul-place')
    expect(await places.count()).toBeGreaterThan(50)
    const last = places.last()
    const label = await last.locator('span').last().innerText()
    const targetPage = Number(label.split('ص')[1])
    await last.click()
    await expect(index).toBeHidden()
    await expect(page.getByTestId('word-sheet-position')).toBeVisible({ timeout: 20_000 })
    await expect(page).toHaveURL(new RegExp(`page=${targetPage}|page=${targetPage - 1}`))
  })
})

test.describe('Qiraat search', () => {
  test('a word search lists places and a result opens its word', async ({ page }) => {
    await openQiraatPage(page, 17)
    await page.getByTestId('qiraat-hub').first().locator('summary').click()
    await page.getByTestId('hub-search').first().click()
    const search = page.getByTestId('qiraat-search')
    await expect(search).toBeVisible()
    await search.getByRole('searchbox', { name: 'الكلمة' }).fill('الصراط')
    await expect(page.getByTestId('search-progress')).toBeHidden({ timeout: 120_000 })
    await expect(page.getByTestId('search-count')).not.toHaveText('0 موضعًا')
    expect(await search.getByTestId('search-result').count()).toBeGreaterThan(3)
    await search.getByRole('tab', { name: 'قارئ أو راوٍ' }).click()
    await search.getByRole('combobox', { name: 'القارئ أو الراوي' }).selectOption('Q01-R02')
    expect(await search.getByTestId('search-result').count()).toBeGreaterThan(10)
    await search.getByTestId('search-result').first().click()
    await expect(search).toBeHidden()
    await expect(page.getByTestId('word-sheet-position')).toBeVisible({ timeout: 20_000 })
  })

  test('a word with no match says so', async ({ page }) => {
    await openQiraatPage(page, 17)
    await page.getByTestId('qiraat-hub').first().locator('summary').click()
    await page.getByTestId('hub-search').first().click()
    const search = page.getByTestId('qiraat-search')
    await search.getByRole('searchbox', { name: 'الكلمة' }).fill('زززززز')
    await expect(page.getByTestId('search-progress')).toBeHidden({ timeout: 120_000 })
    await expect(search).toContainText('لا نتائج')
  })
})

test.describe('compare', () => {
  test('two readers are compared at the open word', async ({ page }) => {
    await openQiraatPage(page, 17)
    await openFirstMarkedWord(page)
    await page.mouse.move(2, 400)
    await page.getByTestId('open-compare').first().click()
    const compare = page.getByTestId('compare-sheet')
    // a word with data opens with the default pair (Hafs and the first other authority it names)
    await expect(compare).toBeVisible()
    await expect(page.getByTestId('compare-verdict')).toBeVisible()
    await compare.getByTestId('compare-change').click()
    const picker = page.getByTestId('reader-picker')
    await picker.getByRole('button', { name: /ورش عن نافع/ }).click()
    await picker.getByRole('button', { name: /^حفص عن عاصم|حفص/ }).first().click()
    await expect(picker.getByTestId('compare-go')).toBeEnabled()
    await picker.getByTestId('compare-go').click()
    await expect(page.getByTestId('compare-sheet')).toBeVisible()
    await expect(page.getByTestId('compare-voice-Q01-R02')).toContainText('ورش')
    await expect(page.getByTestId('compare-voice-Q05-R02')).toContainText('حفص')
    await page.getByTestId('compare-sheet').getByRole('button', { name: 'إغلاق' }).click()
    await expect(page.getByTestId('compare-sheet')).toBeHidden()
  })
})

