// swift-tools-version: 6.2
import PackageDescription

// The developer review editor. Every source file is wrapped in `#if DEBUG`, so a Release build compiles this module
// to nothing. It knows MushafCore and the small `ReviewHost` the app hands it, never the app itself.
let package = Package(
    name: "ReviewEditor",
    platforms: [.iOS(.v26)],
    products: [
        .library(name: "ReviewEditor", type: .static, targets: ["ReviewEditor"]),
    ],
    dependencies: [
        .package(path: "../MushafCore"),
    ],
    targets: [
        .target(name: "ReviewEditor", dependencies: [.product(name: "MushafCore", package: "MushafCore")]),
    ]
)
