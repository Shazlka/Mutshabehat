#if DEBUG
import MushafCore
import SwiftUI

/// Step 3 — edit the face. (The full editor — فرش/أصول, أبواب, readers, وصل/وقف — arrives with the next task;
/// for now it shows the draft that references and existing faces fill in.)
struct EditStepView: View {
    let store: ReviewStore

    var body: some View {
        List {
            if let draft = store.session?.draft {
                Section("المسودة") {
                    LabeledContent("النوع", value: draft.kind == .usul ? "أصول القراءات" : "فرش الحروف")
                    if let code = draft.categoryCode { LabeledContent("الباب", value: code) }
                    if !draft.readingText.isEmpty { Text(draft.readingText).font(.custom("KFGQPCUthmanicScriptHAFS", size: 24)) }
                    NarratorChipsView(items: NarratorDisplay.describe(draft.narrators.map {
                        NarratorRef(id: $0.id, nameAr: CanonicalReaders.narratorName($0.id) ?? $0.id)
                    }))
                }
            } else {
                Section { Text("اختر وجهًا من «الأوجه» أو ابدأ وجهًا جديدًا.").foregroundStyle(.secondary) }
            }
        }
        .listStyle(.insetGrouped)
        .accessibilityIdentifier("review-edit-step")
    }
}
#endif
