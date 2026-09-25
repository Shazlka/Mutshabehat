import { expect, test } from '@playwright/test'

test('review editor keeps a single scaled page, a wider pane, and exact RTL navigation', async ({ page, isMobile }) => {
  test.skip(Boolean(isMobile), 'Desktop workstation layout test')
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })

  await page.goto('/mushaf-1441/review?page=3')
  const word = page.locator('[data-page-slot-current] [data-quran-word-id]').first()
  await expect(word).toBeVisible()
  await word.click()
  const editor = page.locator('[data-qiraat-editor-pane="true"]')
  await expect(editor).toBeVisible()
  await expect(editor.getByText('الأوجه المسجلة')).toBeVisible()
  await expect(editor.getByText('حالة الأداء')).toBeVisible()
  const dimensions = await page.evaluate(() => {
    const editor = document.querySelector<HTMLElement>('[data-qiraat-editor-pane="true"]')!
    const mushaf = document.querySelector<HTMLElement>('main')!
    const leaf = document.querySelector<HTMLElement>('[data-page-slot-current] [data-mushaf-leaf]')!
    return { editor: editor.getBoundingClientRect().width, mushaf: mushaf.getBoundingClientRect().width,
      leafWidth: leaf.getBoundingClientRect().width, leafHeight: leaf.getBoundingClientRect().height,
      scrollWidth: document.documentElement.scrollWidth, viewportWidth: window.innerWidth }
  })
  expect(dimensions.editor).toBeGreaterThan(dimensions.mushaf)
  expect(dimensions.leafWidth).toBeGreaterThan(0)
  expect(dimensions.leafHeight / dimensions.leafWidth).toBeGreaterThan(1.25)
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth)

  const next = page.getByRole('button', { name: 'الصفحة التالية' })
  const previous = page.getByRole('button', { name: 'الصفحة السابقة' })
  await expect(next.locator('svg path')).toHaveAttribute('d', 'M19 12H5m6-6-6 6 6 6')
  await expect(previous.locator('svg path')).toHaveAttribute('d', 'M5 12h14m-6-6 6 6-6 6')
  await next.click()
  await expect(page.locator('[data-page-slot-current] [data-page-no="4"]')).toBeVisible()
  await previous.click()
  await expect(page.locator('[data-page-slot-current] [data-page-no="3"]')).toBeVisible()
  expect(errors).toEqual([])
})

test('recorded faces can be selected, edited, and previewed without a page reload', async ({ page, isMobile }) => {
  test.skip(Boolean(isMobile), 'Desktop workstation layout test')
  const key = '002:006:001'
  const sourceKey = '002:011:007'
  const chapter = '11111111-1111-4111-8111-111111111111'
  const root = '22222222-2222-4222-8222-222222222222'
  const makeItem = (n: number) => ({ id: `33333333-3333-4333-8333-33333333333${n}`,
    scopeType: 'WORD', startCanonicalKey: key, endCanonicalKey: key, targetAuthorityId: 'Q01',
    taxonomyId: chapter, corpusId: null, frameworkId: null, status: 'verified', version: 1,
    readingContext: 'BOTH', inheritanceAction: 'INHERIT', appliesToDescendants: false,
    colorOverride: null, notes: null, faces: [{ id: `44444444-4444-4444-8444-44444444444${n}`,
      faceType: 'HAMZAH', faceValue: { first: 'تحقيق' }, labelAr: `تحقيق ${n}`, preferenceStatus: '', sortOrder: 0 }],
    variants: [], sources: [] })
  let items = [1, 2, 3, 4].map(makeItem)
  const sourceItem = { ...makeItem(5), startCanonicalKey: sourceKey, endCanonicalKey: sourceKey,
    faces: [makeItem(5).faces[0], { ...makeItem(5).faces[0], id: '44444444-4444-4444-8444-444444444446', labelAr: 'تسهيل الثانية', sortOrder: 1 }] }
  let lastPatch: Record<string, unknown> | null = null
  let lastApply: Record<string, unknown> | null = null
  let lastCopy: Record<string, unknown> | null = null
  const capturedPatch = (): Record<string, unknown> | null => lastPatch
  const capturedCopy = (): Record<string, unknown> | null => lastCopy
  await page.route('**/api/mushaf-1441/qiraat-editor*', async (route) => {
    const url = new URL(route.request().url())
    const method = route.request().method()
    let result: unknown
    if (method === 'GET' && url.searchParams.has('sourceId')) {
      result = { occurrences: [
        { canonicalKey: key, surah: 2, ayah: 6, page: 3, token: 1, word: 'إِنَّ', state: 'source', verification: 'verified', existingVariant: 'تحقيق' },
        { canonicalKey: '002:006:002', surah: 2, ayah: 6, page: 3, token: 2, word: 'إِنَّ', state: 'add', verification: null, existingVariant: null },
        { canonicalKey: '002:006:003', surah: 2, ayah: 6, page: 3, token: 3, word: 'إِنَّ', state: 'existing', verification: 'verified', existingVariant: 'تحقيق' },
        { canonicalKey: '002:006:004', surah: 2, ayah: 6, page: 3, token: 4, word: 'إِنَّ', state: 'conflict', verification: 'verified', existingVariant: 'إبدال' },
      ] }
    } else if (method === 'GET' && url.searchParams.get('verified') === '1') {
      result = { matches: [{ id: sourceItem.id, canonicalKey: sourceKey, surah: 2, ayah: 11, page: 3,
        word: 'إِنَّ', authorityId: 'Q01', taxonomyId: chapter, readingContext: 'BOTH',
        faces: sourceItem.faces.map((face) => ({ label: face.labelAr })), status: 'verified' }] }
    } else if (method === 'GET') {
      result = { catalog: { entities: [{ id: 'Q01', parentId: null, type: 'reader', nameAr: 'نافع', color: null }],
        taxonomies: [{ id: root, parentId: null, category: 'USUL', nameAr: 'الأصول', code: 'USUL' },
          { id: chapter, parentId: root, category: 'USUL', nameAr: 'تغيير الهمز', code: 'USUL_HAMZ_CHANGE' }],
        sources: [], corpora: [], frameworks: [] }, annotations: url.searchParams.get('canonicalKey') === sourceKey ? [sourceItem] : items }
    } else if (method === 'DELETE') {
      const body = route.request().postDataJSON() as { items: Array<{ id: string }> }
      items = items.filter((item) => !body.items.some((selected) => selected.id === item.id))
      result = { deleted: body.items.length }
    } else if (method === 'PATCH') {
      const body = route.request().postDataJSON() as Record<string, unknown>
      lastPatch = body
      items = items.map((item) => item.id === body.id ? { ...item, readingContext: String(body.readingContext),
        version: item.version + 1, faces: body.faces as typeof item.faces } : item)
      result = { annotations: items }
    } else if (method === 'POST' && (route.request().postDataJSON() as { action?: string }).action === 'apply-occurrences') {
      lastApply = route.request().postDataJSON() as Record<string, unknown>
      result = { result: { added: 1, existing: 0, review: 0, conflicts: 0, invalid: 0 } }
    } else {
      lastCopy = route.request().postDataJSON() as Record<string, unknown>
      result = { annotations: items, result: 'created' }
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) })
  })
  page.on('dialog', (dialog) => void dialog.accept())
  await page.goto('/mushaf-1441/review?page=3')
  await page.locator('[data-page-slot-current] [data-quran-word-id]').first().click()
  const editor = page.locator('[data-qiraat-editor-pane="true"]')
  const recorded = editor.getByRole('region', { name: 'الأوجه المسجلة' })
  await expect(recorded.locator('input[type=checkbox]')).toHaveCount(4)
  await recorded.getByRole('button', { name: 'تحديد الكل' }).click()
  await recorded.locator('input[type=checkbox]').nth(3).uncheck()
  await recorded.getByRole('button', { name: 'حذف المحدد' }).click()
  await expect(recorded.locator('input[type=checkbox]')).toHaveCount(1)
  await recorded.getByRole('button', { name: 'تعديل' }).click()
  await editor.getByRole('button', { name: '✓ الوصل' }).click()
  await editor.getByRole('button', { name: 'تسهيل', exact: true }).click()
  await editor.getByRole('button', { name: 'حفظ التعديل' }).click()
  await expect.poll(() => capturedPatch()?.readingContext).toBe('WAQF_ONLY')
  expect((capturedPatch()?.faces as Array<{ faceValue: { first: string } }>)[0].faceValue.first).toBe('تسهيل')
  await recorded.getByRole('button', { name: 'تطبيق على جميع مواضع الكلمة' }).click()
  await expect(editor.getByText('تم العثور على 4 موضع')).toBeVisible()
  await editor.getByRole('button', { name: /تطبيق على المواضع الآمنة/ }).click()
  await expect.poll(() => (lastApply?.keys as string[] | undefined)?.length).toBe(1)
  await editor.getByRole('button', { name: /تمت مراجعة هذه الكلمة سابقًا/ }).click()
  await editor.getByRole('button', { name: 'اختيار الأوجه' }).click()
  const copyPanel = editor.getByText('اختر الأوجه المنسوخة').locator('..')
  await expect(copyPanel.locator('input[type=checkbox]')).toHaveCount(2)
  await copyPanel.locator('input[type=checkbox]').nth(1).uncheck()
  await copyPanel.getByRole('button', { name: 'نسخ إلى هذا الموضع' }).click()
  await expect.poll(() => (capturedCopy()?.faces as unknown[] | undefined)?.length).toBe(1)
  expect(capturedCopy()?.sourceAnnotationId).toBe(sourceItem.id)
})

test('mobile review workflow: Mushaf page -> tap word -> dedicated full editor -> back to Mushaf', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only workflow test')
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })

  await page.goto('/mushaf-1441/review?page=3')

  // View A: Mushaf view is visible, desktop editor pane is hidden
  const mobileMushaf = page.locator('[data-mobile-mushaf-view="true"]')
  await expect(mobileMushaf).toBeVisible()
  const desktopEditor = page.locator('[data-qiraat-editor-pane="true"]')
  await expect(desktopEditor).toBeHidden()

  // Top bar shows page title and page 3 / 604
  await expect(mobileMushaf.getByText('سورة البقرة')).toBeVisible()
  await expect(mobileMushaf.getByText(/3 \/ 604/)).toBeVisible()

  // Bottom navigation has RTL buttons
  const prevBtn = mobileMushaf.getByRole('button', { name: /السابقة/ })
  const nextBtn = mobileMushaf.getByRole('button', { name: /التالية/ })
  await expect(prevBtn).toBeVisible()
  await expect(nextBtn).toBeVisible()

  // Tap a Quran word
  const word = page.locator('[data-page-slot-current] [data-quran-word-id]').first()
  await expect(word).toBeVisible()
  await word.click()

  // View B: Dedicated Full-Screen Editor is opened
  const mobileEditor = page.locator('[data-mobile-review-editor="true"]')
  await expect(mobileEditor).toBeVisible()
  await expect(mobileMushaf).toBeHidden()

  // Top header shows Back to Mushaf and metadata
  const backBtn = mobileEditor.getByRole('button', { name: 'العودة إلى المصحف' })
  await expect(backBtn).toBeVisible()
  await expect(mobileEditor.getByText(/سورة البقرة/)).toBeVisible()

  // Bottom action bar shows Save and Save & Next buttons
  const saveBtn = mobileEditor.getByRole('button', { name: 'حفظ', exact: true })
  const saveAndNextBtn = mobileEditor.getByRole('button', { name: /حفظ والتالي/ })
  await expect(saveBtn).toBeVisible()
  await expect(saveAndNextBtn).toBeVisible()

  // Kind toggle allows switching between Farsh and Usul
  const usulTab = mobileEditor.getByRole('button', { name: /أصول القراءات/ })
  const farshTab = mobileEditor.getByRole('button', { name: /فرش الحروف/ })
  await expect(usulTab).toBeVisible()
  await expect(farshTab).toBeVisible()

  // Click Back to return to View A
  await backBtn.click()
  await expect(mobileMushaf).toBeVisible()
  await expect(mobileEditor).toBeHidden()

  expect(errors).toEqual([])
})

test('mobile editor handles unsaved changes guard on back navigation', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only workflow test')

  await page.goto('/mushaf-1441/review?page=3')
  const word = page.locator('[data-page-slot-current] [data-quran-word-id]').first()
  await expect(word).toBeVisible()
  await word.click()

  const mobileEditor = page.locator('[data-mobile-review-editor="true"]')
  await expect(mobileEditor).toBeVisible()

  // Switch to Usul al-Qira'at to make form dirty
  const usulTab = mobileEditor.getByRole('button', { name: /أصول القراءات/ })
  await usulTab.click()

  // Tap Back button
  const backBtn = mobileEditor.getByRole('button', { name: 'العودة إلى المصحف' })
  await backBtn.click()

  // Unsaved changes dialog should appear
  await expect(page.getByText('تنبيه: توجد تعديلات غير محفوظة')).toBeVisible()

  // Tapping "متابعة التعديل" dismisses modal and keeps editor open
  const continueBtn = page.getByRole('button', { name: 'متابعة التعديل' })
  await continueBtn.click()
  await expect(mobileEditor).toBeVisible()
  await expect(page.getByText('تنبيه: توجد تعديلات غير محفوظة')).toBeHidden()

  // Tapping Back and then "تجاهل التعديلات" discards changes and returns to View A
  await backBtn.click()
  await expect(page.getByText('تنبيه: توجد تعديلات غير محفوظة')).toBeVisible()
  const discardBtn = page.getByRole('button', { name: 'تجاهل التعديلات' })
  await discardBtn.click()

  const mobileMushaf = page.locator('[data-mobile-mushaf-view="true"]')
  await expect(mobileMushaf).toBeVisible()
  await expect(mobileEditor).toBeHidden()
})

