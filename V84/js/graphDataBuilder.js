/**
 * graphDataBuilder.js — Surah co-occurrence graph data (Task 5.1)
 *
 * Exports:
 *   buildGraphData(opts?)  → { nodes, edges, meta }
 *
 * Node shape:
 *   { id, name, nameEn, juz, type, verses, page, count }
 *   id     — surah number (1-114), used as D3 node id
 *   count  — number of groups that reference this surah
 *
 * Edge shape:
 *   { source, target, weight, groups }
 *   source/target — surah numbers (integers, source < target always)
 *   weight        — number of groups where both surahs co-occur
 *   groups        — array of group ids that created this edge
 *
 * Meta shape:
 *   { totalGroups, totalNodes, totalEdges, maxCount, maxWeight }
 *
 * Options:
 *   minWeight (default 1) — exclude edges with fewer co-occurrences
 *   minCount  (default 1) — exclude nodes referenced by fewer groups
 *
 * Surah names are matched via getSurahByNameFuzzy() which handles
 * tashkeel variants and alef normalisation (see quranMeta.js).
 */

import { SURAHS, getSurahByNameFuzzy } from '../data/quranMeta.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Canonical edge key — always low_high so A→B and B→A map to the same entry. */
function _edgeKey(a, b) {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

/**
 * Collect unique surah numbers referenced by a group.
 * Reads from g.surahs (name array) and g.verses[].surah (name string).
 * Each surah counted once per group regardless of how many verses it has.
 */
function _surahNums(g) {
  const seen = new Set();
  const add  = name => {
    if (!name) return;
    const s = getSurahByNameFuzzy(name);
    if (s) seen.add(s.number);
  };
  (g.surahs || []).forEach(add);
  (g.verses  || []).forEach(v => add(v?.surah));
  return [...seen];
}

// ── Main builder ──────────────────────────────────────────────────────────────

export function buildGraphData({ minWeight = 1, minCount = 1 } = {}) {
  const data = (window.activeDb && window.activeData)
    ? window.activeData
    : [...(window.personalData || []), ...(window.automatedData || [])];

  const nodeCounts = new Map(); // surahNumber → groupCount
  const edgeMap    = new Map(); // edgeKey → edge object

  data.forEach(g => {
    const nums = _surahNums(g);

    // Increment node counts
    nums.forEach(n => nodeCounts.set(n, (nodeCounts.get(n) || 0) + 1));

    // Increment edge weights for every distinct pair in this group
    for (let i = 0; i < nums.length; i++) {
      for (let j = i + 1; j < nums.length; j++) {
        const key = _edgeKey(nums[i], nums[j]);
        if (!edgeMap.has(key)) {
          const lo = Math.min(nums[i], nums[j]);
          const hi = Math.max(nums[i], nums[j]);
          edgeMap.set(key, { source: lo, target: hi, weight: 0, groups: [] });
        }
        const e = edgeMap.get(key);
        e.weight++;
        if (g.id != null) e.groups.push(String(g.id));
      }
    }
  });

  // Build nodes — only surahs with count ≥ minCount
  const nodes = SURAHS
    .filter(s => (nodeCounts.get(s.number) || 0) >= minCount)
    .map(s => ({
      id:     s.number,
      name:   s.name,
      nameEn: s.nameEn,
      juz:    s.juz,
      type:   s.type,
      verses: s.verses,
      page:   s.page,
      count:  nodeCounts.get(s.number),
    }));

  const nodeSet = new Set(nodes.map(n => n.id));

  // Build edges — only those with weight ≥ minWeight and both endpoints present
  const edges = [...edgeMap.values()].filter(
    e => e.weight >= minWeight && nodeSet.has(e.source) && nodeSet.has(e.target)
  );

  const maxCount  = nodes.reduce((m, n) => Math.max(m, n.count),  0);
  const maxWeight = edges.reduce((m, e) => Math.max(m, e.weight), 0);

  return {
    nodes,
    edges,
    meta: {
      totalGroups: data.length,
      totalNodes:  nodes.length,
      totalEdges:  edges.length,
      maxCount,
      maxWeight,
    },
  };
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  window.buildGraphData = buildGraphData;
});
