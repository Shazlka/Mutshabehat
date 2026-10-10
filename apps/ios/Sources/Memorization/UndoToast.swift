import MushafCore
import SwiftUI

struct ToastState: Equatable {
    let id = UUID()
    let batchID: UUID
    let changed: Int
    let milestones: [Milestone]

    init(batchID: UUID, changed: Int, milestones: [Milestone]) {
        self.batchID = batchID
        self.changed = changed
        self.milestones = milestones
    }

    init(result: MemorizationStore.ApplyResult, plan: BatchPlan) {
        self.init(batchID: result.batch.id, changed: plan.changes.count, milestones: result.milestones)
    }
}

/// «تم تحديث N آية — تراجع», shown for a few seconds after an update, with any milestone it reached.
struct UndoToast: View {
    let state: ToastState
    let language: AppLanguage
    var surahName: (Int) -> String? = { _ in nil }
    let undo: () -> Void
    let dismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 12) {
                Text(verbatim: message)
                    .font(.subheadline.weight(.semibold))
                    .accessibilityIdentifier("memo-undo-toast")
                Spacer(minLength: 8)
                Button(language == .arabic ? "تراجع" : "Undo", action: undo)
                    .font(.subheadline.weight(.bold))
                    .accessibilityIdentifier("memo-undo-button")
            }
            ForEach(state.milestones, id: \.self) { milestone in
                Text(verbatim: MilestoneText.describe(milestone, language: language, surahName: surahName))
                    .font(.caption)
                    .foregroundStyle(MemorizationTheme.color(.mastered))
                    .accessibilityIdentifier("memo-milestone")
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(.thickMaterial, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Color.primary.opacity(0.12), lineWidth: 0.5))
        .padding(.horizontal, 16)
        .shadow(color: .black.opacity(0.12), radius: 8, y: 2)
        .onTapGesture(perform: dismiss)
    }

    private var message: String {
        let count = MemorizationTheme.number(state.changed, language: language)
        return language == .arabic ? "تم تحديث \(count) آية" : "Updated \(count) ayat"
    }
}

enum MilestoneText {
    static func describe(_ milestone: Milestone, language: AppLanguage, surahName: (Int) -> String? = { _ in nil }) -> String {
        switch (milestone, language) {
        case let (.surahCompleted(n), .arabic): "أتممت حفظ سورة \(surahName(n) ?? MemorizationTheme.number(n, language: .arabic))"
        case let (.surahCompleted(n), .english): "You completed surah \(surahName(n) ?? String(n))"
        case let (.juzCompleted(n), .arabic): "أتممت حفظ الجزء \(MemorizationTheme.number(n, language: .arabic))"
        case let (.juzCompleted(n), .english): "You completed juz \(n)"
        case let (.percent(p), .arabic): "أتممت \(MemorizationTheme.number(p, language: .arabic))٪ من القرآن"
        case let (.percent(p), .english): "You reached \(p)% of the Quran"
        case (.quranCompleted, .arabic): "أتممت حفظ القرآن الكريم"
        case (.quranCompleted, .english): "You completed memorizing the Quran"
        }
    }
}


/// Shows the undo toast over any screen for a few seconds, undoes the batch on request and plays a soft
/// haptic only when the update reached a milestone.
private struct MemorizationToastModifier: ViewModifier {
    @Binding var toast: ToastState?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let store: MemorizationStore
    let library: MushafLibrary
    let language: AppLanguage
    let bottomPadding: CGFloat
    let undoFailed: () -> Void

    func body(content: Content) -> some View {
        content
            .overlay(alignment: .bottom) {
                if let toast {
                    UndoToast(state: toast, language: language, surahName: { library.surahNames[$0] }, undo: undo,
                              dismiss: { self.toast = nil })
                        .padding(.bottom, bottomPadding)
                        .transition(reduceMotion ? .opacity : .move(edge: .bottom).combined(with: .opacity))
                }
            }
            .animation(.easeInOut(duration: 0.2), value: toast?.id)
            .task(id: toast?.id) {
                guard let current = toast else { return }
                if !current.milestones.isEmpty { UINotificationFeedbackGenerator().notificationOccurred(.success) }
                try? await Task.sleep(for: .seconds(8))
                if toast?.id == current.id { toast = nil }
            }
    }

    private func undo() {
        guard let current = toast else { return }
        do {
            try store.undo(batchID: current.batchID)
            toast = nil
        } catch {
            toast = nil
            undoFailed()
        }
    }
}

extension View {
    func memorizationToast(_ toast: Binding<ToastState?>, store: MemorizationStore, library: MushafLibrary,
                           language: AppLanguage, bottomPadding: CGFloat = 74, undoFailed: @escaping () -> Void = {}) -> some View {
        modifier(MemorizationToastModifier(toast: toast, store: store, library: library, language: language,
                                           bottomPadding: bottomPadding, undoFailed: undoFailed))
    }
}


/// The same toast for hosts (the reader) whose store may not exist: nothing is added without one.
struct OptionalMemorizationToast: ViewModifier {
    @Binding var toast: ToastState?
    let library: MushafLibrary
    let language: AppLanguage
    var bottomPadding: CGFloat = 56

    @ViewBuilder
    func body(content: Content) -> some View {
        if let store = library.memorizationStore {
            content.memorizationToast($toast, store: store, library: library, language: language, bottomPadding: bottomPadding)
        } else {
            content
        }
    }
}
