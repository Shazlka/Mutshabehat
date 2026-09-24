# Mushaf 1441 Review Editor implementation

## Existing model and write path

The editor in `QiraatEditor.tsx` uses `quran_words` canonical keys (surah:ayah:word position), `qiraat_annotations`, `qiraat_annotation_faces`, `qiraat_annotation_variants`, and `qiraat_annotation_sources`. Authorities are the existing reader/narrator hierarchy in `qiraat_authorities`; Usul/Farsh are `qiraat_taxonomies`. Annotation rows have `status`, `reading_context`, `version`, `deleted_at`, `created_by`, and `updated_by`. The annotation revision trigger records parent changes. The authenticated `/api/mushaf-1441/qiraat-editor` route calls editor RPCs; the browser has no privileged database credential. The reader still uses fixture backed page words and Qiraat data for page turning.

## 2026-09-24 (GPT-6 Codex) — Review workflow

- Added a transactional, OCC checked multi soft-delete RPC. Any version conflict rolls back the whole selection.
- Added compatible `qiraat_editor_update_annotation_v2` and `qiraat_editor_create_annotation_v2` paths. PATCH updates the same annotation and retains child face IDs when the face is still present. Source-reference details are retained for unchanged source IDs. POST skips an equivalent active annotation under a semantic lock. A row can also fill the form as a draft copy. `reading_context` remains the Wasl/Waqf representation: `WASL_ONLY`, `WAQF_ONLY`, `BOTH`.
- Added three chapters beneath the existing Hamzah taxonomy: تغيير الهمز, الهمزتان من كلمة, and الهمزتان من كلمتين. Structured `HAMZAH` face JSON stores `first`, optional `second`, optional `relation`, optional `insertion`, and optional `replacementFirst`/`replacementSecond` for an Ibdal madd letter. Values include تحقيق, تسهيل, إبدال, and the other reviewer selected treatments. The UI does not infer an attribution or validate source dependent canonical combinations.
- Added an indexed, conservative same word lookup over the existing `quran_words` table. A candidate must satisfy both `normalize_arabic` and `qiraat_editor_lexical_key`, which preserves lexical letter and Hamzah distinctions while stripping tashkeel and attached marks. All matches are previewed with their canonical key and location.
- Added a verified source lookup, selectable-face copy through the existing create route, and an occurrence bulk copy RPC. Each copy receives a new annotation and face IDs, the target's canonical word association, `entry_method='batch'`, `source_annotation_id`, and draft status. The RPC skips equivalent active faces and refuses to overwrite a different face for the same authority/rule. A single call is transactional; target keys are sorted before advisory locking.
- `/mushaf-1441/review` loads the existing Mushaf viewer with edit mode active. The desktop and tablet editor wrapper takes 60% of the available width; the remaining pane retains 40% and renders one page using its existing page aspect sizing. RTL arrows use fixed SVG geometry; edit mode turns exactly one page at a time.
- The editor caches the read-only authority/taxonomy/source catalog for the browser session; subsequent word requests ask only for that word's annotations. Saves invalidate the affected word and resolved-page cache without refetching the Qur'an fixtures.
- No Qur'an text fixture or `quran_words.text_uthmani` value is written by these functions. Existing reader and review queue paths remain in place.

## Verification and limits

Before the migration, `pg_dump -Fc` was saved at `/Volumes/External Mini/Projects/apps/mutshabehat-selfhost/backups/pre-review-editor-20260924.dump`. The migration is additive and rerunnable; it was first run in a rolled-back transaction and then applied with `ON_ERROR_STOP=1 --single-transaction`. `tests/qiraat_review_bulk.sql` runs against the real schema inside a rollback and verifies multi-delete, OCC, verified lookup, separate copied identity, equivalence skipping, conflict protection, Waqf, and unchanged Qur'an text.

The new PATCH RPC retains child face IDs and the parent revision trail; it recreates pronunciation-variant child rows when edited. A reviewer can select individual faces from one verified source annotation and can choose a narrator by choosing that narrator's source annotation. Copying several source annotations or narrators in one transaction is not implemented. Bulk apply uses all faces in one stored annotation. New copies deliberately remain drafts until reviewed at their target location. The local authoring table had one active draft and no verified rows before this work, so a full destructive browser acceptance run against existing production records was not possible without introducing synthetic live records.

## History & Changelog

| Date & Agent Model | Added | Removed | Changed | Verification |
| --- | --- | --- | --- | --- |
| 2026-09-24 (GPT-6 Codex) | Review editor model map, two migrations and rollback instructions, integration coverage | None | Recorded copy and pronunciation-variant identity limits; constrained edit-pane flex sizing after tablet browser check | `tests/qiraat_review_bulk.sql`: passed, rolled back; `npm run typecheck`: passed with Node 22 / 4 GB heap; targeted `npm run lint -- ...`: exit 0, 14 existing warnings; `npm run test:qiraat`: passed (44 engine tests and validators); `npm run mushaf:validate`: all seven validators passed; production `npm run build`: passed; desktop and tablet Playwright: 4 passed |
