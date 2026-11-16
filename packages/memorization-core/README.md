# @mutshabehat/memorization-core

Framework-free TypeScript port of the native Qiraat iOS pure memorization domain logic.

## Capabilities

- **Ayah Memorization Records**: Hafs memorization status (`mastered`, `memorizedWithErrors`, `needsMushaf`, `notMemorized`) and review strength with due dates and review histories.
- **Quran Index & Page Weights**: Exact 604-page Madinah layout, ayah-to-page mappings, juz boundaries, and word-share weights summing to exactly 604.0.
- **Selection & Selection Parser**: Typed selection representations (`surah`, `ayahRange`, `pageRange`, `juz`, `ayat`, `span`) and text parsing of Arabic queries like «البقرة 255», «يس», «صفحة 42», «الجزء 30» with Arabic-Indic, Eastern Arabic, and Latin digits.
- **Planning & Review**: Atomic batch planning (`planUpdate`, `planReview`, `needsConfirmation`, `computeMilestones`, `applyPlanToRecords`, `applyUndoToRecords`).
- **Spaced Repetition Engine**: Interval ladder (`[1, 3, 7, 14, 30, 60]`), failure handling, strength aging, and next review scheduling.
- **Statistics & Milestones**: Page mixes, ayah status runs, surah list queries, dominant transitions, and snapshot metrics.
- **Streaks**: Deterministic calendar-day streak computation resilient to daylight saving changes.
- **Backups & Merging**: Stable JSON encoding, SHA-256 hashing, retention planning, and deterministic export merging.

## Design Conventions

- **Pure logic**: No React, no DOM, no IndexedDB, no network calls.
- **Time parameterization**: Pure functions accept explicit timestamp parameters (`now`), never reading the system clock directly.
- **Hafs-only**: Memorization never reads or writes Qiraat variant data.
