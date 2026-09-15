# Qiraat Core

Standalone qiraat architecture for the Mushaf 1441 preview module.

This package intentionally contains no real qiraat content. The empty fixture is used to prove UI and adapter boundaries without inventing readings. Real qiraat data must later come from a verified source with documented licensing and review.

Supported future readings:

- Hafs
- Warsh
- Abu Amr
- Hamza

Run validation:

```bash
node packages/qiraat-core/validate.mjs
```
