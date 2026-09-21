# 11 — Annotation master data operations

## Safety boundary

The canonical Quran registry (`quran_words`) is derived only from committed Mushaf 1441 page-word fixtures. It is not editable through the application and must never be used to alter fixture text, glyphs, page order or layout. Regenerate/validate it with:

```bash
npm run qiraat:canonical-words:validate
npx tsx scripts/qiraat/seed-canonical-words.ts | docker exec -i mutshabehat-db \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction
```

The second command is idempotent and only inserts missing canonical keys. Before any production
DDL or reseed, take a fresh `pg_dump -Fc` backup and obtain explicit approval.

## Adding a transmission entity

`qiraat_authorities` remains the single hierarchy for Reader → Narrator → Tariq (`route` in the
existing enum). Use an unambiguous stable ID; never use a bare Arabic name. Insert the entity with
the correct parent, then verify/rebuild the closure:

```sql
SELECT qiraat_rebuild_authority_closure();
SELECT ancestor_id, descendant_id, depth
FROM qiraat_authority_closure
WHERE descendant_id = '<authority-id>'
ORDER BY depth;
```

Do not add a Tariq, parent relationship or framework membership without a verified repository or
user-supplied scholarly source. Framework validity belongs in `qiraat_framework_authorities`; it
does not make the framework a parent of the authority.

## Adding taxonomy, groups and colours

- Add a `qiraat_taxonomies` row under the `USUL` or `FARSH` root; do not hard-code UI options.
- The `USUL` and `FARSH` rows are roots only. Usul groups (for example `USUL_HAMZ`,
  `USUL_MADD`, and `USUL_IDGHAM`) must be children of `USUL`; selectable rules such as
  `USUL_MADD_BADAL` must be children of their group. Never create a self-nested `USUL` row.
- Optional leaf-only entry presets belong in `metadata.face_presets`; the editor exposes them
  only after a leaf rule is selected. This metadata describes input vocabulary, not Reader or
  Narrator applicability.
- Add group presets to `qiraat_groups`, then expand them through `qiraat_group_members`. Groups are
  shortcuts only, never hierarchy entities. Both the group definition and every membership require
  verified evidence.
- `qiraat_authority_colors.default_color` mirrors the existing authority default. Update it only
  through a deliberate “change default colour” operation. A future annotation `color_override`
  remains local to that annotation and must not change this table.

## Phase boundary

This phase creates master data only. Annotation creation, inheritance resolution, revisions,
batch rollback and import DTOs are introduced in later phases and must use the same server-side
validation path once implemented.
