# Native Qur'an Search

## Audit

The authoritative Mushaf 1441 fixtures are compiled into `Generated/mushaf.sqlite` by
`scripts/build_mushaf_db.py`. `words` contains stable word IDs, page/line position, surah/ayah,
`index_in_ayah`, the untouched Uthmani text, and the page-specific QCF glyph. The database contains
83,665 tokens; 77,429 `char_type=word` occurrences are searchable and represent 21,295 distinct
Uthmani strings. The earlier search rebuilt every ayah and filtered the entire Qur'an in Swift for
each query. There is no Postgres or Supabase dependency in the native app.

## Architecture

The build script creates a derived, disposable search layer without updating `words`:

- `quran_word_search`: one searchable occurrence, global consecutive token position, location,
  untouched Uthmani display word, and plain/canonical/imlai/rasm keys.
- `quran_ayah_search`: one authoritative display string per ayah (not duplicated per occurrence).
- `quran_search_aliases`: indexed aliases, including controlled prefix/article forms.
- `quran_search_orthography_rules`: enabled, documented Uthmani-to-imlai rules and confidence.

All normal stages use B-tree indexes. Phrase search joins consecutive global token positions and
also requires the same surah and ayah. Smart mode tries exact indexed layers before controlled typo
matching. Broad mode additionally permits the deliberately weak rasm key. Search results retain
match type and score and always display/highlight the original Uthmani spelling and stable word IDs.

## Rebuild and rollback

Run `make data` from `apps/ios`; rebuilding is idempotent and recreates both the index and
`Reports/quran-search-collisions.json`. No user or Qiraat data is migrated. Rollback is therefore a
code rollback followed by `make data`; no database down-migration is necessary.

## Verification snapshot (2026-10-01)

- Required results: الصلاة 65, الزكاة 29, الحياة 67, الرحمن 57, ايمان 26 (limit 200).
- Phrase samples: `ان الله غفور رحيم` 14; `في قلوبهم مرض` 10; `لا اله الا هو` 30.
- The reusable corpus has 55 real-data word/phrase cases and zero unmatched cases.
- Worst indexed corpus query measured through the Xcode runtime: 41 ms on the development Mac.
- Collision report: zero empty normalized words and zero residual search-insensitive Unicode marks.

## Known limitations

- Search is spelling equivalence, not Arabic root/stem search.
- Orthographic aliases are intentionally conservative and live in a reviewed rule list; the
  collision report must be checked whenever rules change.
- Smart typo tolerance handles a bounded edit and similarity candidates; Broad rasm results are
  lower confidence and may contain homographs.
- A result highlights the matching Mushaf token boxes after page navigation; it does not alter QCF
  glyphs or authoritative Quran/Qiraat data.
