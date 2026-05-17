# V71 — Surah/Ayah Dropdowns + Font Preview

## What changed

### Modification window
- Replaced manual Surah input with a Surah dropdown.
- Replaced manual Ayah input with an Ayah dropdown.
- Ayah dropdown updates automatically based on the selected Surah using `quran-reference.js`.

### Settings font preview
- Added live font preview under Settings > Font.
- Preview changes immediately when selecting Normal Quran or Mushaf QPC V2.

### Fonts folder
The app works even if `/fonts` is empty because CSS fallback fonts are included.
For real QPC V2 display, add one of these files:
- `fonts/qpc-v2.woff2`
- `fonts/qpc-v2.ttf`

Keep the exact file name.
