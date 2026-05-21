import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/visual.spec.js",
  use: {
    baseURL: "http://localhost:5173",
    locale: "ar-AE",
    timezoneId: "Asia/Dubai",
    viewport: { width: 1280, height: 800 },
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "python3 -m http.server 5173 --directory V82B",
    url: "http://localhost:5173",
    reuseExistingServer: false,
    timeout: 15_000,
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
      animations: "disabled",
    },
  },
  timeout: 15_000,
});
