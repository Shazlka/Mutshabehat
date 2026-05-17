# Release Notes — V85 Independent Sorting and Filters

## Implemented
- Moved sorting dropdown outside the collapsible Surah filter menu.
- Sorting dropdown is now in the same filter bar line as the filter controls.
- Desktop/tablet layout stays horizontal; mobile layout is compact and responsive.
- Added independent sorting persistence: `personalSortMethod`, `automatedSortMethod`.
- Added independent filter persistence: `personalFilters`, `automatedFilters`.
- Filters and sorting are restored per database when reopening.
- Filters reset only by user action.

## Preserved
- Adding personal groups, saving personal DB, copying Automated groups to Personal, exporting data.js, GitHub sync, RTL/theme/responsive design, DB format, and Automated lazy loading.

## Microsoft Graph / Azure
- No Microsoft Graph or Azure App Registration changes are required.
- Existing GitHub token/repo/branch/path settings remain unchanged.
