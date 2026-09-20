# Put your Qiraat Excel files here

This is the folder `scripts/qiraat/import_excel.py` scans automatically. Nothing else in the
repo reads from it, and nothing here is committed to git (see `.gitignore`) — it is your
local working folder for the source spreadsheets you're currently importing.

## What to put here

- `.xlsx` / `.xls` / `.csv` files, however many, however named.
- Any number of sheets per file. Empty sheets are skipped automatically.
- Column headers in Arabic or English — see `scripts/qiraat/excel_mapping.yaml` for every
  header spelling already recognized. If your sheet uses a header that isn't recognized,
  the dry-run report lists it under "unmapped columns" and no data is guessed from it; add
  the new spelling to that YAML file (or ask for it to be added) and re-run.

## What to run

```bash
# 1. See what would happen — never touches the database.
npm run qiraat:import:dry

# 2. Load it into the review-only staging tables.
npm run qiraat:import

# 3. Open the review UI and work through it page by page.
#    /admin/qiraat-import

# 4. Once you've approved rows, publish them into the permanent schema.
npm run qiraat:publish -- --batch <batch-id-from-step-3>

# 5. Regenerate the app's JSON fixtures from the database.
npm run qiraat:export
```

Full walkthrough, validation rules, and how duplicate/conflict detection works:
`docs/qiraat/excel-import-system.md`.
