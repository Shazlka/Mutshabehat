// swift-tools-version: 6.0

import Foundation
import PackageDescription

// ── swift-testing macro plugin shim ──────────────────────────────────────────
// Swift 6.4 running from *Command Line Tools* (no Xcode) does not auto-locate
// swift-testing's macro plugin, and the manifest fails to compile without an
// explicit path. Xcode's toolchain finds it on its own.
//
// This has to be conditional, not hardcoded. Handing an Xcode compiler a macro
// plugin built for the CLT toolchain is worse than not shimming at all, and
// `.unsafeFlags` makes a package ineligible as a versioned dependency — so on a
// machine with Xcode these arrays must come out empty, leaving the manifest
// clean for the Phase 4 app target to depend on.
//
// Detect the *active* developer directory rather than guessing from what is
// installed: DEVELOPER_DIR wins if set, otherwise ask xcode-select.
private func activeDeveloperDirectory() -> String {
    if let override = ProcessInfo.processInfo.environment["DEVELOPER_DIR"], !override.isEmpty {
        return override
    }
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/xcode-select")
    process.arguments = ["-p"]
    let pipe = Pipe()
    process.standardOutput = pipe
    process.standardError = FileHandle.nullDevice
    guard (try? process.run()) != nil else { return "" }
    let data = pipe.fileHandleForReading.readDataToEndOfFile()
    process.waitUntilExit()
    return String(decoding: data, as: UTF8.self).trimmingCharacters(in: .whitespacesAndNewlines)
}

private let commandLineToolsRoot = "/Library/Developer/CommandLineTools"
private let testingMacroPlugin = "\(commandLineToolsRoot)/usr/lib/swift/host/plugins/testing/libTestingMacros.dylib"

private let needsCommandLineToolsTestingShim =
    activeDeveloperDirectory().hasPrefix(commandLineToolsRoot)
    && FileManager.default.fileExists(atPath: testingMacroPlugin)

private let testingShimSwiftSettings: [SwiftSetting] = needsCommandLineToolsTestingShim
    ? [.unsafeFlags(["-load-plugin-library", testingMacroPlugin], .when(platforms: [.macOS]))]
    : []

private let testingShimLinkerSettings: [LinkerSetting] = needsCommandLineToolsTestingShim
    ? [.unsafeFlags([
        "-Xlinker", "-rpath", "-Xlinker", "\(commandLineToolsRoot)/Library/Developer/Frameworks",
        "-Xlinker", "-rpath", "-Xlinker", "\(commandLineToolsRoot)/Library/Developer/usr/lib",
      ], .when(platforms: [.macOS]))]
    : []

let package = Package(
    name: "MutshabehatCore",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
    ],
    products: [
        .library(name: "MutshabehatDomain", targets: ["MutshabehatDomain"]),
        .library(name: "MutshabehatPersistence", targets: ["MutshabehatPersistence"]),
    ],
    dependencies: [],
    targets: [
        .target(
            name: "MutshabehatDomain"
        ),
        .target(
            name: "MutshabehatPersistence",
            dependencies: ["MutshabehatDomain"],
            linkerSettings: [
                .linkedLibrary("sqlite3"),
            ]
        ),
        .testTarget(
            name: "MutshabehatDomainTests",
            dependencies: ["MutshabehatDomain"],
            path: "Tests",
            exclude: ["MutshabehatPersistenceTests"],
            sources: ["MutshabehatDomainTests"],
            resources: [
                .copy("Fixtures/arabic-golden.json"),
            ],
            swiftSettings: testingShimSwiftSettings,
            linkerSettings: testingShimLinkerSettings
        ),
        .testTarget(
            name: "MutshabehatPersistenceTests",
            dependencies: ["MutshabehatDomain", "MutshabehatPersistence"],
            swiftSettings: testingShimSwiftSettings,
            linkerSettings: testingShimLinkerSettings
        ),
    ]
)
