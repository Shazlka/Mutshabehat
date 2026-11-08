import MushafCore
import SwiftUI

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
