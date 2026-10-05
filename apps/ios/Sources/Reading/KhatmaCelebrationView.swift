import MushafCore
import SwiftUI

struct KhatmaCelebrationView: View {
    let completedKhatma: KhatmaRecord?
    let onStartNewKhatma: () -> Void
    let onViewStatistics: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            Color(uiColor: .systemGroupedBackground)
                .ignoresSafeArea()

            VStack(spacing: 24) {
                Spacer()

                // Traditional illuminated Islamic crest
                VStack(spacing: 12) {
                    Image(systemName: "book.pages.fill")
                        .font(.system(size: 64))
                        .foregroundColor(Color.accentColor)

                    Text("الْحَمْدُ لِلَّهِ")
                        .font(.system(size: 32, weight: .bold))
                        .foregroundColor(.primary)

                    Text("تَمَّتْ خَتْمَةُ الْقُرْآنِ الْكَرِيمِ بِحَمْدِ اللَّهِ وَتَوْفِيقِهِ")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundColor(Color(red: 0.60, green: 0.48, blue: 0.20))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 24)
                }

                if let khatma = completedKhatma {
                    VStack(spacing: 14) {
                        Text("الختمة رقم \(khatma.khatmaNumber)")
                            .font(.headline)
                            .foregroundColor(.primary)

                        Divider()

                        HStack {
                            DetailItem(title: "تاريخ البدء", value: formatDate(khatma.startedAt))
                            Spacer()
                            DetailItem(title: "تاريخ الختم", value: formatDate(khatma.completedAt ?? Date()))
                            Spacer()
                            DetailItem(title: "المدة", value: "\(khatma.durationInDays) يوماً")
                        }
                    }
                    .padding(20)
                    .background(Color(uiColor: .secondarySystemGroupedBackground))
                    .cornerRadius(16)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color(red: 0.60, green: 0.48, blue: 0.20).opacity(0.3), lineWidth: 1)
                    )
                    .padding(.horizontal, 24)
                }

                Spacer()

                // Actions
                VStack(spacing: 12) {
                    Button {
                        onStartNewKhatma()
                        dismiss()
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "arrow.clockwise")
                            Text("بدء ختمة جديدة")
                        }
                        .font(.headline.bold())
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Color.accentColor)
                        .cornerRadius(14)
                    }

                    Button {
                        dismiss()
                        onViewStatistics()
                    } label: {
                        Text("عرض الإحصائيات")
                            .font(.subheadline.bold())
                            .foregroundColor(.primary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(Color(uiColor: .secondarySystemGroupedBackground))
                            .cornerRadius(14)
                    }
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 20)
            }
        }
    }

    private func formatDate(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.locale = Locale(identifier: "ar")
        return f.string(from: date)
    }
}

private struct DetailItem: View {
    let title: String
    let value: String

    var body: some View {
        VStack(spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
            Text(value)
                .font(.system(size: 14, weight: .bold))
                .foregroundColor(.primary)
        }
    }
}
