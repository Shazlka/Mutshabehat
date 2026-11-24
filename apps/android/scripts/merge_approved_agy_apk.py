#!/usr/bin/env python3
"""Add Qiraat cloud sync to the approved AGY APK when its Kotlin sources are unavailable."""

import argparse
import hashlib
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET
import zipfile

APP = Path("com/shazlka/qiraat")
ANDROID = "{http://schemas.android.com/apk/res/android}"
DEX_SHARDS = (3, 5, 6, 7, 9)
AGY_SHA256 = "f047feb675af1ef64cc7068a49c5e31b994a6ea39397ce2e3e0dc71fac93f6fe"
BASE_SHA256 = "d81022749a635ea39220350b0091d6645c0b7b053112e4942f2c515fc621eecd"
VERSION_CODE = "3"
VERSION_NAME = "0.4.2-agy-cloud-sync"


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def run(*args):
    subprocess.run(args, check=True)


def decode_dex(apk, destination, apktool):
    reduced = destination.with_suffix(".apk")
    with zipfile.ZipFile(apk) as source, zipfile.ZipFile(reduced, "w") as output:
        output.writestr("AndroidManifest.xml", source.read("AndroidManifest.xml"))
        for position, number in enumerate(DEX_SHARDS, 1):
            target = "classes.dex" if position == 1 else f"classes{position}.dex"
            output.writestr(target, source.read(f"classes{number}.dex"))
    run(*apktool, "decode", "-r", "-b", "--only-main-classes", "-o", destination, reduced)
    return {
        number: destination / ("smali" if position == 1 else f"smali_classes{position}")
        for position, number in enumerate(DEX_SHARDS, 1)
    }


def normalized(path):
    if not path.exists():
        return None
    return re.sub(
        r"(?ms)^\.annotation build Ldalvik/annotation/SourceDebugExtension;\n.*?^\.end annotation\n",
        "",
        path.read_text(),
    )


def method(text, signature):
    matches = re.findall(r"(?ms)^\.method [^\n]*" + re.escape(signature) + r"\n.*?^\.end method$", text)
    if len(matches) != 1:
        raise ValueError(f"Expected one method with signature {signature}, found {len(matches)}")
    return matches[0]


def replace_once(text, old, new):
    if text.count(old) != 1:
        raise ValueError(f"Expected one occurrence of {old!r}")
    return text.replace(old, new, 1)


def merge_reader(base, agy, cloud):
    reader = APP / "reader"
    for path in sorted((base / reader).glob("ReaderViewModel*.smali")):
        relative = path.relative_to(base)
        before = normalized(path)
        patch = normalized(cloud / relative)
        if before == patch:
            continue
        if normalized(agy / relative) != before:
            raise ValueError(f"AGY also changed {relative}")
        shutil.copyfile(cloud / relative, agy / relative)

    settings = agy / APP / "settings" / "SettingsUiKt.smali"
    text = settings.read_text()
    anchor = '    const-string v0, "$this$LazyColumn"\n\n    move-object v1, p6'
    hook = (
        "    invoke-static {p6, p0}, Lcom/shazlka/qiraat/cloud/CloudAccountSettingsItemKt;"
        "->addCloudAccountSettingsItem(Landroidx/compose/foundation/lazy/LazyListScope;"
        "Lcom/shazlka/qiraat/reader/ReaderViewModel;)V\n\n"
    )
    settings.write_text(replace_once(text, anchor, hook + anchor))


def merge_reading(agy, cloud):
    reading = APP / "reading"
    companion = reading / "QuranReadingDatabase$Companion.smali"
    target = agy / companion
    signature = "setupTables(Landroid/database/sqlite/SQLiteDatabase;)V"
    setup = method(target.read_text(), signature)
    cloud_setup = method((cloud / companion).read_text(), signature)
    tables = []
    for table in ("reading_days_legacy", "reading_deletions"):
        match = re.search(
            r"(?m)^    const-string v0, [^\n]*CREATE TABLE IF NOT EXISTS "
            + table + r" [^\n]*\n\n    invoke-virtual \{p1, v0\}[^\n]+\n",
            cloud_setup,
        )
        if match is None:
            raise ValueError(f"Missing cloud table setup for {table}")
        tables.append(match[0])
    patched_setup = replace_once(setup, "    return-void", "\n".join(tables) + "\n    return-void")
    target.write_text(replace_once(target.read_text(), setup, patched_setup))

    database = reading / "QuranReadingDatabase.smali"
    source = (cloud / database).read_text()
    signatures = (
        "cloudSnapshot(Ljava/util/Map;)Ljava/util/Map;",
        "cloudSnapshot$default(Lcom/shazlka/qiraat/reading/QuranReadingDatabase;Ljava/util/Map;ILjava/lang/Object;)Ljava/util/Map;",
    )
    with (agy / database).open("a") as target:
        for signature in signatures:
            target.write("\n\n" + method(source, signature) + "\n")

    tracker = agy / reading / "ReadingTracker.smali"
    method(tracker.read_text(), "reload()V")
    with tracker.open("a") as target:
        target.write(
            "\n\n.method public final reloadFromDatabase()V\n"
            "    .locals 0\n\n"
            "    invoke-virtual {p0}, Lcom/shazlka/qiraat/reading/ReadingTracker;->reload()V\n\n"
            "    return-void\n.end method\n"
        )


def merge_manifest(project):
    manifest = project / "AndroidManifest.xml"
    parsed = ET.parse(manifest)
    root = parsed.getroot()
    ET.register_namespace("android", ANDROID[1:-1])
    permission = ET.Element("uses-permission", {ANDROID + "name": "android.permission.INTERNET"})
    root.insert(list(root).index(root.find("application")), permission)
    activity = next(
        item for item in root.findall("./application/activity")
        if item.get(ANDROID + "name") == "com.shazlka.qiraat.MainActivity"
    )
    activity.set(ANDROID + "launchMode", "singleTop")
    callback = ET.SubElement(activity, "intent-filter")
    ET.SubElement(callback, "action", {ANDROID + "name": "android.intent.action.VIEW"})
    for name in ("DEFAULT", "BROWSABLE"):
        ET.SubElement(callback, "category", {ANDROID + "name": "android.intent.category." + name})
    ET.SubElement(callback, "data", {
        ANDROID + "scheme": "com.shazlka.qiraat",
        ANDROID + "host": "cloud",
        ANDROID + "path": "/callback",
    })
    parsed.write(manifest, encoding="utf-8", xml_declaration=True)
    config = project / "apktool.yml"
    text = replace_once(config.read_text(), "versionCode: 1", f"versionCode: {VERSION_CODE}")
    config.write_text(replace_once(text, "versionName: 0.4.0-phase4", f"versionName: {VERSION_NAME}"))


def build(args, work):
    apktool = (args.java, "-jar", args.apktool)
    base = decode_dex(args.base, work / "base", apktool)
    agy = decode_dex(args.approved, work / "approved", apktool)
    cloud = decode_dex(args.cloud, work / "cloud", apktool)
    helper = cloud[6] / APP / "cloud" / "CloudAccountSettingsItemKt.smali"
    if not helper.is_file():
        raise ValueError("Build the cloud APK with CloudAccountSettingsItem.kt first")

    merge_reader(base[3], agy[3], cloud[3])
    merge_reading(agy[9], cloud[9])
    project = work / "package"
    run(*apktool, "decode", "--no-src", "--no-assets", "-p", work / "framework", "-o", project, args.approved)
    merge_manifest(project)
    for number in (3, 9):
        (project / f"classes{number}.dex").unlink()
        shutil.move(agy[number], project / f"smali_classes{number}")
    compiled = work / "compiled.apk"
    aapt = work / "aapt2"
    shutil.copy2(args.build_tools / "aapt2", aapt)
    run(*apktool, "build", "-p", work / "framework", "-a", aapt, "-o", compiled, project)

    unsigned = work / "unsigned.apk"
    with (
        zipfile.ZipFile(args.approved) as original,
        zipfile.ZipFile(args.cloud) as cloud_apk,
        zipfile.ZipFile(compiled) as compiled_apk,
        zipfile.ZipFile(unsigned, "w") as result,
    ):
        for entry in original.infolist():
            name = entry.filename
            if name in {"AndroidManifest.xml", "classes3.dex", "classes9.dex"}:
                contents = compiled_apk.read(name)
            elif name in {"classes5.dex", "classes6.dex", "classes7.dex"}:
                contents = cloud_apk.read(name)
            else:
                contents = original.read(entry)
            entry.extra = b""
            result.writestr(entry, contents)

    aligned = work / "aligned.apk"
    run(args.build_tools / "zipalign", "-P", "16", "-f", "4", unsigned, aligned)
    run(
        args.build_tools / "apksigner", "sign", "--ks", args.keystore,
        "--ks-key-alias", "androiddebugkey", "--ks-pass", "pass:android",
        "--key-pass", "pass:android", "--out", args.output, aligned,
    )
    run(args.build_tools / "apksigner", "verify", "--verbose", args.output)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("base", "approved", "cloud", "apktool", "java", "build-tools", "keystore", "output"):
        parser.add_argument(f"--{name}", type=Path, required=True)
    args = parser.parse_args()
    if sha256(args.base) != BASE_SHA256 or sha256(args.approved) != AGY_SHA256:
        parser.error("The APKs do not match the approved AGY input and its verified predecessor")
    with tempfile.TemporaryDirectory(prefix="qiraat-agy-merge-") as directory:
        build(args, Path(directory))


if __name__ == "__main__":
    main()
