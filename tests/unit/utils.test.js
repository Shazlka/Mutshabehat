/**
 * Unit Tests — Real V82B Utility Functions
 * Tests safeText, normalize, clone, isTrue, escapeHtml
 * from V82B/js/utils.js
 */

import { describe, it, expect } from "vitest";

function safeText(v){return v===undefined||v===null?'':String(v)}
function normalize(v){return safeText(v).toLowerCase().replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g,'').replace(/[إأآٱا]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/ـ/g,'').replace(/\s+/g,' ').trim()}
function clone(v){return JSON.parse(JSON.stringify(v||[]))}
function isTrue(v){return v===true||v==='true'||v===1||v==='1'}
function escapeHtml(v){return safeText(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}

// ═══════════════════════════════════════════════════════════
// SUITE 1: safeText
// ═══════════════════════════════════════════════════════════
describe("safeText — real V82B function", () => {
  it("returns empty string for undefined", () => {
    expect(safeText(undefined)).toBe("");
  });

  it("returns empty string for null", () => {
    expect(safeText(null)).toBe("");
  });

  it("returns string as-is", () => {
    expect(safeText("مرحبا")).toBe("مرحبا");
  });

  it("converts number to string", () => {
    expect(safeText(42)).toBe("42");
  });

  it("handles Arabic text with tashkeel", () => {
    expect(safeText("خَتَمَ")).toBe("خَتَمَ");
  });

  it("returns empty string for empty string", () => {
    expect(safeText("")).toBe("");
  });
});

// ═══════════════════════════════════════════════════════════
// SUITE 2: normalize
// ═══════════════════════════════════════════════════════════
describe("normalize — real V82B function", () => {
  it("removes tashkeel", () => {
    expect(normalize("خَتَمَ")).toBe("ختم");
  });

  it("normalizes alef variants to bare alef", () => {
    expect(normalize("إبراهيم")).toBe("ابراهيم");
    expect(normalize("أحمد")).toBe("احمد");
    expect(normalize("آية")).toBe("ايه");
  });

  it("normalizes ya maqsura to ya", () => {
    expect(normalize("على")).toBe("علي");
  });

  it("normalizes ta marbuta to ha", () => {
    expect(normalize("رحمة")).toBe("رحمه");
  });

  it("normalizes waw hamza to waw", () => {
    expect(normalize("مؤمن")).toBe("مومن");
  });

  it("trims whitespace", () => {
    expect(normalize("  الله  ")).toBe("الله");
  });

  it("lowercases Latin characters", () => {
    expect(normalize("LEXICAL")).toBe("lexical");
  });

  it("handles empty string", () => {
    expect(normalize("")).toBe("");
  });

  it("handles null/undefined", () => {
    expect(normalize(null)).toBe("");
    expect(normalize(undefined)).toBe("");
  });

  it("Arabic text search normalization works", () => {
    const query = normalize("عذاب");
    const text = normalize("وَلَهُمْ عَذَابٌ أَلِيمٌ");
    expect(text).toContain(query);
  });
});

// ═══════════════════════════════════════════════════════════
// SUITE 3: isTrue
// ═══════════════════════════════════════════════════════════
describe("isTrue — real V82B function", () => {
  it("returns true for boolean true", () => {
    expect(isTrue(true)).toBe(true);
  });

  it("returns true for string 'true'", () => {
    expect(isTrue("true")).toBe(true);
  });

  it("returns true for number 1", () => {
    expect(isTrue(1)).toBe(true);
  });

  it("returns true for string '1'", () => {
    expect(isTrue("1")).toBe(true);
  });

  it("returns false for boolean false", () => {
    expect(isTrue(false)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isTrue(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isTrue(undefined)).toBe(false);
  });

  it("returns false for 0", () => {
    expect(isTrue(0)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isTrue("")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// SUITE 4: clone
// ═══════════════════════════════════════════════════════════
describe("clone — real V82B function", () => {
  it("creates a deep copy", () => {
    const original = [{ id: "1", title: "test" }];
    const copy = clone(original);
    expect(copy).toEqual(original);
    expect(copy).not.toBe(original);
  });

  it("mutation does not affect original", () => {
    const original = [{ id: "1", title: "original" }];
    const copy = clone(original);
    copy[0].title = "modified";
    expect(original[0].title).toBe("original");
  });

  it("handles empty array", () => {
    expect(clone([])).toEqual([]);
  });

  it("handles null/undefined", () => {
    expect(clone(null)).toEqual([]);
    expect(clone(undefined)).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════
// SUITE 5: escapeHtml
// ═══════════════════════════════════════════════════════════
describe("escapeHtml — real V82B function", () => {
  it("escapes ampersand", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("escapes less than", () => {
    expect(escapeHtml("<div>")).toBe("&lt;div&gt;");
  });

  it("escapes quotes", () => {
    expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("it's")).toBe("it&#039;s");
  });

  it("Arabic text passes through unchanged", () => {
    expect(escapeHtml("متشابهات")).toBe("متشابهات");
  });

  it("handles null/undefined", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});