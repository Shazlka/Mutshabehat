/**
 * Unit Tests — Filter & Sort Logic
 * Tests all filter combinations and sort orders
 */

import { describe, it, expect } from "vitest";
import { SAMPLE_MUTASHABIHAT, LARGE_DB } from "../fixtures/mutashabihat.fixture.js";

// ── Import your real filter/sort utilities ────────────────
// import { applyFilters, applySort } from "../../src/lib/filters.js";

// ── Standalone mock implementations (replace with real imports) ──
const applyFilters = (data, filters = {}) => {
  let result = [...data];

  if (filters.keyword) {
    const kw = filters.keyword.toLowerCase();
    result = result.filter(
      (r) =>
        r.keyword?.toLowerCase().includes(kw) ||
        r.arabic_a?.includes(filters.keyword) ||
        r.arabic_b?.includes(filters.keyword) ||
        r.notes?.toLowerCase().includes(kw)
    );
  }

  if (filters.category) {
    result = result.filter((r) => r.category === filters.category);
  }

  if (filters.similarity_type) {
    result = result.filter((r) => r.similarity_type === filters.similarity_type);
  }

  if (filters.surah) {
    result = result.filter(
      (r) => r.surah_a === filters.surah || r.surah_b === filters.surah
    );
  }

  if (filters.favorites === true) {
    result = result.filter((r) => r.favorite === true);
  }

  if (filters.tags && filters.tags.length > 0) {
    result = result.filter((r) =>
      filters.tags.every((tag) => r.tags?.includes(tag))
    );
  }

  if (filters.dateFrom) {
    result = result.filter(
      (r) => new Date(r.created_at) >= new Date(filters.dateFrom)
    );
  }

  if (filters.dateTo) {
    result = result.filter(
      (r) => new Date(r.created_at) <= new Date(filters.dateTo)
    );
  }

  return result;
};

const applySort = (data, sort = {}) => {
  const { field = "created_at", direction = "desc" } = sort;
  return [...data].sort((a, b) => {
    let va = a[field];
    let vb = b[field];

    if (typeof va === "string") va = va.toLowerCase();
    if (typeof vb === "string") vb = vb.toLowerCase();

    if (va < vb) return direction === "asc" ? -1 : 1;
    if (va > vb) return direction === "asc" ? 1 : -1;
    return 0;
  });
};

// ═══════════════════════════════════════════════════════════
// SUITE 1: Text Search / Keyword Filter
// ═══════════════════════════════════════════════════════════
describe("🔍 Filter — Keyword Search", () => {
  it("filters by Arabic keyword in keyword field", () => {
    const results = applyFilters(SAMPLE_MUTASHABIHAT, { keyword: "ختم" });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("ms-001");
  });

  it("filters by Arabic text within arabic_a field", () => {
    const results = applyFilters(SAMPLE_MUTASHABIHAT, {
      keyword: "قُلُوبِهِمْ",
    });
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty when keyword not found", () => {
    const results = applyFilters(SAMPLE_MUTASHABIHAT, { keyword: "غير موجود xyz" });
    expect(results).toHaveLength(0);
  });

  it("no filter returns all records", () => {
    const results = applyFilters(SAMPLE_MUTASHABIHAT, {});
    expect(results).toHaveLength(SAMPLE_MUTASHABIHAT.length);
  });

  it("case-insensitive for Latin characters", () => {
    const results = applyFilters(SAMPLE_MUTASHABIHAT, { keyword: "LEXICAL" });
    // no match expected — Arabic data; just checks no crash
    expect(Array.isArray(results)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// SUITE 2: Category Filter
// ═══════════════════════════════════════════════════════════
describe("📂 Filter — Category", () => {
  it("filters by category 'عذاب'", () => {
    const results = applyFilters(SAMPLE_MUTASHABIHAT, { category: "عذاب" });
    expect(results).toHaveLength(2);
    results.forEach((r) => expect(r.category).toBe("عذاب"));
  });

  it("filters by category 'قلب'", () => {
    const results = applyFilters(SAMPLE_MUTASHABIHAT, { category: "قلب" });
    expect(results).toHaveLength(1);
  });

  it("returns empty for unknown category", () => {
    const results = applyFilters(SAMPLE_MUTASHABIHAT, { category: "مجهول" });
    expect(results).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════
// SUITE 3: Similarity Type Filter
// ═══════════════════════════════════════════════════════════
describe("🔗 Filter — Similarity Type", () => {
  it("filters by 'lexical'", () => {
    const results = applyFilters(SAMPLE_MUTASHABIHAT, {
      similarity_type: "lexical",
    });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("ms-001");
  });

  it("filters by 'contextual'", () => {
    const results = applyFilters(SAMPLE_MUTASHABIHAT, {
      similarity_type: "contextual",
    });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("ms-002");
  });

  it("filters by 'structural'", () => {
    const results = applyFilters(SAMPLE_MUTASHABIHAT, {
      similarity_type: "structural",
    });
    expect(results).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════
// SUITE 4: Surah Filter
// ═══════════════════════════════════════════════════════════
describe("📖 Filter — Surah", () => {
  it("filters records involving Surah 2", () => {
    const results = applyFilters(SAMPLE_MUTASHABIHAT, { surah: 2 });
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it("filters records involving Surah 4", () => {
    const results = applyFilters(SAMPLE_MUTASHABIHAT, { surah: 4 });
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty for Surah not in data", () => {
    const results = applyFilters(SAMPLE_MUTASHABIHAT, { surah: 99 });
    expect(results).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════
// SUITE 5: Favorites Filter
// ═══════════════════════════════════════════════════════════
describe("⭐ Filter — Favorites", () => {
  it("returns only favorites when favorites=true", () => {
    const results = applyFilters(SAMPLE_MUTASHABIHAT, { favorites: true });
    expect(results).toHaveLength(1);
    expect(results[0].favorite).toBe(true);
  });

  it("does not filter when favorites not set", () => {
    const results = applyFilters(SAMPLE_MUTASHABIHAT, {});
    expect(results).toHaveLength(3);
  });
});

// ═══════════════════════════════════════════════════════════
// SUITE 6: Combined Filters
// ═══════════════════════════════════════════════════════════
describe("🔀 Filter — Combined", () => {
  it("category + similarity_type compound filter", () => {
    const results = applyFilters(SAMPLE_MUTASHABIHAT, {
      category: "عذاب",
      similarity_type: "contextual",
    });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("ms-002");
  });

  it("compound filter returns empty when no match", () => {
    const results = applyFilters(SAMPLE_MUTASHABIHAT, {
      category: "قلب",
      similarity_type: "structural",
    });
    expect(results).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════
// SUITE 7: Sort
// ═══════════════════════════════════════════════════════════
describe("🔢 Sort", () => {
  it("sorts by created_at ascending", () => {
    const sorted = applySort(SAMPLE_MUTASHABIHAT, {
      field: "created_at",
      direction: "asc",
    });
    expect(sorted[0].id).toBe("ms-001");
    expect(sorted[2].id).toBe("ms-003");
  });

  it("sorts by created_at descending", () => {
    const sorted = applySort(SAMPLE_MUTASHABIHAT, {
      field: "created_at",
      direction: "desc",
    });
    expect(sorted[0].id).toBe("ms-003");
  });

  it("sorts by surah_a ascending", () => {
    const sorted = applySort(SAMPLE_MUTASHABIHAT, {
      field: "surah_a",
      direction: "asc",
    });
    expect(sorted[0].surah_a).toBeLessThanOrEqual(sorted[1].surah_a);
  });

  it("sorts by category alphabetically", () => {
    const sorted = applySort(SAMPLE_MUTASHABIHAT, {
      field: "category",
      direction: "asc",
    });
    expect(Array.isArray(sorted)).toBe(true);
    expect(sorted).toHaveLength(3);
  });

  it("does not mutate original array", () => {
    const original = [...SAMPLE_MUTASHABIHAT];
    applySort(SAMPLE_MUTASHABIHAT, { field: "surah_a", direction: "desc" });
    expect(SAMPLE_MUTASHABIHAT).toEqual(original);
  });

  it("handles large dataset sort without timeout", () => {
    const start = Date.now();
    applySort(LARGE_DB, { field: "surah_a", direction: "asc" });
    expect(Date.now() - start).toBeLessThan(500);
  });
});
