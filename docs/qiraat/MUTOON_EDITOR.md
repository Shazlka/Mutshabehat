# متون editor (web) and its live link to the iOS app

Open `/mushaf-1441/mutoon-editor`. Choose الشاطبية, الدرة or طيبة النشر, pick a verse, then a word, and assign any readers and narrators to it (one by one, by a ready group such as سما or صحبة, or to one specific letter). Every choice is saved to the database the moment it is made and shows in the iOS app within seconds. You can also correct the verse text (whole hemistich, rename, insert or delete a word), link a word to the poem's own symbol (with its source), add a source and a note to an assignment, delete any assignment or symbol, and undo/redo.

No poem text is committed to the public Git repository.

## Data model (migration `20261028150000_qiraat_mutoon_rows.sql`)

| Table | Row |
|---|---|
| `qiraat_mutoon_works` | one of the three poems |
| `qiraat_mutoon_verses` | a verse: `(work, verse)`, hemistichs, chapter, order, `version` |
| `qiraat_mutoon_marks` | a poem's own symbol on a word (checked against the poem's dictionary), `version` |
| `qiraat_mutoon_assignments` | readers/narrators assigned by hand to a word or a letter, `version` |
| `qiraat_mutoon_log` | every change in commit order (`seq`, before/after, client): the feed behind "what changed since N" |

`qiraat_mutoon_documents` (the first, whole-document storage) is kept only as a backup of the import. All tables are closed to `anon`/`authenticated`; the API uses the service role.

Writes go through `qiraat_mutoon_apply(ops, client)`: up to 200 operations (`assign_set/del`, `mark_set/del`, `verse_set`) in one transaction. Each carries the version of the row it was planned from; a stale version raises `PT409` (HTTP 409) and nothing is applied. Changes to a verse's text also move or remove the assignments and marks on its words in the same transaction.

## API

- `GET /api/mushaf-1441/mutoon-editor?work=W` a poem's chapters and verses with counts.
- `GET ...?work=W&verse=N` one verse with its marks and assignments.
- `GET ...?since=S` verses changed after sequence `S` (the editor polls this every 8 s).
- `POST ...` `{ops, lines, client}`; `lines` is the verse text the operations were planned against.
- `GET /api/mushaf-1441/mutoon` for the iOS app: no parameter = a snapshot with `seq`; `?since=S` = only the changed verses with their compiled marks (`origin: "assignment"` for a hand assignment, `"symbol"` for a poem symbol); `full: true` asks for a new snapshot.

## iOS

`QiraatLiveSync.syncMutoon()` takes one snapshot, stores its `seq`, then every 10 s while the «المتون» page is open asks `?since=seq` and swaps only the changed verses (`MatnOverlay`, in `MushafCore`). A hand assignment is drawn in its reader's colour (the shared green for several), underlined, and its card names the readers; it needs no dictionary symbol.

## Who can edit

By the owner's decision the site signs every visitor in as the owner, so there is no separate editor login. Writes are refused from other origins and every operation is validated and version-checked.

## Deploying

1. Back up the database. 2. Apply `supabase/migrations/20261028150000_qiraat_mutoon_rows.sql` in one transaction (`--single-transaction -v ON_ERROR_STOP=1`) and `NOTIFY pgrst, 'reload schema'`. 3. Deploy the web code. Until the migration is applied the API answers 503. Rollback: `supabase/rollbacks/20261028150000_qiraat_mutoon_rows.down.sql` (export `qiraat_mutoon_snapshot_json()` first if later edits matter).
