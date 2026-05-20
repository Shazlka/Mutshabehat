/**
 * E2E Tests — Windows & Navigation @windows
 * Uses Playwright to test all app windows, panels, modals
 */

import { test, expect } from "@playwright/test";

// ─── Selectors (update to match your actual app selectors) ──
const SEL = {
  // Main layout
  appRoot: '[data-testid="app-root"]',
  sidebar: '[data-testid="sidebar"]',
  mainContent: '[data-testid="main-content"]',
  header: '[data-testid="header"]',

  // Navigation tabs / windows
  navDatabase: '[data-testid="nav-database"]',
  navAnalysis: '[data-testid="nav-analysis"]',
  navSettings: '[data-testid="nav-settings"]',
  navExport: '[data-testid="nav-export"]',

  // Modals
  modalOverlay: '[data-testid="modal-overlay"]',
  modalClose: '[data-testid="modal-close"]',
  addRecordModal: '[data-testid="modal-add-record"]',
  editRecordModal: '[data-testid="modal-edit-record"]',
  deleteConfirmModal: '[data-testid="modal-delete-confirm"]',
  importModal: '[data-testid="modal-import"]',
  exportModal: '[data-testid="modal-export"]',
  settingsPanel: '[data-testid="settings-panel"]',

  // Action buttons
  btnAddRecord: '[data-testid="btn-add-record"]',
  btnImport: '[data-testid="btn-import"]',
  btnExport: '[data-testid="btn-export"]',
  btnSettings: '[data-testid="btn-settings"]',
  btnRefresh: '[data-testid="btn-refresh"]',
};

// ═══════════════════════════════════════════════════════════
// SUITE 1: App Load & Basic Render @windows
// ═══════════════════════════════════════════════════════════
test.describe("🪟 App Load @windows", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("renders app without crash", async ({ page }) => {
    await expect(page).toHaveTitle(/mutashabihat|متشابهات/i);
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
      const el = document.querySelector("body");
      return getComputedStyle(el).fontFamily;
    });
    expect(fontFamily).toMatch(/Amiri/i);
  });

  test("dark theme is applied by default", async ({ page }) => {
    const bodyClass = await page.locator("body").getAttribute("class");
    expect(bodyClass).toMatch(/dark/);
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

// ═══════════════════════════════════════════════════════════
// SUITE 2: Navigation Windows @windows
// ═══════════════════════════════════════════════════════════
test.describe("🧭 Navigation @windows", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("clicking Database nav shows database window", async ({ page }) => {
    await page.click(SEL.navDatabase);
    await expect(page.locator('[data-testid="database-view"]')).toBeVisible();
  });

  test("clicking Settings nav opens settings panel", async ({ page }) => {
    await page.click(SEL.navSettings);
    await expect(page.locator(SEL.settingsPanel)).toBeVisible();
  });

  test("clicking Export nav opens export panel", async ({ page }) => {
    await page.click(SEL.navExport);
    await expect(page.locator(SEL.exportModal)).toBeVisible();
  });

  test("keyboard shortcut Escape closes open panel", async ({ page }) => {
    await page.click(SEL.navSettings);
    await page.keyboard.press("Escape");
    await expect(page.locator(SEL.settingsPanel)).not.toBeVisible();
  });

  test("browser back/forward navigates correctly", async ({ page }) => {
    await page.click(SEL.navAnalysis);
    await page.goBack();
    await expect(page.locator('[data-testid="database-view"]')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════
// SUITE 3: Add Record Modal @windows
// ═══════════════════════════════════════════════════════════
test.describe("➕ Add Record Modal @windows", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("Add button opens modal", async ({ page }) => {
    await page.click(SEL.btnAddRecord);
    await expect(page.locator(SEL.addRecordModal)).toBeVisible();
  });

  test("modal has form fields for surah and ayah", async ({ page }) => {
    await page.click(SEL.btnAddRecord);
    await expect(page.locator('[name="surah_a"]')).toBeVisible();
    await expect(page.locator('[name="ayah_a"]')).toBeVisible();
  });

  test("modal close button dismisses modal", async ({ page }) => {
    await page.click(SEL.btnAddRecord);
    await page.click(SEL.modalClose);
    await expect(page.locator(SEL.addRecordModal)).not.toBeVisible();
  });

  test("clicking overlay closes modal", async ({ page }) => {
    await page.click(SEL.btnAddRecord);
    await page.click(SEL.modalOverlay, { position: { x: 10, y: 10 } });
    await expect(page.locator(SEL.addRecordModal)).not.toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════
// SUITE 4: Delete Confirm Modal @windows
// ═══════════════════════════════════════════════════════════
test.describe("🗑️ Delete Confirm Modal @windows", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("delete button shows confirmation modal", async ({ page }) => {
    const firstDeleteBtn = page.locator('[data-testid="btn-delete-record"]').first();
    if (await firstDeleteBtn.isVisible()) {
      await firstDeleteBtn.click();
      await expect(page.locator(SEL.deleteConfirmModal)).toBeVisible();
    }
  });

  test("cancel button on delete modal keeps record", async ({ page }) => {
    const count_before = await page.locator('[data-testid="record-row"]').count();
    const firstDeleteBtn = page.locator('[data-testid="btn-delete-record"]').first();
    if (await firstDeleteBtn.isVisible()) {
      await firstDeleteBtn.click();
      await page.click('[data-testid="btn-delete-cancel"]');
      const count_after = await page.locator('[data-testid="record-row"]').count();
      expect(count_after).toBe(count_before);
    }
  });
});

// ═══════════════════════════════════════════════════════════
// SUITE 5: Responsive / Mobile @windows
// ═══════════════════════════════════════════════════════════
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
    // On mobile, sidebar may be hidden or collapsed
    const isHidden = !(await sidebar.isVisible());
    const hasClass = await sidebar.evaluate(
      (el) => el.classList.contains("collapsed") || el.classList.contains("hidden")
    );
    expect(isHidden || hasClass).toBe(true);
  });
});
