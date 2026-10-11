import Foundation
import MushafCore
import SwiftUI

/// What the reader can say about a page's Qiraat data: when the web app last confirmed it.
/// Pure, so the mapping from `QiraatLiveSync.Outcome` is unit-tested without a network or a view.
struct QiraatSyncStatus: Equatable {
    enum Kind: Equatable {
        /// Confirmed against the web app less than a minute ago: «محدّث الآن».
        case current
        /// Last confirmed `elapsed` seconds ago: «محدّث قبل N دقيقة».
        case confirmed(elapsed: TimeInterval)
        /// Never confirmed on this device: the bundled snapshot, «نسخة محلية».
        case localCopy
    }

    let kind: Kind
    let isOffline: Bool

    /// Confirmations this recent still read as «الآن».
    static let currentWindow: TimeInterval = 60

    /// The status of a page after its latest check.
    ///
    /// - `updated` and `unchanged` mean the web app answered, so the page is confirmed at `lastSuccess`
    ///   (or now, when the caller does not know the time).
    /// - `failed`, `skipped` and no check yet keep the last confirmed time. A page never confirmed on
    ///   this device is the bundled copy.
    static func make(outcome: QiraatLiveSync.Outcome?, lastSuccess: Date?, now: Date, isOffline: Bool) -> QiraatSyncStatus {
        let confirmedAt: Date?
        switch outcome {
        case .updated, .unchanged: confirmedAt = lastSuccess ?? now
        case .failed, .skipped, nil: confirmedAt = lastSuccess
        }
        guard let confirmedAt else { return QiraatSyncStatus(kind: .localCopy, isOffline: isOffline) }
        let elapsed = max(0, now.timeIntervalSince(confirmedAt))
        let kind: Kind = elapsed < currentWindow ? .current : .confirmed(elapsed: elapsed)
        return QiraatSyncStatus(kind: kind, isOffline: isOffline)
    }

    /// The visible label, always in Arabic.
    var title: String {
        switch kind {
        case .current: "محدّث الآن"
        case .confirmed(let elapsed): "محدّث \(Self.agoText(elapsed))"
        case .localCopy: "نسخة محلية"
        }
    }

    var symbolName: String {
        if isOffline { return "wifi.slash" }
        switch kind {
        case .current: return "checkmark.circle"
        case .confirmed: return "clock"
        case .localCopy: return "internaldrive"
        }
    }

    /// Colour is never the only cue: the symbol and the words carry the state too.
    var tint: Color {
        switch kind {
        case .current: .progress
        case .confirmed: .info
        case .localCopy: .caution
        }
    }

    /// «قبل دقيقة», «قبل 5 دقائق», «قبل ساعتين», «قبل 3 أيام» (minutes, hours, days; Arabic plurals).
    static func agoText(_ elapsed: TimeInterval) -> String {
        let minutes = Int(elapsed / 60)
        if minutes < 60 {
            return "قبل " + arabicCount(minutes, one: "دقيقة", two: "دقيقتين", few: "دقائق", many: "دقيقة")
        }
        let hours = minutes / 60
        if hours < 24 {
            return "قبل " + arabicCount(hours, one: "ساعة", two: "ساعتين", few: "ساعات", many: "ساعة")
        }
        return "قبل " + arabicCount(hours / 24, one: "يوم", two: "يومين", few: "أيام", many: "يومًا")
    }

    private static func arabicCount(_ n: Int, one: String, two: String, few: String, many: String) -> String {
        switch n {
        case 1: one
        case 2: two
        case 3...10: "\(ArabicDigits.string(n)) \(few)"
        default: "\(ArabicDigits.string(n)) \(many)"
        }
    }
}

/// The small chip that tells the reader how fresh the Qiraat data on the page is.
struct QiraatSyncStatusView: View {
    let status: QiraatSyncStatus

    var body: some View {
        Label {
            Text(verbatim: status.title)
        } icon: {
            Image(systemName: status.symbolName)
        }
        .font(.caption.bold())
        .foregroundStyle(status.tint)
        .padding(.horizontal, 9)
        .padding(.vertical, 4)
        .background(Capsule().fill(status.tint.opacity(0.12)))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(status.title)
        .accessibilityValue(status.isOffline ? "بلا اتصال" : "")
        .accessibilityIdentifier("qiraat-sync-status")
    }
}

/// The text a reader shares when a Qiraat entry looks wrong. It carries only facts the app already
/// holds (page, position, word, the ids of the shown entries); nothing is sent over the network.
struct QiraatErrorReport: Equatable {
    let page: Int
    let ayah: AyahKey
    let token: Int
    let word: String
    let variantIDs: [String]
    let rulingIDs: [String]

    init(page: Int, ayah: AyahKey, token: Int, word: String, variantIDs: [String], rulingIDs: [String]) {
        self.page = page
        self.ayah = ayah
        self.token = token
        self.word = word
        self.variantIDs = variantIDs
        self.rulingIDs = rulingIDs
    }

    init(item: QiraatWordSelection) {
        self.init(page: item.word.page, ayah: item.word.ayahKey, token: item.word.indexInAyah,
                  word: item.word.textUthmani, variantIDs: item.selection.variants.map(\.id),
                  rulingIDs: item.selection.rulings.map(\.id))
    }

    var text: String {
        var lines = [
            "بلاغ عن خطأ في القراءات",
            "الصفحة: \(page)",
            "الموضع: \(ayah.description):\(token)",
            "الكلمة: \(word)",
        ]
        if !variantIDs.isEmpty { lines.append("الوجوه: " + variantIDs.joined(separator: "، ")) }
        if !rulingIDs.isEmpty { lines.append("الأحكام: " + rulingIDs.joined(separator: "، ")) }
        return lines.joined(separator: "\n")
    }
}

/// «بلّغ عن خطأ»: opens the share sheet with `QiraatErrorReport.text` prefilled.
struct QiraatReportErrorLink: View {
    let report: QiraatErrorReport

    var body: some View {
        ShareLink(item: report.text) {
            Label("بلّغ عن خطأ", systemImage: "exclamationmark.bubble")
                .font(.callout.bold())
        }
        .tint(.info)
        .frame(minHeight: 44, alignment: .leading)
        .contentShape(Rectangle())
        .accessibilityIdentifier("qiraat-report-error")
    }
}
