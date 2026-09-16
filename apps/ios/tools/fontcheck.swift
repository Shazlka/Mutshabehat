// fontcheck.swift — does CoreText actually load a QCF Mushaf page font, and do
// the repo's fixture glyph codepoints resolve in it?
//
// Evidence for D-06 (docs/ios/DECISIONS.md). "The font downloaded with HTTP 200"
// is not the question; "CoreText registers it and U+FC41 draws a real glyph" is.
//
// CoreText is the same framework on macOS and iOS, so this runs today without
// Xcode. Re-run it in an iOS simulator once Xcode is installed (IOS-10) before
// trusting the WOFF2 row.
//
//   curl -o p110.ttf https://verses.quran.foundation/fonts/quran/hafs/v2/ttf/p110.ttf
//   swiftc -O fontcheck.swift -o fontcheck && ./fontcheck p110.ttf QCF2110 0xFC41
//
// Run one file per process: every format of a given page registers under the
// same PostScript name, so checking two in one process measures the first one twice.

import Foundation
import CoreText

guard CommandLine.arguments.count >= 3 else {
    FileHandle.standardError.write(Data("usage: fontcheck <font-file> <PostScriptName> [codepoint ...]\n".utf8))
    exit(2)
}

let path = CommandLine.arguments[1]
let psName = CommandLine.arguments[2]
let probes: [UniChar] = CommandLine.arguments.count > 3
    ? CommandLine.arguments[3...].compactMap { UniChar($0.replacingOccurrences(of: "0x", with: ""), radix: 16) }
    : [0xFC41, 0xFC42, 0xFC43]

let url = URL(fileURLWithPath: path)
let name = (path as NSString).lastPathComponent

var err: Unmanaged<CFError>?
guard CTFontManagerRegisterFontsForURL(url as CFURL, .process, &err) else {
    let detail = err.map { CFErrorCopyDescription($0.takeRetainedValue()) as String } ?? "unknown error"
    print("\(name): REGISTER FAILED — \(detail)")
    exit(1)
}

// Resolve by name from the registered set, the way an app would — not by
// building a CGFont straight from the bytes, which can succeed for a file the
// font manager would never hand back.
let font = CTFontCreateWithName(psName as CFString, 40, nil)
let resolved = CTFontCopyPostScriptName(font) as String
guard resolved == psName else {
    print("\(name): registered, but '\(psName)' resolved to '\(resolved)' — the font did not enter the registry")
    exit(1)
}

var chars = probes
var glyphs = [CGGlyph](repeating: 0, count: probes.count)
let allMapped = CTFontGetGlyphsForCharacters(font, &chars, &glyphs, probes.count)
var advances = [CGSize](repeating: .zero, count: probes.count)
_ = CTFontGetAdvancesForGlyphs(font, .horizontal, &glyphs, &advances, probes.count)

// A mapped-but-blank glyph renders as nothing, which looks like a layout bug
// rather than a font bug — so require a non-zero advance, not just a mapping.
let drawable = zip(glyphs, advances).filter { $0.0 != 0 && $0.1.width > 0 }.count

print("""
\(name)
  registered      yes
  postScriptName  \(resolved)
  glyphCount      \(CTFontGetGlyphCount(font))
  probes          \(probes.map { "U+" + String($0, radix: 16, uppercase: true) }.joined(separator: " "))
  allMapped       \(allMapped)
  drawable        \(drawable)/\(probes.count)
  advances        \(advances.map { Int($0.width) })
""")

exit(allMapped && drawable == probes.count ? 0 : 1)
