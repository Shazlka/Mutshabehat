// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "MushafCore",
    platforms: [.iOS(.v26), .macOS(.v15)],
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
