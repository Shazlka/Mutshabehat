import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 5,
  reporter: [["html"], ["list"]],

  use: {
    baseURL: process.env.BASE_URL || "http://localhost:5173",
    trace: "off",
    screenshot: "only-on-failure",
    video: "off",
    locale: "ar-AE",
    timezoneId: "Asia/Dubai",
  },

  projects: [
    {
      name: "desktop",
      testMatch: [
        "**/actions.spec.js",
        "**/database.spec.js",
        "**/filter-sort.spec.js",
        "**/windows.spec.js",
      ],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "iphone-14",
      testMatch: "**/mobile-tablet.spec.js",
      use: { ...devices["iPhone 14"] },
    },
    {
      name: "pixel-7",
      testMatch: "**/mobile-tablet.spec.js",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "ipad-pro",
      testMatch: "**/mobile-tablet.spec.js",
      use: { ...devices["iPad Pro 11"] },
    },
    {
      name: "galaxy-tab",
      testMatch: "**/mobile-tablet.spec.js",
      use: { ...devices["Galaxy Tab S4"] },
    },
    {
      name: "performance",
      testMatch: "**/performance.spec.js",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "accessibility",
      testMatch: "**/accessibility.spec.js",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "visual",
      testMatch: "**/visual.spec.js",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],

  webServer: {
    command: "npx serve V82B -p 5173 --no-clipboard",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 30_000,
  },

  timeout: 15_000,
  expect: {
    timeout: 3_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
      animations: "disabled",
    },
  },
});