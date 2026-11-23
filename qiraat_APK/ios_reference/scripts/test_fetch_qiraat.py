"""Offline contract tests: python3 apps/ios/scripts/test_fetch_qiraat.py -v."""

import collections
import contextlib
import datetime
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest import mock
from urllib.parse import parse_qs, urlsplit


SCRIPT = Path(__file__).with_name("fetch_qiraat.py")
REPO = Path(__file__).resolve().parents[3]
CATALOG_SOURCES = (
    "packages/qiraat-core/readers.ts",
    "packages/qiraat-core/narrators.ts",
    "packages/qiraat-core/colors.ts",
    "src/app/mushaf-1441/_components/qiraat/qiraatWordMarker.ts",
)
COOKIE = "test-session=private-cookie-value"


def page_data(number):
    """Synthetic records exercise transport only, without asserting a reading."""
    return {
        "pageNumber": number,
        "variants": [{
            "id": "test-variant", "surah": 1, "ayah": 1,
            "startToken": 1, "endToken": 1, "readingIds": ["Q03-R01"],
            "operation": "REPLACE", "hafsText": "نص تجريبي",
            "variantText": "نص تجريبي", "verificationStatus": "NEEDS_MANUAL_REVIEW",
            "differenceType": "ORTHOGRAPHY", "wajhIndex": 2,
            "notes": "بيانات اختبار", "futureField": {"keep": True},
        }],
        "rulings": [{
            "id": "test-ruling", "pageNumber": number,
            "category": "TEST", "categoryAr": "اختبار", "color": "#123456",
            "wordAnchored": True, "surah": 1, "ayah": 1,
            "startToken": 2, "endToken": 1, "endAyah": 2,
            "baseText": "نص تجريبي", "hasAlternate": True,
            "verificationStatus": "REVIEWED",
            "readings": [{"readingId": "Q03-R01", "action": "اختبار", "isDefault": False}],
            "attribution": [{"authorityId": "Q03-R01", "action": "اختبار",
                             "condition": "اختبار", "wajhOrder": 2, "wajhNote": "اختبار"}],
            "sourceNotes": ["اختبار"],
        }],
        "rules": [{"id": "test-rule", "text": "اختبار", "extra": [1, None]}],
        "futurePageField": {"preserve": "كما هو"},
    }


class LocalAPI:
    def __init__(self):
        self.requests = collections.Counter()
        self.authenticated = collections.Counter()
        self.redirects = 0
        self.payloads = {}
        self.statuses = {}
        self.drops = collections.Counter()
        self.redirect_hops = 0
        self.barrier = None
        self.lock = threading.Lock()
        owner = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_GET(self):
                query = parse_qs(urlsplit(self.path).query)
                number = int(query["page"][0])
                hop = int(query.get("hop", ["0"])[0])
                with owner.lock:
                    owner.requests[number] += 1
                    needs_cookie = self.headers.get("Cookie") != COOKIE
                    if needs_cookie or hop < owner.redirect_hops:
                        owner.redirects += 1
                        status = 307
                    else:
                        owner.authenticated[number] += 1
                        statuses = owner.statuses.get(number, [])
                        status = statuses.pop(0) if statuses else 200
                        if owner.drops[number]:
                            owner.drops[number] -= 1
                            self.connection.shutdown(socket.SHUT_RDWR)
                            self.connection.close()
                            return
                if status == 307:
                    self.send_response(307)
                    self.send_header("Set-Cookie", COOKIE + "; Path=/; HttpOnly")
                    location = self.path if needs_cookie else (
                        f"/api/mushaf-1441/qiraat?page={number}&hop={hop + 1}")
                    self.send_header("Location", location)
                    self.end_headers()
                    return
                if owner.barrier and status == 200:
                    owner.barrier.wait(timeout=5)
                payload = owner.payloads.get(number, page_data(number))
                body = payload if isinstance(payload, bytes) else json.dumps(
                    payload, ensure_ascii=False).encode("utf-8")
                self.send_response(status)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.base = f"http://127.0.0.1:{self.server.server_port}"
        self.thread = threading.Thread(
            target=self.server.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True)
        self.thread.start()

    def close(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()


class FetchQiraatTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.out = self.root / "out"
        self.api = LocalAPI()
        self.addCleanup(self.api.close)

    def run_script(self, *options, repo=REPO, out=None, pages=2, env_base=False):
        env = dict(os.environ, QIRAAT_API_BASE=self.api.base,
                   NO_PROXY="127.0.0.1", no_proxy="127.0.0.1", PYTHONDONTWRITEBYTECODE="1")
        command = [sys.executable, str(SCRIPT), str(repo), str(out or self.out),
                   "--page-count", str(pages), "--workers", "2"]
        if not env_base:
            command.extend(["--base", self.api.base])
        command.extend(options)
        return subprocess.run(command, capture_output=True, text=True, env=env, timeout=20)

    def load_module(self):
        spec = importlib.util.spec_from_file_location("fetch_qiraat", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        with mock.patch.object(sys, "dont_write_bytecode", True):
            spec.loader.exec_module(module)
        return module

    def fake_repo(self):
        repo = self.root / "repo"
        for relative in CATALOG_SOURCES:
            dest = repo / relative
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(REPO / relative, dest)
        return repo

    def write_fixture(self, repo, folder, number, value):
        path = repo / "packages/qiraat-core/fixtures" / folder / f"page-{number:03d}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")

    def read_json(self, name):
        return json.loads((self.out / name).read_text(encoding="utf-8"))

    def assert_no_parts(self, out=None):
        self.assertEqual(list((out or self.out).rglob("*.part")), [])

    def test_api_fetches_all_pages_and_preserves_the_complete_payload(self):
        self.api.barrier = threading.Barrier(2)
        result = self.run_script(pages=4)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.api.redirects, 2)
        for number in range(1, 5):
            name = f"page-{number:03d}.json"
            self.assertEqual(self.read_json(name), page_data(number))
            text = (self.out / name).read_text(encoding="utf-8")
            self.assertEqual(text, json.dumps(page_data(number), ensure_ascii=False, separators=(",", ":")))
        catalog = self.read_json("catalog.json")
        self.assertEqual(catalog["schemaVersion"], 1)
        self.assertEqual(catalog["source"], "api")
        self.assertEqual(catalog["sourceUrl"], self.api.base)
        self.assertEqual(catalog["pageCount"], 4)
        self.assertEqual(catalog["counts"], {"variants": 4, "rulings": 4, "rules": 4})
        datetime.datetime.strptime(catalog["fetchedAt"], "%Y-%m-%dT%H:%M:%SZ")
        self.assert_no_parts()

    def test_wrong_page_and_truncated_json_fail_without_publishing(self):
        self.api.payloads = {1: page_data(9), 2: b'{"pageNumber":2,'}
        result = self.run_script(pages=3)
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn("Failed pages: 1, 2", result.stderr)
        self.assertFalse((self.out / "page-001.json").exists())
        self.assertFalse((self.out / "page-002.json").exists())
        self.assertTrue((self.out / "page-003.json").exists())
        self.assertFalse((self.out / "catalog.json").exists())
        self.assert_no_parts()

    def test_skip_valid_pages_and_refresh_requests_them_again(self):
        self.assertEqual(self.run_script().returncode, 0)
        before = self.api.requests.copy()
        self.assertEqual(self.run_script().returncode, 0)
        self.assertEqual(self.api.requests, before)
        result = self.run_script("--refresh")
        self.assertEqual(result.returncode, 0, result.stderr)
        for number in (1, 2):
            self.assertGreater(self.api.requests[number], before[number])
        self.assertEqual(self.read_json("catalog.json")["counts"]["variants"], 2)

    def test_invalid_existing_page_is_fetched_again(self):
        self.out.mkdir()
        (self.out / "page-001.json").write_text('{"pageNumber":', encoding="utf-8")
        result = self.run_script(pages=1)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.read_json("page-001.json"), page_data(1))
        self.assertEqual(self.api.authenticated[1], 1)

    def test_failed_refresh_preserves_existing_page_and_catalog(self):
        self.assertEqual(self.run_script(pages=1).returncode, 0)
        before = {p.name: p.read_bytes() for p in self.out.iterdir()}
        self.api.payloads[1] = page_data(2)
        result = self.run_script("--refresh", pages=1)
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertEqual({p.name: p.read_bytes() for p in self.out.iterdir()}, before)
        self.assert_no_parts()

    def test_fixtures_assemble_arrays_and_missing_files_are_empty(self):
        repo = self.fake_repo()
        expected = {"pageNumber": 1}
        for folder, key in (("pages", "variants"), ("rulings", "rulings")):
            expected[key] = page_data(1)[key]
            self.write_fixture(repo, folder, 1, expected[key])
        expected["rules"] = []
        self.write_fixture(repo, "rules", 2, page_data(2)["rules"])
        result = self.run_script("--source", "fixtures", repo=repo)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.read_json("page-001.json"), expected)
        self.assertEqual(self.read_json("page-002.json"), {
            "pageNumber": 2, "variants": [], "rulings": [], "rules": page_data(2)["rules"]})
        catalog = self.read_json("catalog.json")
        self.assertEqual(catalog["source"], "fixtures")
        self.assertIsNone(catalog["sourceUrl"])
        self.assertEqual(catalog["counts"], {"variants": 1, "rulings": 1, "rules": 1})
        self.assertEqual(self.api.requests, {})

    def test_malformed_fixture_is_not_treated_as_missing(self):
        repo = self.fake_repo()
        self.write_fixture(repo, "rules", 1, {})
        result = self.run_script("--source", "fixtures", repo=repo, pages=1)
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertFalse((self.out / "page-001.json").exists())
        self.assertFalse((self.out / "catalog.json").exists())
        self.assert_no_parts()

    def test_real_catalog_names_counts_and_colors(self):
        result = self.run_script(pages=1)
        self.assertEqual(result.returncode, 0, result.stderr)
        catalog = self.read_json("catalog.json")
        readers = {row["id"]: row for row in catalog["readers"]}
        narrators = {row["id"]: row for row in catalog["narrators"]}
        self.assertEqual(len(readers), 10)
        self.assertEqual(len(narrators), 20)
        self.assertEqual(readers["Q10"]["nameArShort"], "خلف العاشر")
        self.assertEqual(narrators["Q03-R01"]["nameAr"], "الدوري عن أبي عمرو")
        self.assertEqual(narrators["Q07-R02"]["nameAr"], "الدوري عن الكسائي")
        self.assertEqual(catalog["multiReaderColor"], "#3F6212")
        self.assertEqual(catalog["performanceColor"], "#4F46E5")
        self.assertEqual(catalog["unresolvedColor"], "#8a8a8a")
        self.assertEqual(set(readers["Q01"]), {"id", "nameAr", "nameArShort", "color", "sortOrder"})
        self.assertEqual(set(narrators["Q01-R01"]), {"id", "readerId", "nameAr", "color", "sortOrder"})

    def test_catalog_values_are_parsed_and_missing_values_fail(self):
        repo = self.fake_repo()
        path = repo / CATALOG_SOURCES[2]
        original = path.read_text(encoding="utf-8")
        path.write_text(original.replace("#3F6212", "#112233"), encoding="utf-8")
        result = self.run_script("--source", "fixtures", repo=repo, pages=1)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.read_json("catalog.json")["multiReaderColor"], "#112233")
        for relative, old, new in (
            (CATALOG_SOURCES[0], "nameArShort: 'خلف العاشر',", ""),
            (CATALOG_SOURCES[1], "readerId: 'Q01',", ""),
            (CATALOG_SOURCES[2], "export const QIRAAT_MULTI_READER_COLOR = '#112233'", ""),
            (CATALOG_SOURCES[3], "const UNRESOLVED_MARKER_COLOR = '#8a8a8a'", ""),
        ):
            with self.subTest(source=relative):
                path = repo / relative
                content = path.read_text(encoding="utf-8")
                path.write_text(content.replace(old, new), encoding="utf-8")
                out = self.root / ("missing-" + path.stem)
                result = self.run_script("--source", "fixtures", repo=repo, out=out, pages=1)
                self.assertEqual(result.returncode, 1, result.stderr)
                self.assertFalse((out / "catalog.json").exists())
                self.assert_no_parts(out)
                path.write_text(content, encoding="utf-8")

    def test_cookies_never_reach_output_files_or_logs(self):
        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual({p.name for p in self.out.iterdir()}, {
            "page-001.json", "page-002.json", "catalog.json"})
        for p in self.out.iterdir():
            self.assertNotIn("private-cookie-value", p.read_text(encoding="utf-8"))
            self.assertNotIn("test-session", p.read_text(encoding="utf-8"))
        self.assertNotIn("private-cookie-value", result.stdout + result.stderr)

    def test_catalog_rejects_null_or_nonliteral_names(self):
        repo = self.fake_repo()
        path = repo / CATALOG_SOURCES[0]
        original = path.read_text(encoding="utf-8")
        for value in ("null", "DISPLAY_NAME"):
            with self.subTest(value=value):
                path.write_text(original.replace("nameArShort: 'خلف العاشر'",
                                                 "nameArShort: " + value), encoding="utf-8")
                out = self.root / value
                result = self.run_script("--source", "fixtures", repo=repo, out=out, pages=1)
                self.assertEqual(result.returncode, 1, result.stderr)
                self.assertFalse((out / "catalog.json").exists())

    def test_environment_base_is_used(self):
        result = self.run_script(pages=1, env_base=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.read_json("catalog.json")["sourceUrl"], self.api.base)

    def test_validation_rejects_missing_fields_and_wrong_list_types(self):
        bad_pages = [[], None, {}, dict(page_data(1), pageNumber=True)]
        for key in ("variants", "rulings", "rules"):
            bad = page_data(1)
            bad[key] = {}
            bad_pages.append(bad)
        required = {
            "variants": ("id", "surah", "ayah", "startToken", "endToken", "readingIds"),
            "rulings": ("id", "category", "categoryAr", "color", "wordAnchored", "surah",
                        "ayah", "startToken", "endToken", "readings", "attribution"),
        }
        for key, fields in required.items():
            bad = page_data(1)
            bad[key] = [None]
            bad_pages.append(bad)
            for field in fields:
                bad = page_data(1)
                del bad[key][0][field]
                bad_pages.append(bad)
            for field in ("readingIds",) if key == "variants" else ("readings", "attribution"):
                bad = page_data(1)
                bad[key][0][field] = {}
                bad_pages.append(bad)
        for index, bad in enumerate(bad_pages):
            with self.subTest(case=index):
                self.api.payloads[1] = bad
                out = self.root / str(index)
                result = self.run_script(pages=1, out=out)
                self.assertEqual(result.returncode, 1, result.stderr)
                self.assertFalse((out / "page-001.json").exists())
                self.assertFalse((out / "catalog.json").exists())
                self.assert_no_parts(out)

    def test_5xx_retries_three_attempts_with_backoff(self):
        self.api.statuses[1] = [503, 502, 200]
        module = self.load_module()
        with mock.patch.object(module.time, "sleep") as sleep:
            status = module.main([str(REPO), str(self.out), "--base", self.api.base,
                                  "--page-count", "1"])
        self.assertEqual(status, 0)
        self.assertEqual(self.api.authenticated[1], 3)
        self.assertEqual(sleep.call_args_list, [mock.call(1), mock.call(2)])

    def test_network_disconnect_is_retried(self):
        self.api.drops[1] = 1
        module = self.load_module()
        with mock.patch.object(module.time, "sleep") as sleep:
            status = module.main([str(REPO), str(self.out), "--base", self.api.base,
                                  "--page-count", "1"])
        self.assertEqual(status, 0)
        self.assertEqual(self.api.authenticated[1], 2)
        sleep.assert_called_once_with(1)

    def test_exhausted_5xx_and_4xx_fail_without_excess_retries(self):
        self.api.statuses = {1: [503] * 4, 2: [404] * 4}
        module = self.load_module()
        stderr = io.StringIO()
        with mock.patch.object(module.time, "sleep"), contextlib.redirect_stderr(stderr):
            status = module.main([str(REPO), str(self.out), "--base", self.api.base,
                                  "--page-count", "2"])
        self.assertEqual(status, 1)
        self.assertEqual(self.api.authenticated, {1: 3, 2: 1})
        self.assertIn("Failed pages: 1, 2", stderr.getvalue())
        self.assertFalse((self.out / "catalog.json").exists())
        self.assert_no_parts()

    def test_at_most_five_redirects_including_the_cookie_redirect(self):
        for hops, expected in ((4, 0), (5, 1)):
            with self.subTest(hops=hops):
                self.api.redirect_hops = hops
                self.api.requests.clear()
                out = self.root / str(hops)
                result = self.run_script(pages=1, out=out)
                self.assertEqual(result.returncode, expected, result.stderr)
                self.assertEqual(self.api.requests[1], 6)
                self.assertEqual((out / "catalog.json").exists(), expected == 0)
                self.assertNotIn("private-cookie-value", result.stdout + result.stderr)
                self.assert_no_parts(out)

    def test_atomic_page_and_catalog_replace_failures_clean_up_parts(self):
        module = self.load_module()
        replace = os.replace
        for target in ("page-001.json", "catalog.json"):
            with self.subTest(target=target):
                out = self.root / target
                seen = []

                def fail_replace(src, dst):
                    self.assertTrue(str(src).endswith(".part"))
                    seen.append(Path(dst).name)
                    if Path(dst).name == target:
                        raise OSError("simulated replace failure")
                    replace(src, dst)

                with mock.patch.object(module.os, "replace", side_effect=fail_replace), \
                        contextlib.redirect_stderr(io.StringIO()):
                    status = module.main([str(REPO), str(out), "--base", self.api.base,
                                          "--page-count", "1"])
                self.assertEqual(status, 1)
                self.assertIn(target, seen)
                self.assertFalse((out / target).exists())
                self.assertFalse((out / "catalog.json").exists())
                self.assert_no_parts(out)

    def test_nonpositive_worker_or_page_count_is_rejected(self):
        for option in ("--workers", "--page-count"):
            for value in ("0", "-1"):
                with self.subTest(option=option, value=value):
                    result = self.run_script(option, value)
                    self.assertEqual(result.returncode, 2, result.stderr)
        self.assertEqual(self.api.requests, {})


if __name__ == "__main__":
    unittest.main()
