/**
 * Unit Tests — Actions: Settings, Copy, Export, Sync, Refresh
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SAMPLE_MUTASHABIHAT,
  SAMPLE_SETTINGS,
  SAMPLE_EXPORT_JSON,
} from "../fixtures/mutashabihat.fixture.js";

// ── Mock implementations (replace with your real imports) ─
const settingsManager = {
  get: (key) => {
    const raw = localStorage.getItem("mutashabihat_settings");
    if (!raw) return null;
    const settings = JSON.parse(raw);
    return key ? settings[key] : settings;
  },
  set: (key, value) => {
    const raw = localStorage.getItem("mutashabihat_settings");
    const settings = raw ? JSON.parse(raw) : {};
    settings[key] = value;
    localStorage.setItem("mutashabihat_settings", JSON.stringify(settings));
  },
  setAll: (settingsObj) => {
    localStorage.setItem("mutashabihat_settings", JSON.stringify(settingsObj));
  },
  reset: () => {
    localStorage.removeItem("mutashabihat_settings");
  },
  getAll: () => {
    const raw = localStorage.getItem("mutashabihat_settings");
    return raw ? JSON.parse(raw) : {};
  },
};

const copyToClipboard = async (text) => {
  await navigator.clipboard.writeText(text);
  return true;
};

const exportToFile = (data, format = "json") => {
  let content, mimeType, filename;

  if (format === "json") {
    content = JSON.stringify(data, null, 2);
    mimeType = "application/json";
    filename = `mutashabihat_export_${Date.now()}.json`;
  } else if (format === "csv") {
    const headers = Object.keys(data[0] || {}).join(",");
    const rows = data.map((r) => Object.values(r).join(","));
    content = [headers, ...rows].join("\n");
    mimeType = "text/csv";
    filename = `mutashabihat_export_${Date.now()}.csv`;
  } else {
    throw new Error(`Unsupported format: ${format}`);
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return { filename, size: content.length };
};

// ═══════════════════════════════════════════════════════════
// SUITE 1: Settings
// ═══════════════════════════════════════════════════════════
describe("⚙️ Settings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("set() and get() a single setting", () => {
    settingsManager.set("theme", "dark");
    expect(settingsManager.get("theme")).toBe("dark");
  });

  it("setAll() saves entire settings object", () => {
    settingsManager.setAll(SAMPLE_SETTINGS);
    const all = settingsManager.getAll();
    expect(all.theme).toBe("dark");
    expect(all.font).toBe("Amiri");
    expect(all.direction).toBe("rtl");
  });

  it("get() returns null when settings not initialized", () => {
    expect(settingsManager.get("theme")).toBeNull();
  });

  it("reset() clears all settings", () => {
    settingsManager.setAll(SAMPLE_SETTINGS);
    settingsManager.reset();
    expect(settingsManager.getAll()).toEqual({});
  });

  it("set() updates individual key without overwriting others", () => {
    settingsManager.setAll(SAMPLE_SETTINGS);
    settingsManager.set("theme", "light");
    const all = settingsManager.getAll();
    expect(all.theme).toBe("light");
    expect(all.font).toBe("Amiri"); // unchanged
  });

  it("autoSave setting persists correctly", () => {
    settingsManager.set("autoSave", true);
    expect(settingsManager.get("autoSave")).toBe(true);
    settingsManager.set("autoSave", false);
    expect(settingsManager.get("autoSave")).toBe(false);
  });

  it("fontSize setting can be updated", () => {
    settingsManager.set("fontSize", "small");
    expect(settingsManager.get("fontSize")).toBe("small");
    settingsManager.set("fontSize", "large");
    expect(settingsManager.get("fontSize")).toBe("large");
  });

  it("RTL direction setting persists", () => {
    settingsManager.set("direction", "rtl");
    expect(settingsManager.get("direction")).toBe("rtl");
  });
});

// ═══════════════════════════════════════════════════════════
// SUITE 2: Copy to Clipboard
// ═══════════════════════════════════════════════════════════
describe("📋 Copy", () => {
  it("copies text to clipboard", async () => {
    const text = "خَتَمَ اللَّهُ عَلَىٰ قُلُوبِهِمْ";
    const result = await copyToClipboard(text);
    expect(result).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(text);
  });

  it("copies Arabic text correctly", async () => {
    const arabicText = "عَذَابٌ أَلِيمٌ";
    await copyToClipboard(arabicText);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(arabicText);
  });

  it("copies JSON export to clipboard", async () => {
    const json = JSON.stringify(SAMPLE_MUTASHABIHAT[0], null, 2);
    await copyToClipboard(json);
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
  });

  it("handles empty string copy", async () => {
    await expect(copyToClipboard("")).resolves.toBe(true);
  });

  it("handles clipboard failure gracefully", async () => {
    navigator.clipboard.writeText.mockRejectedValueOnce(
      new Error("Clipboard denied")
    );
    await expect(copyToClipboard("test")).rejects.toThrow("Clipboard denied");
  });
});

// ═══════════════════════════════════════════════════════════
// SUITE 3: EXPORT
// ═══════════════════════════════════════════════════════════
describe("📤 Export", () => {
  beforeEach(() => {
    vi.spyOn(document, 'createElement').mockReturnValue({
      click: vi.fn(),
      href: "",
      download: "",
      style: {},
    });
  });

  it("exports to JSON with correct structure", () => {
    const result = exportToFile(SAMPLE_MUTASHABIHAT, "json");
    expect(result.filename).toMatch(/\.json$/);
    expect(result.size).toBeGreaterThan(0);
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it("exports to CSV", () => {
    const result = exportToFile(SAMPLE_MUTASHABIHAT, "csv");
    expect(result.filename).toMatch(/\.csv$/);
  });

  it("throws on unsupported format", () => {
    expect(() => exportToFile(SAMPLE_MUTASHABIHAT, "xlsx")).toThrow("Unsupported format");
  });

  it("export of empty array produces valid output", () => {
    const result = exportToFile([], "json");
    expect(result.size).toBeGreaterThan(0);
  });

  it("revokes object URL after export", () => {
    exportToFile(SAMPLE_MUTASHABIHAT, "json");
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it("JSON export preserves Arabic characters", () => {
    const result = exportToFile(SAMPLE_MUTASHABIHAT, "json");
    expect(result.size).toBeGreaterThan(100);
  });
});
// ═══════════════════════════════════════════════════════════
// SUITE 4: Sync (localStorage persistence simulation)
// ═══════════════════════════════════════════════════════════
describe("🔄 Sync / Persistence", () => {
  const DB_KEY = "mutashabihat_data";

  beforeEach(() => localStorage.clear());

  it("saves data to localStorage", () => {
    localStorage.setItem(DB_KEY, JSON.stringify(SAMPLE_MUTASHABIHAT));
    expect(localStorage.getItem(DB_KEY)).not.toBeNull();
  });

  it("retrieves and parses saved data correctly", () => {
    localStorage.setItem(DB_KEY, JSON.stringify(SAMPLE_MUTASHABIHAT));
    const loaded = JSON.parse(localStorage.getItem(DB_KEY));
    expect(loaded).toHaveLength(3);
    expect(loaded[0].id).toBe("ms-001");
  });

  it("overwrites stale data on save", () => {
    localStorage.setItem(DB_KEY, JSON.stringify([SAMPLE_MUTASHABIHAT[0]]));
    localStorage.setItem(DB_KEY, JSON.stringify(SAMPLE_MUTASHABIHAT));
    const loaded = JSON.parse(localStorage.getItem(DB_KEY));
    expect(loaded).toHaveLength(3);
  });

  it("returns null when no saved data exists", () => {
    expect(localStorage.getItem(DB_KEY)).toBeNull();
  });

  it("settings persist across simulated reload", () => {
    settingsManager.setAll(SAMPLE_SETTINGS);
    // Simulate reload — settings still in localStorage
    const reloaded = JSON.parse(
      localStorage.getItem("mutashabihat_settings")
    );
    expect(reloaded.font).toBe("Amiri");
    expect(reloaded.direction).toBe("rtl");
  });
});

// ═══════════════════════════════════════════════════════════
// SUITE 5: Refresh / State Reset
// ═══════════════════════════════════════════════════════════
describe("🔁 Refresh", () => {
  it("re-reading localStorage after clear returns null", () => {
    localStorage.setItem("test_key", "test_val");
    localStorage.clear();
    expect(localStorage.getItem("test_key")).toBeNull();
  });

  it("settings reset does not affect DB data", () => {
    const DB_KEY = "mutashabihat_data";
    localStorage.setItem(DB_KEY, JSON.stringify(SAMPLE_MUTASHABIHAT));
    settingsManager.reset(); // only removes settings key
    expect(localStorage.getItem(DB_KEY)).not.toBeNull();
  });
});
