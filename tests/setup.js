import "@testing-library/jest-dom";
import { vi } from "vitest";

// ─── Mock localStorage ─────────────────────────────────────
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => (store[key] = String(value)),
    removeItem: (key) => delete store[key],
    clear: () => (store = {}),
    get length() {
      return Object.keys(store).length;
    },
    key: (n) => Object.keys(store)[n] ?? null,
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

// ─── Mock sessionStorage ────────────────────────────────────
const sessionStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => (store[key] = String(value)),
    removeItem: (key) => delete store[key],
    clear: () => (store = {}),
  };
})();
Object.defineProperty(window, "sessionStorage", { value: sessionStorageMock });

// ─── Mock Clipboard API ─────────────────────────────────────
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue("مocked clipboard text"),
  },
});

// ─── Mock IndexedDB (if used) ───────────────────────────────
import "fake-indexeddb/auto";

// ─── Mock window.matchMedia ─────────────────────────────────
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ─── Mock URL.createObjectURL (for export) ─────────────────
global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
global.URL.revokeObjectURL = vi.fn();

// ─── Mock ResizeObserver ────────────────────────────────────
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// ─── Reset all mocks after each test ───────────────────────
afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});
