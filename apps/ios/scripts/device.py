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


class Ambiguous(Exception):
    """More than one team or device fits; the person must name one (TEAM=… / DEVICE=…)."""

    def __init__(self, choices):
        super().__init__(", ".join(choices))
        self.choices = choices


def choose_team(prefs):
    """The one team Xcode has for the signed-in Apple ID. Several teams are never guessed between:
    signing with an employer's team instead of one's own (or the reverse) is not a safe default."""
    teams = []
    for key in ("IDEProvisioningTeamByIdentifier", "IDEProvisioningTeams"):
        for account_teams in (prefs.get(key) or {}).values():
            for t in account_teams:
                if isinstance(t, dict) and t.get("teamID") and t["teamID"] not in teams:
                    teams.append(t["teamID"])
    if len(teams) > 1:
        raise Ambiguous(teams)
    return teams[0] if teams else None


def choose_device(listing, wanted=None):
    """The paired physical iPhone from `devicectl list devices` JSON (any iOS device when `wanted`
    names it). A connected one wins over an asleep one; two equally good ones are never guessed between."""
    found = []
    for d in listing.get("result", {}).get("devices", []):
        hw, conn, props = d.get("hardwareProperties", {}), d.get("connectionProperties", {}), d.get("deviceProperties", {})
        if hw.get("reality") != "physical" or hw.get("platform") != "iOS" or conn.get("pairingState") != "paired":
            continue
        entry = {"udid": hw.get("udid"), "identifier": d.get("identifier"), "name": props.get("name", ""),
                 "connected": conn.get("tunnelState") == "connected"}
        if wanted:
            if wanted not in (entry["udid"], entry["identifier"], entry["name"]):
                continue
        elif hw.get("deviceType") != "iPhone":
            continue
        found.append(entry)
    connected = [e for e in found if e["connected"]]
    pool = connected or found
    if len(pool) > 1:
        raise Ambiguous([e["name"] for e in pool])
    return pool[0] if pool else None


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
    try:
        team = os.environ.get("TEAM") or choose_team(prefs)
    except Ambiguous as several:
        fail(f"Xcode has several signing teams ({several}). Run: make device TEAM=<one of them>")
    if not team:
        fail("Xcode has no Apple ID. Open Xcode → Settings → Accounts, add your Apple ID, then run make device again.")

    with tempfile.NamedTemporaryFile(suffix=".json") as out:
        subprocess.run(["xcrun", "devicectl", "list", "devices", "--json-output", out.name],
                       capture_output=True, check=True)
        listing = json.load(open(out.name))
    try:
        target = choose_device(listing, os.environ.get("DEVICE"))
    except Ambiguous as several:
        fail(f"Several devices are paired ({several}). Run: make device DEVICE=\"<name>\"")
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
