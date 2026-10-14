#!/usr/bin/env python3
"""Human review queue from an auto-review verdict file: tiers B (sources disagree), C (nothing documents the word)
and A-S2 (a book confirms, nquran is silent or differs). Writes the Markdown summary and a JSON list per page.
    python3 scripts/qiraat/build-queue.py artifacts/qiraat-auto-review-live-all.json docs/qiraat/AUTO_REVIEW_QUEUE.md artifacts/queue-all.json
"""
import json
import sys
from collections import Counter, defaultdict

src, out_md, out_json = sys.argv[1:4]
verdicts = json.load(open(src))["verdicts"]
queue = [v for v in verdicts if v["tier"] in ("B", "C", "A-S2")]
by_page = defaultdict(list)
for v in queue:
    by_page[v["page"]].append(v)
json.dump({str(p): [{"id": v["id"], "ref": v["ref"], "word": v["word"], "tier": v["tier"], "reason": v["reason"],
                      "narrators": v["narrators"], "category": v["category"], "sub": v["subCategory"]} for v in vs]
           for p, vs in sorted(by_page.items())}, open(out_json, "w"), ensure_ascii=False)

tiers = Counter(v["tier"] for v in queue)
lines = ["# Automatic review: human queue", "",
         f"Entries the sources could not settle: **{len(queue)}** (B = sources disagree {tiers['B']}, "
         f"C = nothing documents the word {tiers['C']}, A-S2 = a book confirms but nquran is silent or differs {tiers['A-S2']}).",
         "Open a page in the editor: `/mushaf-1441/review?page=N`. Per-entry detail: `artifacts/queue-all.json`.", "",
         "| Pages | B | C | A-S2 | Total |", "|---|---:|---:|---:|---:|"]
for start in range(1, 605, 50):
    end = min(start + 49, 604)
    c = Counter(v["tier"] for p in range(start, end + 1) for v in by_page.get(p, []))
    lines.append(f"| {start}-{end} | {c['B']} | {c['C']} | {c['A-S2']} | {sum(c.values())} |")
lines += ["", "## Most common reasons", ""]
for reason, n in Counter(v["reason"].split(";")[0] for v in queue).most_common(10):
    lines.append(f"- {n} × {reason}")
open(out_md, "w").write("\n".join(lines) + "\n")
print(len(queue), "queued")
