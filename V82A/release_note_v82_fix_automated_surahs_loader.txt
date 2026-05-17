Mutashabihat V82 - Fix Automated Surah Loader Empty Issue

Problem fixed:
- In V81 some deployments showed the automated-surahs database as empty.

Root correction:
- The loader now uses Surah number instead of Arabic Surah name in the button onclick/loading path.
- Each chunk now registers data in window.AUTOMATED_SURAH_DATA_BY_NO[SurahNo].
- The old Arabic-name assignment is also kept for compatibility.
- Added clear error message if a chunk file cannot be loaded from GitHub.

Required GitHub files:
- index.html
- app.js
- automated-manifest.js
- automated-data.js small stub
- full folder automated-surahs with 114 files

Validation:
- automated-surahs files generated: 114
- Original automated groups: 12668
- Largest chunk size bytes: 7690825
- Generated: 2026-05-15T03:58:11.487753Z
