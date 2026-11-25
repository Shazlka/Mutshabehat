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
* The reader's header is always shown (only the footer hides), and a tap on the empty strip under the page shows or
  hides the footer (`ReaderChromeTap`): the strip was a plain spacer, so a hidden footer could not be brought back.
* `ReadingStatisticsScreen` hands over to `KhatmaStatsScreen` (`KhatmaStatsUi.kt`), the khatma statistics screen laid out
  and coloured like the iOS one (correct khatma percentage, tappable daily chart, compact surah rows).

The new Kotlin classes are compiled by Gradle (`assembleDebug`), merged by d8 into one extra dex (`classes12.dex`),
and the four patched shards (`classes3.dex`, `classes5.dex`, `classes6.dex`, `classes9.dex`) replace the originals. Every other entry of the APK is
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
READING = "com/shazlka/qiraat/reading"
SDK = Path(os.environ.get("ANDROID_HOME", "/opt/homebrew/share/android-commandlinetools"))
NEW_CLASSES = re.compile(
    r"^(NativeSignIn|CloudAuth|HttpReply|HttpTransport|UrlConnectionTransport|LiveSync|SyncEngine|SnapshotIO|"
    r"ComposableSingletons\$NativeSignIn)"
)
READER_CLASSES = re.compile(r"^ReaderChromeTap")
READING_CLASSES = re.compile(r"^(KhatmaStats|KhatmaTier|KhatmaHeat|KhatmaChart|KhatmaPlace|ComposableSingletons\$KhatmaStats)")


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
    # 1a. Make the quick Google button on CloudAccountScreen actually invoke AuthMode.GOOGLE instead of SIGN_IN.
    screen = smali / "CloudAccountScreenKt.smali"
    replace_once(
        screen,
        ".method private static final CloudAccountScreen$lambda$6$0$1$0$2$1$0("
        "Lcom/shazlka/qiraat/cloud/CloudAccount;Landroid/content/Context;)Lkotlin/Unit;\n"
        "    .locals 2\n"
        '    .param p0, "$cloudAccount"    # Lcom/shazlka/qiraat/cloud/CloudAccount;\n'
        '    .param p1, "$context"    # Landroid/content/Context;\n\n'
        "    .line 226\n"
        "    const/4 v0, 0x0\n\n"
        "    const/4 v1, 0x2\n\n"
        "    invoke-static {p0, p1, v0, v1, v0}, Lcom/shazlka/qiraat/cloud/CloudAccount;->openSignIn$default("
        "Lcom/shazlka/qiraat/cloud/CloudAccount;Landroid/content/Context;"
        "Lcom/shazlka/qiraat/cloud/CloudAccount$AuthMode;ILjava/lang/Object;)V\n",
        ".method private static final CloudAccountScreen$lambda$6$0$1$0$2$1$0("
        "Lcom/shazlka/qiraat/cloud/CloudAccount;Landroid/content/Context;)Lkotlin/Unit;\n"
        "    .locals 2\n"
        '    .param p0, "$cloudAccount"    # Lcom/shazlka/qiraat/cloud/CloudAccount;\n'
        '    .param p1, "$context"    # Landroid/content/Context;\n\n'
        "    .line 226\n"
        "    sget-object v0, Lcom/shazlka/qiraat/cloud/CloudAccount$AuthMode;->GOOGLE:Lcom/shazlka/qiraat/cloud/CloudAccount$AuthMode;\n\n"
        "    invoke-virtual {p0, p1, v0}, Lcom/shazlka/qiraat/cloud/CloudAccount;->openSignIn("
        "Landroid/content/Context;Lcom/shazlka/qiraat/cloud/CloudAccount$AuthMode;)V\n",
    )
    # 1c. Widen token and account HTTP timeouts from 15s (0x3a98) to 30s (0x7530) for Neon Compute cold starts.
    for suffix in ("tokenRequest$2.smali", "request$2.smali"):
        req_smali = smali / f"CloudAccount${suffix}"
        text = req_smali.read_text()
        if "0x3a98" not in text:
            raise ValueError(f"{req_smali.name}: expected 0x3a98 timeout literal")
        req_smali.write_text(text.replace("0x3a98", "0x7530"))
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


def patch_reader(shard):
    """Header always visible; a tap on the spacer under the page toggles the footer (the chrome state is `p5`)."""
    path = shard / "smali" / "com/shazlka/qiraat/reader" / "ReaderScreenKt.smali"
    replace_once(
        path,
        "    invoke-static/range {p5 .. p5}, Lcom/shazlka/qiraat/reader/ReaderScreenKt;->ReadyReader$lambda$44("
        "Landroidx/compose/runtime/MutableState;)Z\n\n    move-result v92\n",
        "    invoke-static/range {p5 .. p5}, Lcom/shazlka/qiraat/reader/ReaderScreenKt;->ReadyReader$lambda$44("
        "Landroidx/compose/runtime/MutableState;)Z\n\n    move-result v92\n\n    const/16 v92, 0x1\n",
    )
    replace_once(
        path,
        "    check-cast v14, Landroidx/compose/ui/Modifier;\n\n    const/16 v15, 0x4c\n",
        "    check-cast v14, Landroidx/compose/ui/Modifier;\n\n"
        "    move-object/from16 v15, p5\n\n"
        "    invoke-static {v14, v15}, Lcom/shazlka/qiraat/reader/ReaderChromeTap;->tapTarget("
        "Landroidx/compose/ui/Modifier;Landroidx/compose/runtime/MutableState;)Landroidx/compose/ui/Modifier;\n\n"
        "    move-result-object v14\n\n    const/16 v15, 0x4c\n",
    )


def patch_reading(shard):
    """The approved statistics screen hands over to the iOS-matched one (same parameters, so a plain forward)."""
    insert_after_annotations(
        shard / "smali" / READING / "ReadingUiKt.smali",
        ".method public static final ReadingStatisticsScreen(Lcom/shazlka/qiraat/reading/ReadingTracker;Ljava/util/List;"
        "Ljava/util/Map;ILkotlin/jvm/functions/Function1;Lkotlin/jvm/functions/Function0;"
        "Landroidx/compose/runtime/Composer;I)V",
        "    invoke-static/range {p0 .. p7}, Lcom/shazlka/qiraat/reading/KhatmaStatsUiKt;->KhatmaStatsScreen("
        "Lcom/shazlka/qiraat/reading/ReadingTracker;Ljava/util/List;Ljava/util/Map;ILkotlin/jvm/functions/Function1;"
        "Lkotlin/jvm/functions/Function0;Landroidx/compose/runtime/Composer;I)V\n\n    return-void\n\n",
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
    archive = APP / "build/intermediates/project_dex_archive/debug/dexBuilderDebug/out" / "com/shazlka/qiraat"
    files = sorted(p for p in (archive / "cloud").glob("*.dex") if NEW_CLASSES.match(p.name))
    files += sorted(p for p in (archive / "reading").glob("*.dex") if READING_CLASSES.match(p.name))
    files += sorted(p for p in (archive / "reader").glob("*.dex") if READER_CLASSES.match(p.name))
    if not files or not any(READING_CLASSES.match(p.name) for p in files):
        raise SystemExit("Run ./gradlew assembleDebug first: no compiled sign-in / statistics classes found")
    out = work / "newdex"
    out.mkdir()
    run(build_tools / "d8", "--release", "--min-api", "26", "--lib", android_jar, "--output", out, *files)
    return (out / "classes.dex").read_bytes()


def dex_classes(build_tools, dex):
    dump = subprocess.run([str(build_tools / "dexdump"), "-f", str(dex)], capture_output=True, text=True, errors="replace").stdout
    classes, methods, owner, name = set(), set(), None, None
    for line in dump.splitlines():
        text = line.strip()
        if text.startswith("Class descriptor"):
            classes.add(text.split("'")[1])
        elif text.startswith("#") and "(in L" in text:
            owner = text.split("(in ")[1].rstrip(")")
        elif text.startswith("name") and owner:
            name = text.split("'")[1]
        elif text.startswith("type") and owner and name:
            methods.add((owner, name, text.split("'")[1]))
            name = None
    return classes, methods


def check_packaged(work, patched_shards, new_dex, build_tools, base):
    """Every class the patches call must exist in the new dex, and everything the new dex calls in the approved app must
    exist there with the same signature: a missing one only fails on the device, as an Error."""
    classes, methods = dex_classes(build_tools, new_dex)
    packaged = {c[1:-1] for c in classes}
    called = set()
    for shard in patched_shards:
        for path in shard.rglob("*.smali"):
            called |= set(re.findall(
                r"invoke-static[^\n]*L(com/shazlka/qiraat/(?:cloud/(?:NativeSignIn|SyncEngine|LiveSync|SnapshotIO)|reading/KhatmaStatsUiKt|reader/ReaderChromeTap));",
                path.read_text(),
            ))
    missing = sorted(called - packaged)
    if missing:
        raise SystemExit(f"patched code calls classes that are not in the new dex: {missing}")

    base_classes, base_methods = set(), set()
    with zipfile.ZipFile(base) as archive:
        for entry in archive.namelist():
            if re.fullmatch(r"classes\d*\.dex", entry):
                target = work / f"base-{entry}"
                target.write_bytes(archive.read(entry))
                found_classes, found_methods = dex_classes(build_tools, target)
                base_classes |= found_classes
                base_methods |= found_methods
    own_classes, own_methods = classes, methods
    dump = subprocess.run([str(build_tools / "dexdump"), "-d", str(new_dex)], capture_output=True, text=True, errors="replace").stdout
    problems = set()
    for owner, name, proto in re.findall(r",\s*(L[^;\s]+;)\.([^:\s]+):(\([^)]*\)\S+)\s+//\s+method@", dump):
        if owner in own_classes or name in {"ordinal", "name", "hashCode", "equals", "toString", "compareTo", "getClass"}:
            continue
        if owner.startswith(("Lcom/shazlka/", "Landroidx/", "Lkotlin/", "Lkotlinx/")):
            if (owner, name, proto) not in base_methods and (owner, name, proto) not in own_methods:
                # Inherited and Object methods resolve through the class hierarchy; flag only a missing class or a member of ours.
                if owner not in base_classes or owner.startswith("Lcom/shazlka/"):
                    problems.add(f"{owner}.{name}{proto}")
    if problems:
        raise SystemExit("the new dex calls members the approved app does not have:\n  " + "\n  ".join(sorted(problems)))


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
        reading = decode_shard(args.base, 9, work, apktool)
        reader = decode_shard(args.base, 3, work, apktool)
        patch_cloud(cloud)
        patch_main(main_shard)
        patch_reading(reading)
        patch_reader(reader)
        replacements = {
            "classes5.dex": build_shard(main_shard, work, apktool),
            "classes6.dex": build_shard(cloud, work, apktool),
            "classes9.dex": build_shard(reading, work, apktool),
            "classes3.dex": build_shard(reader, work, apktool),
        }
        additions = {"classes12.dex": merge_new_classes(work, args.build_tools, args.android_jar)}
        (work / "classes12.dex").write_bytes(additions["classes12.dex"])
        check_packaged(work, [cloud, main_shard, reading, reader], work / "classes12.dex", args.build_tools, args.base)
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
