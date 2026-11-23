#if DEBUG
import MushafCore
import SwiftUI

/// The start screen: how far the review has come, where to continue, and a way to any page or surah.
struct ReviewHomeView: View {
    let store: ReviewStore
    let library: ReviewHost
    let openPage: (Int) -> Void
    let close: () -> Void
    @State private var confirmingClose = false
    @AppStorage("review:last-page:v1") private var lastPage = 1
    @State private var jumpText = ""

    private var totals: (total: Int, reviewed: Int, unreviewed: Int, flagged: Int)? {
        guard let pages = store.overview?.pages else { return nil }
        return pages.reduce((0, 0, 0, 0)) { ($0.0 + $1.total, $0.1 + $1.reviewed, $0.2 + $1.unreviewed, $0.3 + $1.flagged) }
    }

    var body: some View {
        List {
            Section("تقدّم المراجعة") {
                if let totals {
                    VStack(alignment: .leading, spacing: 8) {
                        ProgressView(value: Double(totals.reviewed), total: Double(max(totals.total, 1)))
                            .tint(.green)
                        HStack {
                            Label("\(totals.reviewed) معتمد", systemImage: "checkmark.circle.fill").foregroundStyle(.green)
                            Spacer()
                            Label("\(totals.unreviewed) بانتظار الاعتماد", systemImage: "circle.dashed").foregroundStyle(.orange)
                            Spacer()
                            Label("\(totals.flagged) معلَّم", systemImage: "flag.fill").foregroundStyle(.red)
                        }
                        .font(.footnote)
                    }
                    .padding(.vertical, 4)
                    .accessibilityElement(children: .combine)
                    .accessibilityIdentifier("review-home-progress")
                } else {
                    HStack { ProgressView(); Text("جارٍ تحميل التقدّم…").foregroundStyle(.secondary) }
                }
            }

            Section("ابدأ") {
                Button { openPage(lastPage) } label: {
                    Label("متابعة من الصفحة \(lastPage)", systemImage: "play.circle.fill")
                }
                .accessibilityIdentifier("review-continue")
                Button {
                    if let page = store.nextPageNeedingReview() { openPage(page) }
                } label: { Label("أول صفحة بها وجه غير مراجَع", systemImage: "circle.dashed") }
                    .disabled(store.nextPageNeedingReview() == nil)
                    .accessibilityIdentifier("review-next-unreviewed-page")
                Button {
                    if let page = store.nextFlaggedPage() { openPage(page) }
                } label: { Label("أول صفحة بها وجه معلَّم", systemImage: "flag") }
                    .disabled(store.nextFlaggedPage() == nil)
            }

            Section("الانتقال إلى صفحة") {
                HStack {
                    TextField("رقم الصفحة (١–٦٠٤)", text: $jumpText)
                        .keyboardType(.numberPad)
                        .accessibilityIdentifier("review-jump-field")
                    Button("فتح") { if let n = Int(jumpText), (1...mushafPageCount).contains(n) { openPage(n) } }
                        .buttonStyle(.borderedProminent)
                        .disabled(Int(jumpText).map { !(1...mushafPageCount).contains($0) } ?? true)
                        .accessibilityIdentifier("review-jump-button")
                }
            }

            Section("السور") {
                ForEach(library.surahs) { surah in
                    Button { openPage(surah.firstPage) } label: {
                        HStack {
                            Text("\(surah.number)").font(.footnote.monospacedDigit()).foregroundStyle(.secondary).frame(width: 34, alignment: .leading)
                            Text(surah.name)
                            Spacer()
                            Text("ص \(surah.firstPage)").font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                    .foregroundStyle(.primary)
                }
            }
        }
        .navigationTitle("محرر القراءات")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("إغلاق") { if store.hasSavesAtStake { confirmingClose = true } else { close() } }
                    .accessibilityIdentifier("review-close")
            }
            ToolbarItem(placement: .confirmationAction) {
                Text("للمطور").font(.caption2.weight(.semibold)).padding(.horizontal, 8).padding(.vertical, 3)
                    .background(.orange.opacity(0.2), in: Capsule()).foregroundStyle(.orange)
            }
        }
        .task { await store.loadOverview() }
        .confirmationDialog("ما زال في الحفظ ما لم يكتمل", isPresented: $confirmingClose, titleVisibility: .visible) {
            Button("إغلاق رغم ذلك", role: .destructive, action: close)
            Button("البقاء", role: .cancel) {}
        } message: {
            Text("الحفظ الجاري يكمل في الخلفية، لكن ما فشل لن يُعاد، ولن تُحدَّث الصفحة.")
        }
    }
}
#endif
