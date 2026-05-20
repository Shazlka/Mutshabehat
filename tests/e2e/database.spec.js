/**
 * E2E Tests — Database UI Operations @database
 * Tests: view, add, edit, delete, search, paginate
 */

import { test, expect } from "@playwright/test";

const FIXTURE_RECORD = {
  surah_a: "2",
  ayah_a: "255",
  surah_b: "3",
  ayah_b: "1",
  arabic_a: "اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ",
  arabic_b: "اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ",
  keyword: "لا إله إلا هو",
  category: "توحيد",
  similarity_type: "lexical",
  notes: "آية الكرسي وافتتاح آل عمران",
};

test.describe("🗄️ Database — View @database", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.click('[data-testid="nav-database"]');
  });

  test("database table/list is visible", async ({ page }) => {
    await expect(page.locator('[data-testid="database-view"]')).toBeVisible();
  });

  test("record count is displayed", async ({ page }) => {
    await expect(page.locator('[data-testid="record-count"]')).toBeVisible();
  });

  test("column headers are visible", async ({ page }) => {
    const headers = page.locator('[data-testid="table-header"]');
    await expect(headers.first()).toBeVisible();
  });

  test("empty state shown when no records", async ({ page }) => {
    // Clear DB via app if UI allows, else skip
    const clearBtn = page.locator('[data-testid="btn-clear-db"]');
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
      await page.click('[data-testid="btn-confirm-clear"]');
      await expect(page.locator('[data-testid="empty-state"]')).toBeVisible();
    }
  });
});

test.describe("➕ Database — Add Record @database", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.click('[data-testid="nav-database"]');
  });

  test("can open Add Record form", async ({ page }) => {
    await page.click('[data-testid="btn-add-record"]');
    await expect(page.locator('[data-testid="modal-add-record"]')).toBeVisible();
  });

  test("form fields accept Arabic text", async ({ page }) => {
    await page.click('[data-testid="btn-add-record"]');
    const field = page.locator('[name="arabic_a"]');
    await field.fill(FIXTURE_RECORD.arabic_a);
    await expect(field).toHaveValue(FIXTURE_RECORD.arabic_a);
  });

  test("surah/ayah number fields accept numeric input", async ({ page }) => {
    await page.click('[data-testid="btn-add-record"]');
    await page.locator('[name="surah_a"]').fill(FIXTURE_RECORD.surah_a);
    await page.locator('[name="ayah_a"]').fill(FIXTURE_RECORD.ayah_a);
    await expect(page.locator('[name="surah_a"]')).toHaveValue(FIXTURE_RECORD.surah_a);
  });

  test("submitting complete form adds record to list", async ({ page }) => {
    const countBefore = await page.locator('[data-testid="record-row"]').count();

    await page.click('[data-testid="btn-add-record"]');
    await page.locator('[name="surah_a"]').fill(FIXTURE_RECORD.surah_a);
    await page.locator('[name="ayah_a"]').fill(FIXTURE_RECORD.ayah_a);
    await page.locator('[name="surah_b"]').fill(FIXTURE_RECORD.surah_b);
    await page.locator('[name="ayah_b"]').fill(FIXTURE_RECORD.ayah_b);
    await page.locator('[name="arabic_a"]').fill(FIXTURE_RECORD.arabic_a);
    await page.locator('[name="keyword"]').fill(FIXTURE_RECORD.keyword);
    await page.locator('[name="category"]').fill(FIXTURE_RECORD.category);
    await page.click('[data-testid="btn-submit-record"]');

    const countAfter = await page.locator('[data-testid="record-row"]').count();
    expect(countAfter).toBe(countBefore + 1);
  });

  test("required fields show validation error when empty", async ({ page }) => {
    await page.click('[data-testid="btn-add-record"]');
    await page.click('[data-testid="btn-submit-record"]');
    await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
  });
});

test.describe("✏️ Database — Edit Record @database", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.click('[data-testid="nav-database"]');
  });

  test("edit button opens edit modal with existing data", async ({ page }) => {
    const firstEdit = page.locator('[data-testid="btn-edit-record"]').first();
    if (await firstEdit.isVisible()) {
      await firstEdit.click();
      await expect(page.locator('[data-testid="modal-edit-record"]')).toBeVisible();
      // Form should be pre-populated
      const surahField = page.locator('[name="surah_a"]');
      const value = await surahField.inputValue();
      expect(value.length).toBeGreaterThan(0);
    }
  });

  test("editing notes field saves correctly", async ({ page }) => {
    const firstEdit = page.locator('[data-testid="btn-edit-record"]').first();
    if (await firstEdit.isVisible()) {
      await firstEdit.click();
      const notes = page.locator('[name="notes"]');
      await notes.clear();
      await notes.fill("ملاحظة محدّثة من الاختبار");
      await page.click('[data-testid="btn-submit-record"]');
      await expect(page.locator("text=ملاحظة محدّثة من الاختبار")).toBeVisible();
    }
  });
});

test.describe("🗑️ Database — Delete Record @database", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.click('[data-testid="nav-database"]');
  });

  test("confirming delete removes record from list", async ({ page }) => {
    const countBefore = await page.locator('[data-testid="record-row"]').count();
    if (countBefore === 0) test.skip();

    await page.locator('[data-testid="btn-delete-record"]').first().click();
    await page.click('[data-testid="btn-delete-confirm"]');

    const countAfter = await page.locator('[data-testid="record-row"]').count();
    expect(countAfter).toBe(countBefore - 1);
  });
});

test.describe("⭐ Database — Favorites @database", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.click('[data-testid="nav-database"]');
  });

  test("clicking favorite star toggles state", async ({ page }) => {
    const star = page.locator('[data-testid="btn-favorite"]').first();
    if (await star.isVisible()) {
      const before = await star.getAttribute("aria-pressed");
      await star.click();
      const after = await star.getAttribute("aria-pressed");
      expect(after).not.toBe(before);
    }
  });
});

test.describe("📄 Database — Pagination @database", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.click('[data-testid="nav-database"]');
  });

  test("next page button is present when records exceed page size", async ({ page }) => {
    const nextBtn = page.locator('[data-testid="btn-next-page"]');
    const count = await page.locator('[data-testid="record-row"]').count();
    if (count > 0) {
      // pagination should be visible if total > page size
      await expect(nextBtn.or(page.locator('[data-testid="pagination"]'))).toBeVisible();
    }
  });

  test("clicking next page shows different records", async ({ page }) => {
    const nextBtn = page.locator('[data-testid="btn-next-page"]');
    if (await nextBtn.isEnabled()) {
      const firstRecordBefore = await page
        .locator('[data-testid="record-row"]')
        .first()
        .textContent();
      await nextBtn.click();
      const firstRecordAfter = await page
        .locator('[data-testid="record-row"]')
        .first()
        .textContent();
      expect(firstRecordAfter).not.toBe(firstRecordBefore);
    }
  });
});
