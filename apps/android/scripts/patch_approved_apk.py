#!/usr/bin/env python3
"""Put the in-app sign-in and the live sync engine into the approved Qiraat Cloud Sync APK (v4).

The approved APK has no sources, so this patches its compiled code and changes nothing else:

* `CloudAccount.openSignIn` calls `NativeSignIn.start` where it opened a Custom Tab. Email sign-in and sign-up
  happen in an in-app dialog; Google still opens the browser.
* `CloudAccount.sync` hands over to `SyncEngine.sync`, which replaces the approved sync (it ordered
  `reading_deletions` by a column that does not exist, wrote an empty baseline hash and flagged first syncs as
  conflicts, and its `SELECT *` exchange failed on the older database layouts). The account screen, conflict dialog and status text are untouched.
* `MainActivity` runs `LiveSync.loop` where it synced once per resume, so the app syncs every 5 seconds while open.
* `ProgressDataset` reads and writes the tables by column name (`SnapshotIO`), so the iPhone's older `reading_days`
  column order and Android's older `reading_deletions` table no longer break or corrupt the exchange.

The new Kotlin classes are compiled by Gradle (`assembleDebug`), merged by d8 into one extra dex (`classes12.dex`),
and the two patched shards (`classes5.dex`, `classes6.dex`) replace the originals. Every other entry of the APK is
copied byte for byte. The result is zip-aligned and signed with the given keystore.

Usage:
  ./gradlew assembleDebug
  python3 scripts/patch_approved_apk.py --base ~/Downloads/Qiraat-Cloud-Sync-v4.apk --apktool apktool.jar \
      --output dist/Qiraat-Cloud-Sync-v6.apk
"""

import argparse
import os
import re
import subprocess
import tempfile
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
APP = HERE.parent / "app"
CLOUD = "com/shazlka/qiraat/cloud"
SDK = Path(os.environ.get("ANDROID_HOME", "/opt/homebrew/share/android-commandlinetools"))
NEW_CLASSES = re.compile(
    r"^(NativeSignIn|CloudAuth|HttpReply|HttpTransport|UrlConnectionTransport|LiveSync|SyncEngine|SnapshotIO|"
    r"ComposableSingletons\$NativeSignIn)"
)


def run(*args, **kwargs):
    subprocess.run([str(a) for a in args], check=True, **kwargs)


def replace_once(path, old, new):
    text = path.read_text()
    if text.count(old) != 1:
        raise ValueError(f"{path.name}: expected exactly one occurrence of {old[:70]!r}, found {text.count(old)}")
    path.write_text(text.replace(old, new))


def decode_shard(base, number, work, apktool):
    reduced = work / f"shard{number}.apk"
    with zipfile.ZipFile(base) as source, zipfile.ZipFile(reduced, "w") as out:
        out.writestr("AndroidManifest.xml", source.read("AndroidManifest.xml"))
        out.writestr("classes.dex", source.read(f"classes{number}.dex"))
    target = work / f"shard{number}"
    run(*apktool, "d", "-r", "-o", target, reduced, stdout=subprocess.DEVNULL)
    return target


def build_shard(project, work, apktool):
    built = work / (project.name + "-built.apk")
    run(*apktool, "b", project, "-o", built, stdout=subprocess.DEVNULL)
    with zipfile.ZipFile(built) as archive:
        return archive.read("classes.dex")


def patch_cloud(shard):
    smali = shard / "smali" / CLOUD
    account = smali / "CloudAccount.smali"
    # 1. Sign in natively instead of opening the browser (Google falls through to the browser).
    replace_once(
        account,
        "    invoke-virtual {p1, v6}, Landroid/content/Context;->startActivity(Landroid/content/Intent;)V\n",
        "    invoke-static {p0, p1, p2, v5}, Lcom/shazlka/qiraat/cloud/NativeSignIn;->start("
        "Ljava/lang/Object;Landroid/content/Context;Ljava/lang/Enum;Landroid/net/Uri;)Z\n\n"
        "    move-result v7\n\n    if-nez v7, :cond_native_sign_in\n\n"
        "    invoke-virtual {p1, v6}, Landroid/content/Context;->startActivity(Landroid/content/Intent;)V\n\n"
        "    :cond_native_sign_in\n",
    )
    # 1b. The tokens carry no email or name, so give finishSignIn what the person typed to store and show.
    replace_once(
        account,
        '    .line 290\n    .local v1, "identity":Lorg/json/JSONObject;\n',
        '    .line 290\n    .local v1, "identity":Lorg/json/JSONObject;\n'
        "    invoke-static {v1}, Lcom/shazlka/qiraat/cloud/NativeSignIn;->enrich(Lorg/json/JSONObject;)V\n\n",
    )
    # 2. Hand the sync over to the engine.
    replace_once(
        account,
        '            "Ljava/lang/Object;"\n        }\n    .end annotation\n\n    move-object/from16 v1, p0\n\n'
        "    move-object/from16 v2, p5\n\n    instance-of v0, v2, Lcom/shazlka/qiraat/cloud/CloudAccount$sync$1;",
        '            "Ljava/lang/Object;"\n        }\n    .end annotation\n\n'
        "    invoke-static/range {p0 .. p5}, Lcom/shazlka/qiraat/cloud/SyncEngine;->sync("
        "Ljava/lang/Object;Ljava/lang/Object;Ljava/lang/Object;Ljava/lang/Object;ZLkotlin/coroutines/Continuation;)"
        "Ljava/lang/Object;\n\n    move-result-object v0\n\n    return-object v0\n\n"
        "    move-object/from16 v1, p0\n\n    move-object/from16 v2, p5\n\n"
        "    instance-of v0, v2, Lcom/shazlka/qiraat/cloud/CloudAccount$sync$1;",
    )
    # 3. Read and write the tables by column name (SnapshotIO): the approved code used SELECT * / INSERT ... VALUES, which
    #    depends on each install's column order and cannot cope with Android's older reading_deletions table.
    dataset = smali / "ProgressDataset.smali"
    insert_after_annotations(
        dataset,
        ".method public final capture(Landroid/database/sqlite/SQLiteDatabase;)Ljava/util/Map;",
        "    invoke-static {p0, p1}, Lcom/shazlka/qiraat/cloud/SnapshotIO;->capture("
        "Lcom/shazlka/qiraat/cloud/ProgressDataset;Landroid/database/sqlite/SQLiteDatabase;)Ljava/util/Map;\n\n"
        "    move-result-object v0\n\n    return-object v0\n\n",
    )
    insert_after_annotations(
        dataset,
        ".method public final replace(Landroid/database/sqlite/SQLiteDatabase;Ljava/util/Map;)V",
        "    invoke-static {p0, p1, p2}, Lcom/shazlka/qiraat/cloud/SnapshotIO;->replace("
        "Lcom/shazlka/qiraat/cloud/ProgressDataset;Landroid/database/sqlite/SQLiteDatabase;Ljava/util/Map;)V\n\n"
        "    return-void\n\n",
    )


def insert_after_annotations(path, header, code):
    """Put `code` at the start of the method's body, right after its last .annotation block."""
    text = path.read_text()
    start = text.index(header)
    end = text.index(".end method", start)
    body = text[start:end]
    marker = body.rindex("    .end annotation\n") + len("    .end annotation\n")
    path.write_text(text[: start + marker] + "\n" + code + text[start + marker + 1 :])


def patch_main(shard):
    path = shard / "smali" / "com/shazlka/qiraat" / "MainActivity$onCreate$1$1$1$1.smali"
    replace_once(
        path,
        "    invoke-static/range {v3 .. v10}, Lcom/shazlka/qiraat/cloud/CloudAccount;->sync$default("
        "Lcom/shazlka/qiraat/cloud/CloudAccount;Lcom/shazlka/qiraat/reader/ReaderViewModel;"
        "Lcom/shazlka/qiraat/cloud/ProgressDataset;Lcom/shazlka/qiraat/cloud/CloudAccount$Resolution;Z"
        "Lkotlin/coroutines/Continuation;ILjava/lang/Object;)Ljava/lang/Object;\n",
        "    invoke-static {v3, v4, v8}, Lcom/shazlka/qiraat/cloud/LiveSync;->loop("
        "Ljava/lang/Object;Ljava/lang/Object;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;\n",
    )


def merge_new_classes(work, build_tools, android_jar):
    archive = APP / "build/intermediates/project_dex_archive/debug/dexBuilderDebug/out" / CLOUD
    files = sorted(p for p in archive.glob("*.dex") if NEW_CLASSES.match(p.name))
    if not files:
        raise SystemExit("Run ./gradlew assembleDebug first: no compiled sign-in classes found")
    out = work / "newdex"
    out.mkdir()
    run(build_tools / "d8", "--release", "--min-api", "26", "--lib", android_jar, "--output", out, *files)
    return (out / "classes.dex").read_bytes()


def check_packaged(work, patched_shards, new_dex, build_tools):
    """Every class the patches call must exist in the new dex: a missing one only fails on the device, as an Error."""
    dump = subprocess.run([str(build_tools / "dexdump"), "-f", str(new_dex)], capture_output=True, text=True,
                          errors="replace").stdout
    packaged = set(re.findall(r"Class descriptor\s+: 'L(com/shazlka/qiraat/cloud/[^;']+);'", dump))
    called = set()
    for shard in patched_shards:
        for path in shard.rglob("*.smali"):
            called |= set(re.findall(r"invoke-static[^\n]*L(com/shazlka/qiraat/cloud/(?:NativeSignIn|SyncEngine|LiveSync|SnapshotIO));", path.read_text()))
    missing = sorted(called - packaged)
    if missing:
        raise SystemExit(f"patched code calls classes that are not in the new dex: {missing}")


def assemble(base, replacements, additions, destination):
    with zipfile.ZipFile(base) as source, zipfile.ZipFile(destination, "w") as out:
        for entry in source.infolist():
            if entry.filename.startswith("META-INF/") and entry.filename.endswith((".SF", ".RSA", ".DSA", ".EC", "MANIFEST.MF")):
                continue
            entry.extra = b""
            out.writestr(entry, replacements.get(entry.filename, source.read(entry)))
        for name, data in additions.items():
            out.writestr(zipfile.ZipInfo(name), data, compress_type=zipfile.ZIP_DEFLATED)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--base", type=Path, required=True, help="the approved Qiraat Cloud Sync APK")
    parser.add_argument("--apktool", type=Path, required=True, help="apktool jar")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--java", type=Path, default=Path("java"))
    parser.add_argument("--build-tools", type=Path, default=next(iter(sorted((SDK / "build-tools").glob("*"))[-1:]), None))
    parser.add_argument("--android-jar", type=Path, default=SDK / "platforms/android-35/android.jar")
    parser.add_argument("--keystore", type=Path, default=Path.home() / ".android/debug.keystore")
    args = parser.parse_args()
    apktool = (args.java, "-jar", args.apktool)

    with tempfile.TemporaryDirectory(prefix="qiraat-v4-patch-") as directory:
        work = Path(directory)
        with zipfile.ZipFile(args.base) as source:
            if "classes12.dex" in source.namelist():
                raise SystemExit("classes12.dex already exists in the base APK")
        cloud = decode_shard(args.base, 6, work, apktool)
        main_shard = decode_shard(args.base, 5, work, apktool)
        patch_cloud(cloud)
        patch_main(main_shard)
        replacements = {
            "classes5.dex": build_shard(main_shard, work, apktool),
            "classes6.dex": build_shard(cloud, work, apktool),
        }
        additions = {"classes12.dex": merge_new_classes(work, args.build_tools, args.android_jar)}
        (work / "classes12.dex").write_bytes(additions["classes12.dex"])
        check_packaged(work, [cloud, main_shard], work / "classes12.dex", args.build_tools)
        unsigned, aligned = work / "unsigned.apk", work / "aligned.apk"
        assemble(args.base, replacements, additions, unsigned)
        run(args.build_tools / "zipalign", "-P", "16", "-f", "4", unsigned, aligned)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        if args.output.exists():
            args.output.unlink()
        run(args.build_tools / "apksigner", "sign", "--ks", args.keystore, "--ks-key-alias", "androiddebugkey",
            "--ks-pass", "pass:android", "--key-pass", "pass:android", "--out", args.output, aligned)
        run(args.build_tools / "apksigner", "verify", args.output)
    print(f"wrote {args.output}")


if __name__ == "__main__":
    main()
