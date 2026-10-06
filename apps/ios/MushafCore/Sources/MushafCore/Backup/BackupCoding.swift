import Foundation

/// JSON settings shared by every backup file: sorted keys (stable bytes for hashing) and ISO-8601 dates
/// with milliseconds ("2026-10-05T10:00:00.123Z"). Dates are normalised to whole milliseconds on the way
/// in and out (see `Date.normalizedToMilliseconds`), so they round-trip exactly.
public enum BackupCoding {
    private static let plain = Date.ISO8601FormatStyle()
    private static let fractional = Date.ISO8601FormatStyle(includingFractionalSeconds: true)

    public static func string(from date: Date) -> String {
        let milliseconds = date.epochMilliseconds
        let seconds = Int64((Double(milliseconds) / 1000).rounded(.down))
        let remainder = milliseconds - seconds * 1000
        let base = Date(timeIntervalSince1970: Double(seconds)).formatted(plain)   // "…T10:00:00Z"
        return String(base.dropLast()) + String(format: ".%03dZ", Int(remainder))
    }

    public static func date(from text: String) -> Date? {
        (try? fractional.parse(text))?.normalizedToMilliseconds
    }

    public static func encoder() -> JSONEncoder {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        encoder.dateEncodingStrategy = .custom { date, encoder in
            var container = encoder.singleValueContainer()
            try container.encode(BackupCoding.string(from: date))
        }
        return encoder
    }

    public static func decoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let text = try decoder.singleValueContainer().decode(String.self)
            guard let date = BackupCoding.date(from: text) else {
                throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "bad date \(text)"))
            }
            return date
        }
        return decoder
    }
}
