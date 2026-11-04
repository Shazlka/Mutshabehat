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


/** On phones and portrait tablets the Qiraat tools live in the burger menu; on desktop and iPad landscape in the sidebar. */
async function ensureQiraatTools(page: Page) {
  // On phones an open word card covers the page; close it before reaching for the menu.
  if (await page.getByTestId('word-sheet-nav').isVisible() && !(await page.getByTestId('qiraat-hub').first().isVisible())) {
    await page.getByRole('button', { name: 'إغلاق بطاقة القراءات' }).first().click({ position: { x: 5, y: 5 } })
  }
  if (!(await page.getByTestId('qiraat-hub').first().isVisible())) {
    await page.getByRole('button', { name: 'القائمة والإعدادات' }).click()
    await expect(page.getByTestId('qiraat-hub').first()).toBeVisible()
  }
}

/** Close the phone menu again (no-op when it is not open). */
async function closeQiraatMenu(page: Page) {
  const close = page.getByRole('button', { name: 'إغلاق القائمة' })
  if (await close.isVisible()) await close.click({ position: { x: 5, y: 5 } })
}

async function openHub(page: Page) {
  await ensureQiraatTools(page)
  await page.getByTestId('qiraat-hub').first().locator('summary').click()
}

async function openFilterChip(page: Page) {
  await ensureQiraatTools(page)
  await page.getByTestId('filter-chip').first().click()
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

    await ensureQiraatTools(page)
    await page.getByTestId('usul-prefs').locator('summary').click()
    await page.getByTestId('usul-farsh-only').check()
    await expect.poll(() => marked.count()).toBeLessThan(before)
    const farshOnly = await marked.count()
    expect(farshOnly).toBeGreaterThan(0) // the فرش variants of page 17 stay

    await page.reload()
    await expect(page.locator('[data-page-slot-current] [data-quran-word-id]').first()).toBeVisible()
    await expect.poll(() => page.locator(MARKED_WORDS).count()).toBe(farshOnly)

    await ensureQiraatTools(page)
    await page.getByTestId('usul-prefs').locator('summary').click()
    await page.getByTestId('usul-farsh-only').uncheck()
    await expect.poll(() => page.locator(MARKED_WORDS).count()).toBe(before)
  })

  test('switching one باب off removes only its words', async ({ page }) => {
    await openQiraatPage(page, 17)
    const marked = page.locator(MARKED_WORDS)
    const before = await marked.count()
    await ensureQiraatTools(page)
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
    await ensureQiraatTools(page)
    await expect(page.getByTestId('filter-chip').first()).toHaveText('الكل')

    await openFilterChip(page)
    const picker = page.getByTestId('reader-picker')
    await expect(picker).toBeVisible()
    await picker.getByRole('button', { name: /ورش عن نافع/ }).click()
    await expect(picker).toBeHidden()
    await ensureQiraatTools(page)
    await expect(page.getByTestId('filter-chip').first()).toContainText('ورش عن نافع')
    await expect.poll(() => marked.count()).toBeLessThan(before)

    await openFilterChip(page)
    await page.getByTestId('reader-picker').getByRole('button', { name: /^الكل/ }).click()
    await expect.poll(() => marked.count()).toBe(before)
  })

  test('the picker searches and closes with Escape', async ({ page }) => {
    await openQiraatPage(page, 17)
    await openFilterChip(page)
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
    await openHub(page)
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
    await openHub(page)
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
    // the word's own card (sidebar on desktop, bottom card on phones) names it
    await expect(sheet(page).locator('xpath=..')).toContainText(wordText)
  })
})

test.describe('usul index', () => {
  test('the index lists the أبواب and a place opens its page and word', async ({ page }) => {
    await openQiraatPage(page, 17)
    await openHub(page)
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
    await openHub(page)
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
    await openHub(page)
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

test.describe('favourites and notes', () => {
  test('a favourite and a note survive a reload and appear in the list', async ({ page }) => {
    await openQiraatPage(page, 17)
    await openFirstMarkedWord(page)
    await page.mouse.move(2, 400)
    await page.getByTestId('favourite-toggle').first().click()
    await expect(page.getByTestId('favourite-toggle').first()).toHaveAttribute('aria-pressed', 'true')
    await page.getByTestId('note-toggle').first().click()
    await page.getByTestId('note-text').first().fill('ملاحظة اختبار')
    await page.getByTestId('note-text').first().blur()

    await page.reload()
    await expect(page.locator('[data-page-slot-current] [data-quran-word-id]').first()).toBeVisible()
    await openHub(page)
    await page.getByTestId('hub-notes').first().click()
    const panel = page.getByTestId('notes-panel')
    await expect(panel.getByTestId('note-item')).toHaveCount(1)
    await expect(panel).toContainText('ملاحظة اختبار')
    await expect(panel.getByTestId('note-item')).toContainText('★')
    await panel.getByTestId('note-item').click()
    await expect(panel).toBeHidden()
    await page.mouse.move(2, 400)
    await expect(page.getByTestId('favourite-toggle').first()).toHaveAttribute('aria-pressed', 'true')

    // clearing both removes the entry
    await page.getByTestId('favourite-toggle').first().click()
    await page.getByTestId('note-text').first().fill('')
    await page.getByTestId('note-text').first().blur()
    await openHub(page)
    await page.getByTestId('hub-notes').first().click()
    await expect(page.getByTestId('notes-panel')).toContainText('لا مفضلة ولا ملاحظات بعد')
  })
})

test.describe('المتون', () => {
  const snapshot = {
    seq: 1,
    revision: 1,
    document: { mutoon: { schemaVersion: 1, works: [
      { work: 'durrah', title: 'الدرة', author: 'ابن الجزري', bookId: null, chapters: [{ title: 'باب الهمز', farsh: false, verses: [{ number: 1, lines: ['بيتٌ في الدرة'], printedPage: null, pageId: null }] }] },
      { work: 'shatibiyyah', title: 'الشاطبية', author: 'الشاطبي', bookId: 1, chapters: [{ title: 'باب المد', farsh: false, verses: [{ number: 2, lines: ['وَمَدُّ الْبَدَلِ', 'بيت ثان'], printedPage: null, pageId: null }, { number: 1, lines: ['أول بيت'], printedPage: null, pageId: null }] }] },
    ] } },
    symbols: { schemaVersion: 1, annotations: [] },
  }

  async function openMutoon(page: Page) {
    await openQiraatPage(page, 17)
    await openHub(page)
    await page.getByTestId('hub-mutoon').first().click()
    return page.getByTestId('mutoon-sheet')
  }

  test('the books are listed in order and a search finds a verse', async ({ page }) => {
    await page.route('**/api/public/v1/mutoon', (route) => route.fulfill({ json: snapshot }))
    const sheet = await openMutoon(page)
    const works = sheet.locator('[data-testid^="mutoon-work-"]')
    await expect(works).toHaveCount(2)
    await expect(works.first()).toContainText('الشاطبية')
    await sheet.getByRole('searchbox', { name: 'ابحث في المتون' }).fill('مد البدل')
    await expect(sheet.getByTestId('mutoon-hit')).toHaveCount(1)
    await expect(sheet.getByTestId('mutoon-hit')).toContainText('الشاطبية · باب المد · بيت 2')
    await sheet.getByRole('searchbox', { name: 'ابحث في المتون' }).fill('لا يوجد')
    await expect(sheet).toContainText('لا نتائج')
  })

  test('a failing feed shows an error with a retry, never a blank sheet', async ({ page }) => {
    await page.route('**/api/public/v1/mutoon', (route) => route.fulfill({ status: 503, json: { error: 'unavailable' } }))
    const sheet = await openMutoon(page)
    await expect(sheet.getByTestId('mutoon-error')).toBeVisible()
    await page.unroute('**/api/public/v1/mutoon')
    await page.route('**/api/public/v1/mutoon', (route) => route.fulfill({ json: snapshot }))
    await sheet.getByRole('button', { name: 'إعادة المحاولة' }).click()
    await expect(sheet.locator('[data-testid^="mutoon-work-"]')).toHaveCount(2)
  })
})

test.describe('sync status and report', () => {
  test('the page says whether its data is confirmed, and an error report copies the word facts', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    // Desktop Chrome has a native share sheet; force the clipboard path the other browsers use.
    await page.addInitScript(() => Object.defineProperty(navigator, 'share', { value: undefined }))
    await openQiraatPage(page, 17)
    await ensureQiraatTools(page)
    const chip = page.getByTestId('sync-status').first()
    await expect(chip).toBeVisible()
    // The test backend is unreachable, so the route answers with the bundled copy: never «محدّث الآن».
    await expect(chip).toHaveAttribute('data-kind', /localCopy|confirmed/)
    await expect(chip).toContainText('نسخة محلية')
    await closeQiraatMenu(page)

    await openFirstMarkedWord(page)
    await page.mouse.move(2, 400)
    await page.getByTestId('report-error').first().click()
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toMatch(/^بلاغ عن خطأ في القراءات\nالصفحة: 1[78]\nالموضع: 2:\d+:\d+\nالكلمة: /)
  })

  test('a live answer reads «محدّث الآن»', async ({ page }) => {
    await page.route('**/api/mushaf-1441/qiraat?*', async (route) => {
      const response = await route.fetch()
      await route.fulfill({ response, headers: { ...response.headers(), 'x-qiraat-source': 'live' } })
    })
    await openQiraatPage(page, 17)
    await ensureQiraatTools(page)
    await expect(page.getByTestId('sync-status').first()).toContainText('محدّث الآن')
  })
})

test.describe('final review fixes', () => {
  test('a sheet takes focus, keeps it inside while open, and Escape closes it', async ({ page }) => {
    await openQiraatPage(page, 17)
    await openHub(page)
    await page.getByTestId('hub-legend').first().click()
    const dialog = page.getByTestId('legend-sheet')
    await expect(dialog).toBeVisible()
    const inside = () => dialog.evaluate((el) => el.contains(document.activeElement))
    expect(await inside()).toBe(true)
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Tab')
      expect(await inside()).toBe(true)
    }
    await page.keyboard.press('Shift+Tab')
    expect(await inside()).toBe(true)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('the page summary follows the riwayah in «القراءة برواية»: every item opens its word', async ({ page }) => {
    await openQiraatPage(page, 17)
    await ensureQiraatTools(page)
    await page.getByRole('button', { name: 'القراءة برواية' }).first().click()
    await closeQiraatMenu(page)
    await page.waitForTimeout(600) // let the riwayah marks settle (Hafs, the default, marks nothing)
    const markedNow = await page.locator(MARKED_WORDS).count()
    await openHub(page)
    await page.getByTestId('hub-pageSummary').first().click()
    const summary = page.getByTestId('page-summary')
    const items = summary.getByTestId('summary-item')
    // one item per marked word: the summary lists exactly what the page marks in this mode
    await expect.poll(() => items.count()).toBe(markedNow)
    if (markedNow === 0) await expect(summary.getByTestId('page-summary-empty')).toBeVisible()
    else {
      await items.first().click()
      await page.mouse.move(2, 400)
      await expect(sheet(page)).toBeVisible()
    }
  })

  test('a note on a page that is already cached still opens its word from the list', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the page arrows are on desktop and tablet; phones turn pages by touch (same code path)')
    await openQiraatPage(page, 17)
    await openFirstMarkedWord(page)
    await page.mouse.move(2, 400)
    await page.getByTestId('favourite-toggle').first().click()
    await expect(page.getByTestId('favourite-toggle').first()).toHaveAttribute('aria-pressed', 'true')
    await ensureQiraatTools(page)
    await closeQiraatMenu(page)
    // turn away and let the neighbours load, so page 17 and its Qiraat data are cached
    await page.getByRole('button', { name: 'الصفحة التالية' }).click()
    await expect(page).not.toHaveURL(/page=17$/)
    await page.getByRole('button', { name: 'الصفحة التالية' }).click()
    await page.waitForTimeout(800)
    await openHub(page)
    await page.getByTestId('hub-notes').first().click()
    await page.getByTestId('notes-panel').getByTestId('note-item').first().click()
    await page.mouse.move(2, 400) // a hover card over a page word would take the sidebar
    await expect(page.getByTestId('word-sheet-position')).toBeVisible({ timeout: 20_000 })
  })
})

test.describe('deferred minors', () => {
  test('the «المزيد» menu closes on Escape and on an outside click', async ({ page }) => {
    await openQiraatPage(page, 17)
    await ensureQiraatTools(page)
    const menu = page.getByTestId('hub-menu').first()
    await menu.locator('summary').click()
    await expect(menu).toHaveAttribute('open', '')
    await page.keyboard.press('Escape')
    await expect(menu).not.toHaveAttribute('open', '')
    await menu.locator('summary').click()
    await expect(menu).toHaveAttribute('open', '')
    await page.getByTestId('filter-chip').first().evaluate((el) => el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })))
    await expect(menu).not.toHaveAttribute('open', '')
  })

  test('the sync chip is an announced status and the colour key draws each mark', async ({ page }) => {
    await openQiraatPage(page, 17)
    await ensureQiraatTools(page)
    await expect(page.getByRole('status').filter({ hasText: 'نسخة محلية' })).toBeVisible()
    await openHub(page)
    await page.getByTestId('hub-legend').first().click()
    const sheet = page.getByTestId('legend-sheet')
    await sheet.getByRole('tab', { name: 'العلامات' }).click()
    for (const key of ['mark-solid', 'mark-dotted', 'mark-imalah', 'mark-taqlil']) {
      await expect(sheet.getByTestId(`legend-row-${key}`).getByText('كلمة', { exact: true })).toBeVisible()
    }
  })

  test('a note typed and left without leaving the field is still saved', async ({ page }) => {
    await openQiraatPage(page, 17)
    await openFirstMarkedWord(page)
    await page.mouse.move(2, 400)
    await page.getByTestId('note-toggle').first().click()
    await page.getByTestId('note-text').first().pressSequentially('نص بلا مغادرة')
    await page.waitForTimeout(1000) // the field keeps focus; the note is saved after typing stops
    await page.reload()
    await expect(page.locator('[data-page-slot-current] [data-quran-word-id]').first()).toBeVisible()
    await openHub(page)
    await page.getByTestId('hub-notes').first().click()
    await expect(page.getByTestId('notes-panel')).toContainText('نص بلا مغادرة')
  })
})

