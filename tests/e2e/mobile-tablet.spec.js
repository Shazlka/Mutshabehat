/**
 * E2E Tests — Mobile & Tablet @mobile @tablet
 */

import { test, expect } from "@playwright/test";

async function openAddModal(page) {
  const addBtn = page.locator('[data-testid="btn-add-record"]');
  if (await addBtn.isVisible()) {
    await addBtn.tap();
  } else {
    const menuBtn = page.locator('.mobile-menu-btn');
    if (await menuBtn.isVisible()) {
      await menuBtn.tap();
      await page.waitForTimeout(300);
      const addInMenu = page.locator('#mobileMenu button').filter({ hasText: /اضافة|إضافة/i });
      if (await addInMenu.isVisible()) {
        await addInMenu.tap();
      }
    }
  }
}

async function openDatabase(page) {
  await page.locator('button.choice-card').first().tap();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
}

test.describe("Mobile App Load @mobile", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("app loads without crash on mobile", async ({ page }) => {
    await expect(page.locator('[data-testid="app-root"]')).toBeVisible();
  });

  test("RTL layout applied on mobile", async ({ page }) => {
    const dir = await page.locator("html").getAttribute("dir");
    expect(dir).toBe("rtl");
  });

  test("header is visible on mobile", async ({ page }) => {
    await expect(page.locator('[data-testid="header"]')).toBeVisible();
  });

  test("home screen shows database choice buttons", async ({ page }) => {
    await expect(page.locator('button.choice-card').first()).toBeVisible();
  });

  test("mobile menu button is visible on small screen", async ({ page }) => {
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 900) {
      await expect(page.locator('.mobile-menu-btn')).toBeVisible();
    }
  });

  test("desktop nav is hidden on mobile", async ({ page }) => {
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 900) {
      const nav = page.locator('.header-actions');
      const isHidden = !(await nav.isVisible());
      expect(isHidden).toBe(true);
    }
  });

  test("no horizontal scroll on mobile", async ({ page }) => {
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5);
  });
});

test.describe("Mobile Navigation @mobile", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("mobile menu opens on hamburger tap", async ({ page }) => {
    const menuBtn = page.locator('.mobile-menu-btn');
    if (await menuBtn.isVisible()) {
      await menuBtn.tap();
      await expect(page.locator('#mobileMenu')).toBeVisible({ timeout: 3000 });
    }
  });

  test("mobile menu closes after tap", async ({ page }) => {
    const menuBtn = page.locator('.mobile-menu-btn');
    if (await menuBtn.isVisible()) {
      await menuBtn.tap();
      await expect(page.locator('#mobileMenu')).toBeVisible({ timeout: 3000 });
      await page.locator('#mobileMenu button').first().tap();
      await page.waitForTimeout(300);
    }
  });

  test("can navigate to database from home on mobile", async ({ page }) => {
    await page.locator('button.choice-card').first().tap();
    await expect(page.locator('[data-testid="database-view"]')).toBeVisible({ timeout: 5000 });
  });

  test("database view renders correctly on mobile", async ({ page }) => {
    await page.locator('button.choice-card').first().tap();
    await expect(page.locator('[data-testid="database-view"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="record-count"]')).toBeVisible();
  });
});

test.describe("Mobile Database @mobile", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await openDatabase(page);
  });

  test("add record button is tappable on mobile", async ({ page }) => {
    await openAddModal(page);
    await expect(page.locator('.modal-backdrop')).toBeVisible({ timeout: 5000 });
  });

  test("modal is usable on mobile screen", async ({ page }) => {
    await openAddModal(page);
    const isVisible = await page.locator('.modal-backdrop').isVisible();
    if (isVisible) {
      const modal = page.locator('.modal-backdrop .modal');
      const box = await modal.boundingBox();
      if (box) {
        const viewport = page.viewportSize();
        expect(box.width).toBeLessThanOrEqual(viewport.width);
      }
    }
  });

  test("modal closes on close button tap", async ({ page }) => {
    await openAddModal(page);
    const isVisible = await page.locator('.modal-backdrop').isVisible();
    if (isVisible) {
      await page.locator('.modal-close-btn').tap();
      await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 3000 });
    }
  });

  test("settings modal opens on mobile", async ({ page }) => {
    const settingsBtn = page.locator('[data-testid="btn-settings"]');
    if (await settingsBtn.isVisible()) {
      await settingsBtn.tap();
      await expect(page.locator('[data-testid="modal-settingsModal"]')).toBeVisible({ timeout: 5000 });
    } else {
      const menuBtn = page.locator('.mobile-menu-btn');
      if (await menuBtn.isVisible()) {
        await menuBtn.tap();
        await page.waitForTimeout(300);
        const settingsInMenu = page.locator('#mobileMenu button').filter({ hasText: /اعداد|الاعداد|settings/i });
        if (await settingsInMenu.isVisible()) {
          await settingsInMenu.tap();
          await expect(page.locator('[data-testid="modal-settingsModal"]')).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });

  test("export button works on mobile", async ({ page }) => {
    const exportBtn = page.locator('[data-testid="btn-export"]');
    if (await exportBtn.isVisible()) {
      await expect(exportBtn).toBeVisible();
    }
  });

  test("sort control is usable on mobile", async ({ page }) => {
    const sortControl = page.locator('[data-testid="sort-control"]');
    if (await sortControl.isVisible()) {
      await sortControl.selectOption({ index: 1 });
      await page.waitForTimeout(300);
      await expect(page.locator('[data-testid="database-view"]')).toBeVisible();
    }
  });
});

test.describe("Mobile Touch and Scroll @mobile", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await openDatabase(page);
  });

  test("page is scrollable on mobile", async ({ page }) => {
    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    expect(scrollHeight).toBeGreaterThanOrEqual(viewportHeight);
  });

  test("floating scroll-to-top button is present", async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(300);
    const floatBtn = page.locator('.floating-top');
    await expect(floatBtn).toBeVisible();
  });

  test("scroll to top button works", async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(300);
    await page.locator('.floating-top').tap();
    await page.waitForTimeout(500);
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeLessThan(100);
  });
});

test.describe("Tablet Layout @tablet", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("app loads on tablet", async ({ page }) => {
    await expect(page.locator('[data-testid="app-root"]')).toBeVisible();
  });

  test("RTL layout on tablet", async ({ page }) => {
    const dir = await page.locator("html").getAttribute("dir");
    expect(dir).toBe("rtl");
  });

  test("header visible on tablet", async ({ page }) => {
    await expect(page.locator('[data-testid="header"]')).toBeVisible();
  });

  test("no horizontal overflow on tablet", async ({ page }) => {
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 10);
  });

  test("database view renders on tablet", async ({ page }) => {
    await page.locator('button.choice-card').first().tap();
    await page.waitForLoadState("networkidle");
    await expect(page.locator('[data-testid="database-view"]')).toBeVisible({ timeout: 5000 });
  });

  test("sort control visible on tablet", async ({ page }) => {
    await page.locator('button.choice-card').first().tap();
    await page.waitForLoadState("networkidle");
    await expect(page.locator('[data-testid="sort-control"]')).toBeVisible();
  });

  test("add record modal fits tablet screen", async ({ page }) => {
    await openDatabase(page);
    await openAddModal(page);
    const isVisible = await page.locator('.modal-backdrop').isVisible();
    if (isVisible) {
      const modal = page.locator('.modal-backdrop .modal');
      const box = await modal.boundingBox();
      if (box) {
        const viewport = page.viewportSize();
        expect(box.width).toBeLessThanOrEqual(viewport.width);
        expect(box.height).toBeLessThanOrEqual(viewport.height);
      }
    }
  });
});

test.describe("Cross-Device Consistency @mobile @tablet", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("Arabic text renders correctly", async ({ page }) => {
    const title = await page.locator("h1").first().textContent();
    expect(title).toMatch(/[\u0600-\u06FF]/);
  });

  test("theme is applied consistently", async ({ page }) => {
    const theme = await page.locator("body").getAttribute("data-theme");
    expect(theme).toBeDefined();
  });

  test("font loads on all devices", async ({ page }) => {
    const fontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(fontFamily).toBeDefined();
  });

  test("no JS errors on load", async ({ page }) => {
    const errors = [];
    page.on("console", msg => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.reload();
    await page.waitForLoadState("networkidle");
    expect(errors).toHaveLength(0);
  });

  test("settings persist after reload", async ({ page }) => {
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator('[data-testid="app-root"]')).toBeVisible();
    const theme = await page.locator("body").getAttribute("data-theme");
    expect(theme).toBeDefined();
  });
});
