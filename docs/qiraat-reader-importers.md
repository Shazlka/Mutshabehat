# Per-reader Qiraat importers

Every new per-reader importer must import `merge_face`, `merge_variant`, and
`merge_ruling` from `scripts/qiraat/merge_faces.py`. Route word-form candidates
through `merge_variant`; route usul candidates through `merge_ruling`; route
performance-only candidates through `merge_face(variants, rulings, candidate,
reading_id, strict_form)`. Do not keep importer-local merge implementations.
The performance merge is conservative: an explicit action family must match a
compatible ruling category and existing action. Same-reader action conflicts are
reported for review; no existing assignment is overwritten.

Current explicit action/category mappings:

| Source action family | Fixture ruling categories |
| --- | --- |
| Hamza substitution (إبدال الهمز) | `TAGHYIR_HAMZ` |
| Imalah (إمالة) | `IMALAH_TAQLIL`, only matching an imalah action |
| Taqlil (تقليل) | `IMALAH_TAQLIL`, only matching a taqlil action |
| Idgham (إدغام) | `IDGHAM_KABIR`, `IDGHAM_SAGHIR` |
| Sakt (سكت) | `SAKT` |
| Ha pronoun connection (صلة هاء) | `SILAT_HA` |
| Plural mim connection (صلة ميم) | `MEEM_JAM` |
| No ghunna (ترك الغنة) | `TARK_GHUNNA` |
| Ikhfa (إخفاء) | `IKHFA` |
| Ra lightening (ترقيق الراء) | `TARQIQ_RA` |
| Lam emphatic (تغليظ اللام) | `TAGHLIZ_LAM` |
| Waqf (وقف) | `WAQF_RASM`, `WAQF_HAMZA` |
| Madd (مد) | `MADD_BADAL` |
| Yaa of idafa (فتح/إسكان الياء) | `YAAT_IDAFA` |
| Facilitation (تسهيل) | `HAMZATAN_KALIMA`, `HAMZATAN_KALIMATAYN` when the ruling action also says facilitation |

Facilitation (تسهيل) is distinct from substitution (إبدال); imalah is distinct
from taqlil. Unmapped wording is left as a separate record for review. Exact
variant candidates can share one record only when token span, stored variant
text, difference type, and face description agree. The validator rejects new
duplicate groups; exceptions already listed in
`docs/qiraat-reader-dedupe-audit.json` remain visible for manual review.
