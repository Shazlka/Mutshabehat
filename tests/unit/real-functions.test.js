/**
 * Unit Tests — Real V82B Filter & Data Functions
 * Inline copies of pure functions from V82B source files
 */

import { describe, it, expect } from "vitest";

// ── Inline pure functions (exact copies from V82B) ─────────
function safeText(v){return v===undefined||v===null?'':String(v)}
function isTrue(v){return v===true||v==='true'||v===1||v==='1'}

function getTags(g){let a=Array.isArray(g.surahs)?g.surahs.filter(Boolean):[];if(!a.length&&Array.isArray(g.verses))a=[...new Set(g.verses.map(v=>v.surah).filter(Boolean))];return a}
function passStatus(g,s){s=s||'all';if(s==='favorite')return isTrue(g.favorite);if(s==='completed')return isTrue(g.completed);if(s==='notCompleted')return !isTrue(g.completed);if(s==='locked')return isTrue(g.locked);if(s==='autoCandidate')return isTrue(g.autoCandidate);return true}
function dedupeGroups(list){let seen=new Set();return (list||[]).filter(g=>{let key=safeText(g.id)||safeText(g.title)+'|'+safeText((g.verses||[]).map(v=>v.surah+':'+v.ayah).join(','));if(seen.has(key))return false;seen.add(key);return true})}
function dedupeGroupsV84(list){let seen=new Set();return (list||[]).filter(g=>{let key=safeText(g.id)||(safeText(g.title)+'|'+safeText((g.verses||[]).map(v=>v.surah+':'+v.ayah).join(',')));if(seen.has(key))return false;seen.add(key);return true})}

// ── Sample data ─────────────────────────────────────────────
const GROUP_WITH_SURAHS = {
  id: "1", title: "test group",
  surahs: ["البقرة", "آل عمران"],
  verses: [], favorite: true, completed: false,
};
const GROUP_WITH_VERSES = {
  id: "2", title: "test group 2", surahs: [],
  verses: [{ surah: "النساء", ayah: "1" }, { surah: "المائدة", ayah: "2" }],
  favorite: false, completed: true,
};
const GROUP_NO_TAGS = { id: "3", title: "no tags", surahs: [], verses: [], favorite: false };

describe("getTags — real V82B function", () => {
  it("returns surahs array when present", () => {
    expect(getTags(GROUP_WITH_SURAHS)).toEqual(["البقرة", "آل عمران"]);
  });

  it("falls back to verse surahs when surahs is empty", () => {
    const tags = getTags(GROUP_WITH_VERSES);
    expect(tags).toContain("النساء");
    expect(tags).toContain("المائدة");
  });

  it("returns empty array when no surahs or verses", () => {
    expect(getTags(GROUP_NO_TAGS)).toEqual([]);
  });

  it("filters out empty/null values from surahs", () => {
    const tags = getTags({ surahs: ["البقرة", "", null, "النساء"], verses: [] });
    expect(tags).not.toContain("");
    expect(tags).not.toContain(null);
  });

  it("deduplicates verse surahs", () => {
    const g = { surahs: [], verses: [
      { surah: "البقرة", ayah: "1" },
      { surah: "البقرة", ayah: "7" },
      { surah: "النساء", ayah: "1" },
    ]};
    const tags = getTags(g);
    expect(tags.filter(t => t === "البقرة").length).toBe(1);
  });

  it("handles empty group gracefully", () => {
    expect(() => getTags({})).not.toThrow();
  });
});

describe("passStatus — real V82B function", () => {
  it("returns true for 'all' status", () => {
    expect(passStatus(GROUP_WITH_SURAHS, "all")).toBe(true);
  });

  it("returns true for favorite groups", () => {
    expect(passStatus(GROUP_WITH_SURAHS, "favorite")).toBe(true);
  });

  it("returns false for non-favorite groups", () => {
    expect(passStatus(GROUP_WITH_VERSES, "favorite")).toBe(false);
  });

  it("returns true for completed groups", () => {
    expect(passStatus(GROUP_WITH_VERSES, "completed")).toBe(true);
  });

  it("returns false for non-completed groups", () => {
    expect(passStatus(GROUP_WITH_SURAHS, "completed")).toBe(false);
  });

  it("returns true for notCompleted groups", () => {
    expect(passStatus(GROUP_WITH_SURAHS, "notCompleted")).toBe(true);
  });

  it("defaults to true when no status provided", () => {
    expect(passStatus(GROUP_WITH_SURAHS)).toBe(true);
  });
});

describe("dedupeGroups — real V82B function", () => {
  it("removes duplicate groups by id", () => {
    const input = [
      { id: "1", title: "g1", verses: [] },
      { id: "1", title: "g1 dup", verses: [] },
      { id: "2", title: "g2", verses: [] },
    ];
    expect(dedupeGroups(input)).toHaveLength(2);
  });

  it("keeps all unique groups", () => {
    const input = [
      { id: "1", verses: [] },
      { id: "2", verses: [] },
      { id: "3", verses: [] },
    ];
    expect(dedupeGroups(input)).toHaveLength(3);
  });

  it("handles empty array", () => {
    expect(dedupeGroups([])).toEqual([]);
  });

  it("handles null/undefined", () => {
    expect(dedupeGroups(null)).toEqual([]);
    expect(dedupeGroups(undefined)).toEqual([]);
  });

  it("dedupes by verse references when no id", () => {
    const input = [
      { title: "same", verses: [{ surah: "البقرة", ayah: "1" }] },
      { title: "same", verses: [{ surah: "البقرة", ayah: "1" }] },
    ];
    expect(dedupeGroups(input)).toHaveLength(1);
  });
});

describe("dedupeGroupsV84 — real V82B function", () => {
  it("removes duplicates", () => {
    const input = [
      { id: "1", title: "test", verses: [] },
      { id: "1", title: "test", verses: [] },
    ];
    expect(dedupeGroupsV84(input)).toHaveLength(1);
  });

  it("handles empty/null input", () => {
    expect(dedupeGroupsV84([])).toEqual([]);
    expect(dedupeGroupsV84(null)).toEqual([]);
  });

  it("V84 and V82 produce same result", () => {
    const input = [
      { id: "1", verses: [] },
      { id: "2", verses: [] },
      { id: "1", verses: [] },
    ];
    expect(dedupeGroupsV84(input)).toHaveLength(dedupeGroups(input).length);
  });
});