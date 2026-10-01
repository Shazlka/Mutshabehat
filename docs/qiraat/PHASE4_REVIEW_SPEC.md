# Phase 4 review screen: contract

Status: DB layer scratch-tested (26/26 tests) and **applied to live on 2026-09-23** (backup `pre-qiraat-phase4-apply-20260923T131207Z.dump`). API + UI are built against this contract.

Decisions: D5 (rendered Hafs page, variant words highlighted), D7 (instant save, every edit logged), D9 (page text on the RIGHT, variant table on the LEFT), allowlist editors only, new route `/mushaf-1441/review?page=N`, full row editing in v1, marking reviewed resolves open flags with an optional note.

Next.js is **16.2.6** with breaking changes. Read `node_modules/next/dist/docs/` for route handlers, `searchParams`, server/client components before writing code. Follow the existing patterns in `src/app/api/mushaf-1441/qiraat-editor/route.ts` and `src/app/mushaf-1441/page.tsx`.

## 1. Database RPCs (already written, do not change them)
All are `SECURITY DEFINER`, check the allowlist (`qiraat_editors`) and raise `unauthorized` for anyone else. Call them through the user's session client (`createServerSupabaseClient()` from `@/lib/supabase-server`), **never** through a service-role client.

| RPC | Args | Returns |
|---|---|---|
| `qiraat_review_is_editor()` | — | boolean |
| `qiraat_review_overview()` | — | `[{page,total,unreviewed,reviewed,flagged}]` (pages with readings) |
| `qiraat_review_page(p_page int, p_include_deleted bool=false)` | 1–604 | `{page, words:[{key,surah,ayah,word,line,text}], rows:[Row], stats:{total,unreviewed,reviewed,flagged,deleted}, narrators:[{id,code,nameAr,parentId,type,color}], categories:[{code,nameAr}], variantTypes:[string]}` |
| `qiraat_review_set_status(p_entry_id, p_status 'unreviewed'\|'reviewed'\|'flagged', p_expected timestamptz, p_note text, p_device_id text)` | | Row |
| `qiraat_review_update_entry(p jsonb)` | `{entryId, expectedVersion, deviceId, notes?, readingText?, uthmaniText?, description?, performanceNote?, variantType? (فرش only), categoryCode?, rulingText? (أصول only)}`; only keys present change | Row |
| `qiraat_review_set_narrators(p_entry_id, p_narrators jsonb, p_expected, p_device_id)` | `[{id:'Q01-R02', action?, wajhOrder?:1, wajhNote?}]` narrator ids only; replaces the list | Row |
| `qiraat_review_delete_entry(p_entry_id, p_expected, p_note, p_device_id)` | soft delete; the location goes too when it was the last reading | Row |
| `qiraat_review_restore_entry(p_entry_id, p_expected, p_device_id)` | | Row |
| `qiraat_review_history(p_page int, p_limit int=20)` | | `[{txid, at, deviceId, undone, entryId, changes:[{table,rowId,op,field,old,new}]}]` newest first |
| `qiraat_review_undo(p_txid bigint, p_device_id)` | undoes one review transaction | int (rows undone) |

`Row` = `{entryId, locationId, version, kind:'farsh'|'usul', categoryCode, categoryNameAr, surah, ayah, startWord, endAyah, endWord, startKey, endKey, page, hafsText, readingText, uthmaniText, description, performanceNote, variantType, rulingText, options, notes, reviewStatus, locationReviewStatus, verificationStatus, legacyRef, entryOrder, deleted, narrators:[{id,code,nameAr,action,wajhOrder,wajhNote}], flags:[{id,type,issueAr,status,createdAt,resolvedNote,resolvedAt}]}`.

`version` is an opaque string (the entry's `updated_at`). Send it back unchanged as `p_expected` / `expectedVersion`. `startKey`/`endKey` and `words[].key` are canonical keys `SSS:AAA:WWW`; a word is part of a row when `startKey <= key <= endKey` (string compare works because the keys are zero-padded and in the same surah).

**Hafs text is exact and read-only.** Render `words[].text` / `hafsText` verbatim; never retype, normalise or "fix" Quranic text in code.

### Error mapping (Postgres message → HTTP)
| DB message starts with | HTTP | JSON `error` |
|---|---|---|
| (no session) | 401 | `unauthorized` |
| `unauthorized` | 403 | `forbidden` |
| `VERSION_CONFLICT` | 409 | `VERSION_CONFLICT` |
| `QIRAAT_D8` | 422 | `RULE_D8` + `messageAr: "حفص هو الأصل: لا يُذكر إلا وجهًا ثانيًا مع ملاحظة"` |
| `QIRAAT_NARRATOR_TWICE` | 422 | `RULE_NARRATOR_TWICE` + `messageAr: "راوٍ مكرر في هذا الموضع دون وجه مستقل"` |
| `QIRAAT_EMPTY_LOCUS` | 422 | `RULE_EMPTY_LOCATION` + `messageAr: "لا بد من قراءة واحدة على الأقل في الموضع"` |
| `UNDO_CONFLICT` | 409 | `UNDO_CONFLICT` |
| `UNDO_REFUSED` | 403 | `UNDO_REFUSED` |
| `NOT_FOUND` | 404 | `not_found` |
| `DELETED` / `invalid …` / `… is required` / `duplicate narrator` | 400 | the message |
| anything else | 503 | `Qiraat review data is unavailable` (log the real message server-side only) |

## 2. API (Codex)
Route handlers under `src/app/api/mushaf-1441/qiraat-review/`:
- `GET ?page=N[&includeDeleted=1]` → `qiraat_review_page`
- `GET ?overview=1` → `{isEditor, pages}` (is_editor + overview)
- `GET ?history=1&page=N` → history
- `PATCH` body `{action, entryId, version, deviceId, ...}` with `action` ∈ `status` (`status`, `note`), `update` (`fields` object), `narrators` (`narrators` array), `delete` (`note`), `restore` → the RPC's Row
- `POST` body `{action:'undo', txid, deviceId}` → `{undone}`
Validate input shape before calling the DB (page 1–604, action enum, `version` present, narrators array ≤ 20 items, strings ≤ 2,000 chars). `Cache-Control: no-store` on every response. Put the DB-error→HTTP mapping in one small pure module with unit tests (`tsx --test`), plus a test for request validation. Also a typed client module the UI uses (`fetch` wrappers returning typed results/errors) at `src/app/mushaf-1441/review/_lib/api.ts`, and the shared TypeScript types at `src/app/mushaf-1441/review/_lib/types.ts`.

## 3. UI (Antigravity)
Route `src/app/mushaf-1441/review/page.tsx` (server component): read the session (`getSessionUser`); not signed in → link to sign in; signed in but not an editor → a plain Arabic "غير مصرح" message; editor → the client screen.

Client screen (RTL, Arabic UI, desktop-first, usable on iPad landscape):
- **Right pane: the Hafs page.** 15 lines from `words` grouped by `line`, the app's Quran font (`var(--font-quran)`), justified like a Mushaf page. Words covered by a row are highlighted by the row's status (unreviewed / reviewed / flagged; use the design tokens in `design-system/` and `globals.css`, no new palette). Hover links word ↔ row, and clicking a word selects its rows.
- **Left pane: the variant table**, one row per reading, in page order: position (surah:ayah, word), Hafs text, فرش reading text or أصول category, narrators as display-code chips (wajh ≥ 2 shown distinctly with the note on hover), status badge, open-flag count. Filters: all / unreviewed / flagged / reviewed / deleted; kind فرش/أصول.
- **Row editor** (drawer or inline panel on the left) for the selected row:
  - status buttons (reviewed / flagged / unreviewed) with an optional note;
  - flags list (open first, with issue text);
  - فرش fields (reading text, uthmani text, description, performance note, variant type) or أصول fields (category select, ruling text);
  - notes;
  - narrator editor: the 20 narrators grouped by reader; pick main or further wajh; action text; wajh note, required and enforced in the UI when Hafs `Q05-R02` is chosen, and only allowed as wajh ≥ 2;
  - delete / restore.
- **Instant save (D7):** every change calls the API immediately. Show "saved" state; on 409 `VERSION_CONFLICT` reload the row and tell the user; on 422 show `messageAr` inline and keep the user's input.
- **History panel:** recent transactions for the page with an Undo button each.
- **Navigation:** previous/next page, jump to page, "next page with flagged / unreviewed" using the overview, page progress indicator. Keyboard: ← → pages, j/k rows, r = reviewed, f = flagged.
- `deviceId`: a UUID kept in `localStorage` (`qiraat-review-device-id`), sent on every write.
- No new dependencies. Accessibility: keyboard reachable, visible focus, `lang="ar" dir="rtl"`.

## 4. Verification
`npm run typecheck`, `npm run test:qiraat`, `npm run mushaf:validate`, the new unit tests, `npm run build`. A Playwright smoke test against a running dev server: the page renders for an editor and returns 401/403 JSON for the API without a session. **Do not write to the live DB from tests.** Live writes only happen after the DB migration is approved and applied, and then only through a manual check by the reviewer.

## 5. Shared client module (Codex implements, UI imports)
Types live in `src/app/mushaf-1441/review/_lib/types.ts` (written, do not change the shapes without both sides). `src/app/mushaf-1441/review/_lib/api.ts` must export exactly:
```ts
getReviewPage(page: number, includeDeleted?: boolean): Promise<ReviewResult<ReviewPage>>
getReviewOverview(): Promise<ReviewResult<ReviewOverview>>
getReviewHistory(page: number): Promise<ReviewResult<HistoryTransaction[]>>
setStatus(row: ReviewRow, status: ReviewStatus, note: string | null, deviceId: string): Promise<ReviewResult<ReviewRow>>
updateEntry(row: ReviewRow, fields: EntryFields, deviceId: string): Promise<ReviewResult<ReviewRow>>
setNarrators(row: ReviewRow, narrators: NarratorInput[], deviceId: string): Promise<ReviewResult<ReviewRow>>
deleteEntry(row: ReviewRow, note: string | null, deviceId: string): Promise<ReviewResult<ReviewRow>>
restoreEntry(row: ReviewRow, deviceId: string): Promise<ReviewResult<ReviewRow>>
undoTransaction(txid: number, deviceId: string): Promise<ReviewResult<{ undone: number }>>
getDeviceId(): string   // localStorage 'qiraat-review-device-id', crypto.randomUUID() on first use
```
Every write sends `row.version`. They never throw on HTTP errors; they return `{ ok: false, error }`.
