#if DEBUG
import MushafCore
import SwiftUI

/// The bottom sheet for the selected word, in short steps: ١ الأوجه · ٢ المراجع · ٣ التحرير, and ٤ اعتماد as
/// the sticky action at the bottom.
struct ReviewWordSheet: View {
    let store: ReviewStore
    /// Beside the page (iPad): the editor's own navigation stack is used, and close / next sit in the header
    /// (a second stack nested inside the pushed page pops it).
    var embedded = false

    enum Step: Int, CaseIterable, Identifiable {
        case faces, references, edit
        var id: Int { rawValue }
        var title: String {
            switch self {
            case .faces: "١ الأوجه"
            case .references: "٢ المراجع"
            case .edit: "٣ التحرير"
            }
        }
    }

    @State private var step: Step = .faces

    private var word: ReviewWord? { store.selectedKey.flatMap(store.word(forKey:)) }

    var body: some View {
        if embedded {
            panel.modifier(WordSheetBehaviour(store: store, step: $step))
        } else {
            NavigationStack { panel.navigationBarTitleDisplayMode(.inline).toolbar { toolbarItems } }
                .modifier(WordSheetBehaviour(store: store, step: $step))
        }
    }

    @ToolbarContentBuilder private var toolbarItems: some ToolbarContent {
        ToolbarItem(placement: .topBarLeading) { closeButton }
        ToolbarItem(placement: .topBarTrailing) { nextButton }
    }

    private var closeButton: some View {
        Button { store.requestSelect(key: nil) } label: { Image(systemName: "xmark.circle.fill") }
            .accessibilityLabel("إغلاق").accessibilityIdentifier("review-sheet-close")
    }

    private var nextButton: some View {
        Button {
            if let key = store.nextReviewKey(after: store.selectedKey) { store.requestSelect(key: key) }
        } label: { Label("التالي", systemImage: "forward.end") }
            .disabled(store.nextReviewKey(after: store.selectedKey) == nil)
            .accessibilityIdentifier("review-sheet-next")
    }

    private var panel: some View {
            VStack(spacing: 0) {
                if embedded {
                    HStack { closeButton; Spacer(); nextButton }.padding(.horizontal, 16).padding(.top, 8)
                }
                header
                Picker("الخطوة", selection: $step) {
                    ForEach(Step.allCases) { Text($0.title).tag($0) }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16).padding(.bottom, 8)
                .accessibilityIdentifier("review-steps")
                Group {
                    switch step {
                    case .faces: FacesStepView(store: store) { step = .edit }
                    case .references: ReferenceStepView(store: store) { step = .edit }
                    case .edit: EditStepView(store: store)
                    }
                }
                .frame(maxHeight: .infinity)
            }
            .safeAreaInset(edge: .bottom) { ApproveBar(store: store) }
    }

    private var header: some View {
        VStack(spacing: 4) {
            if let word {
                Text(word.text).font(.custom("KFGQPCUthmanicScriptHAFS", size: 36)).accessibilityIdentifier("review-sheet-word")
                Text("\(word.surah):\(word.ayah):\(word.word)").font(.caption).foregroundStyle(.secondary)
            }
            if store.hasUnsavedEdits {
                Label("تعديلات غير محفوظة — اضغط حفظ", systemImage: "pencil.circle.fill")
                    .font(.footnote.weight(.semibold)).foregroundStyle(.orange)
                    .accessibilityIdentifier("review-unsaved")
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }
}

/// Dismissal guard, the unsaved-edits confirmation and the reset to step ١ when the word changes.
private struct WordSheetBehaviour: ViewModifier {
    let store: ReviewStore
    @Binding var step: ReviewWordSheet.Step

    func body(content: Content) -> some View {
        content
            .interactiveDismissDisabled(store.hasUnsavedEdits)
            .confirmationDialog("عندك تعديلات غير محفوظة", isPresented: Binding(
                get: { store.hasPendingConfirmation }, set: { if !$0 { store.cancelPendingSelection() } }), titleVisibility: .visible) {
                Button("تجاهل التعديلات والمتابعة", role: .destructive) { store.confirmPendingSelection() }
                Button("العودة", role: .cancel) { store.cancelPendingSelection() }
            } message: {
                Text("ستضيع إن انتقلت الآن. هل تريد المتابعة بدون حفظ؟")
            }
            .onChange(of: store.selectedKey) { step = .faces }
    }
}

/// Step ٤ — save and approve. With unsaved edits the primary button reads «حفظ واعتماد» and saves first;
/// otherwise it approves the saved faces of the word.
private struct ApproveBar: View {
    let store: ReviewStore

    var body: some View {
        let rows = store.selectedKey.map(store.rows(forKey:)) ?? []
        let waiting = rows.filter { $0.reviewStatus != .reviewed }
        VStack(spacing: 8) {
            if let notice = store.notice {
                Text(notice).font(.footnote).foregroundStyle(.orange).frame(maxWidth: .infinity, alignment: .leading)
            }
            HStack(spacing: 10) {
                if store.session != nil {
                    if store.hasUnsavedEdits {
                        Button { store.saveDraft(approve: false) } label: { Text("حفظ").frame(maxWidth: .infinity) }
                            .buttonStyle(.bordered).accessibilityIdentifier("review-save")
                    }
                    Button { store.saveDraft(approve: true) } label: {
                        Label(store.hasUnsavedEdits ? "حفظ واعتماد" : "اعتماد", systemImage: "checkmark.seal.fill").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent).tint(.green).accessibilityIdentifier("review-approve")
                } else if !waiting.isEmpty {
                    Button { store.approveAllForSelectedWord() } label: {
                        Label(waiting.count == 1 ? "اعتماد" : "اعتماد الكل (\(waiting.count))", systemImage: "checkmark.seal.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent).tint(.green).accessibilityIdentifier("review-approve")
                }
            }
        }
        .controlSize(.large)
        .padding(.horizontal, 16).padding(.vertical, 10)
        .background(.bar)
    }
}
#endif
