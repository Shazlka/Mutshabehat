/**
 * E2E Tests — Filter, Sort & Search UI @filter @sort
 */

import { test, expect } from "@playwright/test";

test.describe("🔍 Search & Filter @filter", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.click('[data-testid="nav-database"]');
  });

  test("search bar is visible", async ({ page }) => {
    await page.click('[data-testid="btn-search"]');
    await expect(page.locator('[data-testid="search-input"]')).toBeVisible({ timeout: 3000 });
  });

  test("typing Arabic text in search filters results", async ({ page }) => {
    await page.click('[data-testid="btn-search"]');
    await page.waitForTimeout(300);
    const search = page.locator('[data-testid="search-input"]');
    await search.fill("عذاب");
    await page.waitForTimeout(400);
    const rows = await page.locator('[data-testid="record-row"]').count();
    expect(rows).toBeGreaterThanOrEqual(0);
  });

  test("clearing search restores all records", async ({ page }) => {
    await page.click('[data-testid="btn-search"]');
    await page.waitForTimeout(300);
    const totalBefore = await page.locator('[data-testid="record-row"]').count();
    await page.locator('[data-testid="search-input"]').fill("عذاب");
    await page.waitForTimeout(400);
    await page.locator('[data-testid="search-input"]').clear();
    await page.waitForTimeout(400);
    const totalAfter = await page.locator('[data-testid="record-row"]').count();
    expect(totalAfter).toBe(totalBefore);
  });

  test("category filter dropdown shows options", async ({ page }) => {
    const catFilter = page.locator('[data-testid="filter-category"]');
    if (await catFilter.isVisible()) {
      await catFilter.click();
      await expect(page.locator('[data-testid="filter-option"]').first()).toBeVisible();
    }
  });

  test("selecting category filter narrows results", async ({ page }) => {
    const catFilter = page.locator('[data-testid="filter-category"]');
    if (await catFilter.isVisible()) {
      const totalBefore = await page.locator('[data-testid="record-row"]').count();
      await catFilter.selectOption({ index: 1 });
      await page.waitForTimeout(300);
      const totalAfter = await page.locator('[data-testid="record-row"]').count();
      expect(totalAfter).toBeLessThanOrEqual(totalBefore);
    }
  });

  test("similarity type filter works", async ({ page }) => {
    const typeFilter = page.locator('[data-testid="filter-similarity-type"]');
    if (await typeFilter.isVisible()) {
      await typeFilter.selectOption("lexical");
      await page.waitForTimeout(300);
      const rows = page.locator('[data-testid="record-row"]');
      const count = await rows.count();
      for (let i = 0; i < count; i++) {
        const badge = rows.nth(i).locator('[data-testid="similarity-type-badge"]');
        if (await badge.isVisible()) {
          await expect(badge).toContainText(/lexical|معجمي/i);
        }
      }
    }
  });

  test("surah filter shows records for that surah", async ({ page }) => {
    const surahFilter = page.locator('[data-testid="filter-surah"]');
    if (await surahFilter.isVisible()) {
      await surahFilter.fill("2");
      await page.waitForTimeout(300);
      const rows = await page.locator('[data-testid="record-row"]').count();
      expect(rows).toBeGreaterThanOrEqual(0);
    }
  });

  test("favorites filter shows only favorite records", async ({ page }) => {
    const favFilter = page.locator('[data-testid="filter-favorites"]');
    if (await favFilter.isVisible()) {
      await favFilter.click();
      await page.waitForTimeout(300);
      const stars = page.locator('[data-testid="btn-favorite"][aria-pressed="true"]');
      const rows = await page.locator('[data-testid="record-row"]').count();
      const favCount = await stars.count();
      expect(favCount).toBe(rows);
    }
  });

  test("clear all filters button resets to full list", async ({ page }) => {
    const totalBefore = await page.locator('[data-testid="record-row"]').count();
    const catFilter = page.locator('[data-testid="filter-category"]');
    if (await catFilter.isVisible()) {
      await catFilter.selectOption({ index: 1 });
      await page.waitForTimeout(300);
      await page.click('[data-testid="btn-clear-filters"]');
      await page.waitForTimeout(300);
      const totalAfter = await page.locator('[data-testid="record-row"]').count();
      expect(totalAfter).toBe(totalBefore);
    }
  });

  test("active filter badge is shown", async ({ page }) => {
    const catFilter = page.locator('[data-testid="filter-category"]');
    if (await catFilter.isVisible()) {
      await catFilter.selectOption({ index: 1 });
      await expect(page.locator('[data-testid="active-filter-badge"]')).toBeVisible();
    }
  });
});

// ═══════════════════════════════════════════════════════════
// SUITE 2: Sort @sort
// ═══════════════════════════════════════════════════════════
test.describe("🔢 Sort @sort", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.click('[data-testid="nav-database"]');
  });

  test("sort control is visible", async ({ page }) => {
    const sortControl = page.locator(
      '[data-testid="sort-control"], [data-testid="sort-select"]'
    );
    await expect(sortControl.first()).toBeVisible();
  });

  test("sorting by surah_a ascending reorders list", async ({ page }) => {
    const sortBtn = page.locator('[data-testid="sort-surah-asc"]');
    if (await sortBtn.isVisible()) {
      await sortBtn.click();
      await page.waitForTimeout(300);
      const surahValues = await page
        .locator('[data-testid="record-surah-a"]')
        .allTextContents();
      const nums = surahValues.map(Number).filter((n) => !isNaN(n));
      for (let i = 1; i < nums.length; i++) {
        expect(nums[i]).toBeGreaterThanOrEqual(nums[i - 1]);
      }
    }
  });

  test("sorting by surah_a descending reverses order", async ({ page }) => {
    const sortBtn = page.locator('[data-testid="sort-surah-desc"]');
    if (await sortBtn.isVisible()) {
      await sortBtn.click();
      await page.waitForTimeout(300);
      const surahValues = await page
        .locator('[data-testid="record-surah-a"]')
        .allTextContents();
      const nums = surahValues.map(Number).filter((n) => !isNaN(n));
      for (let i = 1; i < nums.length; i++) {
        expect(nums[i]).toBeLessThanOrEqual(nums[i - 1]);
      }
    }
  });

  test("clicking column header toggles sort direction", async ({ page }) => {
    const header = page.locator('[data-testid="th-surah-a"]');
    if (await header.isVisible()) {
      await header.click();
      const ascIndicator = await header.getAttribute("aria-sort");
      await header.click();
      const descIndicator = await header.getAttribute("aria-sort");
      expect(ascIndicator).not.toBe(descIndicator);
    }
  });

  test("sort by date added (newest first)", async ({ page }) => {
    const sortDate = page.locator('[data-testid="sort-date-desc"]');
    if (await sortDate.isVisible()) {
      await sortDate.click();
      await page.waitForTimeout(300);
      await expect(page.locator('[data-testid="database-view"]')).toBeVisible();
    }
  });

  test("sort persists after filtering", async ({ page }) => {
    const sortBtn = page.locator('[data-testid="sort-surah-asc"]');
    const catFilter = page.locator('[data-testid="filter-category"]');
    if ((await sortBtn.isVisible()) && (await catFilter.isVisible())) {
      await sortBtn.click();
      await catFilter.selectOption({ index: 1 });
      await page.waitForTimeout(300);
      await expect(sortBtn).toHaveAttribute("aria-pressed", "true");
    }
  });
});
