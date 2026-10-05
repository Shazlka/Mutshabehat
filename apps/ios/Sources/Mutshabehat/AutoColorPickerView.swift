import SwiftUI

public struct AutoColorPickerView: View {
    @Environment(\.dismiss) private var dismiss
    public let verses: [PersonalVerse]
    public let onApply: (Int, Int, [PersonalPart], [PersonalPart]) -> Void

    @State private var indexA: Int = 0
    @State private var indexB: Int = 1
    @State private var previewPartsA: [PersonalPart] = []
    @State private var previewPartsB: [PersonalPart] = []

    public init(verses: [PersonalVerse], onApply: @escaping (Int, Int, [PersonalPart], [PersonalPart]) -> Void) {
        self.verses = verses
        self.onApply = onApply
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("التلوين التلقائي للفروقات")
                            .font(.headline.bold())
                        Text("يقارن آيتين كلمةً كلمة ويعيّن أنواع الفروقات (مشترك، اختلاف، زيادة، فريد) تلقائياً.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 4)

                    // Verse Pickers
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("الآية الأولى (المرجع)")
                                .font(.caption.bold())
                                .foregroundStyle(.secondary)
                            Picker("الآية الأولى", selection: $indexA) {
                                ForEach(Array(verses.enumerated()), id: \.offset) { i, v in
                                    Text("\(i + 1). \(v.surah.isEmpty ? "آية" : v.surah) — \(v.ayah)")
                                        .tag(i)
                                }
                            }
                            .pickerStyle(.menu)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(8)
                            .background(Color(uiColor: .secondarySystemBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }

                        VStack(alignment: .leading, spacing: 6) {
                            Text("الآية الثانية (المقارنة)")
                                .font(.caption.bold())
                                .foregroundStyle(.secondary)
                            Picker("الآية الثانية", selection: $indexB) {
                                ForEach(Array(verses.enumerated()), id: \.offset) { i, v in
                                    Text("\(i + 1). \(v.surah.isEmpty ? "آية" : v.surah) — \(v.ayah)")
                                        .tag(i)
                                }
                            }
                            .pickerStyle(.menu)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(8)
                            .background(Color(uiColor: .secondarySystemBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    }

                    if indexA == indexB {
                        Text("يرجى اختيار آيتين مختلفتين للمقارنة")
                            .font(.caption.bold())
                            .foregroundStyle(.orange)
                            .padding(10)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .background(Color.orange.opacity(0.12))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    } else {
                        // Live Previews
                        VStack(alignment: .leading, spacing: 14) {
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Text("معاينة الآية \(indexA + 1)")
                                        .font(.caption.bold())
                                        .foregroundStyle(.secondary)
                                    if indexA < verses.count {
                                        Text("(\(verses[indexA].surah) : \(verses[indexA].ayah))")
                                            .font(.caption2)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                ArabicDiffView(parts: previewPartsA)
                                    .padding(12)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background(Color(uiColor: .secondarySystemBackground).opacity(0.85))
                                    .clipShape(RoundedRectangle(cornerRadius: 10))
                            }

                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Text("معاينة الآية \(indexB + 1)")
                                        .font(.caption.bold())
                                        .foregroundStyle(.secondary)
                                    if indexB < verses.count {
                                        Text("(\(verses[indexB].surah) : \(verses[indexB].ayah))")
                                            .font(.caption2)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                ArabicDiffView(parts: previewPartsB)
                                    .padding(12)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background(Color(uiColor: .secondarySystemBackground).opacity(0.85))
                                    .clipShape(RoundedRectangle(cornerRadius: 10))
                            }
                        }
                    }

                    Text("ملاحظة: سيتم استبدال الأجزاء الحالية للآيتين بنتيجة المقارنة.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .padding(16)
            }
            .navigationTitle("تلوين تلقائي")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("إلغاء") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("تطبيق التلوين") {
                        if indexA != indexB && !previewPartsA.isEmpty && !previewPartsB.isEmpty {
                            onApply(indexA, indexB, previewPartsA, previewPartsB)
                            dismiss()
                        }
                    }
                    .font(.body.bold())
                    .disabled(indexA == indexB || previewPartsA.isEmpty || previewPartsB.isEmpty)
                }
            }
            .onAppear {
                if verses.count > 1 {
                    indexA = 0
                    indexB = 1
                    updatePreview()
                }
            }
            .onChange(of: indexA) { updatePreview() }
            .onChange(of: indexB) { updatePreview() }
        }
    }

    private func updatePreview() {
        guard indexA < verses.count, indexB < verses.count, indexA != indexB else {
            previewPartsA = []
            previewPartsB = []
            return
        }

        let textA = textOfVerse(verses[indexA])
        let textB = textOfVerse(verses[indexB])
        guard !textA.isEmpty, !textB.isEmpty else {
            previewPartsA = []
            previewPartsB = []
            return
        }

        let result = ArabicDiffAlgorithm.autoColorPair(textA: textA, textB: textB)
        previewPartsA = result.partsA
        previewPartsB = result.partsB
    }

    private func textOfVerse(_ verse: PersonalVerse) -> String {
        verse.parts.map(\.text).joined(separator: " ").trimmingCharacters(in: .whitespaces)
    }
}
