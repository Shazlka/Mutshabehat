// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "MushafCore",
    platforms: [.iOS(.v18), .macOS(.v15)],
    products: [
        .library(name: "MushafCore", targets: ["MushafCore"]),
    ],
    targets: [
        .target(name: "MushafCore", linkerSettings: [.linkedLibrary("sqlite3")]),
        .testTarget(
            name: "MushafCoreTests",
            dependencies: ["MushafCore"],
            resources: [.copy("Fixtures")]
        ),
    ]
)
