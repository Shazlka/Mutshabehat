/**
 * Visual Regression Tests @visual
 * Screenshots compared against baseline on every push
 * Run with --update-snapshots to regenerate baselines
 */

import { test, expect } from "@playwright/test";

// ── Helper ────────────────────────────────────────────────
async function goToDatabase(page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const choiceCard = page.locator("button.choice-card").first();
  if (await choiceCard.isVisible()) {
    await choiceCard.click();
    await page.waitForTimeout(500);
  }
  await page.waitForLoadState("networkidle");
}

// ═══════════════════════════════════════════════════════════
// SUITE 1: Home Screen @visual
// ═══════════════════════════════════════════════════════════
test.describe("Visual — Home Screen @visual", () => {
  test("home screen matches baseline", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot("home-screen.png", {
      fullPage: false,
    });
  });

  test("header matches baseline", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const header = page.locator('[data-testid="header"]');
    await expect(header).toHaveScreenshot("header.png");
  });
});

// ═══════════════════════════════════════════════════════════
// SUITE 2: Database View @visual
// ═══════════════════════════════════════════════════════════
test.describe("Visual — Database View @visual", () => {
  test.beforeEach(async ({ page }) => {
    await goToDatabase(page);
  });

  test("database view matches baseline", async ({ page }) => {
    await expect(page.locator('[data-testid="database-view"]')).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot("database-view.png", {
      fullPage: false,
    });
  });

  test("first record card matches baseline", async ({ page }) => {
    const firstCard = page.locator('[data-testid="record-row"]').first();
    if (await firstCard.isVisible()) {
      await expect(firstCard).toHaveScreenshot("record-card.png");
    }
  });

  test("sort control matches baseline", async ({ page }) => {
    const sortControl = page.locator('[data-testid="sort-control"]');
    if (await sortControl.isVisible()) {
      await expect(sortControl).toHaveScreenshot("sort-control.png");
    }
  });

  test("record count badge matches baseline", async ({ page }) => {
    const counter = page.locator('[data-testid="record-count"]');
    await expect(counter).toBeVisible();
    await expect(counter).toHaveScreenshot("record-count.png");
  });
});

// ═══════════════════════════════════════════════════════════
// SUITE 3: Settings Modal @visual
// ═══════════════════════════════════════════════════════════
test.describe("Visual — Settings Modal @visual", () => {
  test("settings modal matches baseline", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.click('[data-testid="btn-settings"]');
    await expect(
      page.locator('[data-testid="modal-settingsModal"]')
    ).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(300);
    await expect(
      page.locator('[data-testid="modal-settingsModal"]')
    ).toHaveScreenshot("settings-modal.png");
  });
});

// ═══════════════════════════════════════════════════════════
// SUITE 4: Add Record Modal @visual
// ═══════════════════════════════════════════════════════════
test.describe("Visual — Add Record Modal @visual", () => {
  test("add record modal matches baseline", async ({ page }) => {
    await goToDatabase(page);
    await page.click('[data-testid="btn-add-record"]');
    await expect(page.locator(".modal-backdrop")).toBeVisible({
      timeout: 5000,
    });
    await page.waitForTimeout(300);
    await expect(page.locator(".modal-backdrop")).toHaveScreenshot(
      "add-record-modal.png"
    );
  });
});

// ═══════════════════════════════════════════════════════════
// SUITE 5: Theme Consistency @visual
// ═══════════════════════════════════════════════════════════
test.describe("Visual — Theme @visual", () => {
  test("dark theme applied correctly", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const theme = await page.locator("body").getAttribute("data-theme");
    expect(theme).toBeDefined();
    await expect(page.locator("body")).toHaveScreenshot("theme-body.png", {
      fullPage: false,
    });
  });

  test("RTL layout renders correctly", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const dir = await page.locator("html").getAttribute("dir");
    expect(dir).toBe("rtl");
    await expect(page.locator('[data-testid="header"]')).toHaveScreenshot(
      "rtl-header.png"
    );
  });
});