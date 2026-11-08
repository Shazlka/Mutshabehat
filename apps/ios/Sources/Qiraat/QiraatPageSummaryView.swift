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
    /// False in the learning view's side bar, which stays open beside the page.
    var showsClose = true

    @ScaledMetric(relativeTo: .title2) private var wordSize: CGFloat = 30
    @Environment(\.dismiss) private var dismiss
    @State private var groups: [AyahGroup]?
    /// The data could not be loaded (as opposed to loaded and empty).
    @State private var unavailable = false

    private struct AyahGroup: Identifiable {
        let id: AyahKey
        var items: [QiraatPageSummaryItem]
    }

    private struct LoadID: Hashable, Sendable {
        let pages: [Int]
        let filter: QiraatFilter
        let revision: Int
    }

    private var loadID: LoadID {
        LoadID(pages: Array(Set(pages)).sorted(), filter: filter, revision: 0)
    }

    var body: some View {
        let sections = groups ?? []
        List {
            if groups == nil {
                ProgressView("جارٍ إعداد خلافات الصفحة")
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .listRowBackground(Color(uiColor: .mushafPaper))
            } else if unavailable {
                // Failing to look is not the same as finding nothing: never say «لا خلاف» for it.
                Label("تعذّر تحميل خلافات هذه الصفحة", systemImage: "exclamationmark.triangle")
                    .font(.body)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .accessibilityIdentifier("qiraat-page-summary-unavailable")
                    .listRowBackground(Color(uiColor: .mushafPaper))
            } else if sections.isEmpty {
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
                    Text("\(library.surahNames[section.id.surah] ?? String(section.id.surah)) · الآية \(section.id.ayah)")
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
        .toolbar {
            if showsClose {
                ToolbarItem(placement: .cancellationAction) {
                    Button("إغلاق") { dismiss() }
                        .accessibilityIdentifier("qiraat-page-summary-close")
                }
            }
        }
        .accessibilityIdentifier("qiraat-page-summary")
        .task(id: loadID) { await loadGroups() }
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
            ForEach(item.rulingGroups) { group in
                VStack(alignment: .leading, spacing: 4) {
                    Text("باب: \(group.categoryAr)").font(.subheadline.bold())
                    ForEach(group.rulings) { ruling in
                        ForEach(Array(ruling.actionGroups.enumerated()), id: \.offset) { _, actionGroup in
                            Text(verbatim: actionGroup.action).font(.subheadline)
                            authorities(actionGroup.authorities)
                        }
                    }
                    if group.rulings.contains(where: { $0.ruling.verificationStatus == "NEEDS_MANUAL_REVIEW" }) {
                        Text("بحاجة إلى مراجعة").font(.caption)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
        .padding(.vertical, 6)
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: accessibilityLabel(for: item)))
    }

    @MainActor private func loadGroups() async {
        let requested = loadID
        // The bulk sync announces many changed pages in a burst, and each announcement starts a full 604-file rescan.
        // Every new revision cancels this task, so waiting briefly here leaves only the last one to scan.
        if requested.revision > 0, (try? await Task.sleep(for: .milliseconds(400))) == nil { return }
        guard let items = await QiraatPageSummary.load(
            store: store,
            databaseURL: library.database.url,
            pages: requested.pages,
            filter: requested.filter,
            revision: requested.revision
        ) else {
            guard !Task.isCancelled else { return }
            unavailable = true
            groups = []
            return
        }
        guard !Task.isCancelled, requested == loadID else { return }
        unavailable = false

        var result: [AyahGroup] = []
        for item in items {
            if result.last?.id == item.word.ayahKey {
                result[result.count - 1].items.append(item)
            } else {
                result.append(AyahGroup(id: item.word.ayahKey, items: [item]))
            }
        }
        groups = result
    }

    private func accessibilityLabel(for item: QiraatPageSummaryItem) -> String {
        var parts = [appLocalized("نص المصحف:") + " " + item.word.textUthmani]
        for variant in item.variants {
            parts.append(appLocalized("القراءة:") + " " + variant.readingText)
            let names = variant.authorities.map(\.name).joined(separator: "، ")
            if !names.isEmpty { parts.append(appLocalized("القارئون:") + " " + names) }
        }
        for group in item.rulingGroups {
            parts.append(appLocalized("باب:") + " " + group.categoryAr)
            for ruling in group.rulings {
                for action in ruling.actionGroups {
                    parts.append(appLocalized("الأداء:") + " " + action.action)
                    let names = action.authorities.map(\.name).joined(separator: "، ")
                    if !names.isEmpty { parts.append(appLocalized("القارئون:") + " " + names) }
                }
            }
        }
        return parts.joined(separator: ". ")
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
