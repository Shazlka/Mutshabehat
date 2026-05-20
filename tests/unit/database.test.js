/**
 * Unit Tests — Database Operations
 * Tests: create, read, update, delete, import, export, reset
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  SAMPLE_MUTASHABIHAT,
  EMPTY_DB,
  LARGE_DB,
  SAMPLE_EXPORT_JSON,
} from "../fixtures/mutashabihat.fixture.js";

// ── Import your actual DB module ──────────────────────────
// Adjust path to match your project structure
// import { db } from "../../src/lib/database.js";
// import { exportDB, importDB, resetDB } from "../../src/lib/database.js";

// ── Mock DB for standalone testing ───────────────────────
// Remove this block once you connect real imports above
const createMockDB = (initialData = []) => {
  let store = [...initialData];
  return {
    getAll: () => [...store],
    getById: (id) => store.find((r) => r.id === id) ?? null,
    add: (record) => {
      const entry = { ...record, id: record.id || `ms-${Date.now()}` };
      store.push(entry);
      return entry;
    },
    update: (id, changes) => {
      const idx = store.findIndex((r) => r.id === id);
      if (idx === -1) return null;
      store[idx] = { ...store[idx], ...changes, updated_at: new Date().toISOString() };
      return store[idx];
    },
    delete: (id) => {
      const before = store.length;
      store = store.filter((r) => r.id !== id);
      return store.length < before;
    },
    clear: () => { store = []; },
    count: () => store.length,
    export: () => JSON.stringify(store, null, 2),
    import: (json) => {
      const data = JSON.parse(json);
      store = [...data];
      return store.length;
    },
  };
};

// ═══════════════════════════════════════════════════════════
// SUITE 1: READ operations
// ═══════════════════════════════════════════════════════════
describe("📖 Database — Read", () => {
  let db;

  beforeEach(() => {
    db = createMockDB(SAMPLE_MUTASHABIHAT);
  });

  it("getAll() returns all records", () => {
    const result = db.getAll();
    expect(result).toHaveLength(SAMPLE_MUTASHABIHAT.length);
  });

  it("getAll() returns a copy — mutation does not affect store", () => {
    const result = db.getAll();
    result.push({ id: "injected" });
    expect(db.count()).toBe(SAMPLE_MUTASHABIHAT.length);
  });

  it("getById() returns correct record", () => {
    const record = db.getById("ms-001");
    expect(record).toBeDefined();
    expect(record.keyword).toBe("ختم / طبع");
  });

  it("getById() returns null for unknown id", () => {
    expect(db.getById("nonexistent")).toBeNull();
  });

  it("count() returns correct count", () => {
    expect(db.count()).toBe(3);
  });

  it("getAll() on empty DB returns empty array", () => {
    const emptyDb = createMockDB(EMPTY_DB);
    expect(emptyDb.getAll()).toEqual([]);
  });

  it("handles large DB (200 records) without error", () => {
    const largeDb = createMockDB(LARGE_DB);
    expect(largeDb.count()).toBe(200);
    expect(largeDb.getAll()).toHaveLength(200);
  });
});

// ═══════════════════════════════════════════════════════════
// SUITE 2: CREATE operations
// ═══════════════════════════════════════════════════════════
describe("➕ Database — Create", () => {
  let db;

  beforeEach(() => {
    db = createMockDB([]);
  });

  it("add() inserts a new record", () => {
    const record = db.add({ ...SAMPLE_MUTASHABIHAT[0] });
    expect(db.count()).toBe(1);
    expect(db.getById(record.id)).toBeDefined();
  });

  it("add() assigns id if not provided", () => {
    const { id: _, ...noId } = SAMPLE_MUTASHABIHAT[0];
    const record = db.add(noId);
    expect(record.id).toBeDefined();
    expect(typeof record.id).toBe("string");
  });

  it("add() preserves Arabic text correctly", () => {
    const record = db.add(SAMPLE_MUTASHABIHAT[0]);
    expect(record.arabic_a).toBe("خَتَمَ اللَّهُ عَلَىٰ قُلُوبِهِمْ");
  });

  it("add() multiple records increments count", () => {
    SAMPLE_MUTASHABIHAT.forEach((r) => db.add(r));
    expect(db.count()).toBe(SAMPLE_MUTASHABIHAT.length);
  });
});

// ═══════════════════════════════════════════════════════════
// SUITE 3: UPDATE operations
// ═══════════════════════════════════════════════════════════
describe("✏️ Database — Update", () => {
  let db;

  beforeEach(() => {
    db = createMockDB(SAMPLE_MUTASHABIHAT);
  });

  it("update() modifies a field", () => {
    db.update("ms-001", { notes: "ملاحظة محدّثة" });
    const updated = db.getById("ms-001");
    expect(updated.notes).toBe("ملاحظة محدّثة");
  });

  it("update() sets updated_at timestamp", () => {
    const before = new Date(db.getById("ms-001").updated_at).getTime();
    db.update("ms-001", { favorite: true });
    const after = new Date(db.getById("ms-001").updated_at).getTime();
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it("update() does not change unrelated fields", () => {
    db.update("ms-001", { notes: "updated" });
    const record = db.getById("ms-001");
    expect(record.keyword).toBe("ختم / طبع");
    expect(record.surah_a).toBe(2);
  });

  it("update() returns null for non-existent id", () => {
    const result = db.update("ghost-id", { notes: "x" });
    expect(result).toBeNull();
  });

  it("update() can toggle favorite", () => {
    expect(db.getById("ms-001").favorite).toBe(false);
    db.update("ms-001", { favorite: true });
    expect(db.getById("ms-001").favorite).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// SUITE 4: DELETE operations
// ═══════════════════════════════════════════════════════════
describe("🗑️ Database — Delete", () => {
  let db;

  beforeEach(() => {
    db = createMockDB(SAMPLE_MUTASHABIHAT);
  });

  it("delete() removes the record", () => {
    db.delete("ms-001");
    expect(db.getById("ms-001")).toBeNull();
    expect(db.count()).toBe(2);
  });

  it("delete() returns true on success", () => {
    expect(db.delete("ms-002")).toBe(true);
  });

  it("delete() returns false for unknown id", () => {
    expect(db.delete("ghost")).toBe(false);
    expect(db.count()).toBe(3);
  });

  it("clear() removes all records", () => {
    db.clear();
    expect(db.count()).toBe(0);
    expect(db.getAll()).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════
// SUITE 5: EXPORT
// ═══════════════════════════════════════════════════════════
describe("📤 Database — Export", () => {
  let db;

  beforeEach(() => {
    db = createMockDB(SAMPLE_MUTASHABIHAT);
  });

  it("export() returns valid JSON string", () => {
    const json = db.export();
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("export() contains all records", () => {
    const parsed = JSON.parse(db.export());
    expect(parsed).toHaveLength(3);
  });

  it("export() preserves Arabic text", () => {
    const parsed = JSON.parse(db.export());
    expect(parsed[0].arabic_a).toBe("خَتَمَ اللَّهُ عَلَىٰ قُلُوبِهِمْ");
  });

  it("export() on empty DB returns empty array JSON", () => {
    const emptyDb = createMockDB([]);
    expect(JSON.parse(emptyDb.export())).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════
// SUITE 6: IMPORT
// ═══════════════════════════════════════════════════════════
describe("📥 Database — Import", () => {
  let db;

  beforeEach(() => {
    db = createMockDB([]);
  });

  it("import() loads records from JSON", () => {
    const count = db.import(SAMPLE_EXPORT_JSON);
    expect(count).toBe(3);
    expect(db.count()).toBe(3);
  });

  it("import() replaces existing data", () => {
    db.import(SAMPLE_EXPORT_JSON);
    db.import(JSON.stringify([SAMPLE_MUTASHABIHAT[0]]));
    expect(db.count()).toBe(1);
  });

  it("import() throws on invalid JSON", () => {
    expect(() => db.import("not-json")).toThrow();
  });

  it("import() preserves Arabic characters", () => {
    db.import(SAMPLE_EXPORT_JSON);
    const first = db.getAll()[0];
    expect(first.arabic_a).toContain("قُلُوبِهِمْ");
  });
});
