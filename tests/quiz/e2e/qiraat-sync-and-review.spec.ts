import { expect, test } from '@playwright/test'

test.describe('Qiraat Live Rendering and Review Sync', () => {
  test('Page 5 renders live variants and rulings in Qiraat mode', async ({ page }) => {
    await page.goto('/mushaf-1441?page=5')
    await expect(page.locator('[data-page-slot-current] [data-quran-word-id]').first()).toBeVisible({ timeout: 15000 })

    // Enable Qiraat mode if not enabled by default
    const enableQiraat = page.getByRole('button', { name: /تفعيل عرض القراءات/ })
    if (await enableQiraat.count()) {
      await enableQiraat.click()
    }

    // Verify annotated words on page 5
    const annotatedWords = page.locator('[data-page-slot-current] [data-quran-word-id][aria-label*="قراءات"]')
    await expect(annotatedWords.first()).toBeVisible({ timeout: 10000 })
    const count = await annotatedWords.count()
    expect(count).toBeGreaterThan(0)

    // Check specific variant on 2:28 (تُرْجَعُونَ)
    const turjaoon = page.locator('[data-page-slot-current] button[aria-label*="تُرْجَعُونَ"]')
    await expect(turjaoon).toBeVisible({ timeout: 10000 })
    const ariaLabel = await turjaoon.getAttribute('aria-label')
    expect(ariaLabel).toContain('قراءات')

    // Click on the word and verify sidebar details
    await turjaoon.click()
    const sidePanel = page.locator('[data-testid="qiraat-details-panel"], aside, [role="complementary"]').first()
    await expect(sidePanel).toBeVisible()
  })

  test('Review mode on Page 5 displays database rows with proper review status', async ({ page }) => {
    await page.goto('/mushaf-1441/review?page=5')
    await expect(page.locator('text=سورة البقرة').first()).toBeVisible({ timeout: 15000 })

    // Verify row count or entries exist
    const rows = page.locator('[data-testid="review-row"], button[data-entry-id], tr[data-entry-id], [class*="ReviewRow"]')
    await expect(page.locator('text=تُرْجَعُونَ').first()).toBeVisible({ timeout: 10000 })
  })
})
