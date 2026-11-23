#if DEBUG
import MushafCore
import SwiftUI

/// Step 2 — what nquran and الشامل say about the word, compared with what is already recorded, with ➕ to add
/// a group to the draft. Reference data is display-only: nothing is saved by looking at it.
struct ReferenceStepView: View {
    let store: ReviewStore
    let openEditor: () -> Void
    @AppStorage("review:reference-source:v1") private var sourceRaw = ReferenceSource.nquran.rawValue
    @State private var items: [ReferenceItem]?
    @State private var failed = false
    @State private var uncovered = false
    @State private var addedKey: String?

    private var source: ReferenceSource { ReferenceSource(rawValue: sourceRaw) ?? .nquran }

    private var word: ReviewWord? { store.selectedKey.flatMap(store.word(forKey:)) }

    private var loadID: String { "\(store.selectedKey ?? "")|\(sourceRaw)" }

    var body: some View {
        List {
            Section {
                Picker("المصدر", selection: $sourceRaw) {
                    Text("nquran").tag(ReferenceSource.nquran.rawValue)
                    Text("الشامل").tag(ReferenceSource.shamil.rawValue)
                }
                .pickerStyle(.segmented)
                .accessibilityIdentifier("review-reference-source")
            } footer: {
                Text("مرجع للاطّلاع — لا يُحفظ شيء حتى تضغط حفظ أو اعتماد.")
            }

            if failed {
                Section {
                    ContentUnavailableView("تعذّر تحميل المرجع", systemImage: "exclamationmark.triangle")
                        .listRowBackground(Color.clear)
                }
            } else if uncovered {
                Section { Text("لا بيانات من الشامل لهذه السورة بعد.").foregroundStyle(.secondary) }
            } else if let items {
                if items.isEmpty {
                    Section { Text("لا يوجد في هذا المرجع شيء لهذه الكلمة.").foregroundStyle(.secondary) }
                } else {
                    ForEach(items) { item in itemSection(item) }
                }
            } else {
                Section { HStack { ProgressView(); Text("جارٍ التحميل…").foregroundStyle(.secondary) } }
            }
        }
        .listStyle(.insetGrouped)
        .task(id: loadID) { await load() }
    }

    private func load() async {
        guard let word, let page = store.page else { return }
        items = nil; failed = false; uncovered = false
        let ayahWords = page.words.filter { $0.surah == word.surah && $0.ayah == word.ayah }
            .map { AyahWord(word: $0.word, text: $0.text) }.sorted { $0.word < $1.word }
        do {
            if let result = try await ReferenceProvider.items(source: source, library: ReferenceProvider.bundled, word: word, ayahWords: ayahWords) {
                items = result
            } else { uncovered = true }
        } catch { failed = true }
    }

    @ViewBuilder
    private func itemSection(_ item: ReferenceItem) -> some View {
        Section {
            ForEach(item.groups) { group in
                ReferenceGroupRow(store: store, group: group, source: item.source, rowKey: "\(item.id)-\(group.key)",
                                  addedKey: $addedKey, openEditor: openEditor)
            }
            if let text = item.sourceText, !text.isEmpty {
                DisclosureGroup(item.source == .nquran ? "نص المصدر" : "نص الكتاب") {
                    Text(text).font(.footnote).textSelection(.enabled)
                    ForEach(item.flags, id: \.self) { Label($0, systemImage: "exclamationmark.triangle").font(.footnote).foregroundStyle(.orange) }
                }
            }
        } header: {
            HStack(spacing: 6) {
                Text(item.heading).font(.custom("KFGQPCUthmanicScriptHAFS", size: 20))
                if item.isGeneralRule { Text("قاعدة عامة").font(.caption2.weight(.bold)).padding(.horizontal, 6).padding(.vertical, 2).background(.purple.opacity(0.18), in: Capsule()) }
                if let page = item.page { Text("ص \(page)").font(.caption).foregroundStyle(.secondary) }
            }
            .textCase(nil)
        }
    }
}

private struct ReferenceGroupRow: View {
    let store: ReviewStore
    let group: ReferenceGroup
    let source: ReferenceSource
    let rowKey: String
    @Binding var addedKey: String?
    let openEditor: () -> Void

    private var decision: ReferenceDecision { store.decision(for: group) }
    private var inDraft: Bool { store.isInDraft(group) }

    private var badge: (label: String, color: Color)? {
        let visible = ReferenceDecider.badgeVisibility(decision: decision, inDraft: inDraft)
        if visible.draft { return ("✎ في المسودة", .purple) }
        guard visible.decision else { return nil }
        switch decision.status {
        case .matched: return ("✓ معتمد كوجه", .green)
        case .recordedUnreviewed: return ("🔎 مسجَّل كوجه، بانتظار الاعتماد", .blue)
        case .partial: return ("⚠ تعارض جزئي في القراء", .orange)
        case .missing: return ("➕ غير مسجَّل — يُقترح إضافته", .red)
        case .unresolved: return ("❔ تعذّر التعرّف على القارئ", .gray)
        }
    }

    private var conditionLabel: String? {
        guard let condition = group.condition else { return nil }
        let base = condition == .both ? "وصلاً ووقفاً" : condition == .wasl ? "وصلاً" : "وقفاً"
        return group.conditionBasis == "default" ? "\(base) · افتراضي" : base
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(group.readersLabel + ":").font(.subheadline.weight(.semibold))
            ReviewFlowLayout(spacing: 6) {
                if let badge { chip(badge.label, badge.color) }
                if let conditionLabel { chip(conditionLabel, .brown) }
                if let suggestion = group.suggestion, suggestion.kind == .usul || suggestion.categoryCode != nil {
                    Text(suggestion.kind == .farsh ? "فرش" : "أصول").font(.caption2).foregroundStyle(.secondary)
                }
            }
            if !group.performanceText.isEmpty { Text(group.performanceText).font(.footnote).foregroundStyle(.secondary) }
            if let reading = group.readingText, !reading.isEmpty {
                Text(reading).font(.custom("KFGQPCUthmanicScriptHAFS", size: 22))
            }
            if !group.narratorIds.isEmpty {
                Button {
                    store.applyReference(group, source: source)
                    addedKey = rowKey
                    openEditor()
                } label: {
                    Label(addedKey == rowKey ? "أُضيف — راجع واحفظ" : inDraft ? "إضافة وجه آخر" : "إضافة للأداء",
                          systemImage: addedKey == rowKey ? "checkmark.circle" : "plus.circle")
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                .accessibilityIdentifier("review-add-reference")
            }
        }
        .padding(.vertical, 4)
    }

    private func chip(_ text: String, _ color: Color) -> some View {
        Text(text).font(.caption.weight(.semibold)).foregroundStyle(color)
            .padding(.horizontal, 8).padding(.vertical, 3).background(color.opacity(0.14), in: Capsule())
    }
}
#endif
