"""Build, install and launch Qiraat on a connected iPhone (make device). Python stdlib only.

Needs, once, from the person (never done by an agent): an Apple ID in Xcode → Settings → Accounts,
the iPhone connected and trusted, and Settings → Privacy & Security → Developer Mode on.
Picks the signing team Xcode knows (TEAM=… overrides) and the paired iPhone (DEVICE=name|udid
overrides), writes the gitignored Signing.xcconfig, then builds with automatic signing.
"""
import json
import os
import plistlib
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.dirname(HERE)
BUNDLE_ID = "com.shazlka.qiraat"
DERIVED = os.path.join(APP_DIR, "DerivedData")
APP = os.path.join(DERIVED, "Build/Products/Debug-iphoneos/Mutshabehat.app")


def choose_team(prefs):
    """The team Xcode has for the signed-in account; a paid team over a free personal one."""
    teams = []
    for key in ("IDEProvisioningTeamByIdentifier", "IDEProvisioningTeams"):
        for account_teams in (prefs.get(key) or {}).values():
            teams += [t for t in account_teams if isinstance(t, dict) and t.get("teamID")]
    if not teams:
        return None
    teams.sort(key=lambda t: bool(t.get("isFreeProvisioningTeam")))
    return teams[0]["teamID"]


def choose_device(listing, wanted=None):
    """A physical, paired iOS device from `devicectl list devices` JSON; connected ones first."""
    found = []
    for d in listing.get("result", {}).get("devices", []):
        hw, conn, props = d.get("hardwareProperties", {}), d.get("connectionProperties", {}), d.get("deviceProperties", {})
        if hw.get("reality") != "physical" or hw.get("platform") != "iOS" or conn.get("pairingState") != "paired":
            continue
        entry = {"udid": hw.get("udid"), "identifier": d.get("identifier"), "name": props.get("name", ""),
                 "connected": conn.get("tunnelState") == "connected"}
        if wanted and wanted not in (entry["udid"], entry["identifier"], entry["name"]):
            continue
        found.append(entry)
    found.sort(key=lambda e: not e["connected"])
    return found[0] if found else None


def write_signing(path, team):
    """Writes Signing.xcconfig; True when its content changed."""
    content = f"// Written by scripts/device.py — local only, never committed.\nDEVELOPMENT_TEAM = {team}\n"
    try:
        with open(path, encoding="utf-8") as f:
            if f.read() == content:
                return False
    except FileNotFoundError:
        pass
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return True


def fail(message):
    print("error: " + message, file=sys.stderr)
    sys.exit(1)


def run(*args):
    print("+ " + " ".join(args), flush=True)
    subprocess.run(args, check=True)


def main():
    prefs = plistlib.loads(subprocess.run(["defaults", "export", "com.apple.dt.Xcode", "-"],
                                          capture_output=True, check=True).stdout)
    team = os.environ.get("TEAM") or choose_team(prefs)
    if not team:
        fail("Xcode has no Apple ID. Open Xcode → Settings → Accounts, add your Apple ID, then run make device again.")

    with tempfile.NamedTemporaryFile(suffix=".json") as out:
        subprocess.run(["xcrun", "devicectl", "list", "devices", "--json-output", out.name],
                       capture_output=True, check=True)
        listing = json.load(open(out.name))
    target = choose_device(listing, os.environ.get("DEVICE"))
    if not target:
        fail("No paired iPhone found. Connect it with a cable, unlock it, tap Trust, and turn on "
             "Settings → Privacy & Security → Developer Mode; then run make device again.")

    write_signing(os.path.join(APP_DIR, "Signing.xcconfig"), team)
    print(f"Signing team {team}; device {target['name']} ({target['udid']})")
    run("xcodegen", "generate", "--quiet", "--spec", os.path.join(APP_DIR, "project.yml"))
    run("xcodebuild", "-project", os.path.join(APP_DIR, "Mutshabehat.xcodeproj"), "-scheme", "Mutshabehat",
        "-configuration", "Debug", "-derivedDataPath", DERIVED, "-destination", f"id={target['udid']}",
        "-allowProvisioningUpdates", "build")
    run("xcrun", "devicectl", "device", "install", "app", "--device", target["identifier"], APP)
    run("xcrun", "devicectl", "device", "process", "launch", "--device", target["identifier"], BUNDLE_ID)


if __name__ == "__main__":
    main()
