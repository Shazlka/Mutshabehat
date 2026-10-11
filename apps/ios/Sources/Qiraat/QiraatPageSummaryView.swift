import MushafCore
import SwiftUI
import UIKit

/// Plain library/store inputs; existing live-sync notifications refresh the visible summary.
/// Selection remains with the reader, which can navigate and present its existing word sheet.
struct QiraatPageSummaryView: View {
    let pages: [Int]
    let library: MushafLibrary
    let store: QiraatStore?
    let filter: QiraatFilter
    let onSelect: (QiraatPageSummaryItem) -> Void

    @ScaledMetric(relativeTo: .title2) private var wordSize: CGFloat = 30
    @State private var liveRevision = 0

    private struct AyahGroup: Identifiable {
        let id: AyahKey
        var items: [QiraatPageSummaryItem]
    }

    private var groups: [AyahGroup] {
        // The store is not observable. Reading this revision makes a live update invalidate the list.
        _ = liveRevision
        guard let store else { return [] }
        var result: [AyahGroup] = []
        for page in Set(pages).sorted() {
            guard let mushaf = library.page(page), let data = store.page(page) else { continue }
            let items = QiraatPageSummary.build(page: page, words: mushaf.lines.flatMap(\.words), data: data,
                marks: QiraatMarks(catalog: store.catalog, page: data), catalog: store.catalog, filter: filter)
            for item in items {
                if result.last?.id == item.word.ayahKey {
                    result[result.count - 1].items.append(item)
                } else {
                    result.append(AyahGroup(id: item.word.ayahKey, items: [item]))
                }
            }
        }
        return result
    }

    var body: some View {
        let sections = groups
        List {
            if sections.isEmpty {
                Text("لا خلاف في هذه الصفحة")
                    .font(.body)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .accessibilityIdentifier("qiraat-page-summary-empty")
                    .listRowBackground(Color(uiColor: .mushafPaper))
            }
            ForEach(sections) { section in
                Section {
                    ForEach(section.items) { item in
                        Button { onSelect(item) } label: { row(item) }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier(item.id)
                            .accessibilityHint("الانتقال إلى الكلمة وعرض قراءاتها")
                            .listRowBackground(Color(uiColor: .mushafPaper))
                    }
                } header: {
                    Text(verbatim: "\(library.surahNames[section.id.surah] ?? String(section.id.surah)) · الآية \(section.id.ayah)")
                        .font(.headline)
                        .foregroundStyle(Color(uiColor: .mushafInk))
                        .textCase(nil)
                }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .background(Color(uiColor: .mushafPaper))
        .foregroundStyle(Color(uiColor: .mushafInk))
        .environment(\.layoutDirection, .rightToLeft)
        .navigationTitle("خلافات الصفحة")
        .accessibilityIdentifier("qiraat-page-summary")
        .onReceive(NotificationCenter.default.publisher(for: .qiraatPageDidChange)) { notification in
            guard let page = notification.userInfo?["page"] as? Int, pages.contains(page) else { return }
            liveRevision &+= 1
        }
    }

    private func row(_ item: QiraatPageSummaryItem) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            // Unicode text uses the Mushaf face; a QCF glyph requires its own page font.
            Text(verbatim: item.word.textUthmani)
                .font(Font(MushafLibrary.mushafFont(size: wordSize)))
            ForEach(item.variants) { variant in
                VStack(alignment: .leading, spacing: 4) {
                    Text(verbatim: variant.readingText)
                        .font(Font(MushafLibrary.mushafFont(size: wordSize)))
                    Text(verbatim: variant.variant.performanceNote ?? differenceTypeLabelAr(variant.variant.differenceType))
                        .font(.caption)
                    authorities(variant.authorities)
                    if variant.variant.verificationStatus == "NEEDS_MANUAL_REVIEW" {
                        Text("بحاجة إلى مراجعة").font(.caption)
                    }
                }
            }
            ForEach(item.rulings) { ruling in
                VStack(alignment: .leading, spacing: 4) {
                    Text(verbatim: "باب: \(ruling.categoryAr)").font(.subheadline.bold())
                    ForEach(ruling.actionGroups, id: \.action) { group in
                        Text(verbatim: group.action).font(.subheadline)
                        authorities(group.authorities)
                    }
                    if ruling.ruling.verificationStatus == "NEEDS_MANUAL_REVIEW" {
                        Text("بحاجة إلى مراجعة").font(.caption)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
        .padding(.vertical, 6)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    private func authorities(_ pills: [AuthorityPill]) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            ForEach(pills) { pill in
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Circle().fill(Color(qiraatHex: pill.color))
                        .frame(width: 8, height: 8)
                        .accessibilityHidden(true)
                    Text(verbatim: pill.name).font(.subheadline)
                }
            }
        }
    }
}
