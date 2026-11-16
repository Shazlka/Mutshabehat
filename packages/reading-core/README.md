# @mutshabehat/reading-core

Framework-free TypeScript port of the native Qiraat iOS pure reading and khatma domain logic.

## Capabilities

- **Page Dwell Credit**: Proportional ayah credit algorithm with the 30-second target and < 1.0s flick suppression.
- **Khatma Percentage**: Page-based formula `min(pagesRead / 604 * 100, 99)` with exact 100% completion requiring all 6,236 ayahs.
- **Visual Tiers & Heat Levels**: Progress tier classification (`low`, `medium`, `high`) and reading duration heat level categorization (`none`, `light`, `medium`, `high`, `deep`).
- **Reading Streaks**: Calendar-day streak calculation preserving lifetime records across missed days.
- **Chart Metrics & Summaries**: Daily reading chart point generation across 7, 14, and 30-day windows with Arabic-Indic formatting.

## Conventions

- **Pure logic**: No React, no DOM, no SQLite, no network calls.
- **Deterministic**: Time is explicitly passed in as a parameter.
