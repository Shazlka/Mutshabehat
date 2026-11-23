#!/usr/bin/env python3
"""Run simulator tests against the existing snapshot, with cloud/network access disabled.

No data/font generators are run. Both the unit-test host and apps launched by UI tests
receive the DEBUG isolation flag; setting only the scheme test environment covers the
UI test runner, not its target application.
"""

import argparse
from pathlib import Path
import plistlib
import subprocess


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--destination", required=True)
    parser.add_argument("--result-bundle", required=True)
    parser.add_argument("--skip-build", action="store_true")
    parser.add_argument("test_arguments", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    project = Path(__file__).resolve().parents[1]
    derived = project / "DerivedData"
    if not args.skip_build:
        subprocess.run(["xcodegen", "generate", "--quiet"], cwd=project, check=True)
        subprocess.run([
            "xcodebuild", "-project", "Mutshabehat.xcodeproj", "-scheme", "Mutshabehat",
            "-derivedDataPath", str(derived), "-destination", args.destination,
            "SWIFT_EMIT_LOC_STRINGS=NO", "build-for-testing",
        ], cwd=project, check=True)

    products = derived / "Build/Products"
    source = max(products.glob("Mutshabehat_iphonesimulator*.xctestrun"), key=lambda path: path.stat().st_mtime)
    configuration = plistlib.loads(source.read_bytes())
    if "TestConfigurations" in configuration:
        targets = [target for config in configuration["TestConfigurations"]
                   for target in config["TestTargets"]]
    else:
        targets = [value for key, value in configuration.items() if not key.startswith("__")]
    for target in targets:
        target.setdefault("EnvironmentVariables", {})["QIRAAT_TEST_ISOLATION"] = "1"
        if target.get("IsUITestBundle"):
            target.setdefault("UITargetAppEnvironmentVariables", {})["QIRAAT_TEST_ISOLATION"] = "1"
    isolated = products / "Mutshabehat-isolated.xctestrun"
    isolated.write_bytes(plistlib.dumps(configuration))
    arguments = args.test_arguments
    if arguments[:1] == ["--"]:
        arguments = arguments[1:]
    result = subprocess.run([
        "xcodebuild", "test-without-building", "-xctestrun", str(isolated),
        "-destination", args.destination, "-parallel-testing-enabled", "NO",
        "-collect-test-diagnostics", "never", "-resultBundlePath", args.result_bundle,
        *arguments,
    ], cwd=project)
    raise SystemExit(result.returncode)


if __name__ == "__main__":
    main()
