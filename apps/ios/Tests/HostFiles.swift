import Foundation
import XCTest

/// Some tests read the repository's own files (the generated Qiraat data, the string catalog, the Swift
/// sources) by path. Those paths exist where the tests were built, so these tests run on the Mac and in the
/// simulator, and are skipped on a physical device.
enum HostFiles {
    static func requireBuildMachineFiles(file: StaticString = #filePath) throws {
        try XCTSkipUnless(FileManager.default.fileExists(atPath: "\(file)"),
                          "reads repository files, which a physical device does not have")
    }
}
