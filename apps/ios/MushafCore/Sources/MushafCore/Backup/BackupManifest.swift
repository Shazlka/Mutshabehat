import Foundation

public struct BackupFileEntry: Codable, Equatable, Sendable {
    public var name: String
    public var sha256: String
    public var size: Int
    public var rowCount: Int?

    public init(name: String, sha256: String, size: Int, rowCount: Int?) {
        self.name = name
        self.sha256 = sha256
        self.size = size
        self.rowCount = rowCount
    }
}

/// Describes one backup set: what it holds and the hash of every file, so a restore can verify first.
public struct BackupManifest: Codable, Equatable, Sendable {
    public static let currentFormatVersion = 1

    public var formatVersion: Int
    public var createdAt: Date
    public var deviceID: String
    public var appVersion: String
    public var files: [BackupFileEntry]

    public init(formatVersion: Int = BackupManifest.currentFormatVersion, createdAt: Date, deviceID: String,
                appVersion: String, files: [BackupFileEntry]) {
        self.formatVersion = formatVersion
        self.createdAt = createdAt
        self.deviceID = deviceID
        self.appVersion = appVersion
        self.files = files
    }
}
