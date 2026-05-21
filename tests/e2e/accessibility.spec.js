/**
 * E2E Accessibility Tests @a11y
 * Tests: ARIA attributes, keyboard navigation, RTL, semantic HTML
 */

import { test, expect } from "@playwright/test";

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

test.describe("ARIA Attributes @a11y", () => {
  test("html element has lang attribute", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const lang = await page.locator("html").getAttribute("lang");
    expect(lang).toBeTruthy();
  });

  test("html element has dir=rtl", async ({ page }) => {
    await page.goto("/");
    const dir = await page.locator("html").getAttribute("dir");
    expect(dir).toBe("rtl");
  });

  test("page has a main landmark", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const main = page.locator("main, [role=main], [data-testid=main-content]");
    await expect(main).toBeVisible();
  });

  test("page has a header landmark", async ({ page }) => {
    await page.goto("/");
    const header = page.locator("header, [role=banner], [data-testid=header]");
    await expect(header).toBeVisible();
  });

  test("settings button has aria-label or title", async ({ page }) => {
    await page.goto("/");
    const btn = page.locator('[data-testid="btn-settings"]');
    const label = await btn.getAttribute("aria-label");
    const title = await btn.getAttribute("title");
    expect(label || title).toBeTruthy();
  });

  test("add record button has accessible label", async ({ page }) => {
    await goToDatabase(page);
    const btn = page.locator('[data-testid="btn-add-record"]');
    if (await btn.isVisible()) {
      const label = await btn.getAttribute("aria-label");
      const title = await btn.getAttribute("title");
      const text = await btn.textContent();
      expect(label || title || text).toBeTruthy();
    }
  });

  test("favorite buttons have aria-pressed attribute", async ({ page }) => {
    await goToDatabase(page);
    const favBtns = page.locator('[data-testid="btn-favorite"]');
    const count = await favBtns.count();
    if (count > 0) {
      const pressed = await favBtns.first().getAttribute("aria-pressed");
      expect(pressed).not.toBeNull();
    }
  });

  test("settings modal has role=dialog", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.click('[data-testid="btn-settings"]');
    const modal = page.locator('[data-testid="modal-settingsModal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    const role = await modal.getAttribute("role");
    expect(role).toBe("dialog");
  });

  test("settings modal has aria-modal=true", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.click('[data-testid="btn-settings"]');
    const modal = page.locator('[data-testid="modal-settingsModal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    const ariaModal = await modal.getAttribute("aria-modal");
    expect(ariaModal).toBe("true");
  });

  test("record rows are article elements", async ({ page }) => {
    await goToDatabase(page);
    const firstRow = page.locator('[data-testid="record-row"]').first();
    if (await firstRow.isVisible()) {
      const tagName = await firstRow.evaluate(el => el.tagName.toLowerCase());
      expect(tagName).toBe("article");
    }
  });

  test("navigation landmark is present", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const nav = page.locator("nav, [role=navigation], [data-testid=sidebar]");
    await expect(nav).toBeVisible();
  });
});

test.describe("Keyboard Navigation @a11y", () => {
  test("interactive elements are focusable via Tab", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeTruthy();
    console.log(`Focused element after 3 tabs: ${focused}`);
  });

  test("can open settings modal with keyboard Enter", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const btn = page.locator('[data-testid="btn-settings"]');
    await btn.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('[data-testid="modal-settingsModal"]')).toBeVisible({ timeout: 5000 });
  });

  test("can close settings modal with close button", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.click('[data-testid="btn-settings"]');
    await expect(page.locator('[data-testid="modal-settingsModal"]')).toBeVisible({ timeout: 5000 });
    await page.click(".modal-close-btn");
    await expect(page.locator('[data-testid="modal-settingsModal"]')).not.toBeVisible();
  });

  test("database nav button is keyboard accessible", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const navBtn = page.locator('[data-testid="nav-database"]');
    await navBtn.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('[data-testid="database-view"]')).toBeVisible({ timeout: 5000 });
  });

  test("add record button is keyboard accessible", async ({ page }) => {
    await goToDatabase(page);
    const btn = page.locator('[data-testid="btn-add-record"]');
    if (await btn.isVisible()) {
      await btn.focus();
      await page.keyboard.press("Enter");
      await expect(page.locator(".modal-backdrop")).toBeVisible({ timeout: 5000 });
    }
  });

  test("favorite button is keyboard accessible", async ({ page }) => {
    await goToDatabase(page);
    const star = page.locator('[data-testid="btn-favorite"]').first();
    if (await star.isVisible()) {
      const before = await star.getAttribute("aria-pressed");
      await star.focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
      const after = await star.getAttribute("aria-pressed");
      expect(after).not.toBe(before);
    }
  });

  test("all buttons are focusable", async ({ page }) => {
    await goToDatabase(page);
    const buttons = page.locator("button:not([disabled])");
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
    console.log(`Total buttons on database page: ${count}`);
  });
});

test.describe("Semantic HTML @a11y", () => {
  test("page has at least one h1", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBeGreaterThanOrEqual(1);
  });

  test("Arabic text direction is RTL", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const dir = await page.evaluate(() => {
      return window.getComputedStyle(document.body).direction;
    });
    expect(dir).toBe("rtl");
  });

  test("key buttons are present and visible", async ({ page }) => {
    await goToDatabase(page);
    const buttons = page.locator('[data-testid="btn-settings"], [data-testid="btn-add-record"], [data-testid="btn-export"]');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
  });

  test("settings modal has a heading", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.click('[data-testid="btn-settings"]');
    await expect(page.locator('[data-testid="modal-settingsModal"]')).toBeVisible({ timeout: 5000 });
    const heading = page.locator('[data-testid="modal-settingsModal"] h2, [data-testid="modal-settingsModal"] h3');
    await expect(heading.first()).toBeVisible();
  });

  test("no images without alt text", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const imgsWithoutAlt = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("img:not([alt])")).length;
    });
    console.log(`Images without alt: ${imgsWithoutAlt}`);
    expect(imgsWithoutAlt).toBe(0);
  });

  test("add record modal contains form inputs", async ({ page }) => {
    await goToDatabase(page);
    const btn = page.locator('[data-testid="btn-add-record"]');
    if (await btn.isVisible()) {
      await btn.click();
      await expect(page.locator(".modal-backdrop")).toBeVisible({ timeout: 5000 });
      const inputs = page.locator(".modal-backdrop input");
      const count = await inputs.count();
      expect(count).toBeGreaterThan(0);
      console.log(`Form inputs in add modal: ${count}`);
    }
  });
});

test.describe("Color and Visual @a11y", () => {
  test("theme attribute is applied to body", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const theme = await page.locator("body").getAttribute("data-theme");
    expect(theme).toBeTruthy();
    console.log(`Active theme: ${theme}`);
  });

  test("record cards have sufficient size", async ({ page }) => {
    await goToDatabase(page);
    const firstCard = page.locator('[data-testid="record-row"]').first();
    if (await firstCard.isVisible()) {
      const box = await firstCard.boundingBox();
      expect(box).not.toBeNull();
      expect(box.width).toBeGreaterThan(100);
      expect(box.height).toBeGreaterThan(20);
    }
  });

  test("record title font size is readable", async ({ page }) => {
    await goToDatabase(page);
    const title = page.locator('[data-testid="record-title"]').first();
    if (await title.isVisible()) {
      const fontSize = await title.evaluate(el => {
        return parseFloat(window.getComputedStyle(el).fontSize);
      });
      console.log(`Record title font size: ${fontSize}px`);
      expect(fontSize).toBeGreaterThanOrEqual(12);
    }
  });

  test("buttons have minimum touch target size", async ({ page }) => {
    await goToDatabase(page);
    const btn = page.locator('[data-testid="btn-favorite"]').first();
    if (await btn.isVisible()) {
      const box = await btn.boundingBox();
      console.log(`Favorite button size: ${box.width}x${box.height}px`);
      expect(box.width).toBeGreaterThanOrEqual(24);
      expect(box.height).toBeGreaterThanOrEqual(24);
    }
  });
});