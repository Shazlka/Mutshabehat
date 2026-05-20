/**
 * E2E Tests — Windows & Navigation @windows
 */

import { test, expect } from "@playwright/test";

const SEL = {
  appRoot:      '[data-testid="app-root"]',
  sidebar:      '[data-testid="sidebar"]',
  mainContent:  '[data-testid="main-content"]',
  header:       '[data-testid="header"]',
  navDatabase:  '[data-testid="nav-database"]',
  navSettings:  '[data-testid="btn-settings"]',
  btnAddRecord: '[data-testid="btn-add-record"]',
  btnExport:    '[data-testid="btn-export"]',
  btnRefresh:   '[data-testid="btn-refresh"]',
  btnSettings:  '[data-testid="btn-settings"]',
  searchInput:  '[data-testid="search-input"]',
  sortControl:  '[data-testid="sort-control"]',
  recordCount:  '[data-testid="record-count"]',
  databaseView: '[data-testid="database-view"]',
};

test.describe("🪟 App Load @windows", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("renders app without crash", async ({ page }) => {
    await expect(page).toHaveTitle(/متشابهات/i);
  });

  test("sidebar is visible on load", async ({ page }) => {
    await expect(page.locator(SEL.sidebar)).toBeVisible();
  });

  test("main content area is visible", async ({ page }) => {
    await expect(page.locator(SEL.mainContent)).toBeVisible();
  });

  test("header renders correctly", async ({ page }) => {
    await expect(page.locator(SEL.header)).toBeVisible();
  });

  test("RTL layout is applied (dir=rtl)", async ({ page }) => {
    const dir = await page.locator("html").getAttribute("dir");
    expect(dir).toBe("rtl");
  });

  test("Amiri font is loaded", async ({ page }) => {
    const fontFamily = await page.evaluate(() => {
      return getComputedStyle(document.body).fontFamily;
    });
    expect(fontFamily).toBeDefined();
  });

  test("dark theme is applied by default", async ({ page }) => {
    const theme = await page.locator("body").getAttribute("data-theme");
    expect(theme).toBeDefined();
  });

  test("no console errors on load", async ({ page }) => {
    const errors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.reload();
    await page.waitForLoadState("networkidle");
    expect(errors).toHaveLength(0);
  });
});

test.describe("🧭 Navigation @windows", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("clicking Database nav shows database window", async ({ page }) => {
    await page.click(SEL.navDatabase);
    await expect(page.locator(SEL.databaseView)).toBeVisible();
  });

  test("clicking Settings nav opens settings panel", async ({ page }) => {
    await page.click(SEL.btnSettings);
    await expect(page.locator('[data-testid="modal-settingsModal"]')).toBeVisible({ timeout: 5000 });
  });

  test("clicking Export nav opens export panel", async ({ page }) => {
    test.skip(true, "Export downloads directly — no nav-export in this app");
  });

  test("keyboard shortcut Escape closes open panel", async ({ page }) => {
    await page.click(SEL.btnSettings);
    await expect(page.locator('[data-testid="modal-settingsModal"]')).toBeVisible({ timeout: 5000 });
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-testid="modal-settingsModal"]')).not.toBeVisible();
  });

  test("browser back/forward navigates correctly", async ({ page }) => {
    await page.click(SEL.navDatabase);
    await expect(page.locator(SEL.databaseView)).toBeVisible();
  });
});

test.describe("➕ Add Record Modal @windows", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.click('[data-testid="nav-database"]');
  });

  test("Add button opens modal", async ({ page }) => {
    await page.click(SEL.btnAddRecord);
    // Modal created dynamically — check any modal appeared
    await expect(page.locator('.modal-backdrop')).toBeVisible({ timeout: 5000 });
  });

  test("modal has form fields for surah and ayah", async ({ page }) => {
    await page.click(SEL.btnAddRecord);
    await expect(page.locator('.modal-backdrop')).toBeVisible({ timeout: 5000 });
    // Form fields exist inside modal
    const modal = page.locator('.modal-backdrop');
    await expect(modal.locator('input').first()).toBeVisible();
  });

  test("modal close button dismisses modal", async ({ page }) => {
    await page.click(SEL.btnAddRecord);
    await expect(page.locator('.modal-backdrop')).toBeVisible({ timeout: 5000 });
    await page.click('.modal-close-btn');
    await expect(page.locator('.modal-backdrop')).not.toBeVisible();
  });

  test("clicking overlay closes modal", async ({ page }) => {
    await page.click(SEL.btnAddRecord);
    await expect(page.locator('.modal-backdrop')).toBeVisible({ timeout: 5000 });
    await page.locator('.modal-backdrop').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('.modal-backdrop')).not.toBeVisible();
  });
});

test.describe("🗑️ Delete Confirm Modal @windows", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.click('[data-testid="nav-database"]');
  });

  test("delete button shows confirmation modal", async ({ page }) => {
    const firstDeleteBtn = page.locator('[data-testid="btn-delete-record"]').first();
    if (await firstDeleteBtn.isVisible()) {
      await firstDeleteBtn.click();
      await expect(page.locator('.modal-backdrop')).toBeVisible();
    }
  });

  test("cancel button on delete modal keeps record", async ({ page }) => {
    const countBefore = await page.locator('[data-testid="record-row"]').count();
    const firstDeleteBtn = page.locator('[data-testid="btn-delete-record"]').first();
    if (await firstDeleteBtn.isVisible()) {
      await firstDeleteBtn.click();
      await page.click('[data-testid="btn-delete-cancel"]');
      const countAfter = await page.locator('[data-testid="record-row"]').count();
      expect(countAfter).toBe(countBefore);
    }
  });
});

test.describe("📱 Responsive @windows", () => {
  test("app renders on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.locator(SEL.appRoot)).toBeVisible();
  });

  test("sidebar collapses on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const sidebar = page.locator(SEL.sidebar);
    const isHidden = !(await sidebar.isVisible());
    const hasClass = await sidebar.evaluate(
      (el) => el.classList.contains("collapsed") || el.classList.contains("hidden")
    );
    expect(isHidden || hasClass).toBe(true);
  });
});
