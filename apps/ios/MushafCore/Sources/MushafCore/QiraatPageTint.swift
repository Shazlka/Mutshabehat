import Foundation

/// The soft wash the Mushaf page takes from the reader the learner chose: one colour per reader
/// (a narrator uses its reader's colour), none while «الكل» is chosen.
public enum QiraatPageTint {
    /// How much of the reader's colour is mixed into the paper. Just a light touch of colour: the paper stays light
    /// (dark in the dark themes) and the ink keeps reading at 7:1 for all ten readers.
    public static let washAmount = 0.05

    /// The reader's catalog colour for the chosen filter; nil for «الكل» or an id the catalog does not know.
    public static func readerColor(for filter: QiraatFilter, catalog: QiraatCatalog) -> QiraatColor? {
        let readerID: String?
        switch filter {
        case .all: readerID = nil
        case .reader(let id): readerID = id
        case .reading(let id): readerID = catalog.readerId(ofReading: id)
        }
        guard let readerID, let hex = catalog.reader(readerID)?.color else { return nil }
        return QiraatColor(hex: hex)
    }

    /// `paper` moved `amount` (0…1) of the way toward `tint`.
    public static func mixed(paper: QiraatColor, with tint: QiraatColor, amount: Double) -> QiraatColor {
        QiraatColor(red: paper.red + (tint.red - paper.red) * amount,
                    green: paper.green + (tint.green - paper.green) * amount,
                    blue: paper.blue + (tint.blue - paper.blue) * amount)
    }
}

extension QiraatColor {
    /// WCAG relative luminance (0 black … 1 white).
    public var luminance: Double {
        func linear(_ c: Double) -> Double { c <= 0.03928 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4) }
        return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue)
    }

    /// WCAG contrast ratio between two colours (1…21).
    public static func contrast(_ a: QiraatColor, _ b: QiraatColor) -> Double {
        let hi = max(a.luminance, b.luminance), lo = min(a.luminance, b.luminance)
        return (hi + 0.05) / (lo + 0.05)
    }
}
