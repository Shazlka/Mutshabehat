import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [["html"], ["list"]],

  use: {
    baseURL: process.env.BASE_URL || "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",

    // RTL Arabic support
    locale: "ar-AE",
    timezoneId: "Asia/Dubai",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],

webServer: {
  command: "npx serve V82B -p 5173",
  url: "http://localhost:5173",
  reuseExistingServer: true,
  timeout: 120 * 1000,
},

  // Global timeout per test
timeout: 10_000,        // 10s per test (was 30s)
expect: { timeout: 3_000 },
