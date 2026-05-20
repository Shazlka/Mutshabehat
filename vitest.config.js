import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.js"],
    include: ["tests/unit/**/*.test.js"],      // ← ONLY unit tests
    exclude: ["tests/e2e/**", "tests/**/*.spec.js", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["tests/unit/**/*.js"],
      thresholds: { lines: 70, functions: 70, branches: 65, statements: 70 },
    },
    reporters: ["verbose"],
  },
});