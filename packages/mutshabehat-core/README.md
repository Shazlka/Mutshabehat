# Mutshabehat Core

Preview-only integration helpers for linking Mushaf ayat to Mutshabehat data.

The Mushaf link adapter is disabled by default. Enable it only in preview environments with:

```bash
NEXT_PUBLIC_ENABLE_MUSHAF_MUTSHABEHAT_LINK=true
```

Keep the production/default value unset or `false` until the Mutshabehat database has a verified `ayahKey` mapping.
