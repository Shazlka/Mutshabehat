# 13 — Visual Qiraat word editor

The Mushaf Qiraat layer opens a responsive editor when a semantic word button is clicked. The
header displays the word's canonical key (`surah:ayah:word_position`), location and annotation
summary. The page renderer and QCF glyph data remain untouched.

Editor writes use authenticated RPCs exposed through `/api/mushaf-1441/qiraat-editor`:

- `GET` loads one catalog (entities, taxonomy, corpus/framework and sources) plus active annotations;
- `POST` creates explicit authority/rule assignments with structured Faces, Variants and sources;
- `PATCH` replaces an aggregate using `expectedVersion`; and
- `DELETE` soft-deletes using `expectedVersion`.

Multiple queued assignments are submitted as separate records. Default authority colours are
previewed and a hex override is local to the annotation. Faces default to no preference. Alternate
text is editor-only and cannot replace canonical page text.

The editor load promise is shared per canonical key so development remounts do not create duplicate
detail requests. Save & Next / Save & Previous use semantic page-word order and existing page-cache
loading. OCC conflicts return HTTP 409 (`VERSION_CONFLICT`) without silently retrying or overwriting.
