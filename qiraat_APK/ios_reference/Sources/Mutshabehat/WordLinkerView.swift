import SwiftUI

public struct WordLinkerView: View {
    @Environment(\.dismiss) private var dismiss
    public let verses: [PersonalVerse]
    public let onApply: ([PersonalVerse]) -> Void

    public struct LinkerWord: Identifiable, Equatable {
        public let id = UUID()
        public var text: String
        public var type: String
    }

    @State private var wordsByVerse: [[LinkerWord]] = []
    @State private var activeType: String = "shared"

    private let availableTypes: [MutshabehatPartStyle] = [
        .shared, .difference, .difference2, .difference3, .addition, .unique
    ]

    public init(verses: [PersonalVerse], onApply: @escaping ([PersonalVerse]) -> Void) {
        self.verses = verses
        self.onApply = onApply
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Brush Palette
                VStack(alignment: .leading, spacing: 6) {
                    Text("اختر نوع التلوين ثم اضغط على الكلمات لتلوينها:")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 16)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            // "عادي" brush
                            Button {
                                activeType = "normal"
                            } label: {
                                Text("عادي")
                                    .font(.caption.bold())
                                    .foregroundStyle(activeType == "normal" ? Color.primary : Color.secondary)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(
                                        RoundedRectangle(cornerRadius: 8)
                                            .fill(activeType == "normal" ? Color(uiColor: .tertiarySystemFill) : Color.clear)
                                    )
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(activeType == "normal" ? Color.primary : Color.clear, lineWidth: 1.5)
                                    )
                            }
                            .buttonStyle(.plain)

                            ForEach(availableTypes, id: \.self) { style in
                                let rawKey = rawKey(for: style)
                                let isSelected = activeType == rawKey
                                Button {
                                    activeType = rawKey
                                } label: {
                                    HStack(spacing: 4) {
                                        Circle()
                                            .fill(Color(uiColor: style.foreground))
                                            .frame(width: 8, height: 8)
                                        Text(style.title)
                                            .font(.caption.bold())
                                    }
                                    .foregroundStyle(Color(uiColor: style.foreground))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(
                                        RoundedRectangle(cornerRadius: 8)
                                            .fill(Color(uiColor: style.background))
                                    )
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(isSelected ? Color(uiColor: style.foreground) : Color.clear, lineWidth: 2)
                                    )
                                    .scaleEffect(isSelected ? 1.05 : 1.0)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                    }
                    .background(Color(uiColor: .secondarySystemBackground).opacity(0.6))
                }
                .padding(.top, 8)

                Divider()

                // Verses Words Area
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        ForEach(Array(wordsByVerse.enumerated()), id: \.offset) { vIndex, words in
                            let verse = vIndex < verses.count ? verses[vIndex] : nil
                            VStack(alignment: .leading, spacing: 10) {
                                HStack {
                                    Text("\(vIndex + 1). \(verse?.surah ?? "") — آية \(verse?.ayah ?? 1)")
                                        .font(.caption.bold())
                                        .foregroundStyle(Color.accentColor)
                                    Spacer()
                                    Button("إعادة تعيين") {
                                        resetVerse(vIndex)
                                    }
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                                }

                                // Interactive Flow of Words
                                FlowLayout(spacing: 6) {
                                    ForEach(Array(words.enumerated()), id: \.element.id) { wIndex, w in
                                        let style = MutshabehatPartStyle(rawType: w.type)
                                        Button {
                                            paintWord(verseIndex: vIndex, wordIndex: wIndex)
                                        } label: {
                                            Text(w.text)
                                                .font(.custom("KFGQPCUthmanicScriptHAFS", size: 21, relativeTo: .body))
                                                .foregroundStyle(style != nil ? Color(uiColor: style!.foreground) : Color.primary)
                                                .padding(.horizontal, 6)
                                                .padding(.vertical, 3)
                                                .background(style != nil ? Color(uiColor: style!.background) : Color.clear)
                                                .clipShape(RoundedRectangle(cornerRadius: 6))
                                                .overlay(
                                                    RoundedRectangle(cornerRadius: 6)
                                                        .stroke(Color.secondary.opacity(0.2), lineWidth: 0.8)
                                                )
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                                .environment(\.layoutDirection, .rightToLeft)
                                .frame(maxWidth: .infinity, alignment: .trailing)
                            }
                            .padding(14)
                            .background(Color(uiColor: .secondarySystemBackground).opacity(0.85), in: RoundedRectangle(cornerRadius: 12))
                        }
                    }
                    .padding(16)
                }
            }
            .navigationTitle("ربط الكلمات")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("إلغاء") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("تطبيق") {
                        applyChanges()
                        dismiss()
                    }
                    .font(.body.bold())
                }
            }
            .onAppear {
                expandWords()
            }
        }
    }

    private func expandWords() {
        wordsByVerse = verses.map { verse in
            var out: [LinkerWord] = []
            for part in verse.parts {
                let tokens = part.text.split(whereSeparator: \.isWhitespace).map(String.init)
                for token in tokens {
                    out.append(LinkerWord(text: token, type: part.type))
                }
            }
            return out
        }
    }

    private func paintWord(verseIndex: Int, wordIndex: Int) {
        guard verseIndex < wordsByVerse.count, wordIndex < wordsByVerse[verseIndex].count else { return }
        wordsByVerse[verseIndex][wordIndex].type = activeType
    }

    private func resetVerse(_ verseIndex: Int) {
        guard verseIndex < wordsByVerse.count else { return }
        for i in 0..<wordsByVerse[verseIndex].count {
            wordsByVerse[verseIndex][i].type = "normal"
        }
    }

    private func applyChanges() {
        var updatedVerses: [PersonalVerse] = []
        for (vIndex, verse) in verses.enumerated() {
            let words = vIndex < wordsByVerse.count ? wordsByVerse[vIndex] : []
            var parts: [PersonalPart] = []
            for w in words {
                if let last = parts.last, last.type == w.type {
                    parts[parts.count - 1] = PersonalPart(
                        id: last.id,
                        type: last.type,
                        text: (last.text + " " + w.text).trimmingCharacters(in: .whitespaces),
                        sortOrder: last.sortOrder
                    )
                } else {
                    parts.append(PersonalPart(id: UUID().uuidString, type: w.type, text: w.text, sortOrder: parts.count))
                }
            }
            var v = verse
            v.parts = parts
            updatedVerses.append(v)
        }
        onApply(updatedVerses)
    }

    private func rawKey(for style: MutshabehatPartStyle) -> String {
        switch style {
        case .shared: return "shared"
        case .difference: return "diff"
        case .difference2: return "diff2"
        case .difference3: return "diff3"
        case .addition: return "addition"
        case .unique: return "unique"
        case .blank: return "blank"
        }
    }
}
