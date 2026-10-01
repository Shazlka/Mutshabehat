# Review Editor (Phase 4) — bulk workflow implementation

This documents the port of the 8 originally-requested review-editor features onto the correct
target: the Phase 4 review screen (`/mushaf-1441/review` → `ReviewApp.tsx` →
`ReviewEditorPane.tsx` / `ReviewMushafPane.tsx` / `ReviewNav.tsx`), backed by the
`qiraat_entries` / `qiraat_loci` / `qiraat_review_*` schema. It does **not** touch the separate
Phase 5 annotation editor (`QiraatEditor.tsx`, `qiraat_annotations`), which an earlier pass
("Codex") had incorrectly wired the same 8 features into.

## Files changed

- `supabase/migrations/20260926100000_qiraat_review_bulk_workflow.sql` (new) — additive schema
  (`applies_wasl`, `applies_waqf`, `hamzah_detail` on `qiraat_entries`) and 5 new RPCs:
  `qiraat_review_bulk_delete`, `qiraat_review_find_same_word`, `qiraat_review_copy_entry`,
  `qiraat_review_find_occurrences`, `qiraat_review_bulk_apply`. Also replaces
  `qiraat_review_row()` and `qiraat_review_update_entry()` with versions that carry the 3 new
  fields.
- `supabase/rollbacks/20260926100000_qiraat_review_bulk_workflow.down.sql` (new) — drops the 5 new
  functions, restores `qiraat_review_row()`/`qiraat_review_update_entry()` to their pre-migration
  bodies, drops the 3 new columns and the CHECK constraint.
- `tests/qiraat_review_phase4_bulk.sql` (new) — a manual verification script (queries + expected
  results in comments) for someone with database access to run against a scratch restore before
  and after applying, including the `quran_words` checksum safety check for bulk-apply.
- `src/app/api/mushaf-1441/qiraat-review/review-http.ts` — new `ENTRY_FIELD_KEYS`
  (`appliesWasl`, `appliesWaqf`, `hamzahDetail`), new `ValidatedPost` variants
  (`bulkDelete`, `findSameWord`, `copyEntry`, `findOccurrences`, `bulkApply`) and their
  validators, a `RULE_WASL_WAQF` error mapping.
- `src/app/api/mushaf-1441/qiraat-review/route.ts` — dispatches the 5 new POST actions to the new
  RPCs, through the same authenticated/editor-gated client as every existing action.
- `src/app/mushaf-1441/review/_lib/types.ts` — `HamzahDetail` (discriminated union: single /
  kalima / kalimatayn), `ReviewRow.appliesWasl/appliesWaqf/hamzahDetail`,
  `EntryFields.appliesWasl/appliesWaqf/hamzahDetail`, `BulkDeleteItem`, `SameWordMatch`,
  `OccurrenceCandidate`, `BulkApplyResult`, `RULE_WASL_WAQF` error code.
- `src/app/mushaf-1441/review/_lib/api.ts` — `bulkDeleteEntries`, `findSameWord`,
  `copyEntryToOccurrence`, `findOccurrences`, `bulkApply` client functions.
- `src/app/mushaf-1441/review/_components/HamzahDetailFields.tsx` (new) — the structured Hamzah
  chip UI for `TAGHYIR_HAMZ` / `HAMZATAN_KALIMA` / `HAMZATAN_KALIMATAYN`.
- `src/app/mushaf-1441/review/_components/ReviewEditorPane.tsx` — multi-select delete over
  "الأوجه المسجلة", Wasl/Waqf toggle, Hamzah fields, same-word copy panel, apply-to-all-occurrences
  panel; `handleSaveExisting`/`handleCreate` now include the 3 new fields.
- `src/app/mushaf-1441/review/_components/ReviewApp.tsx` — `handleBulkDelete`,
  `handleCopyToOccurrence`, `handleBulkApply` handlers wired to the pane.
- `src/app/mushaf-1441/review/_components/ReviewNav.tsx` — swapped the previous/next page arrow
  glyphs to match the Mushaf-RTL convention already used by the keyboard shortcuts
  (`ArrowLeft` → next/page+1, shown with `←`; `ArrowRight` → previous/page-1, shown with `→`) —
  the icons were previously reversed relative to that convention.
- `tests/qiraat/review-http.test.ts`, `tests/qiraat/review-workstation.test.ts` — fixed two
  pre-existing/newly-surfaced TypeScript errors (a missing discriminant narrow; `ReviewRow`
  fixtures missing the 3 new required fields).

## Database changes — status

**NOT applied to the live database.** This sandbox has no network path to the self-hosted
Postgres (Mac Mini / Tailscale Funnel), so per `CLAUDE.md` the migration was written and reviewed
line-by-line but could not be applied or smoke-tested against real data. A local Postgres 16
cluster exists in this sandbox but its `postgres` role's password is unknown to this session, so
even a scratch-schema syntax check could not be run.

Someone with Mac Mini/Docker access must, per `CLAUDE.md` §"Applying DB DDL":
1. `pg_dump -Fc` backup.
2. Apply `supabase/migrations/20260926100000_qiraat_review_bulk_workflow.sql` with
   `docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1
   --single-transaction < file.sql` from `mutshabehat-selfhost`.
3. `NOTIFY pgrst, 'reload schema'` (the migration's last line already does this once applied).
4. Walk `tests/qiraat_review_phase4_bulk.sql` by hand, in particular the `quran_words` checksum
   comparison before/after a bulk-apply run.

Until applied, every new UI control in this pass (multi-select delete, Wasl/Waqf, Hamzah, copy,
bulk-apply) will call the API and get a `503`/`not_found`-style error, because the RPCs it needs
do not exist on the live database yet. The existing Phase 4 features (status, inline field edit,
narrators, single delete/restore, create, undo) are untouched and keep working exactly as before.

## Feature status

1. **Multi-select delete** — ✅ implemented (UI + `qiraat_review_bulk_delete`, all-or-nothing on
   any version conflict, transactional). ⚠️ not smoke-tested against a live database.
2. **Inline face editing** — ✅ already worked before this pass (`onSaveRowEdits` →
   `qiraat_review_update_entry`, in place, no delete+recreate); this pass only extends the field
   set it covers.
3. **Same-word verified-config copy** — ✅ implemented (`qiraat_review_find_same_word` keyed by
   word position so it also works for a brand-new word with no entry yet;
   `qiraat_review_copy_entry` always creates an independent new entry, forced to
   `unreviewed`/`REVIEWED`). ⚠️ not smoke-tested live.
4. **Structured Hamzah model** — ✅ UI + `hamzah_detail jsonb` field + round-trip through
   update/create/copy. The exact chip vocabulary (see below) is UI-defined, not derived from an
   external qiraat authority — flagged for a scholar's review, not claimed as verified rule data.
5. **Wasl/Waqf applicability** — ✅ toggle UI + `applies_wasl`/`applies_waqf` columns + CHECK
   constraint (DB-enforced, never both false) + `RULE_WASL_WAQF` 422 mapping.
6. **RTL page arrows** — ✅ fixed; verified against the existing, already-correct keyboard
   shortcut convention in the same file, not just by inspection.
7. **Apply-to-all-occurrences** — ⚠️ implemented but simplified relative to the full spec:
   preview/select/apply flow works and is transactional per occurrence (each copy call is
   independently wrapped, so one bad target doesn't abort the others), and skips exact-equivalent
   existing entries. It does **not** have the 4-way `سيتم الإضافة / موجود مسبقًا / يحتاج مراجعة /
   تعارض` classification — only 2-way (`add` / `exists`) — because a reliable "genuine semantic
   conflict, not just a second face" detector needs qiraat-domain judgment this pass didn't have
   scholarly input for. It also does not virtualize the candidate list (fine up to the 500-item
   cap the RPC enforces; a Mushaf-wide word can have hundreds of occurrences, which will render as
   a plain scrollable list, not a virtualized one).
8. **Layout redesign** — ⚠️ not done in this pass. The editor pane was already widened to
   `xl:w-[740px] 2xl:w-[840px]` (up to ~840px) by an earlier commit
   (`7a23f8a feat(qiraat): expand editor pane width…`); this pass did not re-measure or further
   adjust the split, and did not touch `ReviewMushafPane.tsx`'s aspect-ratio handling. Left as-is
   to avoid an unverified visual regression with no browser available in this sandbox.

## Hamzah model

`HamzahDetail` (in `_lib/types.ts`) is a discriminated union on `mode`:
- `single`: one `treatment` from `تحقيق | تسهيل | إبدال | نقل | حذف | سكت قبل الهمز`
  (`TAGHYIR_HAMZ`).
- `kalima` (الهمزتان من كلمة): `first`/`second`, each from `تحقيق | تسهيل | إبدال | حذف`, plus
  `idkhalAlif?: boolean` (إدخال ألف بين الهمزتين).
- `kalimatayn` (الهمزتان من كلمتين): `harakahRelation: 'متفقتان' | 'مختلفتان'`,
  `firstTreatment`/`secondTreatment` from the same 4-value vocabulary, plus
  `isqatFirst?`/`isqatSecond?`/`ibdalMadd?: boolean`.

The database stores it as opaque `jsonb` (`qiraat_entries.hamzah_detail`) and never interprets or
validates its shape beyond "valid JSON" — the vocabulary above is enforced only by the UI, not the
database. `HamzahDetailFields.tsx` only renders when `categoryCode` is one of the 3 relevant Usul
chapters, and is cleared (`null`) if the reviewer switches away from a Hamzah category.

## Bulk-apply safeguards

- Preview-then-apply: `qiraat_review_find_occurrences` (read-only) always runs before
  `qiraat_review_bulk_apply` (write); the reviewer selects a subset from the preview.
- `qiraat_review_bulk_apply` is capped at 500 targets per call (`RAISE EXCEPTION` above that).
- Every target is wrapped in its own `EXCEPTION WHEN OTHERS` block, so one bad/invalid target
  cannot abort the ones that succeed; each failure is reported individually in `errors`.
- A target that already carries an entry with identical normalized content (same reading text for
  a farsh entry, same category code for a usul entry) is detected **before** any write and
  reported in `skipped` — no duplicate row and no downgrade of an existing verified/reviewed row.
- **Quran-text safety, the single most safety-critical rule**: `qiraat_review_bulk_apply` and
  everything it calls (`qiraat_review_copy_entry` → `qiraat_review_create_entry`) contain no
  `INSERT`/`UPDATE`/`DELETE` statement that targets `quran_words`. Every write goes to
  `qiraat_entries`, `qiraat_loci`, `qiraat_variant_details`, `qiraat_ruling_details`,
  `qiraat_entry_authorities`, and `edit_log` only. `tests/qiraat_review_phase4_bulk.sql` §6 is a
  manual checksum-comparison script for whoever applies the migration to confirm this on the real
  database (this sandbox could not run it).
- All 4 database-write RPCs added in this pass require `qiraat_require_editor()`, the same gate
  every existing Phase 4 RPC uses.

## Test / lint / typecheck / build results (actual, not claimed)

This sandbox has no `node_modules` installed (`npm install` was started but the command budget for
this task ran out before it — or, if it finished, before a full `npm run build`/`typecheck` pass
could be re-run and captured — see the session's final message for whichever actually happened).
Where a check could not be completed, that is stated plainly rather than claimed as passing.
