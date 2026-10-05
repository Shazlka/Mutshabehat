#if DEBUG
import MushafCore
import SwiftUI

/// Step 3 — edit the face: kind (فرش / أصول), its fields or أبواب, وصل / وقف, and who reads it. Everything
/// edits the draft in the store; nothing is saved until «حفظ» or «اعتماد».
struct EditStepView: View {
    let store: ReviewStore

    private var kind: Binding<ReadingKind> { store.draftBinding(\.kind, default: .farsh) }

    var body: some View {
        if let draft = store.session?.draft {
            List {
                if let suggestion = store.pendingSuggestion {
                    Section {
                        Button { store.applyPendingSuggestion() } label: {
                            Label(suggestion.kind == .farsh ? "تطبيق اقتراح المرجع: فرش" : "تطبيق اقتراح المرجع: أصول\(suggestion.categoryCode.map { " · " + categoryName($0) } ?? "")",
                                  systemImage: "wand.and.stars")
                        }
                        .accessibilityIdentifier("review-apply-suggestion")
                    }
                }
                Section("نوع الوجه") {
                    Picker("النوع", selection: kind) {
                        Text("فرش الحروف").tag(ReadingKind.farsh)
                        Text("أصول القراءات").tag(ReadingKind.usul)
                    }
                    .pickerStyle(.segmented)
                    .accessibilityIdentifier("review-kind")
                }
                if draft.kind == .farsh {
                    FarshFieldsSection(store: store)
                } else {
                    CategoryPickerSection(store: store)
                }
                if draft.kind == .usul, let code = draft.categoryCode, CategoryRules.isSpecial(code) {
                    Section {
                        NavigationLink {
                            FaceBuilderView(store: store, category: code)
                        } label: {
                            Label(CategoryRules.isImalah(code) ? "منشئ أوجه الممال والمقلل" : "منشئ أوجه الهمز", systemImage: "wand.and.stars.inverse")
                        }
                        .accessibilityIdentifier("review-open-builder")
                    } footer: {
                        Text("يضيف الوجه بالقراء والأداء والخلاف دفعة واحدة، ويحفظ تفاصيله مع الوجه.")
                    }
                }
                Section("الوصل والوقف") {
                    Toggle("وصلاً", isOn: waslBinding(draft))
                    Toggle("وقفًا", isOn: waqfBinding(draft))
                }
                ReaderNarratorPickerSection(store: store)
                NarratorFacesSection(store: store)
            }
            .listStyle(.insetGrouped)
            .scrollDismissesKeyboard(.interactively)
            .accessibilityIdentifier("review-edit-step")
        } else {
            ContentUnavailableView {
                Label("لا وجه مفتوح", systemImage: "square.and.pencil")
            } description: {
                Text("اختر وجهًا من «الأوجه»، أو ابدأ وجهًا جديدًا لهذه الكلمة.")
            } actions: {
                Button("وجه جديد") { store.startNewDraft() }.buttonStyle(.borderedProminent)
            }
        }
    }

    private func categoryName(_ code: String) -> String {
        store.page?.categories.first { $0.code == code }?.nameAr ?? code
    }

    /// The two switches may not both be off (the database requires one of them).
    private func waslBinding(_ draft: ReviewDraftFields) -> Binding<Bool> {
        Binding(get: { draft.appliesWasl }, set: { new in store.updateDraft { $0.appliesWasl = new; if !new && !$0.appliesWaqf { $0.appliesWaqf = true } } })
    }

    private func waqfBinding(_ draft: ReviewDraftFields) -> Binding<Bool> {
        Binding(get: { draft.appliesWaqf }, set: { new in store.updateDraft { $0.appliesWaqf = new; if !new && !$0.appliesWasl { $0.appliesWasl = true } } })
    }
}

// MARK: فرش

private struct FarshFieldsSection: View {
    let store: ReviewStore

    var body: some View {
        Section("نص القراءة والبيان") {
            TextField("نص الكلمة المقروء به", text: store.draftBinding(\.readingText, default: ""), axis: .vertical)
                .font(.custom("KFGQPCUthmanicScriptHAFS", size: 26))
                .environment(\.layoutDirection, .rightToLeft)
                .accessibilityIdentifier("review-reading-text")
            VStack(alignment: .leading, spacing: 8) {
                Text("نوع الاختلاف").font(.footnote).foregroundStyle(.secondary)
                ReviewFlowLayout(spacing: 8) {
                    ForEach(VariantType.canonical, id: \.dbEnum) { item in
                        let selected = VariantType.normalize(store.session?.draft.variantType) == item.dbEnum
                        Button { store.updateDraft { $0.variantType = item.dbEnum } } label: {
                            Text(item.label).font(.footnote.weight(.semibold)).padding(.horizontal, 10).padding(.vertical, 5)
                                .background(selected ? Color.accentColor : Color.secondary.opacity(0.14), in: Capsule())
                                .foregroundStyle(selected ? Color.white : Color.primary)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            TextField("بيان الفرق", text: optional(\.description), axis: .vertical)
            TextField("ملاحظة الأداء", text: optional(\.performanceNote), axis: .vertical)
        }
    }

    private func optional(_ keyPath: WritableKeyPath<ReviewDraftFields, String?>) -> Binding<String> {
        Binding(get: { store.session?.draft[keyPath: keyPath] ?? "" },
                set: { value in store.updateDraft { $0[keyPath: keyPath] = value.isEmpty ? nil : value } })
    }
}

// MARK: أصول

private struct CategoryPickerSection: View {
    let store: ReviewStore
    @State private var query = ""

    private var categories: [ReviewCategory] {
        let all = store.page?.categories ?? []
        let q = Arabic.normalize(query)
        return q.isEmpty ? all : all.filter { Arabic.normalize($0.nameAr).contains(q) || $0.code.lowercased().contains(query.lowercased()) }
    }

    var body: some View {
        let draft = store.session?.draft ?? ReviewDraftFields(kind: .usul)
        let selected = ReviewDraft.selectedCategoryCodes(draft)
        Section {
            TextField("ابحث في الأبواب", text: $query).accessibilityIdentifier("review-category-search")
            ForEach(categories) { category in
                Button {
                    store.updateDraft { ReviewDraft.toggleCategory(category.code, in: &$0) }
                } label: {
                    HStack {
                        Text(category.nameAr)
                        if CategoryRules.isSpecial(category.code) {
                            Text("تفاصيل").font(.caption2).foregroundStyle(.secondary)
                                .padding(.horizontal, 6).padding(.vertical, 1).background(.secondary.opacity(0.15), in: Capsule())
                        }
                        Spacer()
                        if let index = selected.firstIndex(of: category.code) {
                            Image(systemName: index == 0 ? "checkmark.circle.fill" : "checkmark.circle").foregroundStyle(Color.accentColor)
                        }
                    }
                }
                .foregroundStyle(.primary)
                .accessibilityIdentifier("review-category-\(category.code)")
            }
        } header: {
            Text(selected.isEmpty ? "الباب (اختر واحدًا أو أكثر)" : "الأبواب المختارة: \(selected.count)")
        } footer: {
            Text("باب واحد يُحفظ في الوجه نفسه، وكل باب إضافي يُنشئ وجهًا مستقلًا بالقراء أنفسهم. الهمز والإمالة يُختاران وحدهما.")
        }
    }
}

// MARK: القراء والرواة

private struct ReaderNarratorPickerSection: View {
    let store: ReviewStore

    private var narrators: [NarratorInput] { store.session?.draft.narrators ?? [] }

    var body: some View {
        Section {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    preset("الكل", .all); preset("السبعة", .sabah); preset("الثلاثة", .thalatha)
                    preset("الكوفيون", .kufis); preset("المدنيان", .madaniyan)
                    Button(role: .destructive) { store.updateDraft { $0.narrators = [] } } label: { Text("مسح").font(.footnote.weight(.semibold)) }
                        .buttonStyle(.bordered).controlSize(.small).disabled(narrators.isEmpty)
                }
            }
            ForEach(CanonicalReaders.all, id: \.id) { reader in readerRow(reader) }
        } header: {
            Text("القراء والرواة (\(Set(narrators.map(\.id)).count)/20)")
        } footer: {
            if narrators.contains(where: { $0.id == CanonicalReaders.hafsId }) {
                Text("حفص هو الأصل: يُذكر وجهًا ثانيًا فأكثر مع ملاحظة.")
            }
        }
    }

    private func preset(_ title: String, _ preset: NarratorSelection.Preset) -> some View {
        Button { store.updateDraft { $0.narrators = NarratorSelection.select($0.narrators, preset: preset) } } label: {
            Text(title).font(.footnote.weight(.semibold))
        }
        .buttonStyle(.bordered).controlSize(.small)
    }

    private func readerRow(_ reader: CanonicalReader) -> some View {
        let color = Color(UIColor(qiraatHex: reader.color))
        let ids = reader.narrators.map(\.id)
        let count = ids.filter { id in narrators.contains { $0.id == id } }.count
        return VStack(alignment: .leading, spacing: 8) {
            Button { store.updateDraft { $0.narrators = NarratorSelection.toggleReader($0.narrators, readerId: reader.id) } } label: {
                HStack {
                    Image(systemName: count == 2 ? "checkmark.circle.fill" : count == 1 ? "minus.circle.fill" : "circle").foregroundStyle(color)
                    Text(reader.nameAr).foregroundStyle(.primary)
                    Spacer()
                }
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("review-reader-\(reader.id)")
            HStack(spacing: 8) {
                ForEach(reader.narrators, id: \.id) { narrator in
                    let on = narrators.contains { $0.id == narrator.id }
                    Button { store.updateDraft { $0.narrators = NarratorSelection.toggleNarrator($0.narrators, id: narrator.id) } } label: {
                        Text(narrator.nameShort).font(.footnote.weight(.semibold)).padding(.horizontal, 12).padding(.vertical, 5)
                            .background(on ? color : color.opacity(0.12), in: Capsule())
                            .foregroundStyle(on ? Color.white : color)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("review-narrator-\(narrator.id)")
                }
            }
            .padding(.leading, 28)
        }
        .padding(.vertical, 2)
    }
}

// MARK: تفاصيل الأداء والأوجه

struct NarratorFacesSection: View {
    let store: ReviewStore

    private var narrators: [NarratorInput] { store.session?.draft.narrators ?? [] }

    var body: some View {
        if !narrators.isEmpty {
            Section {
                ForEach(Array(narrators.enumerated()), id: \.offset) { index, narrator in faceEditor(index, narrator) }
            } header: {
                Text("تفاصيل الأداء والأوجه للرواة المحددين")
            }
        }
    }

    private func change(_ index: Int, _ edit: (inout NarratorInput) -> Void) {
        store.updateDraft { draft in
            guard draft.narrators.indices.contains(index) else { return }
            edit(&draft.narrators[index])
        }
    }

    @ViewBuilder
    private func faceEditor(_ index: Int, _ narrator: NarratorInput) -> some View {
        let name = CanonicalReaders.narratorName(narrator.id) ?? narrator.id
        let isHafs = narrator.id == CanonicalReaders.hafsId
        let note = narrator.wajhNote ?? ""
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(name).font(.subheadline.weight(.semibold))
                Spacer()
                Stepper("الوجه \(narrator.wajhOrder ?? 1)", value: Binding(
                    get: { narrator.wajhOrder ?? 1 },
                    set: { value in change(index) { $0.wajhOrder = max(isHafs ? 2 : 1, value) } }), in: (isHafs ? 2 : 1)...9)
                    .labelsHidden()
                Text("وجه \(narrator.wajhOrder ?? 1)").font(.caption).foregroundStyle(.secondary)
            }
            TextField("الأداء (يظهر في المصحف)", text: Binding(
                get: { narrator.action ?? "" }, set: { value in change(index) { $0.action = value.isEmpty ? nil : value } }), axis: .vertical)
                .font(.footnote)
            TextField(isHafs ? "ملاحظة (مطلوبة لحفص)" : "الخلاف / ملاحظة", text: Binding(
                get: { note }, set: { value in change(index) { $0.wajhNote = value.isEmpty ? nil : value } }), axis: .vertical)
                .font(.footnote)
            if isHafs && (((narrator.wajhOrder ?? 1) < 2) || Arabic.trimJS(note).isEmpty) {
                Label("حفص: وجه ثانٍ فأكثر مع ملاحظة", systemImage: "exclamationmark.triangle.fill").font(.caption).foregroundStyle(.orange)
            }
            HStack {
                Button { store.updateDraft { $0.narrators = NarratorSelection.addFace($0.narrators, narratorId: narrator.id) } } label: {
                    Label("وجه آخر", systemImage: "plus.circle")
                }
                .buttonStyle(.bordered).controlSize(.small)
                Button(role: .destructive) { store.updateDraft { $0.narrators = NarratorSelection.removeFace($0.narrators, at: index) } } label: {
                    Label("حذف", systemImage: "trash")
                }
                .buttonStyle(.bordered).controlSize(.small)
            }
        }
        .padding(.vertical, 4)
    }
}
#endif
