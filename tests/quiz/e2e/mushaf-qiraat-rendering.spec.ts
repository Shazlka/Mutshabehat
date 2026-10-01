import { expect, test } from '@playwright/test'

test('Qiraat annotated Mushaf words retain visible QCF glyph text', async ({ page }) => {
  await page.goto('/mushaf-1441?page=1')
  await expect(page.locator('[data-page-slot-current] [data-quran-word-id]').first()).toBeVisible()

  const enableQiraat = page.getByRole('button', { name: /تفعيل عرض القراءات/ })
  if (await enableQiraat.count()) await enableQiraat.click()

  const annotatedWord = page.locator('[data-page-slot-current] [data-quran-word-id][aria-label*="قراءات مختلفة"]').first()
  await expect(annotatedWord).toBeVisible()
  await expect.poll(() => annotatedWord.evaluate((word) => getComputedStyle(word).fontFamily), { timeout: 20_000 }).toContain('QCFV2-P1')
  const glyph = annotatedWord.locator(':scope > span > span:not([aria-hidden="true"])')
  await expect.poll(() => glyph.textContent()).not.toBe('')

  const rendered = await annotatedWord.evaluate((button) => {
    const glyph = button.querySelector(':scope > span > span:not([aria-hidden="true"])')
    const buttonStyle = getComputedStyle(button)
    const glyphStyle = glyph ? getComputedStyle(glyph) : null
    return {
      glyphText: glyph?.textContent?.trim() ?? '',
      fontFamily: buttonStyle.fontFamily,
      textFill: buttonStyle.webkitTextFillColor,
      width: button.getBoundingClientRect().width,
      backgroundClip: glyphStyle?.backgroundClip ?? '',
      backgroundImage: glyphStyle?.backgroundImage ?? '',
    }
  })

  expect(rendered.glyphText).not.toBe('')
  expect(rendered.fontFamily).toContain('QCFV2-P1')
  expect(rendered.textFill).not.toBe('rgba(0, 0, 0, 0)')
  expect(rendered.width).toBeGreaterThan(0)
  expect(rendered.backgroundClip).not.toBe('text')
  expect(rendered.backgroundImage).toBe('none')

  const sharedWords = await page.locator('[data-page-slot-current] [data-quran-word-id][data-qiraat-multi-reader="true"]').evaluateAll((words) =>
    words.map((word) => {
      const glyph = word.querySelector(':scope > span > span:not([aria-hidden="true"])')
      const style = getComputedStyle(word)
      const glyphStyle = glyph ? getComputedStyle(glyph) : null
      return {
        label: word.getAttribute('aria-label') ?? '',
        color: style.color,
        text: glyph?.textContent?.trim() ?? '',
        width: word.getBoundingClientRect().width,
        fontFamily: style.fontFamily,
        textFill: style.webkitTextFillColor,
        backgroundClip: glyphStyle?.backgroundClip ?? '',
        backgroundImage: glyphStyle?.backgroundImage ?? '',
      }
    }),
  )
  expect(sharedWords.length).toBeGreaterThan(1)
  expect(new Set(sharedWords.map((word) => word.color)).size).toBe(1)
  expect(sharedWords[0].color).toBe('rgb(63, 98, 18)')
  expect(sharedWords.every((word) => word.text && word.width > 0 && word.fontFamily.includes('QCFV2-P1'))).toBe(true)
  expect(sharedWords.every((word) => word.textFill !== 'rgba(0, 0, 0, 0)')).toBe(true)
  expect(sharedWords.every((word) => word.backgroundClip !== 'text' && word.backgroundImage === 'none')).toBe(true)
  expect(sharedWords.some((word) => word.label.includes('1:4'))).toBe(true)
  expect(sharedWords.some((word) => word.label.includes('1:6'))).toBe(true)
  expect(sharedWords.filter((word) => word.label.includes('1:7')).length).toBeGreaterThanOrEqual(3)
})
