"""Command line entry point for the Phase 3 migration generator."""
import argparse
import hashlib
import json
from pathlib import Path

from .emit_sql import emit_sql
from .plan import build_plan
from .snapshot import load_inputs


def _report(plan, sql_path, sql_text, scratch_metrics=None):
    flags_by_code = {}
    for flag in plan.get("flags", []):
        flags_by_code.setdefault(flag["flag_type"], []).append(flag)
    counts = (scratch_metrics or {}).get("counts", plan.get("counts", {}))
    return {
        "fixture_sha256": plan.get("fixture_sha256"),
        "snapshot_time": plan.get("snapshot_time"),
        "sql": {"path": str(sql_path), "bytes": len(sql_text.encode("utf-8")), "sha256": hashlib.sha256(sql_text.encode("utf-8")).hexdigest()},
        "counts": counts,
        "loci_merged": len(plan.get("merged_away_loci", [])),
        "drops": plan.get("drops", []),
        "flags_by_code": flags_by_code,
        "conversions_by_category": plan.get("conversions", {}),
        "db_only": plan.get("db_only", []),
        "order_changes": plan.get("order_changes", []),
        "live_counts": (scratch_metrics or {}).get("live_counts", {}),
        "counts_source": "scratch apply edit_log" if scratch_metrics else "not supplied; pre-apply estimate",
        "scratch_apply": scratch_metrics or {},
        "interpretation": "The migration rebuilds each touched canonical locus with qiraat_rebuild_locus_readings(locus_id) after entry and authority changes. Counts are scratch-verified; the live database was read-only.",
    }


def _markdown(report):
    lines = ["# Phase 3 migration report", "", f"- Fixture SHA-256: `{report['fixture_sha256']}`", f"- SQL SHA-256: `{report['sql']['sha256']}`", f"- SQL size: {report['sql']['bytes']} bytes", f"- Loci merged: {report['loci_merged']}", "", "## Table counts", ""]
    for table, values in sorted(report["counts"].items()):
        lines.append(f"- `{table}`: " + ", ".join(f"{key}={value}" for key, value in values.items()))
    lines += ["", "## Drops", "", f"{len(report['drops'])} drops", "", "```json", json.dumps(report["drops"], ensure_ascii=False, indent=2, sort_keys=True), "```", "", "## Flags", ""]
    for code, values in sorted(report["flags_by_code"].items()):
        lines += [f"### {code} ({len(values)})", "", "```json", json.dumps(values, ensure_ascii=False, indent=2, sort_keys=True), "```", ""]
    lines += ["## فرش إلى أصول", "", json.dumps(report["conversions_by_category"], ensure_ascii=False, sort_keys=True), "", f"## DB-only entries ({len(report['db_only'])})", "", json.dumps(report["db_only"], ensure_ascii=False), "", "## Interpretation", "", report["interpretation"], ""]
    return "\n".join(lines)


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--report-json", required=True)
    parser.add_argument("--report-md", required=True)
    parser.add_argument("--scratch-report")
    args = parser.parse_args(argv)
    root = Path(__file__).resolve().parents[3]
    fixtures, snapshot, conflicts, duplicate_keys, page_specs = load_inputs(root)
    plan = build_plan(fixtures, snapshot, conflicts, duplicate_keys, page_specs, fixtures["sha256"])
    sql_text = emit_sql(plan)
    sql_path = Path(args.out); sql_path.parent.mkdir(parents=True, exist_ok=True); sql_path.write_text(sql_text, encoding="utf-8")
    scratch_metrics = json.loads(Path(args.scratch_report).read_text(encoding="utf-8")) if args.scratch_report else None
    report = _report(plan, sql_path, sql_text, scratch_metrics)
    json_path = root / args.report_json; json_path.parent.mkdir(parents=True, exist_ok=True); json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    md_path = root / args.report_md; md_path.parent.mkdir(parents=True, exist_ok=True); md_path.write_text(_markdown(report), encoding="utf-8")
    print(json.dumps({"sql_bytes": report["sql"]["bytes"], "sql_sha256": report["sql"]["sha256"], "flags": sum(len(x) for x in report["flags_by_code"].values()), "drops": len(report["drops"])}, ensure_ascii=False))


if __name__ == "__main__":
    main()
