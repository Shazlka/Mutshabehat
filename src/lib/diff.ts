// Arabic word/char diff utilities (ported from Mini's arabicDiff.js).
// Pure functions, no DOM. Used by auto-color + word linker features.

import { stripTashkeel } from './arabic'

export type WordStatus = 'same' | 'added' | 'removed' | 'changed'
export interface WordToken {
  word:    string
  status:  WordStatus
  oldWord?: string   // present on 'changed' (the previous form)
}
export type CharStatus = 'same' | 'added' | 'removed'
export interface CharToken { char: string; status: CharStatus }

// ── LCS ──────────────────────────────────────────────────────────────
function buildLCSTable(a: string[], b: string[]): Uint16Array[] {
  const m = a.length, n = b.length
  const dp: Uint16Array[] = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp
}

type Op =
  | { type: 'same';    indexA: number; indexB: number }
  | { type: 'added';   indexB: number }
  | { type: 'removed'; indexA: number }

function backtrackLCS(dp: Uint16Array[], normA: string[], normB: string[]): Op[] {
  const ops: Op[] = []
  let i = normA.length, j = normB.length
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && normA[i - 1] === normB[j - 1]) {
      ops.push({ type: 'same', indexA: i - 1, indexB: j - 1 })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: 'added', indexB: j - 1 })
      j--
    } else {
      ops.push({ type: 'removed', indexA: i - 1 })
      i--
    }
  }
  return ops.reverse()
}

// ── Levenshtein (capped, for detecting "similar" words) ──────────────
function levenshtein(a: string, b: string, cap = 4): number {
  if (Math.abs(a.length - b.length) > cap) return Infinity
  let prev = new Uint16Array(b.length + 1)
  let curr = new Uint16Array(b.length + 1)
  for (let i = 0; i <= b.length; i++) prev[i] = i
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[b.length]
}

// ── Word diff (LCS over normalized tokens, merge changed) ────────────
export function computeWordDiff(textA: string, textB: string): WordToken[] {
  const wordsA = textA.trim().split(/\s+/).filter(Boolean)
  const wordsB = textB.trim().split(/\s+/).filter(Boolean)
  const normA = wordsA.map(stripTashkeel)
  const normB = wordsB.map(stripTashkeel)
  const dp = buildLCSTable(normA, normB)
  const ops = backtrackLCS(dp, normA, normB)

  const raw: WordToken[] = ops.map((op) => {
    if (op.type === 'same')    return { word: wordsA[op.indexA], status: 'same' }
    if (op.type === 'removed') return { word: wordsA[op.indexA], status: 'removed' }
    return                            { word: wordsB[op.indexB], status: 'added' }
  })

  // Merge adjacent removed+added pairs into 'changed' if Levenshtein ≤ 3
  const out: WordToken[] = []
  for (let k = 0; k < raw.length; k++) {
    const cur = raw[k], next = raw[k + 1]
    if (cur.status === 'removed' && next?.status === 'added' &&
        levenshtein(stripTashkeel(cur.word), stripTashkeel(next.word)) <= 3) {
      out.push({ word: next.word, oldWord: cur.word, status: 'changed' })
      k++
    } else {
      out.push(cur)
    }
  }
  return out
}

// ── Char diff ────────────────────────────────────────────────────────
export function computeCharDiff(wordA: string, wordB: string): CharToken[] {
  const A = [...stripTashkeel(wordA)]
  const B = [...stripTashkeel(wordB)]
  const dp = buildLCSTable(A, B)
  const ops = backtrackLCS(dp, A, B)
  return ops.map((op): CharToken => {
    if (op.type === 'same')    return { char: A[op.indexA], status: 'same' }
    if (op.type === 'removed') return { char: A[op.indexA], status: 'removed' }
    return                            { char: B[op.indexB], status: 'added' }
  })
}

// ── High-level: auto-assign part types to two verse texts ────────────
// Maps diff status → V2 part type:
//   same    → shared
//   added   → addition  (only in B)
//   removed → unique    (only in A)
//   changed → diff      (different word in same slot)
export interface AutoColoredPart { type: 'shared'|'addition'|'unique'|'diff'|'normal'; text: string }
export interface AutoColorResult {
  partsA: AutoColoredPart[]   // for verse A (uses removed/changed-old as 'unique'/'diff')
  partsB: AutoColoredPart[]   // for verse B (uses added/changed-new as 'addition'/'diff')
}

export function autoColorPair(textA: string, textB: string): AutoColorResult {
  const tokens = computeWordDiff(textA, textB)
  const partsA: AutoColoredPart[] = []
  const partsB: AutoColoredPart[] = []
  for (const t of tokens) {
    switch (t.status) {
      case 'same':
        partsA.push({ type: 'shared', text: t.word })
        partsB.push({ type: 'shared', text: t.word })
        break
      case 'removed':
        partsA.push({ type: 'unique', text: t.word })
        break
      case 'added':
        partsB.push({ type: 'addition', text: t.word })
        break
      case 'changed':
        partsA.push({ type: 'diff', text: t.oldWord || '' })
        partsB.push({ type: 'diff', text: t.word })
        break
    }
  }
  return { partsA: mergeAdjacent(partsA), partsB: mergeAdjacent(partsB) }
}

// Merge consecutive parts of same type into one, joining with single space.
function mergeAdjacent(parts: AutoColoredPart[]): AutoColoredPart[] {
  const out: AutoColoredPart[] = []
  for (const p of parts) {
    const last = out[out.length - 1]
    if (last && last.type === p.type) last.text = (last.text + ' ' + p.text).trim()
    else out.push({ ...p })
  }
  return out
}
