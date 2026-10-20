#if DEBUG
import MushafCore
import SwiftUI

/// «هذه الصفحة: معتمد X من Y · كل المصحف: …» under the page, from the page stats and the overview.
struct ReviewStatsBar: View {
    let store: ReviewStore

    private func line(_ title: String, reviewed: Int, total: Int) -> some View {
        let percent = total == 0 ? 0 : Int((Double(reviewed) / Double(total) * 100).rounded())
        return VStack(alignment: .leading, spacing: 3) {
            HStack {
                Text(title).font(.caption.weight(.semibold))
                Spacer()
                Text("معتمد \(reviewed) من \(total) · متبقٍ \(total - reviewed) · \(percent)٪").font(.caption).foregroundStyle(.secondary)
            }
            ProgressView(value: Double(reviewed), total: Double(max(total, 1))).tint(.green)
        }
    }

    var body: some View {
        VStack(spacing: 8) {
            if let stats = store.page?.stats { line("هذه الصفحة", reviewed: stats.reviewed, total: stats.total) }
            if let pages = store.overview?.pages {
                line("كل المصحف", reviewed: pages.reduce(0) { $0 + $1.reviewed }, total: pages.reduce(0) { $0 + $1.total })
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("review-stats-bar")
    }
}

/// The save progress: «جارٍ الحفظ (N)», «✓ تم الحفظ», or a failure with «إعادة المحاولة».
struct ReviewSaveStatusBar: View {
    let store: ReviewStore

    private static let time: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "HH:mm:ss"
        return f
    }()

    var body: some View {
        VStack(spacing: 6) {
            ForEach(store.failures) { failure in
                HStack(spacing: 10) {
                    Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.red)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("تعذّر: \(failure.label)").font(.footnote.weight(.semibold))
                        Text(failure.message).font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button("إعادة المحاولة") { store.retry(failure) }.buttonStyle(.borderedProminent).controlSize(.small)
                    Button { store.dismiss(failure) } label: { Image(systemName: "xmark") }.accessibilityLabel("إخفاء")
                }
                .padding(10)
                .background(.red.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
            }
            switch store.saveStatus {
            case .saving(let n):
                Label("جارٍ الحفظ… (\(n))", systemImage: "arrow.triangle.2.circlepath").font(.footnote).foregroundStyle(.secondary)
                    .accessibilityIdentifier("review-save-status")
            case .saved(let date):
                Label("تم الحفظ في قاعدة البيانات · \(Self.time.string(from: date))", systemImage: "checkmark.circle.fill")
                    .font(.footnote).foregroundStyle(.green).accessibilityIdentifier("review-save-status")
            case .idle, .failed:
                EmptyView()
            }
            if let notice = store.notice {
                Text(notice).font(.footnote).foregroundStyle(.orange)
            }
        }
        .padding(.horizontal, 16)
        .animation(.default, value: store.failures)
    }
}
#endif
