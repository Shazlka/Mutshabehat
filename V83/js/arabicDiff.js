/**
 * arabicDiff.js — Pure JS Arabic text diff utilities
 *
 * Exports:
 *   normalizeTashkeel(text)  — strip harakat for comparison
 *   computeWordDiff(a, b)    — LCS word-level diff
 *   computeCharDiff(a, b)    — character-level diff between two words
 */

// ─── Tashkeel Unicode ranges ──────────────────────────────────────────────────
// U+064B–U+065F : Arabic combining diacriticals (fathah, kasrah, dammah, etc.)
// U+0670        : Arabic Letter Superscript Alef
// U+06D6–U+06DC : Quranic annotation signs
// U+06DF–U+06E4 : Quranic annotation signs
// U+06E7–U+06E8 : Quranic annotation signs
// U+06EA–U+06ED : Quranic annotation signs
const TASHKEEL_RE = /[ً-ٰٟۖ-ۜ۟-۪ۤۧۨ-ۭ]/g;

/**
 * Strip harakat/tashkeel for comparison purposes only.
 * The original text is kept for display — this is only used internally.
 */
export function normalizeTashkeel(text) {
  return text.replace(TASHKEEL_RE, '').trim();
}

// ─── LCS (Longest Common Subsequence) ────────────────────────────────────────

/**
 * Build the LCS length table for two arrays.
 * Works on normalized tokens (strings).
 */
function buildLCSTable(a, b) {
  const m = a.length;
  const n = b.length;
  // Use flat Uint16Array for performance — surah verses rarely exceed 65 535 words
  const dp = new Array(m + 1).fill(null).map(() => new Uint16Array(n + 1));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp;
}

/**
 * Backtrack through the LCS table to produce an edit list.
 * Returns array of { indexA?, indexB?, type: "same"|"removed"|"added" }
 */
function backtrackLCS(dp, normA, normB) {
  const ops = [];
  let i = normA.length;
  let j = normB.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && normA[i - 1] === normB[j - 1]) {
      ops.push({ type: 'same', indexA: i - 1, indexB: j - 1 });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: 'added', indexB: j - 1 });
      j--;
    } else {
      ops.push({ type: 'removed', indexA: i - 1 });
      i--;
    }
  }

  return ops.reverse();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * computeWordDiff(textA, textB)
 *
 * Splits both Arabic strings by whitespace, runs LCS, then marks adjacent
 * removed+added pairs as "changed" when they differ by ≤ 3 characters
 * (likely the same word with minor variation).
 *
 * Returns: Array<{ word: string, status: "same"|"added"|"removed"|"changed" }>
 * The array is in correct RTL reading order (right-to-left semantically,
 * but stored left-to-right in the array for DOM rendering with dir="rtl").
 */
export function computeWordDiff(textA, textB) {
  const wordsA = textA.trim().split(/\s+/);
  const wordsB = textB.trim().split(/\s+/);

  const normA = wordsA.map(normalizeTashkeel);
  const normB = wordsB.map(normalizeTashkeel);

  const dp = buildLCSTable(normA, normB);
  const ops = backtrackLCS(dp, normA, normB);

  // Build raw token list
  const rawTokens = ops.map(op => {
    if (op.type === 'same') {
      return { word: wordsA[op.indexA], status: 'same' };
    } else if (op.type === 'removed') {
      return { word: wordsA[op.indexA], status: 'removed' };
    } else {
      return { word: wordsB[op.indexB], status: 'added' };
    }
  });

  // Merge adjacent removed+added into "changed" where words are similar
  const tokens = [];
  let k = 0;
  while (k < rawTokens.length) {
    const cur = rawTokens[k];
    const next = rawTokens[k + 1];

    if (
      cur.status === 'removed' &&
      next &&
      next.status === 'added' &&
      levenshtein(normalizeTashkeel(cur.word), normalizeTashkeel(next.word)) <= 3
    ) {
      // Merge: keep the B-side word (the "new" text) as "changed"
      tokens.push({ word: next.word, oldWord: cur.word, status: 'changed' });
      k += 2;
    } else {
      tokens.push(cur);
      k++;
    }
  }

  return tokens;
}

/**
 * computeCharDiff(wordA, wordB)
 *
 * Character-level diff between two Arabic words.
 * Returns: Array<{ char: string, status: "same"|"added"|"removed" }>
 */
export function computeCharDiff(wordA, wordB) {
  const charsA = [...normalizeTashkeel(wordA)];
  const charsB = [...normalizeTashkeel(wordB)];

  const dp = buildLCSTable(charsA, charsB);
  const ops = backtrackLCS(dp, charsA, charsB);

  return ops.map(op => {
    if (op.type === 'same')    return { char: charsA[op.indexA], status: 'same' };
    if (op.type === 'removed') return { char: charsA[op.indexA], status: 'removed' };
    return                            { char: charsB[op.indexB], status: 'added' };
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Levenshtein distance between two strings (used to detect "similar" words).
 * Capped early: returns Infinity if distance would exceed cap.
 */
function levenshtein(a, b, cap = 4) {
  if (Math.abs(a.length - b.length) > cap) return Infinity;
  const prev = new Uint16Array(b.length + 1).map((_, i) => i);
  const curr = new Uint16Array(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev.set(curr);
    if (Math.min(...curr) > cap) return Infinity;
  }
  return prev[b.length];
}

// ─── Self-test (runs only when executed directly via node) ────────────────────
if (typeof process !== 'undefined' && process.argv[1]?.endsWith('arabicDiff.js')) {
  console.log('\n── Test 1: زيادة واو ──');
  const t1a = 'فَزَادَهُمُ اللَّهُ مَرَضًا وَلَهُمْ عَذَابٌ أَلِيمٌ';
  const t1b = 'فَزَادَتْهُمْ رِجْسًا إِلَىٰ رِجْسِهِمْ';
  console.log(computeWordDiff(t1a, t1b));

  console.log('\n── Test 2: إبدال كلمة (خَتَمَ / طَبَعَ) ──');
  const t2a = 'خَتَمَ اللَّهُ عَلَىٰ قُلُوبِهِمْ وَعَلَىٰ سَمْعِهِمْ';
  const t2b = 'بَلْ طَبَعَ اللَّهُ عَلَيْهَا بِكُفْرِهِمْ';
  console.log(computeWordDiff(t2a, t2b));

  console.log('\n── Test 3: char diff on single words ──');
  console.log(computeCharDiff('خَلَقْتَنِي', 'خُلِقْتُ'));
}
