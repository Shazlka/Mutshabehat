# متون editor for the iOS app

Open `/mushaf-1441/mutoon-editor` from the web review page. It loads and saves the three poems and their marks in `qiraat_mutoon_documents`. No poem text or annotation data is committed to the public Git repository.

The editor uses the web app's existing Supabase session. There is no additional password. The site's proxy automatically signs visitors into the owner account, so anyone who can reach this web app can read and edit the متون through this page or API. The table itself grants no direct browser-role access; the API verifies the session and uses the server-side service role key. The server requires `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Initial import

After applying `supabase/migrations/20261028100000_qiraat_mutoon_editor.sql`, open the page. Select the private `mutoon.json` and `symbols-all.json` files from `apps/ios/Generated/QiraatMutoon/`, then press **حفظ**. The import is sent to the database only when saved. The table begins empty; the first save creates revision 1. Later imports replace the current working copy only after confirmation and a version-checked save. The last 20 previous versions remain in `qiraat_mutoon_revisions`.

Choose الشاطبية, الدرة or طيبة النشر, search for a verse, and edit its hemistichs. To add a reader or narrator mark, choose the line and word, then choose a symbol from the dictionary for that work. The symbol fixes its reader/narrator IDs; the same letter may mean different people in different poems. Add a source and check the verification box only after checking the شرح. Existing marks can be made pending, given a new note/source, or deleted and recreated on another word. Saving validates every mark against the current poem text and dictionary. A pending mark remains in the data but is not red in the iOS app.

Other devices load the latest saved revision. If another device saved first, this page rejects the stale save. Download both files from the unsaved draft before reloading if you need to keep it.

## Export to the iOS app

Download **both** files from the editor and copy them into `apps/ios/Generated/QiraatMutoon/` in the iOS checkout. Then run from `apps/ios`:

```bash
make matn-symbols
swift test --package-path MushafCore
make project
```

The generated `mutoon-symbols.json` is the app's displayed mark layer. Rebuilding with `make mutoon` would overwrite the edited `mutoon.json` from the original Shamela parser output, so do not run it after applying an editor export unless you first reconcile those text edits back into the local parsed source. Keep a backup of the files before replacing them. Neither export belongs in Git. The app bundles data at build time; an already installed copy will not update until a new build is installed.

## Deployment order

1. Back up the production database, apply the migration in one transaction, and reload the PostgREST schema cache.
2. Seed the table from the two local private JSON files.
3. Deploy the web code and verify the live page, read API, and save conflict behavior.
4. Rebuild and install the iOS app when the editor data is ready for release.
