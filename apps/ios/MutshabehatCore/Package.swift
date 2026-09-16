// swift-tools-version: 6.0

import PackageDescription

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
            swiftSettings: [
                .unsafeFlags([
                    "-load-plugin-library",
                    "/Library/Developer/CommandLineTools/usr/lib/swift/host/plugins/testing/libTestingMacros.dylib",
                ], .when(platforms: [.macOS])),
            ],
            linkerSettings: [
                .unsafeFlags([
                    "-Xlinker", "-rpath",
                    "-Xlinker", "/Library/Developer/CommandLineTools/Library/Developer/Frameworks",
                    "-Xlinker", "-rpath",
                    "-Xlinker", "/Library/Developer/CommandLineTools/Library/Developer/usr/lib",
                ], .when(platforms: [.macOS])),
            ]
        ),
        .testTarget(
            name: "MutshabehatPersistenceTests",
            dependencies: ["MutshabehatDomain", "MutshabehatPersistence"],
            swiftSettings: [
                .unsafeFlags([
                    "-load-plugin-library",
                    "/Library/Developer/CommandLineTools/usr/lib/swift/host/plugins/testing/libTestingMacros.dylib",
                ], .when(platforms: [.macOS])),
            ],
            linkerSettings: [
                .unsafeFlags([
                    "-Xlinker", "-rpath",
                    "-Xlinker", "/Library/Developer/CommandLineTools/Library/Developer/Frameworks",
                    "-Xlinker", "-rpath",
                    "-Xlinker", "/Library/Developer/CommandLineTools/Library/Developer/usr/lib",
                ], .when(platforms: [.macOS])),
            ]
        ),
    ]
)
