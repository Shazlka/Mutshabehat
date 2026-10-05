#if DEBUG
import MushafCore
import SwiftUI
import UIKit

/// The structured builder for الهمز (تغيير الهمز، الهمزتان من كلمة، الهمزتان من كلمتين) and الممال والمقلل:
/// ١ who reads it, ٢ how (the ruling, وصل/وقف, خلاف), ٣ add the face. It writes the narrators with their
/// «الأداء» and wajh into the draft and keeps the structured details; nothing is saved until «حفظ».
struct FaceBuilderView: View {
    let store: ReviewStore
    let category: String

    @State private var selected: [String] = []
    @State private var params = HamzahParams()
    @State private var imalahType: ImalahType = .imalah
    @State private var performance: FacePerformance = .waslWaqf
    @State private var khulf: Khulf = .qawlanWahidan
    @State private var custom = ""
    @State private var message: String?
    @State private var firstWordIsSpanStart = true

    private var isImalah: Bool { CategoryRules.isImalah(category) }

    private var action: String {
        let typed = Arabic.trimJS(custom)
        if !typed.isEmpty { return typed }
        if isImalah { return ImalahBuilder.faceActionText(imalahType, performance, khulf) }
        var p = params
        p.performance = performance
        p.khulf = khulf
        return HamzahBuilder.faceActionText(category: category, params: p)
    }

    private var title: String {
        isImalah ? "منشئ أوجه الممال والمقلل" : category == "HAMZATAN_KALIMA" ? "الهمزتان من كلمة واحدة"
            : category == "HAMZATAN_KALIMATAYN" ? "الهمزتان من كلمتين" : "تغيير الهمز المفرد"
    }

    private var presets: [(title: String, ids: [String], apply: (() -> Void)?)] {
        if isImalah { return ImalahBuilder.presets.map { ($0.title, $0.ids, nil) } }
        return HamzahBuilder.presets(for: category).map { preset in
            (preset.title, preset.ids, { var p = params; preset.apply(&p); performance = p.performance; params = p })
        }
    }

    var body: some View {
        List {
            Section {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Array(presets.enumerated()), id: \.offset) { _, preset in
                            Button { selected = preset.ids; preset.apply?() } label: { Text(preset.title).font(.footnote.weight(.semibold)) }
                                .buttonStyle(.bordered).controlSize(.small)
                        }
                    }
                }
                NarratorToggleList(selection: $selected)
            } header: { Text("١. من يقرأ؟ (\(selected.count))") }

            Section("٢. كيف يقرأ؟") {
                if isImalah {
                    Picker("الحكم", selection: $imalahType) { ForEach(ImalahType.allCases, id: \.self) { Text($0.rawValue).tag($0) } }
                        .pickerStyle(.segmented)
                } else {
                    hamzahControls
                }
                Picker("الأداء", selection: $performance) {
                    Text("وصلاً ووقفاً").tag(FacePerformance.waslWaqf)
                    Text("عند الوقف").tag(FacePerformance.waqfOnly)
                    Text("عند الوصل").tag(FacePerformance.waslOnly)
                }
                .pickerStyle(.segmented)
                Picker("الخلاف", selection: $khulf) {
                    Text("قولاً واحداً").tag(Khulf.qawlanWahidan)
                    Text("بخلف عنه").tag(Khulf.bikhulf)
                }
                .pickerStyle(.segmented)
                TextField("نص مخصص للأداء (اختياري)", text: $custom, axis: .vertical).font(.footnote)
                LabeledContent("المعاينة") { Text(action).font(.footnote).multilineTextAlignment(.trailing) }
            }

            Section {
                Button { addFace() } label: {
                    Label("إضافة هذا الوجه (\(selected.count))", systemImage: "plus.circle.fill").frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(selected.isEmpty)
                .accessibilityIdentifier("review-builder-add")
                if let message { Label(message, systemImage: "checkmark.circle").font(.footnote).foregroundStyle(.green) }
            }

            NarratorFacesSection(store: store)
        }
        .listStyle(.insetGrouped)
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            if !isImalah { performance = HamzahBuilder.defaultPerformance(for: category) }
            if case .kalima(let f, let s, let i)? = store.session?.draft.hamzahDetail {
                params.kalimaFirst = f; params.kalimaSecond = s; params.kalimaIdkhal = i
            }
        }
    }

    // MARK: Hamzah controls

    @ViewBuilder
    private var hamzahControls: some View {
        switch category {
        case "HAMZATAN_KALIMA":
            treatmentPicker("الهمزة الأولى", [.tahqiq, .tasheel, .ibdal, .isqat], $params.kalimaFirst, default: .tahqiq)
            treatmentPicker("الهمزة الثانية", [.tasheel, .ibdal, .tahqiq, .isqat], $params.kalimaSecond, default: .tasheel)
            Toggle("إدخال ألف بين الهمزتين", isOn: Binding(get: { params.kalimaIdkhal ?? false }, set: { params.kalimaIdkhal = $0 }))
        case "HAMZATAN_KALIMATAYN":
            Picker("الحركة", selection: Binding(get: { params.kalimataynRelation ?? .mutafiqatan }, set: { params.kalimataynRelation = $0 })) {
                Text("متفقتان في الحركة").tag(HarakahRelation.mutafiqatan)
                Text("مختلفتان في الحركة").tag(HarakahRelation.mukhtalifatan)
            }
            .pickerStyle(.segmented)
            treatmentPicker("الهمزة الأولى", [.tahqiq, .isqat, .tasheel, .ibdal], $params.kalimataynFirst, default: .tahqiq)
            treatmentPicker("الهمزة الثانية", [.tasheel, .ibdal, .tahqiq, .hadhf], $params.kalimataynSecond, default: .tasheel)
            if let (start, end) = spanWords {
                Picker("أي كلمة فيها الهمزة الأولى؟", selection: $firstWordIsSpanStart) {
                    Text(start.text).tag(true)
                    Text(end.text).tag(false)
                }
                .pickerStyle(.segmented)
            }
        default:
            treatmentPicker("المعالجة", [.tahqiq, .tasheel, .ibdal, .naql, .hadhf, .saktBeforeHamz], $params.singleTreatment, default: .tasheel)
        }
    }

    private func treatmentPicker(_ title: String, _ options: [HamzahTreatment], _ binding: Binding<HamzahTreatment?>,
                                 default fallback: HamzahTreatment) -> some View {
        Picker(title, selection: Binding(get: { binding.wrappedValue ?? fallback }, set: { binding.wrappedValue = $0 })) {
            ForEach(options, id: \.self) { Text($0.rawValue).tag($0) }
        }
    }

    /// The two spanned words in Mushaf order, when a span is selected (الهمزتان من كلمتين).
    private var spanWords: (ReviewWord, ReviewWord)? {
        guard category == "HAMZATAN_KALIMATAYN", let a = store.selectedKey, let b = store.spanEndKey,
              let wa = store.word(forKey: a), let wb = store.word(forKey: b) else { return nil }
        return a <= b ? (wa, wb) : (wb, wa)
    }

    private func addFace() {
        guard !selected.isEmpty else { return }
        let chosen = selected
        let text = action
        let wordKeys = spanWords.map { start, end in
            firstWordIsSpanStart ? HamzahDetail.WordKeys(first: start.key, second: end.key)
                : HamzahDetail.WordKeys(first: end.key, second: start.key)
        }
        var p = params
        p.performance = performance
        p.khulf = khulf
        store.updateDraft { draft in
            draft.narrators = FaceBuilder.addFace(to: draft.narrators, ids: chosen, action: text, performance: performance, khulf: khulf)
            let (wasl, waqf) = performance.waslWaqf
            draft.appliesWasl = wasl
            draft.appliesWaqf = waqf
            if isImalah {
                if let ruling = ImalahBuilder.updatedRulingText(current: draft.rulingText, type: imalahType, performance: performance) {
                    draft.rulingText = ruling
                }
            } else {
                draft.hamzahDetail = HamzahBuilder.detail(category: category, params: p, wordKeys: wordKeys)
                if let ruling = HamzahBuilder.updatedRulingText(current: draft.rulingText, action: text) { draft.rulingText = ruling }
            }
        }
        message = "تمت إضافة الوجه لـ (\(chosen.count)) رواة ✓"
        custom = ""
    }
}

/// The 10 readers with their two narrators as toggles, over a local selection (in the order picked).
struct NarratorToggleList: View {
    @Binding var selection: [String]

    var body: some View {
        ForEach(CanonicalReaders.all, id: \.id) { reader in
            let color = Color(UIColor(qiraatHex: reader.color))
            let ids = reader.narrators.map(\.id)
            VStack(alignment: .leading, spacing: 6) {
                Button {
                    if ids.allSatisfy(selection.contains) { selection.removeAll { ids.contains($0) } }
                    else { for id in ids where !selection.contains(id) { selection.append(id) } }
                } label: {
                    HStack {
                        Image(systemName: ids.allSatisfy(selection.contains) ? "checkmark.circle.fill"
                              : ids.contains(where: selection.contains) ? "minus.circle.fill" : "circle").foregroundStyle(color)
                        Text(reader.nameAr).foregroundStyle(.primary)
                        Spacer()
                    }
                }
                .buttonStyle(.plain)
                HStack(spacing: 8) {
                    ForEach(reader.narrators, id: \.id) { narrator in
                        let on = selection.contains(narrator.id)
                        Button {
                            if on { selection.removeAll { $0 == narrator.id } } else { selection.append(narrator.id) }
                        } label: {
                            Text(narrator.nameShort).font(.footnote.weight(.semibold)).padding(.horizontal, 12).padding(.vertical, 5)
                                .background(on ? color : color.opacity(0.12), in: Capsule()).foregroundStyle(on ? Color.white : color)
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("review-builder-narrator-\(narrator.id)")
                    }
                }
                .padding(.leading, 28)
            }
            .padding(.vertical, 2)
        }
    }
}
#endif
