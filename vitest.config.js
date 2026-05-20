import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.js"],
    include: ["tests/unit/**/*.test.js"],
    exclude: ["node_modules/**", "tests/e2e/**", "tests/**/*.spec.js"],
    reporters: ["verbose"],
  },
});
